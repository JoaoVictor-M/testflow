// Run in Node 20 with Git, OpenSSL and the Docker Compose CLI; no Docker socket is needed.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-hygiene-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function workflowScript(content, name) {
    if (content.startsWith('#!/bin/sh')) {
        const functionName = name === 'Create .env for testing' ? 'prepare_ci_stack' : 'start_ci_stack';
        return `${content}\nexport TESTFLOW_CI_ENV="$PWD/testflow-app/.env"\nexport TESTFLOW_CI_PROJECT=testflow-ci-fixture\n${functionName}\n`;
    }
    const step = content.split(`      - name: ${name}\n        run: |\n`)[1];
    assert.ok(step, `workflow must include ${name}`);
    return step.split(/\n(?=      - name:)/)[0].replace(/^          /gm, '');
}

test('Git ignores secrets and local artifacts while allowing public configuration and source', (t) => {
    const directory = temporaryDirectory(t);
    execFileSync('git', ['init', '--quiet', directory]);
    for (const component of ['', 'testflow-app', 'testflow-frontend']) {
        fs.mkdirSync(path.join(directory, component), { recursive: true });
        fs.copyFileSync(path.join(root, component, '.gitignore'), path.join(directory, component, '.gitignore'));
    }

    const localPaths = [
        '.env', '.env.local', '.env.production', '.env.development', '.env.example.local',
        'private.pem', 'private.key', 'certificate.crt', 'certificate.p12', 'certificate.pfx',
        'secrets/config.json', 'backups/snapshot', 'database.dump', 'database.sql.gz',
        '.claude/state', '.codex/state', '.agents/state', '.maestri/state', '.serena/state',
        '.cache/state', '.idea/state', '.vscode/settings.json', '.DS_Store', 'Thumbs.db',
        'coverage/index.html', 'playwright-report/index.html', 'test-results/result.json',
        'scan.sarif', 'dist/index.js', 'build/index.js', 'node_modules/package/index.js',
        'cache.tsbuildinfo', '.data/database', 'uploads/file', 'evidencias_testes/file',
        'certificados/file', 'age-identity.txt', 'testflow-20260101T000000Z.tar.age',
    ];
    const ignored = [
        ...['', 'testflow-app/', 'testflow-frontend/'].flatMap((prefix) =>
            localPaths.filter((name) => prefix !== 'testflow-frontend/' || name !== '.env.development')
                .map((name) => prefix + name)),
        'reports/scan.json', '.testflow-docs', '.testflow-docs/tarefas/example.md',
        'Cenarios_de_Teste_TestFlow.md',
    ];
    const allowed = [
        '.env.example', 'testflow-app/.env.example', 'testflow-frontend/.env.example',
        'testflow-frontend/.env.development', 'testflow-app/server.js',
        'testflow-frontend/src/App.jsx', '.github/workflows/develop.yml',
        'scripts/test/repository-hygiene.test.cjs',
    ];
    const matches = execFileSync('git', ['-c', 'core.excludesFile=/dev/null', 'check-ignore', '--no-index', '-z', '--stdin'], {
        cwd: directory, input: [...ignored, ...allowed].join('\0') + '\0', encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    }).split('\0').filter(Boolean);
    assert.deepEqual(matches, ignored);

    const publicEnvironment = fs.readFileSync(path.join(root, 'testflow-frontend/.env.development'), 'utf8');
    assert.match(publicEnvironment.trim(), /^VITE_API_URL=https?:\/\/[^\s]+$/);
});

for (const workflow of ['scripts/lib/ci-stack.sh', '.github/workflows/deploy-prod.yml']) {
    test(`${workflow} creates a fresh, masked JWT secret in a private environment file`, (t) => {
        const content = fs.readFileSync(path.join(root, workflow), 'utf8');
        const script = workflowScript(content, 'Create .env for testing');
        const directory = temporaryDirectory(t);
        fs.mkdirSync(path.join(directory, 'testflow-app'));
        const secrets = [];
        for (let run = 0; run < 2; run += 1) {
            const output = execFileSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
                cwd: directory, encoding: 'utf8',
            });
            const envPath = path.join(directory, 'testflow-app/.env');
            const lines = fs.readFileSync(envPath, 'utf8').trim().split('\n');
            assert.equal(lines.length, 3);
            assert.equal(lines[0], 'MONGO_URI=mongodb://mongodb-service:27017/testflow');
            assert.equal(lines[2], 'PORT=3000');
            assert.match(lines[1], /^JWT_SECRET=[a-f0-9]{64}$/);
            const secret = lines[1].slice('JWT_SECRET='.length);
            assert.equal(output.trim(), `::add-mask::${secret}`);
            assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
            secrets.push(secret);
        }
        assert.notEqual(secrets[0], secrets[1]);
    });

    test(`${workflow} passes the generated JWT and database URI to the Compose backend`, (t) => {
        const content = fs.readFileSync(path.join(root, workflow), 'utf8');
        const directory = temporaryDirectory(t);
        fs.mkdirSync(path.join(directory, 'testflow-app'));
        fs.copyFileSync(path.join(root, 'docker-compose.yml'), path.join(directory, 'docker-compose.yml'));
        fs.copyFileSync(path.join(root, 'docker-compose.ci.yml'), path.join(directory, 'docker-compose.ci.yml'));
        execFileSync('bash', ['-e', '-c', workflowScript(content, 'Create .env for testing')], {
            cwd: directory, stdio: 'pipe',
        });
        const secret = fs.readFileSync(path.join(directory, 'testflow-app/.env'), 'utf8')
            .match(/^JWT_SECRET=(.+)$/m)[1];

        // Execute the real workflow script, recording its Docker command without starting services.
        const bin = path.join(directory, 'bin');
        fs.mkdirSync(bin);
        const argumentsFile = path.join(directory, 'compose-arguments');
        fs.writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nprintf \'%s\\0\' "$@" > "$TESTFLOW_DOCKER_ARGUMENTS"\n', { mode: 0o700 });
        execFileSync('bash', ['-e', '-c', workflowScript(content, 'Build and Start Application')], {
            cwd: directory,
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TESTFLOW_DOCKER_ARGUMENTS: argumentsFile },
        });
        const args = fs.readFileSync(argumentsFile, 'utf8').split('\0').filter(Boolean);
        assert.equal(args[0], 'compose');
        const upIndex = args.indexOf('up');
        assert.deepEqual(args.slice(upIndex, upIndex + 3), ['up', '-d', '--build']);
        const configuration = JSON.parse(execFileSync('docker', [...args.slice(0, upIndex), 'config', '--format', 'json'], {
            cwd: directory, encoding: 'utf8',
            env: { ...process.env, FRONTEND_URL: 'https://frontend.example.test/testflow', TESTFLOW_CI_ENV: path.join(directory, 'testflow-app/.env') },
        }));
        const environment = configuration.services['backend-service'].environment;
        assert.equal(environment.JWT_SECRET, secret);
        assert.equal(environment.MONGO_URI, 'mongodb://mongodb-service:27017/testflow');
        assert.equal(environment.PORT, '3000');
        assert.equal(environment.FRONTEND_URL, 'https://frontend.example.test/testflow');
    });
}

test('production workflow readiness failure logs the Compose service and still fails if logs fail', (t) => {
    const directory = temporaryDirectory(t);
    const bin = path.join(directory, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'timeout'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    fs.writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$@" > docker-arguments\nexit 1\n', { mode: 0o700 });
    const content = fs.readFileSync(path.join(root, '.github/workflows/deploy-prod.yml'), 'utf8');
    assert.throws(() => execFileSync('bash', ['-e', '-c', workflowScript(content, 'Wait for Application to be Ready')], {
        cwd: directory, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, stdio: 'pipe',
    }), { status: 1 });
    assert.deepEqual(fs.readFileSync(path.join(directory, 'docker-arguments'), 'utf8').trim().split('\n'), [
        'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.ci.yml', 'logs', 'backend-service',
    ]);
});
