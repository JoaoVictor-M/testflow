const assert = require('node:assert/strict');
const { after, afterEach, before, describe, mock, test } = require('node:test');
const { randomBytes } = require('node:crypto');

const jwtSecret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = jwtSecret;

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const { logger } = require('../utils/logger');
const { connectTo, dropAndDisconnect } = require('./support/database');

const analystToken = () => jwt.sign({ userId: new mongoose.Types.ObjectId(), role: 'analyst' }, jwtSecret);

// O Mongoose converte um objeto com `_id` num ObjectId, então o corpo pode levar um sourceId que
// passa na consulta, mas não é uma string de id, e que carrega o que mais o cliente quiser enviar.
const objectCastAsId = (id) => ({ _id: id, extra: 'segredo-1234' });

describe('log da duplicação', () => {
    before(() => connectTo('testflow-test-clone-log'));
    after(dropAndDisconnect);
    afterEach(() => mock.restoreAll());

    const loggedFields = (info) => info.mock.calls.map((call) => call.arguments[1]);

    test('de projeto: registra o sourceId só quando é um ObjectId', async () => {
        const info = mock.method(logger, 'info', () => {});
        const valid = new mongoose.Types.ObjectId().toString();

        for (const sourceId of [objectCastAsId(valid), valid]) {
            await request(app).post('/api/projects').set('Authorization', `Bearer ${analystToken()}`)
                .send({ title: 'Copia', sourceId });
        }

        const duplications = info.mock.calls.filter((call) => call.arguments[0] === 'Duplicando demandas do projeto');
        assert.equal(duplications.length, 2);
        assert.equal(duplications[0].arguments[1].sourceId, undefined);
        assert.equal(JSON.stringify(loggedFields(info)).includes('segredo-1234'), false);
        assert.equal(duplications[1].arguments[1].sourceId, valid);
    });

    test('de demanda: registra o sourceId só quando é um ObjectId', async () => {
        const info = mock.method(logger, 'info', () => {});
        const valid = new mongoose.Types.ObjectId().toString();

        for (const sourceId of [objectCastAsId(valid), valid]) {
            await request(app).post('/api/demandas').set('Authorization', `Bearer ${analystToken()}`)
                .send({ demandaId: 'D-1', nome: 'Copia', project: new mongoose.Types.ObjectId(), sourceId });
        }

        const duplications = info.mock.calls.filter((call) => call.arguments[0] === 'Duplicando cenários da demanda');
        assert.equal(duplications.length, 2);
        assert.equal(duplications[0].arguments[1].sourceId, undefined);
        assert.equal(JSON.stringify(loggedFields(info)).includes('segredo-1234'), false);
        assert.equal(duplications[1].arguments[1].sourceId, valid);
    });
});
