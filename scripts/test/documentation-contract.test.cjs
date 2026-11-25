// Run in Node 20; reads only files of the repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('API README describes the stack that ships and how to run it', () => {
    const readme = read('testflow-app/README.md');

    assert.doesNotMatch(readme, /Kubernetes|Vue|\bMVP\b|Postman|Visual Studio Code/i);
    assert.doesNotMatch(readme, /^\.\.\.$/m, 'API README must not keep elided placeholders');
    assert.match(readme, /React/);
    assert.match(readme, /scripts\/dev\.sh up/);
    assert.match(readme, /Authorization: Bearer/);
    assert.doesNotMatch(readme, /rotas de dados esperam/i);
});

test('API README documents the route groups that exist in server.js', () => {
    const readme = read('testflow-app/README.md');
    const server = read('testflow-app/server.js');
    const routes = [...server.matchAll(/app\.(?:get|post|put|patch|delete)\('(\/api\/[a-z-]+)/g)].map((m) => m[1]);

    assert.ok(routes.length > 0);
    for (const group of new Set(routes)) {
        assert.ok(readme.includes(group), `API README must mention ${group}`);
    }
});

test('root README and SECURITY describe what exists, without superlatives or unverifiable guarantees', () => {
    const readme = read('README.md');
    const security = read('SECURITY.md');

    assert.doesNotMatch(security, /estado da arte|padrão ouro|vasta maioria|fecham as brechas/i);
    assert.doesNotMatch(security, /Todas e quaisquer/i);
    assert.doesNotMatch(readme, /galeria integrada|Reversa por Nginx|em tempo real/i);
    assert.match(readme, /Administradores, Analistas e Visualizadores/);
    assert.match(readme, /descreve apenas o que a versão atual entrega/i);
    assert.match(readme, /projetos, demandas, cenários e usuários, com a comparação/);
    assert.doesNotMatch(readme, /usuários e configurações/);
});

test('SECURITY states the password and CSP facts as implemented', () => {
    const security = read('SECURITY.md');

    assert.doesNotMatch(security, /no frontend e backend/i);
    assert.doesNotMatch(security, /política estrita de \*\*Content Security Policy/i);
    assert.match(security, /redefinição de senha/i);
    assert.match(security, /Projetos, Demandas, Cenários e Usuários são registradas/);
    assert.doesNotMatch(security, /Usuários e das configurações/);
    assert.match(security, /quando há certificado TLS/);
    assert.match(security, /Sem certificado, o Nginx serve apenas HTTP/);
    assert.doesNotMatch(security, /Todo o tráfego HTTP na porta 80 é forçado/);
});
