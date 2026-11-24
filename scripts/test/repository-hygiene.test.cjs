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
        'certificados/file',
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
        'testflow-frontend/src/App.jsx', '.github/workflows/security.yml',
        'scripts/test/repository-hygiene.test.cjs',
    ];
    const matches = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
        cwd: directory, input: [...ignored, ...allowed].join('\0') + '\0', encoding: 'utf8',
    }).split('\0').filter(Boolean);
    assert.deepEqual(matches, ignored);

    const publicEnvironment = fs.readFileSync(path.join(root, 'testflow-frontend/.env.development'), 'utf8');
    assert.match(publicEnvironment.trim(), /^VITE_API_URL=https?:\/\/[^\s]+$/);
});

for (const workflow of ['security.yml', 'deploy-prod.yml']) {
    test(`${workflow} creates a fresh, masked JWT secret in a private environment file`, (t) => {
        const content = fs.readFileSync(path.join(root, '.github/workflows', workflow), 'utf8');
        const step = content.match(/      - name: Create \.env for testing\r?\n        run: \|\r?\n((?:          [^\n]*\r?\n|\r?\n)+)/);
        assert.ok(step, 'workflow must prepare the test environment');
        const script = step[1].replace(/^          /gm, '');
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
}
