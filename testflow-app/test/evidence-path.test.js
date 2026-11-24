const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, before, describe, test } = require('node:test');
const { randomBytes } = require('node:crypto');

const jwtSecret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = jwtSecret;

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const Demanda = require('../models/Demanda');
const { resolveEvidenceFile } = require('../utils/evidencePath');
const { connectTo, dropAndDisconnect } = require('./support/database');

describe('resolveEvidenceFile', () => {
    const dir = path.join(os.tmpdir(), 'evidencias-dir');

    test('resolve um nome simples dentro da pasta', () => {
        assert.equal(resolveEvidenceFile(dir, '1700-ab12-print.png'), path.join(dir, '1700-ab12-print.png'));
    });

    test('recusa nomes que saem da pasta, apontam para ela ou são absolutos', () => {
        const recusados = ['..', '.', '', '../segredo.txt', '..\\segredo.txt', 'sub/../../x', '/etc/passwd', 'a/b.png', `${dir}-irma/x.png`];
        for (const nome of recusados) assert.equal(resolveEvidenceFile(dir, nome), null, nome);
    });

    test('recusa o que não é texto', () => {
        for (const nome of [undefined, null, 42, {}, ['a']]) assert.equal(resolveEvidenceFile(dir, nome), null);
    });

    test('recusa byte nulo', () => {
        assert.equal(resolveEvidenceFile(dir, 'a\0.png'), null);
    });
});

describe('rotas de evidência com nome de arquivo malicioso', () => {
    const baseDir = path.resolve(__dirname, '..', '..', 'evidencias_testes');
    const pastasCriadas = [];
    const arquivosCriados = [];

    // A pasta de evidências não existe num checkout limpo: o teste a cria e só a remove se foi ele.
    const baseDirJaExistia = fs.existsSync(baseDir);

    before(() => {
        fs.mkdirSync(baseDir, { recursive: true });
        return connectTo('testflow-test-evidence-path');
    });
    after(async () => {
        if (!baseDirJaExistia) fs.rmSync(baseDir, { recursive: true, force: true });
        await dropAndDisconnect();
    });
    afterEach(() => {
        for (const arquivo of arquivosCriados.splice(0)) fs.rmSync(arquivo, { force: true });
        for (const pasta of pastasCriadas.splice(0)) fs.rmSync(pasta, { recursive: true, force: true });
    });

    const criarDemanda = async (filename) => {
        const demanda = await Demanda.create({
            demandaId: `T${randomBytes(3).toString('hex')}`, nome: 'Alvo', project: new mongoose.Types.ObjectId(),
            evidences: [{ filename, originalName: 'x.txt', mimetype: 'text/plain', size: 1 }]
        });
        const pasta = path.join(baseDir, `${demanda.demandaId}_Alvo`);
        fs.mkdirSync(pasta, { recursive: true });
        pastasCriadas.push(pasta);
        return { demanda, pasta };
    };
    const urlDoArquivo = ({ demanda }) => `/api/demandas/${demanda._id}/evidence/${demanda.evidences[0]._id}/file`;

    test('a entrega recusa nome que sai da pasta da demanda', async () => {
        const segredo = path.join(baseDir, 'segredo-fora.txt');
        fs.writeFileSync(segredo, 'conteudo-fora');
        arquivosCriados.push(segredo);

        for (const filename of ['..', '../segredo-fora.txt', segredo]) {
            const resposta = await request(app).get(urlDoArquivo(await criarDemanda(filename)));
            assert.equal(resposta.status, 404, filename);
            assert.equal(resposta.text.includes('conteudo-fora'), false, filename);
        }
    });

    test('a entrega serve o arquivo que está na pasta da demanda', async () => {
        const alvo = await criarDemanda('1700-ab12-ok.txt');
        fs.writeFileSync(path.join(alvo.pasta, '1700-ab12-ok.txt'), 'conteudo-dentro');

        const resposta = await request(app).get(urlDoArquivo(alvo));

        assert.equal(resposta.status, 200);
        assert.equal(resposta.text, 'conteudo-dentro');
    });

    test('a remoção não apaga arquivo fora da pasta da demanda', async () => {
        const segredo = path.join(baseDir, 'segredo-fora.txt');
        fs.writeFileSync(segredo, 'conteudo-fora');
        arquivosCriados.push(segredo);
        const token = jwt.sign({ userId: new mongoose.Types.ObjectId(), role: 'analyst' }, jwtSecret);

        for (const filename of ['../segredo-fora.txt', segredo]) {
            const { demanda } = await criarDemanda(filename);
            const resposta = await request(app)
                .delete(`/api/demandas/${demanda._id}/evidence/${demanda.evidences[0]._id}`)
                .set('Authorization', `Bearer ${token}`);

            assert.equal(resposta.status, 200, filename);
            assert.equal(fs.existsSync(segredo), true, filename);
        }
    });

    test('a remoção apaga o arquivo que está na pasta da demanda', async () => {
        const alvo = await criarDemanda('1700-ab12-ok.txt');
        const arquivo = path.join(alvo.pasta, '1700-ab12-ok.txt');
        fs.writeFileSync(arquivo, 'x');
        const token = jwt.sign({ userId: new mongoose.Types.ObjectId(), role: 'analyst' }, jwtSecret);

        await request(app).delete(`/api/demandas/${alvo.demanda._id}/evidence/${alvo.demanda.evidences[0]._id}`)
            .set('Authorization', `Bearer ${token}`);

        assert.equal(fs.existsSync(arquivo), false);
    });
});
