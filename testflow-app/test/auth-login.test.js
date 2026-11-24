const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { randomBytes } = require('node:crypto');

// O segredo precisa existir antes de o servidor ser carregado.
const jwtSecret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = jwtSecret;

const jwt = require('jsonwebtoken');
const request = require('supertest');
const User = require('../models/User');
const { app } = require('../server');
const { connectTo, dropAndDisconnect } = require('./support/database');

describe('POST /api/auth/login', () => {
    const password = randomBytes(24).toString('hex');

    before(async () => {
        await connectTo('testflow-test-auth-login');
        await User.create({
            name: 'Analista Login', username: 'analista.login',
            email: 'analista.login@example.test', password, role: 'analyst'
        });
    });

    after(dropAndDisconnect);

    test('com as credenciais corretas devolve o token e só os dados públicos do usuário', async () => {
        const response = await request(app).post('/api/auth/login')
            .send({ username: 'analista.login', password });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body.user, { username: 'analista.login', name: 'Analista Login', role: 'analyst' });
        const claims = jwt.verify(response.body.token, jwtSecret);
        assert.equal(claims.username, 'analista.login');
        assert.equal(claims.role, 'analyst');
        assert.equal(JSON.stringify(response.body).includes(password), false);
    });

    test('com a senha errada responde 401 sem token', async () => {
        const response = await request(app).post('/api/auth/login')
            .send({ username: 'analista.login', password: 'senha-errada' });

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, { message: 'Credenciais inválidas' });
    });

    test('com usuário inexistente responde igual à senha errada', async () => {
        const response = await request(app).post('/api/auth/login')
            .send({ username: 'ninguem', password });

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, { message: 'Credenciais inválidas' });
    });
});
