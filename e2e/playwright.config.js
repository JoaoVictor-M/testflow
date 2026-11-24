const os = require('os');
const path = require('path');
const { defineConfig } = require('@playwright/test');

// scripts/ci-e2e.sh starts the stack and passes its address and the seeded administrator.
for (const name of ['TESTFLOW_E2E_URL', 'TESTFLOW_E2E_USER', 'TESTFLOW_E2E_PASSWORD']) {
    if (!process.env[name]) throw new Error(`${name} is required; run scripts/check.sh e2e`);
}

module.exports = defineConfig({
    testDir: './tests',
    // The tests create data in one shared database, so they run one at a time.
    workers: 1,
    retries: 0,
    // Only the console: a file report (HTML, JSON) embeds the steps with the values the tests type.
    reporter: [['list']],
    outputDir: path.join(os.tmpdir(), 'testflow-e2e-results'),
    use: {
        baseURL: process.env.TESTFLOW_E2E_URL,
        // The stack serves a self-signed certificate created for each run.
        ignoreHTTPSErrors: true,
        // The tests type the administrator's password and send its token: no trace, video or screenshot,
        // because nothing of the run is published.
        trace: 'off',
        video: 'off',
        screenshot: 'off',
    },
});
