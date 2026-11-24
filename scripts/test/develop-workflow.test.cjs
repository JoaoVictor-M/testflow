const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const os = require('node:os');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const develop = read('.github/workflows/develop.yml');

test('develop replaces the old workflow and is reusable with bounded, cancellable jobs', () => {
    assert.equal(fs.existsSync(path.join(root, '.github/workflows/security.yml')), false);
    assert.match(develop, /push:\n    branches: \[develop\]/);
    assert.match(develop, /  workflow_dispatch:/);
    assert.match(develop, /  workflow_call:/);
    assert.match(develop, /permissions:\n  contents: read/);
    assert.match(develop, /group: \$\{\{ github.workflow }}-develop-\$\{\{ github.ref }}/);
    assert.match(develop, /cancel-in-progress: true/);
    assert.match(develop, /fail-fast: false/);
    for (const job of develop.split('\njobs:\n')[1].split(/^  [a-z-]+:\n/gm).slice(1)) {
        assert.match(job, /timeout-minutes: \d+/);
        assert.match(job, /persist-credentials: false/);
    }
    assert.doesNotMatch(develop, /continue-on-error|allow-failure|issues: write|checks: write|ACTIONS_ALLOW_USE_UNSECURE/);
});

test('all develop checks use check.sh and preserve the mandatory integration and existing security gates', () => {
    assert.match(develop, /target: \[quality, sast, sca, iac, audit\]/);
    assert.match(develop, /CHECK_TARGET: \$\{\{ matrix.target }}/);
    const commands = [...develop.matchAll(/^\s+(?:- )?run: (.+)$/gm)].map((match) => match[1]);
    assert.deepEqual(commands, [
        'scripts/check.sh "$CHECK_TARGET"', 'scripts/check.sh secrets',
        'scripts/check.sh integration', 'scripts/check.sh e2e', 'scripts/check.sh dast',
        'scripts/check.sh image-scan', 'scripts/check.sh dast-full',
    ]);
    assert.match(develop, /  secrets:[\s\S]*fetch-depth: 0/);
    for (const job of ['integration', 'e2e', 'dast', 'dynamic']) {
        assert.match(develop, new RegExp(`  ${job}:\\n    needs: \\[static, secrets\\]`));
    }
    assert.doesNotMatch(develop, /if:.*(?:integration|hashFiles)|\|\| true/);
    assert.match(develop, /if: always\(\)[\s\S]*path: reports\//);
    assert.match(read('scripts/check.sh'), /--severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1/);
    assert.match(read('scripts/ci-dast.sh'), /zap-full-scan.py/);
    assert.match(read('scripts/ci-dast.sh'), /^ZAP_IMAGE=ghcr.io\/zaproxy\/zaproxy:[\w.]+@sha256:[a-f0-9]{64}$/m);
});

test('actions have full SHA pins and no workflow interpolates expressions into shell scripts', () => {
    for (const name of fs.readdirSync(path.join(root, '.github/workflows')).filter((file) => /\.ya?ml$/.test(file))) {
        const content = read(`.github/workflows/${name}`);
        for (const action of content.matchAll(/^\s+(?:- )?uses: (.+)$/gm)) {
            assert.match(action[1], /^[\w./-]+@[a-f0-9]{40} # [\w.]+$/, `${name}: ${action[1]}`);
        }
        const lines = content.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
            const run = lines[index].match(/^(\s+)(?:- )?run: (.*)$/);
            if (!run) continue;
            let script = run[2];
            while (index + 1 < lines.length && (lines[index + 1].trim() === '' ||
                lines[index + 1].match(/^\s*/)[0].length > run[1].length)) {
                script += `\n${lines[++index]}`;
            }
            assert.equal(script.includes('${{'), false, `${name} interpolates a shell script`);
        }
    }
});

test('matrix values are passed as a single literal shell argument', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-workflow-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.writeFileSync(path.join(directory, 'scripts/check.sh'), '#!/bin/sh\nprintf "%s\\n" "$#" "$@"\n', { mode: 0o700 });
    const target = 'quality; touch injected';
    const command = develop.match(/run: (scripts\/check.sh "\$CHECK_TARGET")/)[1];
    const output = execFileSync('sh', ['-eu', '-c', command], {
        cwd: directory, encoding: 'utf8', env: { ...process.env, CHECK_TARGET: target },
    });
    assert.equal(output, `1\n${target}\n`);
    assert.equal(fs.existsSync(path.join(directory, 'injected')), false);
});

// Directories (relative to the root, with a leading slash) that hold a file named Dockerfile.
function dockerfileDirectories(directory, found = []) {
    const skipped = new Set(['.git', 'node_modules', '.cache', 'reports']);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && !skipped.has(entry.name)) dockerfileDirectories(path.join(directory, entry.name), found);
        const relative = `/${path.relative(root, directory)}`;
        if (entry.isFile() && /dockerfile/i.test(entry.name) && !found.includes(relative)) found.push(relative);
    }
    return found;
}

test('Dependabot updates the lockfiles, actions, Dockerfiles and Compose images against develop', () => {
    const config = read('.github/dependabot.yml');
    const updates = config.split('  - package-ecosystem: ').slice(1);
    assert.equal(updates.length, 6);
    for (const update of updates) {
        assert.match(update, /target-branch: develop/);
        assert.match(update, /interval: weekly/);
        assert.match(update, /cooldown:\n      default-days: 7/);
    }
    for (const directory of ['/testflow-app', '/testflow-frontend', '/e2e']) {
        assert.ok(updates.some((update) => update.startsWith('npm\n') && update.includes(`directory: ${directory}\n`)));
    }
    assert.ok(updates.some((update) => update.startsWith('github-actions\n')));
    const docker = updates.find((update) => update.startsWith('docker\n'));
    const dockerDirectories = docker.match(/directories:\n((?: {6}- .+\n)+)/)[1].match(/\/\S*/g);
    assert.deepEqual([...dockerDirectories].sort(), dockerfileDirectories(root).sort());
    assert.ok(updates.some((update) => update.startsWith('docker-compose\n') && update.includes('directory: /\n')));
});

test('DAST uses an isolated stack with no persistent volumes, published ports or local secrets', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-ci-compose-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const envFile = path.join(directory, 'backend.env');
    fs.writeFileSync(envFile, 'JWT_SECRET=fixture\nMONGO_URI=mongodb://mongodb-service:27017/testflow\n');
    try {
        const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'docker-compose.ci.yml', 'config', '--format', 'json'], {
            cwd: root, encoding: 'utf8', env: { ...process.env, TESTFLOW_CI_ENV: envFile },
        }));
        assert.deepEqual(Object.keys(config.services).sort(), ['backend-service', 'mongodb-service']);
        for (const service of Object.values(config.services)) {
            assert.equal(service.ports, undefined);
            assert.equal(service.volumes, undefined);
            assert.equal(service.container_name, undefined);
        }
        assert.equal(config.services['backend-service'].build.target, 'prod');
        assert.match(config.services['mongodb-service'].image, /@sha256:[a-f0-9]{64}$/);
    } finally {
        fs.rmSync(envFile);
    }
});

const composeFiles = ['-f', 'docker-compose.ci.yml', '-f', 'docker-compose.e2e.yml'];

function renderBrowserStack(directory) {
    const envFile = path.join(directory, 'backend.env');
    fs.writeFileSync(envFile, 'JWT_SECRET=fixture\nMONGO_URI=mongodb://mongodb-service:27017/testflow\n');
    return JSON.parse(execFileSync('docker', ['compose', ...composeFiles, 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, TESTFLOW_CI_ENV: envFile, TESTFLOW_CI_TLS: directory },
    }));
}

test('the browser stack serves the production images over HTTPS with nothing published or persistent', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-web-compose-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const { services } = renderBrowserStack(directory);

    assert.deepEqual(Object.keys(services).sort(), ['backend-service', 'frontend-service', 'mongodb-service', 'nginx-service']);
    for (const service of Object.values(services)) {
        assert.equal(service.ports, undefined);
        assert.equal(service.container_name, undefined);
        for (const volume of service.volumes ?? []) {
            assert.equal(volume.type, 'bind');
            assert.equal(volume.read_only, true);
        }
    }
    assert.equal(services['frontend-service'].build.target, 'prod');
    assert.equal(services['nginx-service'].environment.FRONTEND_URL, 'https://nginx-service:8443');
    assert.equal(services['backend-service'].environment.FRONTEND_URL, 'https://nginx-service:8443');
    assert.deepEqual(services['nginx-service'].volumes.map((volume) => volume.target), ['/etc/nginx/ssl']);
    assert.deepEqual(services['mongodb-service'].volumes.map((volume) => volume.target),
        ['/docker-entrypoint-initdb.d/mongo-init.js']);
    assert.match(services['mongodb-service'].image, /@sha256:[a-f0-9]{64}$/);
});

test('the backend of the browser stack uses the database the first-administrator seed writes to', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-web-compose-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const { services } = renderBrowserStack(directory);
    const seed = read('install/mongo-init.js').match(/getSiblingDB\('([^']+)'\)/)[1];

    assert.equal(services['backend-service'].environment.MONGO_URI, `mongodb://mongodb-service:27017/${seed}`);
});

test('the Playwright image matches the locked test runner and the images are pinned by digest', () => {
    const lock = JSON.parse(read('e2e/package-lock.json'));
    const runner = lock.packages['node_modules/@playwright/test'].version;
    const image = read('scripts/ci-e2e.sh').match(/^PLAYWRIGHT_IMAGE=(\S+)$/m)[1];

    assert.match(image, new RegExp(`^mcr\\.microsoft\\.com/playwright:v${runner.replaceAll('.', '\\.')}-[a-z]+@sha256:[a-f0-9]{64}$`));
    assert.equal(JSON.parse(read('e2e/package.json')).devDependencies['@playwright/test'], runner);
    assert.match(read('scripts/ci-dast-baseline.sh'), /^ZAP_IMAGE=ghcr.io\/zaproxy\/zaproxy:[\w.]+@sha256:[a-f0-9]{64}$/m);
});

test('the e2e run writes no file report and the pipeline publishes none', () => {
    const config = read('e2e/playwright.config.js');
    const reporters = config.match(/reporter: (\[\[.*?]]),/)[1];

    assert.equal(reporters, "[['list']]");
    assert.match(config, /trace: 'off'[\s\S]*video: 'off'[\s\S]*screenshot: 'off'/);
    assert.doesNotMatch(config, /reports\//);
    assert.doesNotMatch(develop, /name: e2e\n|path: reports\/e2e/);
});

test('the DAST baseline plan fails on Medium or higher and filters only single rules, with a reason', () => {
    const plan = read('.zap/baseline.yaml');
    const exitStatus = plan.split('- type: exitStatus')[1];

    assert.match(exitStatus, /errorLevel: Medium\n/);
    assert.doesNotMatch(exitStatus, /errorLevel: (?:High|Informational)/);
    assert.match(plan, /failOnError: true/);
    const filters = [...plan.matchAll(/^\s+- ruleId: (.*)$/gm)].map((match) => match[1]);
    for (const filter of filters) assert.match(filter, /^\d+-\d+ +# \S.+$/, `filter needs an alertRef and a reason: ${filter}`);
    assert.equal([...plan.matchAll(/newRisk: False Positive/g)].length, filters.length);
    assert.doesNotMatch(plan, /alertFilters:\s*\n\s+- ruleId: ["']?\d+["']?\s*\n/);
    assert.doesNotMatch(plan, /excludePaths|urlRegex/);
});

test('the CSP that nginx sends has no inline or eval allowance, no wildcard and covers the directives without fallback', () => {
    const policy = read('nginx/nginx-ssl.conf.template').match(/add_header Content-Security-Policy "([^"]+)"/)[1];
    const directives = Object.fromEntries(policy.split(';').map((part) => part.trim()).filter(Boolean)
        .map((part) => [part.split(' ')[0], part.split(' ').slice(1)]));

    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
    assert.deepEqual(directives['connect-src'], ["'self'"]);
    // The only style allowance besides 'self' is the hash of empty content (SHA-256 of nothing).
    assert.deepEqual(directives['style-src'], ["'self'", `'sha256-${createHash('sha256').update('').digest('base64')}'`]);
    assert.deepEqual(directives['script-src'], ["'self'"]);
    assert.deepEqual(directives['default-src'], ["'none'"]);
    for (const directive of ['base-uri', 'form-action', 'frame-ancestors']) assert.ok(directives[directive], directive);
    // These two belong to the evidence preview and are not tightened here.
    assert.deepEqual(directives['frame-src'], ["'none'"]);
    assert.deepEqual(directives['media-src'], ["'self'"]);
});

test('the page shell has no inline script, so the CSP needs no allowance for one', () => {
    const scripts = [...read('testflow-frontend/index.html').matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

    assert.ok(scripts.length > 0);
    for (const script of scripts) assert.match(script, /\bsrc="/);
    assert.match(read('testflow-frontend/public/theme-init.js'), /classList\.add\('dark'\)/);
});
