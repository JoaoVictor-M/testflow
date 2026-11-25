const { test, entrar, abrirMenu } = require('./apoio');

const telas = [
    ['Visualização', 'Dashboard'],
    ['Visualização', 'Auditoria'],
    ['Gerenciamento', 'Usuários'],
    ['Gerenciamento', 'Configurações Globais'],
];

test('as telas do administrador abrem sem violar a política de conteúdo', async ({ page }) => {
    await entrar(page);
    for (const [menu, item] of telas) {
        await abrirMenu(page, menu, item);
        await page.waitForLoadState('networkidle');
    }
});
