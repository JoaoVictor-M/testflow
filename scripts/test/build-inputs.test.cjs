const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { snapshot } = require('../ci/build-inputs.cjs');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-inputs-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const runtime = { version: '1.2.3', resolved: 'https://registry.npmjs.org/runtime/-/runtime-1.2.3.tgz', integrity: 'sha512-fixture' };
    const dev = { ...runtime, dev: true };
    const manifest = { name: 'fixture', version: '1.0.0', dependencies: { runtime: '^1.2.3' } };
    const packages = { '': manifest, 'node_modules/runtime': runtime, 'node_modules/dev': dev };
    const write = (name, value) => {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), JSON.stringify(value));
    };
    write('package.json', manifest);
    write('package-lock.json', { lockfileVersion: 3, packages });
    write('node_modules/.package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/runtime': runtime, 'node_modules/dev': dev } });
    write('node_modules/runtime/package.json', { version: runtime.version });
    write('node_modules/dev/package.json', { version: dev.version });
    return { root, write, packages, runtime, dev };
}

test('independent installs have identical input and tree digests without recording local paths', (t) => {
    const first = fixture(t);
    const second = fixture(t);
    const report = snapshot(first.root);
    assert.deepEqual(report, snapshot(second.root));
    assert.equal(JSON.stringify(report).includes(first.root), false);
    assert.match(report.treeSha256, /^[a-f0-9]{64}$/);
    assert.equal(report.packages.length, 2);
});

test('production install matches the runtime subset of the complete install', (t) => {
    const { root, write, runtime } = fixture(t);
    const complete = snapshot(root);
    write('node_modules/.package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/runtime': runtime } });
    fs.rmSync(path.join(root, 'node_modules/dev'), { recursive: true });
    const production = snapshot(root, true);
    assert.equal(complete.productionTreeSha256, production.treeSha256);
    assert.equal(complete.lockSha256, production.lockSha256);
    assert.throws(() => snapshot(root), /missing locked package/);
});

test('production rejects a complete installation containing both runtime and development packages', (t) => {
    const { root } = fixture(t);
    assert.equal(snapshot(root).packages.length, 2);
    assert.throws(() => snapshot(root, true), {
        name: 'AssertionError',
        message: 'development package installed in production: node_modules/dev',
    });
});

test('rejects changed installed versions, integrity, unexpected packages and missing runtime dependencies', (t) => {
    const { root, write, runtime } = fixture(t);
    write('node_modules/runtime/package.json', { version: '9.0.0' });
    assert.throws(() => snapshot(root), /installed version/);
    write('node_modules/runtime/package.json', { version: runtime.version });
    write('node_modules/.package-lock.json', { packages: { 'node_modules/runtime': { ...runtime, integrity: 'sha512-changed' } } });
    assert.throws(() => snapshot(root), /locked integrity/);
    write('node_modules/.package-lock.json', { packages: { 'node_modules/unknown': runtime } });
    assert.throws(() => snapshot(root), /unexpected installed package/);
    write('node_modules/.package-lock.json', { packages: {} });
    assert.throws(() => snapshot(root, true), /missing locked package/);
});

test('manifest divergence is rejected and optional platform packages may be absent', (t) => {
    const { root, write, packages } = fixture(t);
    write('package-lock.json', { lockfileVersion: 3, packages: { ...packages, 'node_modules/other-platform': { version: '1.0.0', optional: true } } });
    snapshot(root);
    write('package.json', { ...packages[''], dependencies: { runtime: '^2.0.0' } });
    assert.throws(() => snapshot(root), /manifest and lock/);
});
