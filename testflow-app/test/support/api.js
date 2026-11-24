// Base dos testes de contrato da API: segredo, três perfis sintéticos e um catálogo mínimo.
// Carregue este módulo antes de qualquer outro que importe o servidor: o segredo do JWT é lido
// quando o servidor é carregado.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mock } = require('node:test');

const jwtSecret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = jwtSecret;
process.env.SMTP_HOST = '';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const Demanda = require('../../models/Demanda');
const Project = require('../../models/Project');
const Scenario = require('../../models/Scenario');
const User = require('../../models/User');
const emailService = require('../../services/emailService');
mock.method(emailService, 'sendInviteEmail', async () => {});
const { app } = require('../../server');

const ROLES = ['admin', 'analyst', 'viewer'];

// Pasta que o servidor usa para as evidências: a do próprio checkout, que o Git ignora.
const evidenceRoot = path.resolve(__dirname, '..', '..', '..', 'evidencias_testes');

// Chamada à API; sem token, vai sem o cabeçalho de autorização.
const call = (method, url, token) => {
    const pending = request(app)[method](url);
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
};

// Mesmas claims que o login emite.
const tokenFor = (user) => jwt.sign(
    { userId: user._id, username: user.username, name: user.name, role: user.role },
    jwtSecret,
    { expiresIn: '1h' }
);

// Um usuário por perfil, com senha aleatória e e-mail de domínio reservado para testes.
const createProfiles = async () => {
    const profiles = {};
    for (const role of ROLES) {
        const user = await User.create({
            name: `Fixture ${role}`, username: `fixture.${role}`,
            email: `fixture.${role}@example.test`, password: randomBytes(24).toString('hex'), role
        });
        profiles[role] = { user, token: tokenFor(user) };
    }
    return profiles;
};

// Projeto, demanda e cenário sintéticos, ligados entre si.
const createCatalog = async (suffix = 'base') => {
    const project = await Project.create({ title: `Projeto ${suffix}` });
    const demanda = await Demanda.create({ demandaId: `D${suffix}`, nome: `Demanda ${suffix}`, project: project._id });
    const scenario = await Scenario.create({
        title: `Cenário ${suffix}`, description: 'Descrição sintética', steps: ['Passo 1'],
        expectedResult: 'Resultado esperado', demanda: demanda._id
    });
    return { project, demanda, scenario };
};

// Pastas de evidência criadas pelo teste. O servidor grava sempre em evidenceRoot, então os nomes
// levam um prefixo aleatório por execução e só o que foi registrado aqui é removido, também ao
// encerrar por falha, INT ou TERM.
const createEvidenceTracker = () => {
    const prefix = randomBytes(4).toString('hex');
    const folders = new Set();
    const cleanup = () => {
        for (const folder of folders) {
            assert.ok(folder.startsWith(evidenceRoot + path.sep), `fora da pasta de evidências: ${folder}`);
            fs.rmSync(folder, { recursive: true, force: true });
        }
        folders.clear();
    };
    process.once('exit', cleanup);
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => process.exit(128 + os.constants.signals[signal]));
    }
    return {
        prefix,
        cleanup,
        track: (folder) => { folders.add(folder); return folder; }
    };
};

module.exports = { call, createCatalog, createEvidenceTracker, createProfiles, evidenceRoot, tokenFor };
