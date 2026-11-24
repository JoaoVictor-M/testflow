const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { connectTo, dropAndDisconnect } = require('./support/database');
const { validateJwtSecret } = require('../config/jwt');

const appDir = path.resolve(__dirname, '..');
const testDbName = 'testflow-test-jwt-config';
const mongoUri = `mongodb://mongodb-service:27017/${testDbName}`;

const runNode = async (args, { env = {}, cwd = appDir, timeoutMs = 15000 } = {}) => {
    const cleanEnv = { ...process.env };
    delete cleanEnv.JWT_SECRET;
    Object.assign(cleanEnv, env);

    const child = spawn(process.execPath, args, {
        cwd,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
    }, timeoutMs);

    try {
        const [code, signal] = await once(child, 'exit');
        return { code, signal, stdout, stderr, timedOut };
    } finally {
        clearTimeout(timer);
    }
};

const runEntrypoint = (entryFile, options = {}) =>
    runNode([path.join(appDir, entryFile)], { timeoutMs: 4000, ...options });

const authFlowProbe = `
const { createRequire } = require('node:module');
const appRequire = createRequire(${JSON.stringify(path.join(appDir, 'server.js'))});
const mongoose = appRequire('mongoose');
const request = appRequire('supertest');
const { app } = appRequire('./server.js');

(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    try {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD });

        const token = login.body?.token || '';
        const protectedResp = await request(app)
            .get('/api/projects')
            .set('Authorization', 'Bearer ' + token);

        let foreignStatus = null;
        if (process.env.TEST_FOREIGN_TOKEN) {
            const foreignResp = await request(app)
                .get('/api/projects')
                .set('Authorization', 'Bearer ' + process.env.TEST_FOREIGN_TOKEN);
            foreignStatus = foreignResp.status;
        }

        // Mutar process.env após inicialização não pode desviar a configuração validada.
        process.env.JWT_SECRET = 'mutado-em-execucao-nao-deve-afetar-configuracao-inicial';
        const afterMutationResp = await request(app)
            .get('/api/projects')
            .set('Authorization', 'Bearer ' + token);

        process.stdout.write(JSON.stringify({
            loginStatus: login.status,
            token,
            protectedStatus: protectedResp.status,
            foreignStatus,
            afterMutationStatus: afterMutationResp.status,
        }) + '\\n');
    } finally {
        await mongoose.disconnect();
    }
})().catch((err) => {
    process.stderr.write(String(err.stack || err) + '\\n');
    process.exit(1);
});
`;

describe('Configuração de JWT no startup', () => {
    test('validateJwtSecret aceita segredo com 32+ bytes e rejeita inválidos sem expor o valor', () => {
        const valid = randomBytes(32).toString('hex');
        assert.equal(validateJwtSecret(valid), valid);

        const shortSecret = `segredo-curto-${randomBytes(4).toString('hex')}`;
        for (const invalid of [undefined, null, '', '   ', shortSecret, `      ${shortSecret}      `]) {
            assert.throws(
                () => validateJwtSecret(invalid),
                (error) => {
                    assert.equal(error.code, 'JWT_CONFIG_INVALID');
                    assert.equal(error.message.includes(shortSecret), false);
                    return true;
                }
            );
        }
    });

    test('server.js falha ao iniciar quando JWT_SECRET está ausente, sem vazar valores', { timeout: 15000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-missing-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const result = await runEntrypoint('server.js', { cwd: tempDir });

        assert.notEqual(result.code, 0, 'startup deve falhar sem JWT_SECRET');
        assert.equal(result.signal, null);
        const entries = result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
        assert.ok(entries.some((entry) => entry.level === 'error' && entry.code === 'JWT_CONFIG_INVALID'));
    });

    test('server.js falha ao iniciar com JWT_SECRET vazio ou curto e nunca registra o valor fornecido', { timeout: 15000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-short-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const shortSecret = `curto-${randomBytes(6).toString('hex')}`;
        const paddedShort = `          ${shortSecret}          `;

        for (const invalidSecret of ['', '   ', shortSecret, paddedShort]) {
            const result = await runEntrypoint('server.js', {
                cwd: tempDir,
                env: { JWT_SECRET: invalidSecret },
            });

            assert.notEqual(result.code, 0, 'startup deve rejeitar segredo inválido');
            const combinedOutput = `${result.stdout}\n${result.stderr}`;
            assert.equal(combinedOutput.includes(shortSecret), false, 'o valor do segredo não pode aparecer nos logs');
            const entries = result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
            assert.ok(entries.some((entry) => entry.level === 'error' && entry.code === 'JWT_CONFIG_INVALID'));
        }
    });

    test('index.js (cluster primary) falha imediatamente sem abrir loop de workers nem vazar o segredo', { timeout: 15000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-cluster-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const shortSecret = `cluster-${randomBytes(6).toString('hex')}`;
        const result = await runEntrypoint('index.js', {
            cwd: tempDir,
            env: { JWT_SECRET: shortSecret },
        });

        assert.notEqual(result.code, 0, 'index.js deve falhar antes de criar workers');
        assert.equal(`${result.stdout}\n${result.stderr}`.includes(shortSecret), false);
        const entries = result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
        assert.ok(entries.some((entry) => entry.level === 'error' && entry.code === 'JWT_CONFIG_INVALID'));
        assert.equal(entries.some((entry) => entry.msg === 'Processo mestre rodando'), false);
    });

    test('importar server.js sem JWT_SECRET válido lança erro sem expor valor; authMiddleware não mascara como 403', { timeout: 15000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-require-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const shortSecret = `req-${randomBytes(6).toString('hex')}`;
        const serverCheck = await runNode([
            '-e',
            `try { require(${JSON.stringify(path.join(appDir, 'server.js'))}); process.exit(2); } catch (e) { process.stdout.write(JSON.stringify({ code: e.code, msg: e.message })); }`,
        ], { cwd: tempDir, env: { JWT_SECRET: shortSecret } });

        assert.equal(serverCheck.code, 0);
        const parsed = JSON.parse(serverCheck.stdout);
        assert.equal(parsed.code, 'JWT_CONFIG_INVALID');
        assert.equal(parsed.msg.includes(shortSecret), false);

        const middlewareCheck = await runNode([
            '-e',
            `const auth = require(${JSON.stringify(path.join(appDir, 'middleware/authMiddleware.js'))});
             let status = null;
             try {
               auth({ headers: { authorization: 'Bearer qualquer.token.aqui' } }, { status(s) { status = s; return { json() {} }; } }, () => {});
               process.exit(2);
             } catch (e) {
               process.stdout.write(JSON.stringify({ code: e.code, status }));
             }`,
        ], { cwd: tempDir, env: { JWT_SECRET: shortSecret } });

        assert.equal(middlewareCheck.code, 0);
        assert.deepEqual(JSON.parse(middlewareCheck.stdout), { code: 'JWT_CONFIG_INVALID', status: null });
    });
});

describe('Emissão e verificação com configuração única de JWT', () => {
    const username = 'jwt.config.user';
    const password = randomBytes(24).toString('hex');
    let user;

    before(async () => {
        await connectTo(testDbName);
        user = await User.create({
            name: 'Usuário JWT Config',
            username,
            email: 'jwt.config@example.test',
            password,
            role: 'analyst',
        });
    });

    after(dropAndDisconnect);

    test('com segredo apenas no .env, login e authMiddleware compartilham a mesma chave', { timeout: 20000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-dotenv-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const dotenvSecret = randomBytes(32).toString('hex');
        fs.writeFileSync(path.join(tempDir, '.env'), `JWT_SECRET=${dotenvSecret}\n`, { mode: 0o600 });

        const result = await runNode(['-e', authFlowProbe], {
            cwd: tempDir,
            env: {
                TEST_MONGO_URI: mongoUri,
                TEST_USERNAME: username,
                TEST_PASSWORD: password,
                SMTP_HOST: '',
            },
        });

        assert.equal(result.code, 0, `probe falhou: ${result.stderr}`);
        assert.equal(`${result.stdout}\n${result.stderr}`.includes(dotenvSecret), false, 'segredo não pode vazar em log');

        const lines = result.stdout.trim().split('\n');
        const payload = JSON.parse(lines.at(-1));
        assert.equal(payload.loginStatus, 200);
        assert.equal(payload.protectedStatus, 200, 'token emitido no login deve ser aceito pelo authMiddleware');
        assert.equal(payload.afterMutationStatus, 200, 'configuração inicial permanece única após inicialização');

        const claims = jwt.verify(payload.token, dotenvSecret, { algorithms: ['HS256'] });
        assert.equal(claims.username, username);
        assert.equal(claims.role, 'analyst');
    });

    test('com ambiente externo, este prevalece sobre .env e rejeita token assinado com segredo anterior (rotação)', { timeout: 20000 }, async (t) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-jwt-env-'));
        t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

        const previousSecret = randomBytes(32).toString('hex');
        const rotatedSecret = randomBytes(32).toString('hex');
        fs.writeFileSync(path.join(tempDir, '.env'), `JWT_SECRET=${previousSecret}\n`, { mode: 0o600 });

        const previousToken = jwt.sign(
            { userId: user._id, username: user.username, name: user.name, role: user.role },
            previousSecret,
            { expiresIn: '8h', algorithm: 'HS256' }
        );

        const result = await runNode(['-e', authFlowProbe], {
            cwd: tempDir,
            env: {
                JWT_SECRET: rotatedSecret,
                TEST_MONGO_URI: mongoUri,
                TEST_USERNAME: username,
                TEST_PASSWORD: password,
                TEST_FOREIGN_TOKEN: previousToken,
                SMTP_HOST: '',
            },
        });

        assert.equal(result.code, 0, `probe falhou: ${result.stderr}`);
        assert.equal(`${result.stdout}\n${result.stderr}`.includes(rotatedSecret), false);
        assert.equal(`${result.stdout}\n${result.stderr}`.includes(previousSecret), false);

        const lines = result.stdout.trim().split('\n');
        const payload = JSON.parse(lines.at(-1));
        assert.equal(payload.loginStatus, 200);
        assert.equal(payload.protectedStatus, 200);
        assert.equal(payload.foreignStatus, 403, 'token emitido com segredo anterior deve ser rejeitado após rotação');

        const claims = jwt.verify(payload.token, rotatedSecret, { algorithms: ['HS256'] });
        assert.equal(claims.username, username);
    });
});
