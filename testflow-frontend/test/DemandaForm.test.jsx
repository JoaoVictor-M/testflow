import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast/headless';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import api from '../src/api';
import DemandaForm from '../src/components/DemandaForm';

const evidence = { _id: 'e1', filename: 'a.txt', originalName: 'a.txt' };
const demanda = (overrides = {}) => ({
    _id: 'd1', demandaId: 'PROJ-1', nome: 'Demanda sintética', tempoEstimado: 2,
    status: 'Pendente', responsaveis: [], evidences: [], ...overrides,
});

// O formulário só deixa marcar Testado quando a demanda já tem evidência.
describe('formulário de demanda: conclusão exige evidência', () => {
    let put;
    let post;
    let toastError;

    beforeEach(() => {
        vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/users/all' ? [] : {} }));
        put = vi.spyOn(api, 'put').mockResolvedValue({ data: demanda() });
        post = vi.spyOn(api, 'post').mockResolvedValue({ data: demanda() });
        toastError = vi.spyOn(toast, 'error').mockImplementation(() => {});
        vi.spyOn(toast, 'success').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    async function submitWithStatus(status, props) {
        const user = userEvent.setup();
        const handlers = { onSaveSuccess: vi.fn(), onClose: vi.fn(), onOpenEvidence: vi.fn() };
        render(<DemandaForm projectId="p1" isModalOpen {...handlers} {...props} />);
        await act(async () => {});
        if (!props.demandaToEdit) {
            await user.type(screen.getByLabelText('Número da Demanda (ID)'), 'PROJ-9');
            await user.type(screen.getByLabelText('Nome da Demanda'), 'Demanda nova');
        }
        await user.selectOptions(screen.getByLabelText('Status'), status);
        await user.click(screen.getByRole('button', { name: /Demanda$/ }));
        return handlers;
    }

    test('sem evidência não salva, avisa e abre o modal de evidências', async () => {
        const handlers = await submitWithStatus('Testado', { demandaToEdit: demanda() });

        expect(put).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalledWith('É necessário anexar evidências antes de marcar como Testado.');
        expect(handlers.onOpenEvidence).toHaveBeenCalledOnce();
        expect(handlers.onClose).not.toHaveBeenCalled();
    });

    test('com evidência envia o status Testado', async () => {
        const handlers = await submitWithStatus('Testado', { demandaToEdit: demanda({ evidences: [evidence] }) });

        await waitFor(() => expect(handlers.onSaveSuccess).toHaveBeenCalledOnce());
        expect(put).toHaveBeenCalledWith('/demandas/d1', expect.objectContaining({ status: 'Testado', demandaId: 'PROJ-1' }));
    });

    test('a lista de plataformas que chega depois não desfaz o status escolhido', async () => {
        let release;
        api.get.mockImplementation((url) => (url === '/config/allowlist'
            ? new Promise((resolve) => { release = () => resolve({ data: {} }); })
            : Promise.resolve({ data: [] })));
        const user = userEvent.setup();
        render(<DemandaForm projectId="p1" isModalOpen onSaveSuccess={vi.fn()} onClose={vi.fn()}
            demandaToEdit={demanda({ evidences: [evidence] })} />);

        await user.selectOptions(screen.getByLabelText('Status'), 'Testado');
        await act(async () => release());
        await user.click(screen.getByRole('button', { name: /Demanda$/ }));

        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        expect(put).toHaveBeenCalledWith('/demandas/d1', expect.objectContaining({ status: 'Testado' }));
    });

    test('uma demanda nova não nasce Testado', async () => {
        await submitWithStatus('Testado', {});

        expect(post).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalledOnce();
    });

    test('os demais status salvam sem evidência', async () => {
        const handlers = await submitWithStatus('Testando', { demandaToEdit: demanda() });

        await waitFor(() => expect(handlers.onSaveSuccess).toHaveBeenCalledOnce());
        expect(put).toHaveBeenCalledWith('/demandas/d1', expect.objectContaining({ status: 'Testando' }));
        expect(handlers.onOpenEvidence).not.toHaveBeenCalled();
    });
});
