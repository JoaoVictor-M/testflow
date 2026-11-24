const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const { createHash, randomBytes } = require('node:crypto');

// Configura segredo e limites enxutos antes de carregar o servidor.
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.RECOVERY_RATE_LIMIT_WINDOW_MS = '60000';
process.env.RECOVERY_FORGOT_IDENTITY_MAX = '2';
process.env.RECOVERY_FORGOT_IP_MAX = '4';
process.env.RECOVERY_RESET_IP_MAX = '4';
process.env.RECOVERY_RESET_TOKEN_MAX = '2';

const request = require('supertest');
const User = require('../models/User');
const RateLimitBucket = require('../models/RateLimitBucket');
const { app } = require('../server');
const { createRateLimiter, getClientIp, getRecoveryRateLimitConfig } = require('../middleware/recoveryRateLimit');
const { connectTo, dropAndDisconnect } = require('./support/database');

const GENERIC_RECOVERY_MESSAGE = 'Se os dados estiverem corretos, um email de recuperação será enviado.';

describe('recuperação e redefinição de senha', () => {
    const initialPassword = `Init@${randomBytes(8).toString('hex')}1`;
    let existingUser;

    before(async () => {
        await connectTo('testflow-test-auth-recovery');
        existingUser = await User.create({
            name: 'Maria Recuperacao',
            username: 'maria.recuperacao',
            email: 'maria.recuperacao@example.test',
            password: initialPassword,
            role: 'analyst'
        });
    });

    beforeEach(async () => {
        await RateLimitBucket.deleteMany({});
        await User.updateOne(
            { _id: existingUser._id },
            { $set: { resetPasswordToken: null, resetPasswordExpires: null } }
        );
    });

    after(dropAndDisconnect);

    describe('POST /api/auth/forgot-password', () => {
        test('devolve o mesmo status e corpo para conta existente, usuário inexistente e email divergente', async () => {
            const known = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'maria.recuperacao', email: 'maria.recuperacao@example.test' });
            const unknownUser = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'usuario.inexistente', email: 'ninguem@example.test' });
            const wrongEmail = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'maria.recuperacao', email: 'outro.email@example.test' });

            assert.equal(known.status, 200);
            assert.equal(unknownUser.status, 200);
            assert.equal(wrongEmail.status, 200);
            assert.deepEqual(known.body, { message: GENERIC_RECOVERY_MESSAGE });
            assert.deepEqual(unknownUser.body, known.body);
            assert.deepEqual(wrongEmail.body, known.body);

            const stored = await User.findById(existingUser._id).lean();
            assert.ok(stored.resetPasswordToken);
            assert.ok(stored.resetPasswordExpires > new Date());
        });

        test('recusa entradas ausentes ou que não sejam texto antes de consultar o banco', async () => {
            const missing = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'maria.recuperacao' });
            const operatorPayload = await request(app).post('/api/auth/forgot-password')
                .send({ username: { $ne: null }, email: { $ne: null } });

            assert.equal(missing.status, 400);
            assert.equal(operatorPayload.status, 400);
            const stored = await User.findById(existingUser._id).lean();
            assert.equal(stored.resetPasswordToken, null);
        });

        test('limita por identidade sem bloquear outra identidade na mesma origem e devolve Retry-After', async () => {
            for (let i = 0; i < 2; i += 1) {
                const ok = await request(app).post('/api/auth/forgot-password')
                    .send({ username: 'alvo.repetido', email: 'alvo.repetido@example.test' });
                assert.equal(ok.status, 200);
            }

            const blocked = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'alvo.repetido', email: 'alvo.repetido@example.test' });
            assert.equal(blocked.status, 429);
            assert.ok(Number(blocked.headers['retry-after']) >= 1);
            assert.equal(typeof blocked.body.message, 'string');

            // Outro usuário atrás do mesmo IP corporativo ainda consegue solicitar recuperação.
            const colleague = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'colega.equipe', email: 'colega.equipe@example.test' });
            assert.equal(colleague.status, 200);
        });

        test('limita pulverização de contas distintas vindas da mesma origem', async () => {
            for (let i = 0; i < 4; i += 1) {
                const ok = await request(app).post('/api/auth/forgot-password')
                    .send({ username: `spray.${i}`, email: `spray.${i}@example.test` });
                assert.equal(ok.status, 200);
            }

            const blocked = await request(app).post('/api/auth/forgot-password')
                .send({ username: 'spray.5', email: 'spray.5@example.test' });
            assert.equal(blocked.status, 429);
            assert.ok(Number(blocked.headers['retry-after']) >= 1);
        });
    });

    describe('janela temporária e estado compartilhado do limitador', () => {
        test('compartilha contagem entre instâncias distintas e libera após expirar a janela', async () => {
            let currentTime = 1_700_000_000_000;
            const makeLimiter = () => createRateLimiter({
                scope: 'shared-worker-check',
                windowMs: 1000,
                now: () => currentTime,
                getBuckets: () => [{ dimension: 'identity', value: 'usuario.compartilhado', max: 2 }]
            });
            const workerA = makeLimiter();
            const workerB = makeLimiter();

            const invoke = (middleware) => new Promise((resolve) => {
                const headers = {};
                const res = {
                    statusCode: 200,
                    set(name, value) { headers[name.toLowerCase()] = value; },
                    status(code) { this.statusCode = code; return this; },
                    json(body) { resolve({ status: this.statusCode, headers, body }); }
                };
                middleware({ body: {}, params: {}, headers: {}, ip: '127.0.0.1' }, res, () => {
                    resolve({ status: 200, headers, body: null });
                });
            });

            assert.equal((await invoke(workerA)).status, 200);
            assert.equal((await invoke(workerB)).status, 200);
            const limited = await invoke(workerA);
            assert.equal(limited.status, 429);
            assert.equal(limited.headers['retry-after'], '1');

            // Após o fim da janela não há bloqueio permanente.
            currentTime += 1001;
            assert.equal((await invoke(workerB)).status, 200);

            // Chave persistida no banco não expõe o valor bruto da identidade.
            const buckets = await RateLimitBucket.find({}).lean();
            assert.ok(buckets.length >= 1);
            assert.equal(JSON.stringify(buckets).includes('usuario.compartilhado'), false);
        });

        test('extrai o salto confiável do proxy e ignora cabeçalho forjado quando configurado', () => {
            const req = {
                ip: '172.18.0.5',
                headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.42' }
            };
            assert.equal(getClientIp(req, 0), '172.18.0.5');
            assert.equal(getClientIp(req, 1), '198.51.100.42');

            const defaults = getRecoveryRateLimitConfig({
                RECOVERY_RATE_LIMIT_WINDOW_MS: 'invalido',
                RECOVERY_FORGOT_IDENTITY_MAX: '-1'
            });
            assert.equal(defaults.windowMs, 900000);
            assert.equal(defaults.forgotIdentityMax, 5);
            assert.equal(defaults.forgotIpMax, 20);
        });
    });

    describe('validação e consumo único de token de redefinição', () => {
        const seedResetToken = async (rawToken, expiresAt) => {
            const hashedToken = createHash('sha256').update(rawToken).digest('hex');
            await User.updateOne(
                { _id: existingUser._id },
                { $set: { resetPasswordToken: hashedToken, resetPasswordExpires: expiresAt } }
            );
        };

        test('recusa token expirado na validação e na redefinição', async () => {
            const expiredToken = randomBytes(20).toString('hex');
            await seedResetToken(expiredToken, new Date(Date.now() - 10_000));

            const validated = await request(app).get(`/api/auth/validate-reset-token/${expiredToken}`);
            const reset = await request(app).post('/api/auth/reset-password')
                .send({ token: expiredToken, newPassword: 'Nova@Senha123' });

            assert.equal(validated.status, 400);
            assert.equal(reset.status, 400);
        });

        test('redefine a senha uma única vez, invalida o token usado e libera login com a nova senha', async () => {
            const rawToken = randomBytes(20).toString('hex');
            const newPassword = `Nova@${randomBytes(6).toString('hex')}9`;
            await seedResetToken(rawToken, new Date(Date.now() + 60_000));

            const validated = await request(app).get(`/api/auth/validate-reset-token/${rawToken}`);
            assert.equal(validated.status, 200);
            assert.deepEqual(validated.body, {
                valid: true,
                name: 'Maria Recuperacao',
                username: 'maria.recuperacao'
            });

            const reset = await request(app).post('/api/auth/reset-password')
                .send({ token: rawToken, newPassword });
            assert.equal(reset.status, 200);

            const reused = await request(app).post('/api/auth/reset-password')
                .send({ token: rawToken, newPassword: 'Outra@Senha123' });
            assert.equal(reused.status, 400);

            const revalidated = await request(app).get(`/api/auth/validate-reset-token/${rawToken}`);
            assert.equal(revalidated.status, 400);

            const loginNew = await request(app).post('/api/auth/login')
                .send({ username: 'maria.recuperacao', password: newPassword });
            assert.equal(loginNew.status, 200);
        });

        test('aplica limite de tentativas nas rotas de validação e redefinição', async () => {
            const probeToken = randomBytes(20).toString('hex');

            assert.equal((await request(app).get(`/api/auth/validate-reset-token/${probeToken}`)).status, 400);
            assert.equal((await request(app).get(`/api/auth/validate-reset-token/${probeToken}`)).status, 400);
            const blockedValidate = await request(app).get(`/api/auth/validate-reset-token/${probeToken}`);
            assert.equal(blockedValidate.status, 429);
            assert.ok(Number(blockedValidate.headers['retry-after']) >= 1);

            await RateLimitBucket.deleteMany({});
            assert.equal((await request(app).post('/api/auth/reset-password')
                .send({ token: probeToken, newPassword: 'Nova@Senha123' })).status, 400);
            assert.equal((await request(app).post('/api/auth/reset-password')
                .send({ token: probeToken, newPassword: 'Nova@Senha123' })).status, 400);
            const blockedReset = await request(app).post('/api/auth/reset-password')
                .send({ token: probeToken, newPassword: 'Nova@Senha123' });
            assert.equal(blockedReset.status, 429);
            assert.ok(Number(blockedReset.headers['retry-after']) >= 1);
        });
    });
});
