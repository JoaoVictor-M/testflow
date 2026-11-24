const { test, expect } = require('@playwright/test');

const rotasProtegidas = [
    ['get', '/api/projects'],
    ['get', '/api/demandas'],
    ['get', '/api/scenarios'],
    ['get', '/api/stats'],
    ['post', '/api/projects'],
    ['post', '/api/demandas'],
    ['post', '/api/scenarios'],
];

test('a API informa a versão sem exigir login', async ({ request }) => {
    const resposta = await request.get('/api/system/version');

    expect(resposta.status()).toBe(200);
    expect((await resposta.json()).version).toMatch(/^\d+\.\d+\.\d+$/);
});

for (const [metodo, rota] of rotasProtegidas) {
    test(`${metodo.toUpperCase()} ${rota} recusa quem não fez login`, async ({ request }) => {
        const resposta = await request[metodo](rota);

        expect(resposta.status()).toBe(401);
    });
}

test('a senha errada não gera token', async ({ request }) => {
    const resposta = await request.post('/api/auth/login', {
        data: { username: process.env.TESTFLOW_E2E_USER, password: 'senha-incorreta' },
    });

    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).not.toHaveProperty('token');
});

test('o administrador autenticado lê os projetos', async ({ request }) => {
    const login = await request.post('/api/auth/login', {
        data: { username: process.env.TESTFLOW_E2E_USER, password: process.env.TESTFLOW_E2E_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const { token, user } = await login.json();
    expect(user.role).toBe('admin');

    const projetos = await request.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } });

    expect(projetos.status()).toBe(200);
    expect(Array.isArray(await projetos.json())).toBe(true);
});
