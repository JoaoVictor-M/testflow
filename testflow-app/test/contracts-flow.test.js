const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { call, createCatalog, createProfiles } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const AuditLog = require('../models/AuditLog');
const Demanda = require('../models/Demanda');
const Scenario = require('../models/Scenario');

const scenarioBody = (demanda, title = 'Cenário novo') => ({
    title, description: 'Descrição sintética', steps: ['Abrir a tela', 'Salvar'], expectedResult: 'Salvo', demanda
});

describe('projetos, demandas e cenários', () => {
    let analyst;
    let admin;

    before(async () => {
        await connectTo('testflow-test-contracts-flow');
        ({ analyst, admin } = await createProfiles());
    });

    after(dropAndDisconnect);

    const createProject = (body = {}) => call('post', '/api/projects', analyst.token)
        .send({ title: 'Projeto de fluxo', ...body });
    const createDemanda = (project, body = {}) => call('post', '/api/demandas', analyst.token)
        .send({ demandaId: 'FLX-1', nome: 'Demanda de fluxo', project, ...body });

    describe('projeto', () => {
        test('nasce Não Iniciado e normaliza tags, responsáveis, versões e servidores', async () => {
            const response = await createProject({
                tags: ['  Regressão ', 'regressão'], responsaveis: ['Ana Teste'], versions: ['V1'], servers: ['HML']
            });

            assert.equal(response.status, 201);
            assert.equal(response.body.status, 'Não Iniciado');
            assert.deepEqual(response.body.tags.map((tag) => tag.name), ['regressão']);
            assert.deepEqual(response.body.responsaveis.map((item) => item.name), ['ana teste']);
            assert.deepEqual(response.body.versions.map((item) => item.name), ['v1']);
            assert.deepEqual(response.body.servers.map((item) => item.name), ['hml']);
        });

        test('exige título e status válido', async () => {
            assert.equal((await createProject({ title: undefined })).status, 400);
            assert.equal((await createProject({ status: 'Inexistente' })).status, 400);
        });

        test('a edição troca os campos e registra a auditoria com o autor', async () => {
            const { body: created } = await createProject();

            const updated = await call('put', `/api/projects/${created._id}`, admin.token)
                .send({ title: 'Projeto editado', status: 'Em Andamento' });

            assert.equal(updated.status, 200);
            assert.equal(updated.body.title, 'Projeto editado');
            const entry = await AuditLog.findOne({ entityId: created._id, action: 'UPDATE' }).lean();
            assert.equal(entry.entity, 'Project');
            assert.equal(entry.user.toString(), admin.user._id.toString());
            assert.equal(entry.details.old.title, 'Projeto de fluxo');
            assert.equal(entry.details.new.title, 'Projeto editado');
        });

        test('apagar o projeto apaga as demandas e os cenários dele e registra a auditoria', async () => {
            const { project, demanda, scenario } = await createCatalog('cascata');

            const response = await call('delete', `/api/projects/${project._id}`, analyst.token);

            assert.equal(response.status, 200);
            assert.equal(await Demanda.exists({ _id: demanda._id }), null);
            assert.equal(await Scenario.exists({ _id: scenario._id }), null);
            assert.ok(await AuditLog.exists({ entityId: project._id, action: 'DELETE', entity: 'Project' }));
        });
    });

    describe('demanda', () => {
        test('nasce Pendente e exige identificação, nome e projeto', async () => {
            const { project } = await createCatalog('demanda');

            const created = await createDemanda(project._id);
            const noName = await createDemanda(project._id, { nome: undefined });
            const noProject = await createDemanda(undefined);

            assert.equal(created.status, 201);
            assert.equal(created.body.status, 'Pendente');
            assert.equal(noName.status, 400);
            assert.equal(noProject.status, 400);
        });

        test('recusa status inexistente na criação e na edição', async () => {
            const { project, demanda } = await createCatalog('status');

            const created = await createDemanda(project._id, { status: 'Inexistente' });
            const edited = await call('put', `/api/demandas/${demanda._id}`, analyst.token)
                .send({ demandaId: 'X', nome: 'X', status: 'Inexistente' });

            assert.equal(created.status, 400);
            assert.equal(edited.status, 400);
        });

        test('recusa link fora da lista de plataformas permitidas', async () => {
            const { project } = await createCatalog('link');

            const response = await createDemanda(project._id, { linkDemanda: 'https://fora-da-lista.example.test/1' });

            assert.equal(response.status, 400);
            assert.equal(response.body.message, 'URL de demanda não permitida pela allowlist configurada.');
        });

        test('apagar a demanda apaga os cenários dela', async () => {
            const { demanda, scenario } = await createCatalog('apagar');

            const response = await call('delete', `/api/demandas/${demanda._id}`, analyst.token);

            assert.equal(response.status, 200);
            assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        });
    });

    describe('cenário', () => {
        test('nasce Aguardando e exige vínculo com uma demanda', async () => {
            const { demanda } = await createCatalog('cenario');

            const created = await call('post', '/api/scenarios', analyst.token).send(scenarioBody(demanda._id));
            const incomplete = await call('post', '/api/scenarios', analyst.token).send(scenarioBody(undefined));

            assert.equal(created.status, 201);
            assert.equal(created.body.status, 'Aguardando');
            assert.equal(incomplete.status, 400);
        });

        test('registra o link do Mantis ao marcar o cenário Com Erro', async () => {
            const { scenario } = await createCatalog('mantis');
            const failed = await call('patch', `/api/scenarios/${scenario._id}/status`, analyst.token)
                .send({ status: 'Com Erro', mantisLink: 'https://mantis.example.test/1' });

            assert.equal(failed.status, 200);
            assert.equal(failed.body.status, 'Com Erro');
            assert.equal(failed.body.mantisLink, 'https://mantis.example.test/1');
        });

        test('recusa status fora de Aguardando, Passou e Com Erro', async () => {
            const { scenario } = await createCatalog('status-cenario');

            const response = await call('patch', `/api/scenarios/${scenario._id}/status`, analyst.token)
                .send({ status: 'Bloqueado' });

            assert.equal(response.status, 400);
            assert.equal((await Scenario.findById(scenario._id).lean()).status, 'Aguardando');
        });

        test('a edição e a exclusão registram a auditoria', async () => {
            const { scenario } = await createCatalog('auditoria');

            await call('put', `/api/scenarios/${scenario._id}`, analyst.token).send({ title: 'Título novo' });
            const deleted = await call('delete', `/api/scenarios/${scenario._id}`, analyst.token);

            assert.equal(deleted.status, 200);
            const actions = (await AuditLog.find({ entityId: scenario._id }).sort({ createdAt: 1 }).lean())
                .map((entry) => entry.action);
            assert.deepEqual(actions, ['UPDATE', 'DELETE']);
        });
    });

    describe('auditoria e estatísticas', () => {
        test('o admin lista a auditoria paginada, com o autor e filtro por ação', async () => {
            for (let index = 0; index < 3; index += 1) {
                const created = await createProject({ title: `Projeto de auditoria ${index}` });
                assert.equal(created.status, 201);
            }

            const response = await call('get', '/api/audit?action=CREATE&limit=2&page=1', admin.token);

            assert.equal(response.status, 200);
            assert.equal(response.body.data.length, 2);
            assert.ok(response.body.total >= 3);
            assert.ok(response.body.pages >= 2);
            assert.equal(response.body.page, 1);
            assert.ok(response.body.data.every((entry) => entry.action === 'CREATE'));
            assert.deepEqual(Object.keys(response.body.data[0].user).sort(), ['_id', 'name', 'username']);
        });

        test('as estatísticas do projeto contam só o que pertence a ele', async () => {
            const { project, demanda } = await createCatalog('stats');
            await Demanda.updateOne({ _id: demanda._id }, { tempoEstimado: 5, status: 'Testando' });
            await Scenario.updateOne({ demanda: demanda._id }, { status: 'Com Erro' });
            await createCatalog('stats-fora');

            const response = await call('get', `/api/stats?projectId=${project._id}`, analyst.token);

            assert.equal(response.status, 200);
            assert.equal(response.body.totalProjects, 1);
            assert.equal(response.body.totalDemandas, 1);
            assert.equal(response.body.totalScenarios, 1);
            assert.equal(response.body.totalHorasEstimadas, 5);
            assert.deepEqual(response.body.scenariosByStatus, { 'Com Erro': 1 });
            assert.deepEqual(response.body.demandasByStatus, { Testando: 1 });
            assert.equal(response.body.totalDemandasCobertas, 1);
        });
    });
});
