const assert = require('node:assert/strict');
const { test } = require('node:test');
const { call } = require('./support/api');

// A versão que a API informa é a do package.json do back, sem exigir login.
test('GET /api/system/version devolve a versão do back em semver', async () => {
    const response = await call('get', '/api/system/version');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { version: require('../package.json').version });
    assert.match(response.body.version, /^\d+\.\d+\.\d+$/);
});
