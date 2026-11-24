import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ConfirmationModal from '../src/components/ConfirmationModal';
import MantisModal from '../src/components/MantisModal';
import { AuthContext } from '../src/context/AuthContext';
import ScenariosListPage from '../src/pages/ScenariosListPage';

const { mockGet, mockPatch, mockDelete } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPatch: vi.fn(),
    mockDelete: vi.fn(),
}));

vi.mock('../src/api', () => ({
    default: {
        get: mockGet,
        patch: mockPatch,
        delete: mockDelete,
    },
}));

describe('ConfirmationModal: operação assíncrona', () => {
    test('aguarda confirmação assíncrona concluir antes de fechar e bloqueia duplo clique', async () => {
        const user = userEvent.setup();
        let resolveConfirm;
        const onConfirm = vi.fn(() => new Promise((resolve) => {
            resolveConfirm = resolve;
        }));
        const onClose = vi.fn();

        render(
            <ConfirmationModal
                isOpen
                onClose={onClose}
                onConfirm={onConfirm}
                title="Deletar Projeto"
                message="Confirmar exclusão?"
                confirmText="Deletar"
            />
        );

        const confirmBtn = screen.getByRole('button', { name: 'Deletar' });
        await user.click(confirmBtn);

        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Processando/i })).toBeDisabled();

        await act(async () => {
            resolveConfirm();
        });

        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });

    test('mantém o modal aberto e exibe erro quando a confirmação falha', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn().mockRejectedValue({
            response: { data: { message: 'Falha ao excluir no servidor.' } },
        });
        const onClose = vi.fn();

        render(
            <ConfirmationModal
                isOpen
                onClose={onClose}
                onConfirm={onConfirm}
                title="Deletar Projeto"
                message="Confirmar exclusão?"
                confirmText="Deletar"
            />
        );

        await user.click(screen.getByRole('button', { name: 'Deletar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao excluir no servidor.');
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Deletar' })).toBeEnabled();
    });
});

describe('MantisModal: envio assíncrono preserva formulário em erro', () => {
    test('aguarda sucesso antes de limpar o link e fechar', async () => {
        const user = userEvent.setup();
        let resolveSubmit;
        const onSubmit = vi.fn(() => new Promise((resolve) => {
            resolveSubmit = resolve;
        }));
        const onClose = vi.fn();

        render(<MantisModal isOpen onClose={onClose} onSubmit={onSubmit} />);

        const input = screen.getByLabelText('Link do Mantis');
        await user.type(input, 'https://mantis.exemplo.local/view.php?id=42');
        await user.click(screen.getByRole('button', { name: 'Salvar Erro' }));

        expect(onSubmit).toHaveBeenCalledWith('https://mantis.exemplo.local/view.php?id=42');
        expect(onClose).not.toHaveBeenCalled();
        expect(input).toHaveValue('https://mantis.exemplo.local/view.php?id=42');
        expect(screen.getByRole('button', { name: /Salvando/i })).toBeDisabled();

        await act(async () => {
            resolveSubmit();
        });

        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(input).toHaveValue('');
    });

    test('mantém o modal aberto, preserva o link digitado e mostra erro quando salvar falha', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockRejectedValue(new Error('URL fora da lista permitida.'));
        const onClose = vi.fn();

        render(<MantisModal isOpen onClose={onClose} onSubmit={onSubmit} />);

        const input = screen.getByLabelText('Link do Mantis');
        await user.type(input, 'https://mantis.exemplo.local/view.php?id=99');
        await user.click(screen.getByRole('button', { name: 'Salvar Erro' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('URL fora da lista permitida.');
        expect(onClose).not.toHaveBeenCalled();
        expect(input).toHaveValue('https://mantis.exemplo.local/view.php?id=99');
    });
});

describe('ScenariosListPage: integração real dos modais em falha de API', () => {
    const sampleScenario = {
        _id: 'cen-1',
        title: 'Validar envio de evidência',
        description: 'Garante validação de erro',
        steps: ['Abrir tela'],
        expectedResult: 'Erro exibido',
        status: 'Aguardando',
        mantisLink: '',
    };

    const renderScenariosPage = () => render(
        <AuthContext.Provider value={{ user: { role: 'analyst', name: 'Ana QA' } }}>
            <MemoryRouter initialEntries={['/demanda/dem-1/scenarios']}>
                <Routes>
                    <Route path="/demanda/:demandaId/scenarios" element={<ScenariosListPage />} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>
    );

    beforeEach(() => {
        mockGet.mockReset();
        mockPatch.mockReset();
        mockDelete.mockReset();
        mockGet.mockResolvedValue({ data: [sampleScenario] });
    });

    test('erro ao salvar link do Mantis mantém o modal aberto e preserva o texto digitado', async () => {
        const user = userEvent.setup();
        mockPatch
            .mockRejectedValueOnce({ response: { data: { message: 'Falha ao salvar Mantis.' } } })
            .mockResolvedValueOnce({
                data: { ...sampleScenario, status: 'Com Erro', mantisLink: 'https://mantis.exemplo.local/view.php?id=77' },
            });

        renderScenariosPage();
        await user.click(await screen.findByText('Validar envio de evidência'));
        await user.click(screen.getByRole('button', { name: /Erro/i }));

        const input = screen.getByLabelText('Link do Mantis');
        await user.type(input, 'https://mantis.exemplo.local/view.php?id=77');
        await user.click(screen.getByRole('button', { name: 'Salvar Erro' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar Mantis.');
        expect(input).toHaveValue('https://mantis.exemplo.local/view.php?id=77');

        await user.click(screen.getByRole('button', { name: 'Salvar Erro' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('erro ao deletar cenário mantém a confirmação aberta e preserva o cenário na lista', async () => {
        const user = userEvent.setup();
        mockDelete
            .mockRejectedValueOnce({ response: { data: { message: 'Falha ao excluir cenário.' } } })
            .mockResolvedValueOnce({ data: {} });

        renderScenariosPage();
        await user.click(await screen.findByText('Validar envio de evidência'));
        await user.click(screen.getByTitle('Deletar Cenário'));

        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Deletar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Falha ao excluir cenário.');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Validar envio de evidência')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Deletar' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.queryByText('Validar envio de evidência')).not.toBeInTheDocument();
    });
});
