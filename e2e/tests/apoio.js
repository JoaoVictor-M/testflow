const base = require('@playwright/test');

// Every test fails if the browser reports a Content Security Policy violation on any screen it opens.
// The event says which directive, which file and which sample of the content was refused.
const test = base.test.extend({
    violacoesCsp: [async ({ page }, use) => {
        const violacoes = [];
        await page.exposeFunction('registrarViolacaoCsp', (violacao) => violacoes.push(violacao));
        await page.addInitScript(() => {
            document.addEventListener('securitypolicyviolation', (evento) => {
                window.registrarViolacaoCsp(`${evento.violatedDirective} em ${evento.sourceFile || 'a página'}:${evento.lineNumber} ` +
                    `[${evento.sample.slice(0, 60)}]`);
            });
        });
        await use(violacoes);
        // The same kind repeats for each rule or style: show each one once.
        base.expect([...new Set(violacoes)].slice(0, 5), 'violações de CSP').toEqual([]);
    }, { auto: true }],
});

// The step is boxed so that the report shows no line with the typed password.
async function entrar(page) {
    await test.step('entrar como administrador', async () => {
        await page.goto('/testflow/');
        await page.getByPlaceholder('Digite seu usuário').fill(process.env.TESTFLOW_E2E_USER);
        await page.getByPlaceholder('Digite sua senha').fill(process.env.TESTFLOW_E2E_PASSWORD);
        await page.getByRole('button', { name: 'Entrar' }).click();
        await base.expect(page.getByRole('button', { name: 'Gerenciamento' })).toBeVisible();
    }, { box: true });
}

// The router lives in memory (the URL never changes) and so does the session: go through the menus.
async function abrirMenu(page, menu, item) {
    await page.getByRole('button', { name: menu }).click();
    await page.getByRole('menuitem', { name: item }).click();
}

module.exports = { test, expect: base.expect, entrar, abrirMenu };
