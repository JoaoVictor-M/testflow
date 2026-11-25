import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import AboutModal from '../src/components/AboutModal';
import DeveloperCreditsModal from '../src/components/DeveloperCreditsModal';
import DocumentationModal from '../src/components/DocumentationModal';
import ReleaseNotes from '../src/components/ReleaseNotes';
import { APP_VERSION } from '../src/version';

async function openHelpTab(label) {
    const user = userEvent.setup();
    const { container } = render(<DocumentationModal isOpen onClose={vi.fn()} />);
    if (label) await user.click(screen.getByRole('button', { name: label }));
    return container.textContent;
}

describe('ajuda embutida descreve só o que a versão entrega', () => {
    test('a introdução informa a versão descrita e separa o que ainda não existe', async () => {
        const text = await openHelpTab();

        expect(text).toContain(APP_VERSION);
        expect(text).toMatch(/só entram aqui quando forem entregues/i);
    });

    test('demandas usam os quatro status do sistema e não prometem outros', async () => {
        const text = await openHelpTab('Demandas');

        for (const status of ['Pendente', 'Testando', 'Aguardando Correção', 'Testado']) {
            expect(text).toContain(status);
        }
        expect(text).not.toMatch(/Em Andamento|Finalizado|Não testável/);
        expect(text).not.toMatch(/Tags/);
        expect(text).toMatch(/formulário da demanda não permite marcar como "Testado" sem evidência/i);
    });

    test('projetos listam os campos reais e dizem o que a duplicação copia', async () => {
        const text = await openHelpTab('Projetos');

        expect(text).toMatch(/Título/);
        expect(text).toMatch(/Tags/);
        expect(text).not.toMatch(/Descrição|único/);
        expect(text).toMatch(/demandas e cenários/i);
        expect(text).toMatch(/evidências \(arquivos\) não são copiadas/i);
        expect(text).not.toMatch(/sistema de arquivos/i);
    });

    test('cenários citam o resultado de cada execução e a duplicação', async () => {
        const text = await openHelpTab('Cenários');

        for (const result of ['Aguardando', 'Passou', 'Com Erro']) {
            expect(text).toContain(result);
        }
        expect(text).toMatch(/Duplicar/);
    });

    test('evidências não prometem arrastar e soltar e informam tipos e tamanho aceitos', async () => {
        const text = await openHelpTab('Evidências');

        expect(text).not.toMatch(/arraste|solte/i);
        expect(text).toMatch(/50 MB/);
        for (const extension of ['.pdf', '.png', '.mp4', '.log']) {
            expect(text).toContain(extension);
        }
    });

    test('usuários listam os três perfis e não prometem autoedição de perfil', async () => {
        const text = await openHelpTab('Usuários');

        expect(text).toMatch(/ADMINISTRADOR/);
        expect(text).toMatch(/ANALISTA/);
        expect(text).toMatch(/VISUALIZADOR/);
        expect(text).not.toMatch(/seu próprio perfil/i);
    });

    test('auditoria cita só criação, edição e exclusão', async () => {
        const text = await openHelpTab('Auditoria');

        expect(text).toMatch(/Criação/);
        expect(text).toMatch(/Exclusão/);
        expect(text).not.toMatch(/Duplicação/);
        expect(text).toMatch(/projetos, demandas, cenários e usuários\./);
        expect(text).not.toMatch(/usuários e configurações/i);
    });

    test('configurações incluem as URLs permitidas além do SMTP', async () => {
        const text = await openHelpTab('Configurações');

        expect(text).toMatch(/URLs Permitidas/);
        expect(text).toMatch(/SMTP/);
    });
});

describe('Sobre e notas da versão', () => {
    test('Sobre não promete desempenho, escala nem rastreabilidade total', () => {
        const { container } = render(<AboutModal isOpen onClose={vi.fn()} />);

        expect(container.textContent).not.toMatch(/definitiva|sem perder performance|rastreabilidade total|em segundos/i);
        expect(container.textContent).toMatch(/AGPLv3/);
    });

    test('notas da versão mostram a versão instalada e nenhuma garantia de segurança', () => {
        const { container } = render(<ReleaseNotes isOpen onClose={vi.fn()} version={APP_VERSION} />);
        const text = container.textContent;

        expect(text).toContain(`TestFlow ${APP_VERSION}`);
        expect(text).not.toMatch(/Production Ready|pentest|CWE-|Remediação completa/i);
        expect(text).not.toMatch(/apenas Administradores podem gerenciar usuários/i);
        expect(text).not.toMatch(/restrito a admin para rotas de gestão de usuários/i);
    });
});

describe('créditos do desenvolvedor', () => {
    test('mantêm os links de LinkedIn e GitHub abrindo em nova aba sem vazar a origem', () => {
        render(<DeveloperCreditsModal isOpen onClose={vi.fn()} />);

        const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
        const github = screen.getByRole('link', { name: 'GitHub' });

        expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/joao-victor-melo/');
        expect(github).toHaveAttribute('href', 'https://github.com/JoaoVictor-M');
        for (const link of [linkedin, github]) {
            expect(link).toHaveAttribute('target', '_blank');
            expect(link.getAttribute('rel')).toMatch(/noopener/);
        }
    });
});
