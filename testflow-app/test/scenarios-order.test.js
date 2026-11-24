const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const mongoose = require('mongoose');
const { call, createProfiles } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const makeScenarioDoc = (demandaId, overrides) => ({
    title: 'Cenário',
    description: 'Descrição sintética',
    steps: ['Abrir tela', 'Confirmar'],
    expectedResult: 'Resultado esperado',
    demanda: demandaId,
    status: 'Aguardando',
    mantisLink: '',
    ...overrides
});

describe('ordenação cronológica de cenários', () => {
    let analyst;
    let project;
    let demandaSeq = 0;

    before(async () => {
        await connectTo('testflow-test-scenarios-order');
        ({ analyst } = await createProfiles());
        project = await Project.create({ title: 'Projeto ordenação' });
    });

    after(dropAndDisconnect);

    const createDemanda = () => {
        demandaSeq += 1;
        return Demanda.create({
            demandaId: `ORD-${demandaSeq}`,
            nome: `Demanda ordenação ${demandaSeq}`,
            project: project._id
        });
    };

    const listTitles = async (demandaId) => {
        const response = await call('get', `/api/scenarios?demandaId=${demandaId}`, analyst.token);
        assert.equal(response.status, 200);
        return response.body.map((item) => item.title);
    };

    test('GET retorna createdAt crescente com desempate estável por _id', async () => {
        const demanda = await createDemanda();
        const t1 = new Date('2026-01-10T10:00:00.000Z');
        const t2 = new Date('2026-01-11T10:00:00.000Z');
        const t3 = new Date('2026-01-12T10:00:00.000Z');

        // Inseridos fora de ordem cronológica e com o maior _id do empate inserido antes do menor.
        await Scenario.collection.insertMany([
            makeScenarioDoc(demanda._id, { _id: oid('65a000000000000000000030'), title: 'Terceiro', createdAt: t3, updatedAt: t3 }),
            makeScenarioDoc(demanda._id, { _id: oid('65a000000000000000000022'), title: 'Empate B', createdAt: t2, updatedAt: t2 }),
            makeScenarioDoc(demanda._id, { _id: oid('65a000000000000000000010'), title: 'Primeiro', createdAt: t1, updatedAt: t1 }),
            makeScenarioDoc(demanda._id, { _id: oid('65a000000000000000000021'), title: 'Empate A', createdAt: t2, updatedAt: t2 })
        ]);

        const firstRead = await listTitles(demanda._id);
        const secondRead = await listTitles(demanda._id);

        assert.deepEqual(firstRead, ['Primeiro', 'Empate A', 'Empate B', 'Terceiro']);
        assert.deepEqual(secondRead, ['Primeiro', 'Empate A', 'Empate B', 'Terceiro']);
    });

    test('criar e duplicar colocam o cenário na posição cronológica mantida em novas consultas', async () => {
        const demanda = await createDemanda();
        const t1 = new Date('2026-02-01T08:00:00.000Z');
        const t2 = new Date('2026-02-02T08:00:00.000Z');
        const oldestId = oid('65b000000000000000000010');

        await Scenario.collection.insertMany([
            makeScenarioDoc(demanda._id, { _id: oid('65b000000000000000000020'), title: 'Segundo', createdAt: t2, updatedAt: t2 }),
            makeScenarioDoc(demanda._id, { _id: oldestId, title: 'Primeiro', createdAt: t1, updatedAt: t1 })
        ]);

        const created = await call('post', '/api/scenarios', analyst.token).send({
            title: 'Terceiro criado',
            description: 'Descrição nova',
            steps: ['Passo 1'],
            expectedResult: 'OK',
            demanda: demanda._id
        });
        assert.equal(created.status, 201);
        assert.deepEqual(await listTitles(demanda._id), ['Primeiro', 'Segundo', 'Terceiro criado']);

        const duplicated = await call('post', '/api/scenarios', analyst.token).send({
            title: 'Primeiro (Cópia)',
            description: 'Descrição sintética',
            steps: ['Abrir tela', 'Confirmar'],
            expectedResult: 'Resultado esperado',
            demanda: demanda._id,
            sourceId: oldestId
        });
        assert.equal(duplicated.status, 201);
        assert.deepEqual(await listTitles(demanda._id), ['Primeiro', 'Segundo', 'Terceiro criado', 'Primeiro (Cópia)']);
        assert.deepEqual(await listTitles(demanda._id), ['Primeiro', 'Segundo', 'Terceiro criado', 'Primeiro (Cópia)']);
    });

    test('editar conteúdo ou status não altera createdAt nem a posição na lista', async () => {
        const demanda = await createDemanda();
        const t1 = new Date('2026-03-01T09:00:00.000Z');
        const t2 = new Date('2026-03-02T09:00:00.000Z');
        const t3 = new Date('2026-03-03T09:00:00.000Z');
        const firstId = oid('65c000000000000000000010');

        await Scenario.collection.insertMany([
            makeScenarioDoc(demanda._id, { _id: oid('65c000000000000000000030'), title: 'Terceiro', createdAt: t3, updatedAt: t3 }),
            makeScenarioDoc(demanda._id, { _id: firstId, title: 'Primeiro', createdAt: t1, updatedAt: t1 }),
            makeScenarioDoc(demanda._id, { _id: oid('65c000000000000000000020'), title: 'Segundo', createdAt: t2, updatedAt: t2 })
        ]);

        const edited = await call('put', `/api/scenarios/${firstId}`, analyst.token).send({
            title: 'Primeiro editado',
            description: 'Descrição atualizada',
            steps: ['Passo atualizado'],
            expectedResult: 'Resultado atualizado',
            demanda: demanda._id
        });
        assert.equal(edited.status, 200);
        assert.equal(new Date(edited.body.createdAt).toISOString(), t1.toISOString());

        const statusUpdated = await call('patch', `/api/scenarios/${firstId}/status`, analyst.token)
            .send({ status: 'Passou', mantisLink: '' });
        assert.equal(statusUpdated.status, 200);
        assert.equal(new Date(statusUpdated.body.createdAt).toISOString(), t1.toISOString());

        assert.deepEqual(await listTitles(demanda._id), ['Primeiro editado', 'Segundo', 'Terceiro']);
    });
});
