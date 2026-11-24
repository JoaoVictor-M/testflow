// Execute release helpers with isolated fake services; never publish a test release.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const workflow = read('.github/workflows/release.yml');
const job = (name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z-]+:\n/)[0];

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-release-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'bin'));
    fs.mkdirSync(path.join(directory, 'scripts/ci'), { recursive: true });
    for (const file of fs.readdirSync(path.join(root, 'scripts/ci'))) {
        fs.copyFileSync(path.join(root, 'scripts/ci', file), path.join(directory, 'scripts/ci', file));
    }
    fs.writeFileSync(path.join(directory, 'VERSION'), '2.3.4\n');
    const install = (name, script) => fs.writeFileSync(path.join(directory, 'bin', name), `#!/bin/sh\n${script}\n`, { mode: 0o700 });
    const run = (script, env = {}) => spawnSync('sh', ['-eu', '-c', script], {
        cwd: directory, encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}/bin:${process.env.PATH}`, GITHUB_REPOSITORY: 'example/testflow', ...env },
    });
    return { directory, install, run };
}

test('release uses main, safe dry-run, all checks, clean archived images and least privilege', () => {
    assert.equal(fs.existsSync(path.join(root, '.github/workflows/deploy-prod.yml')), false);
    assert.match(workflow, /push:\n    branches: \[main\]/);
    assert.match(workflow, /dry_run:[\s\S]*type: boolean\n        default: true/);
    assert.match(workflow, /group: release\n  cancel-in-progress: false/);
    assert.match(job('checks'), /needs: validate\n    uses: \.\/\.github\/workflows\/develop.yml/);
    assert.match(job('dast-full'), /needs: checks[\s\S]*scripts\/check.sh dast-full/);
    assert.match(job('build-prod'), /needs: \[checks, dast-full\][\s\S]*scripts\/check.sh build-prod/);
    assert.match(job('build-prod'), /docker save -o prod-images.tar testflow-backend:prod testflow-frontend:prod testflow-nginx:prod/);
    assert.match(job('scan-prod'), /needs: build-prod[\s\S]*name: prod-images[\s\S]*scripts\/check.sh scan-prod/);
    assert.match(job('scan-prod'), /name: sbom[\s\S]*if-no-files-found: error/);
    for (const name of ['publish', 'release', 'update-prod-repo']) {
        assert.match(job(name), /if: github.ref == 'refs\/heads\/main' && \(github.event_name == 'push' \|\| \(github.event_name == 'workflow_dispatch' && !inputs.dry_run\)\)/);
        assert.doesNotMatch(job(name), /docker build|continue-on-error|always\(\)/);
    }
    assert.match(job('publish'), /needs: \[validate, scan-prod\][\s\S]*id-token: write/);
    assert.match(job('publish'), /password: \$\{\{ secrets.GHCR_PAT }}/);
    assert.match(job('release'), /needs: \[validate, publish\][\s\S]*contents: write/);
    assert.match(job('release'), /gh release create "\$RELEASE_TAG" --target "\$GITHUB_SHA"[\s\S]*sbom\/\*.spdx.json/);
    assert.match(job('update-prod-repo'), /needs: \[validate, release\][\s\S]*secrets.PROD_REPO_TOKEN/);
    assert.match(job('update-prod-repo'), /testflow-backend:\$\{RELEASE_TAG}/);
    assert.doesNotMatch(workflow, /continue-on-error|ignore-unfixed|ACTIONS_ALLOW_USE_UNSECURE|secrets: inherit|JWT_SECRET/);
});

test('release DAST gives precedence to the runtime synthetic JWT_SECRET and never sets a default', (t) => {
    const ciStack = read('scripts/lib/ci-stack.sh');
    assert.match(read('scripts/ci-dast.sh'), /\. scripts\/lib\/ci-stack\.sh[\s\S]*open_ci_stack/);
    assert.match(ciStack, /jwt_secret="\$\(openssl rand -hex 32\)"[\s\S]*mask_secret "\$jwt_secret"[\s\S]*"JWT_SECRET=\$jwt_secret"[\s\S]*> "\$TESTFLOW_CI_ENV"/);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-release-jwt-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const synthetic = 'a'.repeat(64);
    const envFile = path.join(directory, 'backend.env');
    fs.writeFileSync(envFile, `MONGO_URI=mongodb://mongodb-service:27017/testflow\nJWT_SECRET=${synthetic}\nPORT=3000\n`);

    const dastConfig = JSON.parse(execFileSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.ci.yml', 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, TESTFLOW_CI_ENV: envFile, JWT_SECRET: 'caller-secret-must-not-override' },
    }));
    assert.equal(dastConfig.services['backend-service'].environment.JWT_SECRET, synthetic);

    const e2eConfig = JSON.parse(execFileSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.ci.yml', '-f', 'docker-compose.e2e.yml', 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, TESTFLOW_CI_ENV: envFile, TESTFLOW_CI_TLS: directory, JWT_SECRET: 'caller-secret-must-not-override' },
    }));
    assert.equal(e2eConfig.services['backend-service'].environment.JWT_SECRET, synthetic);

    const withoutSecretFile = path.join(directory, 'no-secret.env');
    fs.writeFileSync(withoutSecretFile, 'MONGO_URI=mongodb://mongodb-service:27017/testflow\nPORT=3000\n');
    const noDefaultConfig = JSON.parse(execFileSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.ci.yml', 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, TESTFLOW_CI_ENV: withoutSecretFile, JWT_SECRET: 'caller-secret-must-not-leak' },
    }));
    assert.equal(noDefaultConfig.services['backend-service'].environment.JWT_SECRET, undefined);
});

test('existing tags or releases and API failures refuse publication, while a fresh version passes', (t) => {
    const f = fixture(t);
    f.install('gh', `
case "$*" in
  *tags*) printf '%s\\n' "\${EXISTING_TAG:-v0.0.1}" ;;
  *releases*) printf '%s\\n' "\${EXISTING_RELEASE:-v0.0.2}" ;;
  *) exit 9 ;;
esac
[ -z "\${API_FAILURE:-}" ]`);
    assert.equal(f.run('sh scripts/ci/refuse-released-version.sh').status, 0);
    for (const env of [{ EXISTING_TAG: 'v2.3.4' }, { EXISTING_RELEASE: 'v2.3.4' }, { API_FAILURE: 'yes' }]) {
        assert.notEqual(f.run('sh scripts/ci/refuse-released-version.sh', env).status, 0);
    }
    for (const version of ['2.3', 'v2.3.4', '02.3.4', '2.3.4\n2.3.4', '2.3.4; echo bad', '2.3.4-rc1']) {
        fs.writeFileSync(path.join(f.directory, 'VERSION'), version);
        assert.notEqual(f.run('sh scripts/ci/release-version.sh').status, 0, version);
    }
});

test('release notes select only the requested version and refuse missing or empty notes', (t) => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.directory, 'CHANGELOG.md'), '# Changes\n## [Unreleased]\nfuture\n## [2.3.4] - 2026-01-01\n\n### Added\n- shipped\n## [2.3.3] - 2025-01-01\nolder\n');
    const result = f.run('sh scripts/ci/release-notes.sh 2.3.4');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /shipped/);
    assert.doesNotMatch(result.stdout, /future|older/);
    assert.equal(f.run('sh scripts/ci/release-notes.sh 9.9.9').status, 1);
    fs.writeFileSync(path.join(f.directory, 'CHANGELOG.md'), '## [2.3.4] - 2026-01-01\n \n');
    assert.equal(f.run('sh scripts/ci/release-notes.sh 2.3.4').status, 1);
});

test('production contents reject forbidden application files and clean up even on export failure', (t) => {
    const f = fixture(t);
    f.install('docker', `
printf '%s\\n' "$*" >> calls
case "$*" in
  'image inspect '*) printf '%s\\n' /app ;;
  create*) echo testflow-inspection ;;
  export*) [ -z "\${EXPORT_FAILURE:-}" ] || exit 1; cp image.tar "$3" ;;
esac`);
    const tarRoot = path.join(f.directory, 'tar-root');
    const archive = (name) => {
        fs.rmSync(tarRoot, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(path.join(tarRoot, name)), { recursive: true });
        fs.writeFileSync(path.join(tarRoot, name), 'fixture');
        execFileSync('tar', ['-cf', path.join(f.directory, 'image.tar'), '-C', tarRoot, name]);
    };
    for (const allowed of ['app/index.js', 'etc/ssl/cert.pem', 'app/node_modules/library/index.js.map']) {
        archive(allowed);
        assert.equal(f.run('sh scripts/ci/check-prod-image.sh testflow-backend:prod').status, 0, allowed);
    }
    for (const forbidden of ['app/test/data.js', 'app/foo.test.js', 'app/seed.js', 'app/server.js.map', 'app/private.key', 'app/.env', 'app/node_modules/vitest/package.json', 'app/.git/config']) {
        archive(forbidden);
        assert.equal(f.run('sh scripts/ci/check-prod-image.sh testflow-backend:prod').status, 1, forbidden);
        assert.deepEqual(fs.readdirSync(path.join(f.directory, '.cache')), []);
    }
    assert.equal(f.run('sh scripts/ci/check-prod-image.sh testflow-backend:prod', { EXPORT_FAILURE: 'yes' }).status, 1);
    assert.match(fs.readFileSync(path.join(f.directory, 'calls'), 'utf8'), /rm testflow-inspection/);
    assert.deepEqual(fs.readdirSync(path.join(f.directory, '.cache')), []);
});

test('production build is clean for all images and stops on a failed build or contents check', (t) => {
    const f = fixture(t);
    f.install('docker', `
echo "$*" >> calls
case "$*" in *"\${FAIL_ON:-@never@}"*) exit 1 ;; esac
case "$*" in
  'image inspect '*) echo /app ;;
  create*) echo testflow-inspection ;;
  export*) cp image.tar "$3" ;;
esac`);
    fs.writeFileSync(path.join(f.directory, 'index.js'), 'fixture');
    execFileSync('tar', ['-cf', path.join(f.directory, 'image.tar'), '-C', f.directory, 'index.js']);
    assert.equal(f.run('sh scripts/ci/build-prod.sh').status, 0);
    const calls = fs.readFileSync(path.join(f.directory, 'calls'), 'utf8');
    for (const [name, context] of [['backend', 'testflow-app'], ['frontend', 'testflow-frontend'], ['nginx', 'nginx']]) {
        assert.ok(calls.includes(`build --pull --no-cache -t testflow-${name}:prod ${context}`));
    }
    assert.equal(f.run('sh scripts/ci/build-prod.sh', { FAIL_ON: '--no-cache' }).status, 1);
    assert.equal(f.run('sh scripts/ci/build-prod.sh', { FAIL_ON: 'export' }).status, 1);
});

test('Trivy scans and emits an SPDX SBOM for each loaded image and propagates failures', (t) => {
    const f = fixture(t);
    f.install('docker', `
echo "$*" >> calls
case "$*" in *"\${FAIL_ON:-@never@}"*) exit 1 ;; esac`);
    const result = f.run('sh scripts/ci/scan-prod.sh', { TRIVY_IMAGE: 'trivy-fixture' });
    assert.equal(result.status, 0, result.stderr);
    const calls = fs.readFileSync(path.join(f.directory, 'calls'), 'utf8');
    assert.match(calls, /^load -i prod-images.tar/m);
    for (const name of ['backend', 'frontend', 'nginx']) assert.ok(calls.includes(`/reports/testflow-${name}.spdx.json`));
    assert.equal((calls.match(/--severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1/g) ?? []).length, 3);
    assert.doesNotMatch(calls, /docker.sock|ignore-unfixed/);
    for (const failure of ['load', 'save', '--exit-code', '--format spdx-json']) {
        assert.equal(f.run('sh scripts/ci/scan-prod.sh', { TRIVY_IMAGE: 'trivy-fixture', FAIL_ON: failure }).status, 1);
        assert.deepEqual(fs.readdirSync(path.join(f.directory, '.cache')), ['trivy']);
    }
});

test('publishing signs immutable digests before latest; push/sign failures prevent promotion', (t) => {
    const f = fixture(t);
    f.install('docker', `
echo "docker $*" >> calls
case "$*" in *"\${FAIL_ON:-@never@}"*) exit 1 ;; esac
case "$*" in 'image inspect '*) echo ghcr.io/example/testflow@sha256:abc123 ;; esac`);
    f.install('cosign', 'echo "cosign $*" >> calls\n[ -z "${SIGN_FAILURE:-}" ]');
    const script = job('publish').split('      - name: Push and sign the scanned images, then promote latest\n        run: |\n')[1]
        .trimEnd().replace(/^          /gm, '');
    const run = (env = {}) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
        cwd: f.directory, encoding: 'utf8', env: {
            ...process.env, PATH: `${f.directory}/bin:${process.env.PATH}`, REGISTRY: 'ghcr.io',
            GITHUB_REPOSITORY_OWNER: 'Example', RELEASE_TAG: 'v2.3.4', GITHUB_SHA: 'commit-sha', ...env,
        },
    });
    assert.equal(run().status, 0);
    const callsPath = path.join(f.directory, 'calls');
    const calls = fs.readFileSync(callsPath, 'utf8');
    assert.equal((calls.match(/cosign sign --yes ghcr.io\/example\/testflow@sha256:abc123/g) ?? []).length, 3);
    assert.ok(calls.lastIndexOf('cosign sign') < calls.indexOf(':latest'));
    for (const env of [{ SIGN_FAILURE: 'yes' }, { FAIL_ON: 'push' }, { FAIL_ON: 'load' }]) {
        fs.writeFileSync(callsPath, '');
        assert.equal(run(env).status, 1);
        assert.doesNotMatch(fs.readFileSync(callsPath, 'utf8'), /:latest/);
    }
});
