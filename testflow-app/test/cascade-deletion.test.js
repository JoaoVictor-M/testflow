const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, afterEach, before, describe, mock, test } = require('node:test');

const { call, createEvidenceTracker, createProfiles, evidenceRoot } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');
const { logger } = require('../utils/logger');

describe('exclusão em cascata de projeto, demanda e cenário com limpeza de arquivos', () => {
    const tracker = createEvidenceTracker();
    const extraFiles = [];
    let profiles;

    before(async () => {
        await connectTo('testflow-test-cascade-deletion');
        profiles = await createProfiles();
    });

    afterEach(() => {
        mock.restoreAll();
        for (const file of extraFiles.splice(0)) fs.rmSync(file, { force: true });
        tracker.cleanup();
    });

    after(dropAndDisconnect);

    const createHierarchy = async ({ suffix, demandaId, nome, filename, createFile = true }) => {
        const project = await Project.create({ title: `Projeto ${suffix}` });
        const demanda = await Demanda.create({
            demandaId,
            nome,
            project: project._id,
            evidences: filename
                ? [{ filename, originalName: 'print.txt', mimetype: 'text/plain', size: 8 }]
                : []
        });
        const scenario = await Scenario.create({
            title: `Cenário ${suffix}`,
            description: 'Descrição sintética',
            steps: ['Passo 1'],
            expectedResult: 'Resultado esperado',
            demanda: demanda._id
        });

        const safeId = demandaId.replace(/[^a-zA-Z0-9]/g, '');
        const safeName = nome.replace(/[^a-zA-Z0-9.\-_ \u00C0-\u00FF]/g, '').trim().replace(/\s+/g, '_');
        const dir = tracker.track(path.join(evidenceRoot, `${safeId}_${safeName}`));
        let filePath = null;
        if (createFile && filename && !filename.includes('..') && !filename.includes('/')) {
            fs.mkdirSync(dir, { recursive: true });
            filePath = path.join(dir, filename);
            fs.writeFileSync(filePath, 'conteudo');
        }
        return { project, demanda, scenario, dir, filePath };
    };

    test('excluir projeto, demanda ou cenário apaga documentos e arquivos de evidência associados', async () => {
        const scenarioOnly = await createHierarchy({
            suffix: `${tracker.prefix}-sc`,
            demandaId: `S${tracker.prefix}`,
            nome: 'SoloCenario',
            filename: 'manter.txt'
        });
        const delScenario = await call('delete', `/api/scenarios/${scenarioOnly.scenario._id}`, profiles.admin.token);
        assert.equal(delScenario.status, 200);
        assert.equal(await Scenario.exists({ _id: scenarioOnly.scenario._id }), null);
        assert.equal(fs.existsSync(scenarioOnly.filePath), true);

        const demandaTarget = await createHierarchy({
            suffix: `${tracker.prefix}-dm`,
            demandaId: `D${tracker.prefix}`,
            nome: 'DemandaUnica',
            filename: 'evidencia-demanda.txt'
        });
        const delDemanda = await call('delete', `/api/demandas/${demandaTarget.demanda._id}`, profiles.admin.token);
        assert.equal(delDemanda.status, 200);
        assert.equal(await Demanda.exists({ _id: demandaTarget.demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: demandaTarget.scenario._id }), null);
        assert.equal(fs.existsSync(demandaTarget.filePath), false);
        assert.equal(fs.existsSync(demandaTarget.dir), false);

        const projectTarget = await createHierarchy({
            suffix: `${tracker.prefix}-pj`,
            demandaId: `P${tracker.prefix}`,
            nome: 'DemandaProjeto',
            filename: 'evidencia-projeto.txt'
        });
        const delProject = await call('delete', `/api/projects/${projectTarget.project._id}`, profiles.admin.token);
        assert.equal(delProject.status, 200);
        assert.equal(await Project.exists({ _id: projectTarget.project._id }), null);
        assert.equal(await Demanda.exists({ _id: projectTarget.demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: projectTarget.scenario._id }), null);
        assert.equal(fs.existsSync(projectTarget.filePath), false);
        assert.equal(fs.existsSync(projectTarget.dir), false);
    });

    test('arquivo ainda referenciado por outra demanda não é apagado e arquivo já ausente não gera erro', async () => {
        const sharedCode = `SH${tracker.prefix}`;
        const sharedName = 'Compartilhada';
        const sharedFile = 'anexo-compartilhado.txt';

        const first = await createHierarchy({
            suffix: `${tracker.prefix}-a`,
            demandaId: sharedCode,
            nome: sharedName,
            filename: sharedFile
        });
        const second = await createHierarchy({
            suffix: `${tracker.prefix}-b`,
            demandaId: sharedCode,
            nome: sharedName,
            filename: sharedFile
        });

        const delFirst = await call('delete', `/api/demandas/${first.demanda._id}`, profiles.admin.token);
        assert.equal(delFirst.status, 200);
        assert.equal(fs.existsSync(first.filePath), true);
        assert.ok(await Demanda.exists({ _id: second.demanda._id }));

        // Arquivo já ausente no disco (ENOENT) não falha a exclusão nem registra erro.
        fs.rmSync(second.filePath, { force: true });
        const errorLog = mock.method(logger, 'error', () => {});
        const delSecond = await call('delete', `/api/demandas/${second.demanda._id}`, profiles.admin.token);
        assert.equal(delSecond.status, 200);
        assert.equal(await Demanda.exists({ _id: second.demanda._id }), null);
        assert.equal(errorLog.mock.calls.length, 0);
    });

    test('falha de filesystem registra apenas ids no log, sem nome ou caminho, e não deixa documento pela metade', async () => {
        const secretFilename = 'arquivo-confidencial-123.txt';
        const target = await createHierarchy({
            suffix: `${tracker.prefix}-err`,
            demandaId: `ER${tracker.prefix}`,
            nome: 'FalhaUnlink',
            filename: secretFilename
        });

        const errorLog = mock.method(logger, 'error', () => {});
        mock.method(fs.promises, 'unlink', async () => {
            const err = new Error(`EACCES: permission denied, unlink '${target.filePath}'`);
            err.code = 'EACCES';
            err.path = target.filePath;
            throw err;
        });

        const response = await call('delete', `/api/projects/${target.project._id}`, profiles.admin.token);

        assert.equal(response.status, 200);
        assert.equal(await Project.exists({ _id: target.project._id }), null);
        assert.equal(await Demanda.exists({ _id: target.demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: target.scenario._id }), null);
        assert.ok(errorLog.mock.calls.length >= 1);

        const serialized = JSON.stringify(errorLog.mock.calls.map((entry) => entry.arguments));
        assert.equal(serialized.includes(String(target.project._id)), true);
        assert.equal(serialized.includes(String(target.demanda._id)), true);
        assert.equal(serialized.includes(secretFilename), false);
        assert.equal(serialized.includes(target.filePath), false);
    });

    test('proteção de caminho impede remoção fora da pasta da demanda', async () => {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        const outsideFile = path.join(evidenceRoot, `fora-${tracker.prefix}.txt`);
        fs.writeFileSync(outsideFile, 'nao-apagar');
        extraFiles.push(outsideFile);

        const target = await createHierarchy({
            suffix: `${tracker.prefix}-trav`,
            demandaId: `TR${tracker.prefix}`,
            nome: 'Traversal',
            filename: `../fora-${tracker.prefix}.txt`,
            createFile: false
        });

        const response = await call('delete', `/api/demandas/${target.demanda._id}`, profiles.admin.token);

        assert.equal(response.status, 200);
        assert.equal(await Demanda.exists({ _id: target.demanda._id }), null);
        assert.equal(fs.existsSync(outsideFile), true);
    });
});
