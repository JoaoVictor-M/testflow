const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');
const mongoose = require('mongoose');
const { call, createEvidenceTracker, createProfiles, evidenceRoot } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');

// A demanda só vai para Testado com ao menos uma evidência.
describe('evidências e conclusão da demanda', () => {
    let analyst;
    let viewer;
    let project;
    let counter = 0;
    const evidence = createEvidenceTracker();

    before(async () => {
        await connectTo('testflow-test-contracts-evidence');
        ({ analyst, viewer } = await createProfiles());
        project = await Project.create({ title: 'Projeto de evidências' });
    });

    // O nome da pasta segue a regra do servidor (id e nome sem símbolos); só as pastas criadas aqui saem.
    after(async () => {
        evidence.cleanup();
        await dropAndDisconnect();
    });

    const folderOf = (demanda) => path.join(evidenceRoot, `${demanda.demandaId}_${demanda.nome.replace(/\s+/g, '_')}`);

    const newDemanda = async (status = 'Pendente') => {
        counter += 1;
        const demanda = await Demanda.create({
            demandaId: `EVD${evidence.prefix}${counter}`, nome: `Demanda evidencia ${counter}`, project: project._id, status
        });
        evidence.track(folderOf(demanda));
        return demanda;
    };

    const upload = (demandaId, { name = 'evidencia.txt', content = 'conteudo sintetico', type = 'text/plain' } = {}) =>
        call('post', `/api/demandas/${demandaId}/evidence`, analyst.token)
            .attach('file', Buffer.from(content), { filename: name, contentType: type });

    const finalize = (demanda) => call('put', `/api/demandas/${demanda._id}`, analyst.token)
        .send({ demandaId: demanda.demandaId, nome: demanda.nome, status: 'Testado' });

    describe('upload', () => {
        test('guarda o arquivo na pasta da demanda e acrescenta a evidência sem mudar o status', async () => {
            const demanda = await newDemanda();

            const response = await upload(demanda._id, { content: 'abc123' });

            assert.equal(response.status, 201);
            assert.equal(response.body.status, 'Pendente');
            const [evidence] = response.body.evidences;
            assert.equal(evidence.originalName, 'evidencia.txt');
            assert.equal(evidence.mimetype, 'text/plain');
            assert.equal(evidence.size, 6);
            assert.match(evidence.filename, /^\d+-[0-9a-f]{8}-evidencia\.txt$/);
            const stored = path.join(folderOf(demanda), evidence.filename);
            assert.equal(fs.readFileSync(stored, 'utf8'), 'abc123'); // eslint-disable-line security/detect-non-literal-fs-filename
        });

        test('recusa extensão fora da lista, dupla extensão e tipo de conteúdo não permitido', async () => {
            const demanda = await newDemanda();

            const extension = await upload(demanda._id, { name: 'programa.exe', type: 'application/octet-stream' });
            const double = await upload(demanda._id, { name: 'relatorio.final.txt' });
            const mime = await upload(demanda._id, { name: 'pagina.txt', type: 'text/html' });

            assert.deepEqual([extension.status, double.status, mime.status], [400, 400, 400]);
            assert.equal((await Demanda.findById(demanda._id).lean()).evidences.length, 0);
        });

        test('recusa a chamada sem arquivo e com id que não é de demanda', async () => {
            const demanda = await newDemanda();

            const empty = await call('post', `/api/demandas/${demanda._id}/evidence`, analyst.token);
            const malformed = await upload('nao-e-id');

            assert.equal(empty.status, 400);
            assert.equal(malformed.status, 400);
        });

        test('demanda inexistente responde 404 e não deixa o arquivo gravado', async () => {
            const missing = new mongoose.Types.ObjectId();
            const folder = evidence.track(path.join(evidenceRoot, missing.toString()));

            const response = await upload(missing);

            assert.equal(response.status, 404);
            assert.deepEqual(fs.readdirSync(folder), []); // eslint-disable-line security/detect-non-literal-fs-filename
        });
    });

    describe('download', () => {
        test('quem está logado baixa o conteúdo enviado, inclusive o viewer', async () => {
            const demanda = await newDemanda();
            const { body } = await upload(demanda._id, { content: 'conteudo do download' });
            const url = `/api/demandas/${demanda._id}/evidence/${body.evidences[0]._id}/file`;

            const response = await call('get', url, viewer.token);

            assert.equal(response.status, 200);
            assert.equal(response.text, 'conteudo do download');
        });

        test('id malformado responde 400; evidência e demanda inexistentes, 404', async () => {
            const demanda = await newDemanda();
            const missing = new mongoose.Types.ObjectId();

            const malformed = await call('get', `/api/demandas/${demanda._id}/evidence/x/file`, viewer.token);
            const noEvidence = await call('get', `/api/demandas/${demanda._id}/evidence/${missing}/file`, viewer.token);
            const noDemanda = await call('get', `/api/demandas/${missing}/evidence/${missing}/file`, viewer.token);

            assert.deepEqual([malformed.status, noEvidence.status, noDemanda.status], [400, 404, 404]);
        });
    });

    describe('exclusão', () => {
        test('apaga o arquivo e a evidência escolhida e mantém as outras e o status', async () => {
            const demanda = await newDemanda('Testando');
            const first = (await upload(demanda._id, { name: 'a.txt' })).body.evidences[0];
            const second = (await upload(demanda._id, { name: 'b.txt' })).body.evidences[1];

            const response = await call('delete', `/api/demandas/${demanda._id}/evidence/${first._id}`, analyst.token);

            assert.equal(response.status, 200);
            assert.deepEqual(response.body.evidences.map((item) => item._id), [second._id]);
            assert.equal(response.body.status, 'Testando');
            assert.equal(fs.existsSync(path.join(folderOf(demanda), first.filename)), false); // eslint-disable-line security/detect-non-literal-fs-filename
            assert.equal(fs.existsSync(path.join(folderOf(demanda), second.filename)), true); // eslint-disable-line security/detect-non-literal-fs-filename
        });

        test('a última evidência de uma demanda ainda não concluída pode ser apagada', async () => {
            const demanda = await newDemanda();
            const { body } = await upload(demanda._id);

            const response = await call('delete', `/api/demandas/${demanda._id}/evidence/${body.evidences[0]._id}`, analyst.token);

            assert.equal(response.status, 200);
            assert.deepEqual(response.body.evidences, []);
            assert.equal(response.body.status, 'Pendente');
        });

        test('evidência inexistente e id malformado não alteram a demanda', async () => {
            const demanda = await newDemanda();
            await upload(demanda._id);

            const missing = await call('delete', `/api/demandas/${demanda._id}/evidence/${new mongoose.Types.ObjectId()}`, analyst.token);
            const malformed = await call('delete', `/api/demandas/${demanda._id}/evidence/x`, analyst.token);

            assert.deepEqual([missing.status, malformed.status], [404, 400]);
            assert.equal((await Demanda.findById(demanda._id).lean()).evidences.length, 1);
        });
    });

    describe('evidência de outra demanda', () => {
        test('baixar ou apagar pela demanda errada responde 404 e preserva a evidência', async () => {
            const demandaA = await newDemanda();
            const demandaB = await newDemanda();
            const { body } = await upload(demandaB._id, { content: 'so da demanda B' });
            const evidenceOfB = body.evidences[0];

            const download = await call('get', `/api/demandas/${demandaA._id}/evidence/${evidenceOfB._id}/file`, analyst.token);
            const removal = await call('delete', `/api/demandas/${demandaA._id}/evidence/${evidenceOfB._id}`, analyst.token);

            assert.deepEqual([download.status, removal.status], [404, 404]);
            assert.equal(download.text.includes('so da demanda B'), false);
            const stored = await Demanda.findById(demandaB._id).lean();
            assert.deepEqual(stored.evidences.map((item) => item.filename), [evidenceOfB.filename]);
            assert.equal(fs.existsSync(path.join(folderOf(demandaB), evidenceOfB.filename)), true); // eslint-disable-line security/detect-non-literal-fs-filename
        });
    });

    describe('conclusão da demanda', () => {
        test('com evidência vai para Testado, mesmo com cenários Aguardando e Com Erro', async () => {
            const demanda = await newDemanda('Testando');
            await upload(demanda._id);
            const base = { description: 'Descrição sintética', steps: ['Passo'], expectedResult: 'Resultado', demanda: demanda._id };
            await Scenario.create([
                { ...base, title: 'Aguardando', status: 'Aguardando' },
                { ...base, title: 'Com erro', status: 'Com Erro' }
            ]);

            const response = await finalize(demanda);

            assert.equal(response.status, 200);
            assert.equal(response.body.status, 'Testado');
        });

        test('os demais status não exigem evidência', async () => {
            const demanda = await newDemanda();

            for (const status of ['Testando', 'Aguardando Correção', 'Pendente']) {
                const response = await call('put', `/api/demandas/${demanda._id}`, analyst.token)
                    .send({ demandaId: demanda.demandaId, nome: demanda.nome, status });
                assert.equal(response.status, 200, status);
                assert.equal(response.body.status, status);
            }
        });
    });
});
