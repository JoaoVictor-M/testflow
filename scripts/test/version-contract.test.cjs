// Run in Node 20; reads only files of the repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const jsonVersion = (file) => JSON.parse(read(file)).version;

// Back e front declaram a mesma versão em todos os lugares onde ela vive.
test('back, front, lockfiles and the version shown on screen declare the same version', () => {
    const version = jsonVersion('testflow-app/package.json');

    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(jsonVersion('testflow-frontend/package.json'), version);
    assert.equal(jsonVersion('testflow-app/package-lock.json'), version);
    assert.equal(jsonVersion('testflow-frontend/package-lock.json'), version);
    assert.equal(read('testflow-frontend/src/version.js').match(/APP_VERSION = "v(.+)"/)?.[1], version);
});
