const assert = require('node:assert/strict');
const { after, afterEach, before, describe, mock, test } = require('node:test');
const { randomBytes } = require('node:crypto');

process.env.JWT_SECRET = randomBytes(32).toString('hex');

const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const { createLogger, logger } = require('../utils/logger');
const { isDatabaseReady } = require('../services/healthService');
const { connectTo, dropAndDisconnect } = require('./support/database');

afterEach(() => mock.restoreAll());

describe('GET /health', () => {
    test('responde 200 sem autenticação, mesmo sem banco', async () => {
        assert.notEqual(mongoose.connection.readyState, 1);

        const response = await request(app).get('/health');

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { status: 'ok' });
    });
});

describe('GET /ready', () => {
    test('com o Mongo desconectado responde 503 sem detalhes', async () => {
        const response = await request(app).get('/ready');

        assert.equal(response.status, 503);
        assert.deepEqual(response.body, { status: 'unavailable' });
    });

    describe('com o Mongo conectado', () => {
        before(() => connectTo('testflow-test-health'));
        after(dropAndDisconnect);

        test('responde 200 sem autenticação', async () => {
            const response = await request(app).get('/ready');

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, { status: 'ok' });
        });

        test('responde 503 quando o ping falha', async () => {
            mock.method(mongoose.connection.db, 'admin', () => ({ ping: () => Promise.reject(new Error('caiu')) }));

            const response = await request(app).get('/ready');

            assert.equal(response.status, 503);
        });

        test('não espera um ping que nunca responde', async () => {
            mock.method(mongoose.connection.db, 'admin', () => ({ ping: () => new Promise(() => {}) }));

            assert.equal(await isDatabaseReady(20), false);
        });
    });
});

describe('log de requisições', () => {
    test('devolve o id da requisição e registra rota, status e duração sem a query', async () => {
        const info = mock.method(logger, 'info', () => {});

        const response = await request(app).get('/api/rota-inexistente?token=segredo-na-query');

        const requestId = response.headers['x-request-id'];
        assert.match(requestId, /^[\w.-]{8,64}$/);
        const [message, fields] = info.mock.calls.at(-1).arguments;
        assert.equal(message, 'requisição concluída');
        assert.equal(fields.requestId, requestId);
        assert.equal(fields.method, 'GET');
        assert.equal(fields.status, 404);
        assert.equal(typeof fields.durationMs, 'number');
        assert.equal(JSON.stringify(fields).includes('segredo-na-query'), false);
    });

    test('registra o modelo da rota, não o valor do token no caminho', async () => {
        const info = mock.method(logger, 'info', () => {});

        await request(app).get('/api/auth/validate-reset-token/token-secreto-123');

        const [, fields] = info.mock.calls.at(-1).arguments;
        assert.equal(fields.route, '/api/auth/validate-reset-token/:token');
        assert.equal(JSON.stringify(fields).includes('token-secreto-123'), false);
    });

    test('aproveita um id válido recebido do proxy e troca um inválido', async () => {
        const reused = await request(app).get('/health').set('X-Request-Id', 'proxy-abc-123456');
        const replaced = await request(app).get('/health').set('X-Request-Id', 'id com espacos!');

        assert.equal(reused.headers['x-request-id'], 'proxy-abc-123456');
        assert.match(replaced.headers['x-request-id'], /^[\w.-]{8,64}$/);
    });

    test('não registra as sondas de saúde', async () => {
        const info = mock.method(logger, 'info', () => {});

        await request(app).get('/health');
        await request(app).get('/ready');

        assert.equal(info.mock.callCount(), 0);
    });
});

describe('erro não tratado', () => {
    test('corpo JSON inválido responde 400 em JSON e não registra o conteúdo enviado', async () => {
        const written = [];
        const capture = createLogger((line) => written.push(line));
        mock.method(logger, 'error', capture.error);

        const response = await request(app).post('/api/auth/login')
            .set('Content-Type', 'application/json').send('{"username":"ana","password":"senha-vazada"');

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: 'Requisição inválida.' });
        assert.equal(written.length, 1);
        assert.equal(JSON.parse(written[0]).msg, 'Erro não tratado na requisição');
        assert.equal(written[0].includes('senha-vazada'), false);
    });
});
