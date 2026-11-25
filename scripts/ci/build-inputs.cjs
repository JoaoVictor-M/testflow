const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const digest = (value) => createHash('sha256').update(value).digest('hex');

function snapshot(directory, productionOnly = false) {
    const read = (name) => fs.readFileSync(path.join(directory, name), 'utf8');
    const manifestText = read('package.json');
    const lockText = read('package-lock.json');
    const manifest = JSON.parse(manifestText);
    const lock = JSON.parse(lockText);
    assert.equal(lock.lockfileVersion, 3, 'expected lockfile v3');
    for (const field of ['name', 'version', 'dependencies', 'devDependencies', 'optionalDependencies', 'engines']) {
        assert.deepEqual(manifest[field], lock.packages[''][field], `manifest and lock differ: ${field}`);
    }
    const installed = JSON.parse(read('node_modules/.package-lock.json')).packages;
    const packages = [];
    for (const name of Object.keys(installed).sort()) {
        assert.match(name, /^node_modules\//);
        assert.ok(!name.split('/').includes('..'), 'invalid package path');
        const expected = lock.packages[name];
        const actual = installed[name];
        assert.ok(expected, `unexpected installed package: ${name}`);
        assert.ok(!productionOnly || !expected.dev, `development package installed in production: ${name}`);
        for (const field of ['version', 'resolved', 'integrity']) {
            assert.equal(actual[field], expected[field], `locked ${field} differs: ${name}`);
        }
        assert.equal(JSON.parse(read(`${name}/package.json`)).version, expected.version, `installed version differs: ${name}`);
        packages.push({ path: name, version: expected.version, integrity: expected.integrity, dev: !!expected.dev });
    }
    for (const [name, expected] of Object.entries(lock.packages)) {
        if (!name || expected.optional || expected.devOptional || (productionOnly && expected.dev)) continue;
        assert.ok(installed[name], `missing locked package: ${name}`);
    }
    const production = packages.filter((entry) => !entry.dev);
    return {
        node: process.versions.node, npm: process.env.TESTFLOW_NPM_VERSION,
        nodeImage: process.env.TESTFLOW_NODE_IMAGE,
        platform: process.platform, arch: process.arch,
        manifestSha256: digest(manifestText), lockSha256: digest(lockText),
        npmrcSha256: fs.existsSync(path.join(directory, '.npmrc')) ? digest(read('.npmrc')) : null,
        treeSha256: digest(JSON.stringify(packages)),
        productionTreeSha256: digest(JSON.stringify(production)), packages,
    };
}

module.exports = { snapshot };
if (require.main === module) {
    process.stdout.write(`${JSON.stringify(snapshot(process.argv[2], process.argv[3] === 'production'), null, 2)}\n`);
}
