const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const mongoose = require('mongoose');
const { call, createCatalog, createProfiles, tokenFor } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');
const User = require('../models/User');

describe('acesso por perfil e chamada direta', () => {
    let profiles;
    let catalog;
    let routes;

    // As rotas de escrita usam um id inexistente: quem passa do middleware recebe 400 ou 404 e nada é alterado.
    before(async () => {
        await connectTo('testflow-test-contracts-access');
        profiles = await createProfiles();
        catalog = await createCatalog();
        const { project, demanda, scenario } = catalog;
        const id = new mongoose.Types.ObjectId().toString();
        routes = {
            readers: [
                ['get', '/api/projects'],
                ['get', '/api/responsaveis'],
                ['get', `/api/demandas?projectId=${project._id}`],
                ['get', `/api/scenarios?demandaId=${demanda._id}`],
                ['get', `/api/scenarios/${scenario._id}`],
                ['get', '/api/stats'],
                ['get', '/api/config/allowlist'],
                ['post', '/api/users/generate-username']
            ],
            writers: [
                ['post', '/api/auth/register'],
                ['get', '/api/users'],
                ['get', '/api/users/all'],
                ['put', `/api/users/${id}`],
                ['delete', `/api/users/${id}`],
                ['post', '/api/users/import'],
                ['post', '/api/projects'],
                ['put', `/api/projects/${id}`],
                ['delete', `/api/projects/${id}`],
                ['post', '/api/demandas'],
                ['put', `/api/demandas/${id}`],
                ['delete', `/api/demandas/${id}`],
                ['post', `/api/demandas/${id}/evidence`],
                ['delete', `/api/demandas/${id}/evidence/${id}`],
                ['post', '/api/scenarios'],
                ['put', `/api/scenarios/${id}`],
                ['delete', `/api/scenarios/${id}`],
                ['patch', `/api/scenarios/${id}/status`]
            ],
            adminOnly: [
                ['get', '/api/config/email'],
                ['put', '/api/config/email'],
                ['post', '/api/config/allowlist'],
                ['get', '/api/audit']
            ]
        };
    });

    after(dropAndDisconnect);

    const protectedRoutes = () => [...routes.readers, ...routes.writers, ...routes.adminOnly];
    const countDocuments = async () => Promise.all([User, Project, Demanda, Scenario].map((model) => model.countDocuments()));

    describe('sem sessão válida', () => {
        test('sem token toda rota protegida responde 401', async () => {
            for (const [method, url] of protectedRoutes()) {
                const response = await call(method, url);
                assert.equal(response.status, 401, `${method} ${url}`);
                assert.deepEqual(response.body, { message: 'Acesso negado. Token não fornecido.' });
            }
        });

        // Falta de token é 401, mas token inválido ou expirado é 403, o mesmo código da falta de permissão.
        test('com token inválido toda rota protegida responde 403', async () => {
            for (const [method, url] of protectedRoutes()) {
                const response = await call(method, url, 'token.invalido.qualquer');
                assert.equal(response.status, 403, `${method} ${url}`);
                assert.deepEqual(response.body, { message: 'Token inválido ou expirado.' });
            }
        });
    });

    describe('perfil sem permissão de escrita (viewer)', () => {
        test('recebe 403 em toda rota de escrita e nada é gravado', async () => {
            const before = await countDocuments();
            for (const [method, url] of [...routes.writers, ...routes.adminOnly]) {
                const response = await call(method, url, profiles.viewer.token);
                assert.equal(response.status, 403, `${method} ${url}`);
                assert.equal(response.body.message, 'Acesso Proibido: Você não tem permissão para realizar esta ação.');
            }
            assert.deepEqual(await countDocuments(), before);
        });

        test('consulta os dados do projeto, das demandas e dos cenários', async () => {
            for (const [method, url] of routes.readers.filter(([verb]) => verb === 'get')) {
                const response = await call(method, url, profiles.viewer.token);
                assert.equal(response.status, 200, `${method} ${url}`);
            }
        });
    });

    describe('perfil analyst', () => {
        test('recebe 403 nas rotas só do admin', async () => {
            for (const [method, url] of routes.adminOnly) {
                const response = await call(method, url, profiles.analyst.token);
                assert.equal(response.status, 403, `${method} ${url}`);
            }
        });

        test('passa do middleware nas rotas de escrita', async () => {
            // Corpo vazio: a validação responde 400 ou 404, nunca 401 nem 403.
            for (const [method, url] of routes.writers) {
                const response = await call(method, url, profiles.analyst.token);
                assert.ok(![401, 403].includes(response.status), `${method} ${url} → ${response.status}`);
            }
        });
    });

    describe('perfil admin', () => {
        test('passa do middleware nas rotas só do admin', async () => {
            for (const [method, url] of routes.adminOnly.filter(([verb]) => verb === 'get')) {
                const response = await call(method, url, profiles.admin.token);
                assert.equal(response.status, 200, `${method} ${url}`);
            }
        });
    });

    // Comportamento atual: quem está autenticado enxerga os dados de todos e só o papel restringe a escrita.
    describe('escopo de acesso aos dados', () => {
        test('os três perfis veem o mesmo projeto, a mesma demanda e o mesmo cenário', async () => {
            const { project, demanda, scenario } = catalog;
            for (const role of ['admin', 'analyst', 'viewer']) {
                const { token } = profiles[role];
                const projects = await call('get', '/api/projects', token);
                const demandas = await call('get', `/api/demandas?projectId=${project._id}`, token);
                const found = await call('get', `/api/scenarios/${scenario._id}`, token);

                assert.ok(projects.body.some((item) => item._id === project._id.toString()), role);
                assert.deepEqual(demandas.body.map((item) => item._id), [demanda._id.toString()], role);
                assert.equal(found.body.title, scenario.title, role);
            }
        });

        test('um analyst altera o projeto criado por outro analyst', async () => {
            const owner = profiles.analyst;
            const created = await call('post', '/api/projects', owner.token).send({ title: 'Projeto do analyst um' });
            const colleague = await User.create({
                name: 'Fixture colega', username: 'fixture.colega', email: 'fixture.colega@example.test',
                password: 'senha-sintetica-1', role: 'analyst'
            });

            const response = await call('put', `/api/projects/${created.body._id}`, tokenFor(colleague))
                .send({ title: 'Renomeado pelo colega' });

            assert.equal(response.status, 200);
            assert.equal(response.body.title, 'Renomeado pelo colega');
        });

        test('a listagem de um projeto ou de uma demanda não traz registros de outro par', async () => {
            const other = await createCatalog('outro');
            const { token } = profiles.viewer;
            const idsOf = async (url) => (await call('get', url, token)).body.map((item) => item._id);

            for (const own of [catalog, other]) {
                assert.deepEqual(await idsOf(`/api/demandas?projectId=${own.project._id}`), [own.demanda._id.toString()]);
                assert.deepEqual(await idsOf(`/api/scenarios?demandaId=${own.demanda._id}`), [own.scenario._id.toString()]);
            }
        });

        test('o viewer não consegue alterar nem apagar o cenário pelo id direto', async () => {
            const { scenario } = catalog;
            const { token } = profiles.viewer;

            const edited = await call('put', `/api/scenarios/${scenario._id}`, token).send({ title: 'Invadido' });
            const patched = await call('patch', `/api/scenarios/${scenario._id}/status`, token).send({ status: 'Passou' });
            const deleted = await call('delete', `/api/scenarios/${scenario._id}`, token);

            assert.deepEqual([edited.status, patched.status, deleted.status], [403, 403, 403]);
            const stored = await Scenario.findById(scenario._id).lean();
            assert.equal(stored.title, scenario.title);
            assert.equal(stored.status, 'Aguardando');
        });

        test('o viewer não apaga projeto nem demanda pelo id direto', async () => {
            const { project, demanda } = catalog;
            const { token } = profiles.viewer;

            const demandaDeleted = await call('delete', `/api/demandas/${demanda._id}`, token);
            const projectDeleted = await call('delete', `/api/projects/${project._id}`, token);

            assert.deepEqual([demandaDeleted.status, projectDeleted.status], [403, 403]);
            assert.ok(await Demanda.exists({ _id: demanda._id }));
            assert.ok(await Project.exists({ _id: project._id }));
        });

        test('id inexistente responde 404 e não revela dado de outro registro', async () => {
            const missing = new mongoose.Types.ObjectId();

            const scenario = await call('get', `/api/scenarios/${missing}`, profiles.viewer.token);
            const edited = await call('put', `/api/projects/${missing}`, profiles.analyst.token).send({ title: 'x' });

            assert.equal(scenario.status, 404);
            assert.equal(edited.status, 404);
        });

        test('listagens exigem o id do pai e recusam id malformado', async () => {
            const { token } = profiles.viewer;

            assert.equal((await call('get', '/api/demandas', token)).status, 400);
            assert.equal((await call('get', '/api/scenarios', token)).status, 400);
            assert.equal((await call('get', '/api/scenarios?demandaId=nao-e-id', token)).status, 400);
        });

        test('pai inexistente devolve lista vazia, sem dado de outro pai', async () => {
            const missing = new mongoose.Types.ObjectId();

            const demandas = await call('get', `/api/demandas?projectId=${missing}`, profiles.viewer.token);
            const scenarios = await call('get', `/api/scenarios?demandaId=${missing}`, profiles.viewer.token);

            assert.deepEqual([demandas.body, scenarios.body], [[], []]);
        });
    });

    describe('contas de usuário', () => {
        test('o analyst cria viewer e analyst, mas não admin', async () => {
            const { token } = profiles.analyst;
            const create = (username, role) => call('post', '/api/auth/register', token)
                .send({ username, name: `Conta ${username}`, email: `${username}@example.test`, role });

            assert.equal((await create('conta.viewer', 'viewer')).status, 201);
            assert.equal((await create('conta.analyst', 'analyst')).status, 201);
            const denied = await create('conta.admin', 'admin');
            assert.equal(denied.status, 403);
            assert.equal(await User.exists({ username: 'conta.admin' }), null);
        });

        test('sem informar o papel a conta nasce viewer, e o admin cria admin', async () => {
            const noRole = await call('post', '/api/auth/register', profiles.admin.token)
                .send({ username: 'conta.padrao', name: 'Conta Padrão', email: 'conta.padrao@example.test' });
            const admin = await call('post', '/api/auth/register', profiles.admin.token)
                .send({ username: 'conta.admin2', name: 'Conta Admin', email: 'conta.admin2@example.test', role: 'admin' });

            assert.equal(noRole.body.user.role, 'viewer');
            assert.equal(admin.status, 201);
            assert.equal(admin.body.user.role, 'admin');
        });

        test('o analyst não edita admin nem promove ninguém a admin', async () => {
            const { token } = profiles.analyst;
            const edited = await call('put', `/api/users/${profiles.admin.user._id}`, token).send({ name: 'Alterado' });
            const promoted = await call('put', `/api/users/${profiles.viewer.user._id}`, token).send({ role: 'admin' });

            assert.equal(edited.status, 403);
            assert.equal(promoted.status, 403);
            assert.equal((await User.findById(profiles.viewer.user._id).lean()).role, 'viewer');
        });

        test('ninguém apaga a si mesmo', async () => {
            const response = await call('delete', `/api/users/${profiles.analyst.user._id}`, profiles.analyst.token);

            assert.equal(response.status, 400);
            assert.ok(await User.exists({ _id: profiles.analyst.user._id }));
        });

        test('a importação recusa admin e informa a falha por linha', async () => {
            const response = await call('post', '/api/users/import', profiles.admin.token).send({
                users: [{ name: 'Importado Admin', email: 'importado.admin@example.test', role: 'admin' }]
            });

            assert.equal(response.status, 200);
            assert.equal(response.body.results.failed, 1);
            assert.equal(await User.exists({ email: 'importado.admin@example.test' }), null);
        });

        test('a listagem sem /all esconde só a conta de username admin', async () => {
            await User.create({
                name: 'Conta inicial', username: 'admin', email: 'admin.inicial@example.test',
                password: 'senha-sintetica-4', role: 'admin'
            });

            const limited = await call('get', '/api/users', profiles.admin.token);
            const all = await call('get', '/api/users/all', profiles.admin.token);

            assert.equal(limited.body.some((item) => item.username === 'admin'), false);
            assert.equal(all.body.some((item) => item.username === 'admin'), true);
        });
    });
});
