const { test, expect, entrar, abrirMenu } = require('./apoio');

test('o administrador cria projeto, demanda e cenário pela interface', async ({ page }) => {
    const sufixo = Date.now().toString(36);
    const projeto = `Projeto e2e ${sufixo}`;
    const demanda = `Demanda e2e ${sufixo}`;
    const cenario = `Cenário e2e ${sufixo}`;

    await entrar(page);
    await abrirMenu(page, 'Gerenciamento', 'Projetos');
    await page.getByRole('button', { name: '+ Novo Projeto' }).click();
    await page.getByLabel('Título do Projeto').fill(projeto);
    await page.getByRole('button', { name: 'Salvar Projeto' }).click();
    await page.getByText(projeto).click();

    // Cada passo espera o botão da tela seguinte.
    await page.getByRole('button', { name: '+ Nova Demanda' }).click();
    await page.getByLabel('Número da Demanda (ID)').fill(`E2E-${sufixo}`);
    await page.getByLabel('Nome da Demanda').fill(demanda);
    await page.getByRole('button', { name: 'Salvar Demanda' }).click();
    await page.getByText(demanda).click();

    await page.getByRole('button', { name: '+ Novo Cenário' }).click();
    await page.getByLabel('Título', { exact: true }).fill(cenario);
    await page.getByLabel('Descrição', { exact: true }).fill('Cenário criado pelo teste ponta a ponta');
    await page.getByLabel('Passos (um por linha)').fill('Abrir a tela\nConferir o resultado');
    await page.getByLabel('Resultado Esperado', { exact: true }).fill('A tela responde sem erro');
    await page.getByRole('button', { name: 'Salvar Cenário' }).click();

    await expect(page.getByRole('heading', { name: cenario })).toBeVisible();
});
