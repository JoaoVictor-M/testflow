import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import api from '../src/api';
import DashboardPage from '../src/pages/DashboardPage';

const makeStats = (overrides = {}) => ({
    totalHorasEstimadas: 10,
    totalDemandas: 2,
    totalScenarios: 5,
    scenariosByStatus: { Passou: 3, 'Com Erro': 1, Aguardando: 1 },
    demandasByStatus: { Testado: 1, Testando: 1, 'Aguardando Correção': 0, Pendente: 0 },
    horasPorProjeto: [],
    demandasByTester: [],
    horasByTester: [],
    testandoByTester: [],
    demandasMaisBugs: [],
    ...overrides,
});

describe('DashboardPage: estados assíncronos e respostas fora de ordem', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('exibe erro explícito com opção de tentar novamente quando o carregamento inicial falha', async () => {
        let statsCalls = 0;
        vi.spyOn(api, 'get').mockImplementation((url) => {
            if (url === '/projects') return Promise.resolve({ data: [] });
            if (url === '/responsaveis') return Promise.resolve({ data: [] });
            if (url.startsWith('/stats')) {
                statsCalls += 1;
                if (statsCalls === 1) {
                    return Promise.reject(new Error('Falha de rede'));
                }
                return Promise.resolve({ data: makeStats({ totalDemandas: 7 }) });
            }
            return Promise.resolve({ data: [] });
        });

        const user = userEvent.setup();
        render(<DashboardPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar/i);
        await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));

        await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
    });

    test('prevalece a última consulta ativa quando respostas chegam fora de ordem e cancela a anterior', async () => {
        const pendingByProject = {};
        const signals = [];

        vi.spyOn(api, 'get').mockImplementation((url, config) => {
            if (url === '/projects') {
                return Promise.resolve({
                    data: [
                        { _id: 'p1', title: 'Projeto Alpha' },
                        { _id: 'p2', title: 'Projeto Beta' },
                    ],
                });
            }
            if (url === '/responsaveis') return Promise.resolve({ data: [] });
            if (url === '/stats?') {
                return Promise.resolve({ data: makeStats({ totalDemandas: 100 }) });
            }
            if (url.includes('projectId=p1')) {
                signals.push(config?.signal);
                return new Promise((resolve) => {
                    pendingByProject.p1 = () => resolve({ data: makeStats({ totalDemandas: 11 }) });
                });
            }
            if (url.includes('projectId=p2')) {
                signals.push(config?.signal);
                return new Promise((resolve) => {
                    pendingByProject.p2 = () => resolve({ data: makeStats({ totalDemandas: 22 }) });
                });
            }
            return Promise.resolve({ data: makeStats() });
        });

        const user = userEvent.setup();
        render(<DashboardPage />);

        await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());

        const projectSelect = screen.getByLabelText('Filtrar por Projeto');
        await user.selectOptions(projectSelect, 'p1');
        await user.selectOptions(projectSelect, 'p2');

        // A consulta de p1 deve ter sido cancelada quando p2 iniciou.
        expect(signals[0]?.aborted).toBe(true);

        // Resposta mais recente (p2) chega primeiro.
        await act(async () => {
            pendingByProject.p2();
        });
        await waitFor(() => expect(screen.getByText('22')).toBeInTheDocument());

        // Resposta atrasada (p1) chega depois e não deve sobrescrever p2.
        await act(async () => {
            pendingByProject.p1();
        });
        expect(screen.getByText('22')).toBeInTheDocument();
        expect(screen.queryByText('11')).not.toBeInTheDocument();
    });

    test('mantém dados anteriores visíveis com aviso explícito quando uma atualização de filtro falha', async () => {
        vi.spyOn(api, 'get').mockImplementation((url) => {
            if (url === '/projects') {
                return Promise.resolve({ data: [{ _id: 'p1', title: 'Projeto Alpha' }] });
            }
            if (url === '/responsaveis') return Promise.resolve({ data: [] });
            if (url === '/stats?') {
                return Promise.resolve({ data: makeStats({ totalDemandas: 42 }) });
            }
            if (url.includes('projectId=p1')) {
                return Promise.reject(new Error('Timeout'));
            }
            return Promise.resolve({ data: makeStats() });
        });

        const user = userEvent.setup();
        render(<DashboardPage />);

        await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

        await user.selectOptions(screen.getByLabelText('Filtrar por Projeto'), 'p1');

        expect(await screen.findByRole('alert')).toHaveTextContent(/anteriores/i);
        expect(screen.getByText('42')).toBeInTheDocument();
    });
});
