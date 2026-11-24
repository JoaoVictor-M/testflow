import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ConfirmationModal from '../src/components/ConfirmationModal';
import MantisModal from '../src/components/MantisModal';

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
