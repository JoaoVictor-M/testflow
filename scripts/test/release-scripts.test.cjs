// Behavior tests for the release helpers and production image inspection scripts.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');

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

test('publishing signs immutable digests before latest; push/sign/inspect failures prevent promotion', (t) => {
    const f = fixture(t);
    f.install('docker', `
echo "docker $*" >> calls
case "$*" in *"\${FAIL_ON:-@never@}"*) exit 1 ;; esac
case "$*" in 'image inspect '*) [ -n "\${EMPTY_DIGEST:-}" ] || echo ghcr.io/example/testflow@sha256:abc123 ;; esac`);
    f.install('cosign', 'echo "cosign $*" >> calls\n[ -z "${SIGN_FAILURE:-}" ]');
    const envBase = { REGISTRY: 'ghcr.io', GITHUB_REPOSITORY_OWNER: 'Example', RELEASE_TAG: 'v2.3.4', GITHUB_SHA: 'commit-sha' };
    const result = f.run('sh scripts/ci/publish-prod.sh', envBase);
    assert.equal(result.status, 0, result.stderr);
    const callsPath = path.join(f.directory, 'calls');
    const calls = fs.readFileSync(callsPath, 'utf8');
    assert.equal((calls.match(/cosign sign --yes ghcr\.io\/example\/testflow@sha256:abc123/g) ?? []).length, 3);
    assert.ok(calls.lastIndexOf('cosign sign') < calls.indexOf(':latest'));
    for (const extra of [{ SIGN_FAILURE: 'yes' }, { FAIL_ON: 'push' }, { FAIL_ON: 'load' }, { FAIL_ON: 'inspect' }, { EMPTY_DIGEST: 'yes' }]) {
        fs.writeFileSync(callsPath, '');
        assert.equal(f.run('sh scripts/ci/publish-prod.sh', { ...envBase, ...extra }).status, 1);
        assert.doesNotMatch(fs.readFileSync(callsPath, 'utf8'), /:latest/);
    }
});
