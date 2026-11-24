// Run in Node 20; reads only files of the repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const jsonVersion = (file) => JSON.parse(read(file)).version;

// Back, front, lockfiles e a versão na tela seguem o arquivo VERSION na raiz.
test('VERSION, back, front, lockfiles and the version shown on screen declare the same version', () => {
    const rawVersion = read('VERSION');
    assert.match(rawVersion, /^\d+\.\d+\.\d+\r?\n?$/);

    const version = rawVersion.trim();
    assert.equal(jsonVersion('testflow-app/package.json'), version);
    assert.equal(jsonVersion('testflow-frontend/package.json'), version);
    assert.equal(jsonVersion('testflow-app/package-lock.json'), version);
    assert.equal(jsonVersion('testflow-frontend/package-lock.json'), version);
    assert.equal(read('testflow-frontend/src/version.js').match(/APP_VERSION = "v(.+)"/)?.[1], version);
});

test('CHANGELOG.md lists Unreleased and every released version starting from VERSION', () => {
    const version = read('VERSION').trim();
    const changelog = read('CHANGELOG.md');
    const escapedVersion = version.replace(/\./g, '\\.');

    const unreleased = changelog.indexOf('## [Unreleased]');
    const current = changelog.search(new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
    const initial = changelog.search(/^## \[1\.0\.0\] - \d{4}-\d{2}-\d{2}$/m);

    assert.ok(unreleased >= 0, 'CHANGELOG.md must contain ## [Unreleased]');
    assert.ok(current > unreleased, `CHANGELOG.md must list ## [${version}] - YYYY-MM-DD after Unreleased`);
    assert.ok(initial > current, 'CHANGELOG.md must list ## [1.0.0] - YYYY-MM-DD after the current version');
});

test('docs/desenvolvimento.md documents folders, commands, check.sh targets and pipelines', () => {
    const guide = read('docs/desenvolvimento.md');

    for (const entry of [
        'testflow-app/',
        'testflow-frontend/',
        'nginx/',
        'backup/',
        'scripts/',
        'scripts/dev.sh',
        'docker compose',
        'scripts/check.sh',
        'quality',
        'build-inputs',
        'lint',
        'test',
        'test-scripts',
        'test-repository',
        'build',
        'integration',
        'secrets',
        'sast',
        'sca',
        'audit',
        'iac',
        'image-scan',
        'dast-full',
        'all',
        'develop.yml',
        'deploy-prod.yml',
    ]) {
        assert.ok(guide.includes(entry), `docs/desenvolvimento.md must mention ${entry}`);
    }
});

test('README.md explains how to start production and development concisely and links to the guide', () => {
    const readme = read('README.md');
    assert.match(readme, /docker compose up -d/);
    assert.match(readme, /sh scripts\/dev\.sh up/);
    assert.match(readme, /docs\/desenvolvimento\.md/);
    assert.match(readme, /https:\/\/github\.com\/JoaoVictor-M\/testflow\/blob\/main\/CHANGELOG\.md/);

    const devSection = readme.match(/## 🛠️ Desenvolvimento \(Para Code Maintainers\)([\s\S]*?)^---$/m);
    assert.ok(devSection, 'README.md must keep the development section delimited by --- for production packaging');
    const nonEmptyLines = devSection[1].trim().split('\n').filter((line) => line.trim() !== '');
    assert.ok(nonEmptyLines.length <= 20, `development section in README.md should stay concise (got ${nonEmptyLines.length} lines)`);
});
