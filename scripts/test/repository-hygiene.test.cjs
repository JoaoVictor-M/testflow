// Behavior tests for Git ignore rules, CI secret generation and version synchronization.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-hygiene-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
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
        'reports/scan.json', 'prod-images.tar', '.testflow-docs', '.testflow-docs/tarefas/example.md',
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
});

test('scripts/ci/stack.sh creates a fresh 0600 JWT secret and masks it only on GitHub Actions', (t) => {
    const stack = read('scripts/ci/stack.sh');
    const run = `${stack}\nexport TESTFLOW_CI_ENV="$PWD/backend.env"\nprepare_ci_stack\n`;
    const directory = temporaryDirectory(t);
    const secrets = [];
    for (let i = 0; i < 2; i += 1) {
        const output = execFileSync('sh', ['-eu', '-c', run], {
            cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' },
        });
        const envPath = path.join(directory, 'backend.env');
        const lines = fs.readFileSync(envPath, 'utf8').trim().split('\n');
        assert.equal(lines[0], 'MONGO_URI=mongodb://mongodb-service:27017/testflow-db');
        assert.match(lines[1], /^JWT_SECRET=[a-f0-9]{64}$/);
        assert.equal(lines[2], 'PORT=3000');
        const secret = lines[1].slice('JWT_SECRET='.length);
        assert.equal(output.trim(), `::add-mask::${secret}`);
        assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
        secrets.push(secret);
    }
    assert.notEqual(secrets[0], secrets[1]);

    const localEnv = { ...process.env };
    delete localEnv.GITHUB_ACTIONS;
    assert.equal(execFileSync('sh', ['-eu', '-c', run], { cwd: directory, encoding: 'utf8', env: localEnv }), '');
});

test('VERSION, packages, locks, frontend version and CHANGELOG stay in sync', () => {
    const version = read('VERSION').trim();
    assert.match(version, /^\d+\.\d+\.\d+$/);
    for (const file of ['testflow-app/package.json', 'testflow-frontend/package.json', 'testflow-app/package-lock.json', 'testflow-frontend/package-lock.json']) {
        assert.equal(JSON.parse(read(file)).version, version, file);
    }
    assert.equal(read('testflow-frontend/src/version.js').match(/APP_VERSION = "v(.+)"/)?.[1], version);
    const notes = execFileSync('sh', ['scripts/ci/release-notes.sh', version], { cwd: root, encoding: 'utf8' });
    assert.ok(notes.trim().length > 0);
});
