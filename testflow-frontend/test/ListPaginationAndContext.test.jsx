import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast/headless';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import api from '../src/api';
import { AuthContext } from '../src/context/AuthContext';
import AuditLogsPage from '../src/pages/AuditLogsPage';
import DemandasListPage from '../src/pages/DemandasListPage';
import EmailSettings from '../src/pages/EmailSettings';
import ProjectsListPage from '../src/pages/ProjectsListPage';
import UsersManager from '../src/pages/UsersManager';

const adminUser = { id: 'u1', username: 'admin', name: 'Admin Teste', role: 'admin' };

function renderWithAuth(ui, initialEntries = ['/projects']) {
    return render(
        <AuthContext.Provider value={{ user: adminUser }}>
            <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </AuthContext.Provider>
    );
}

const makeProjects = (count) => Array.from({ length: count }, (_, idx) => ({
    _id: `p${String(idx + 1).padStart(2, '0')}`,
    title: `Projeto ${String(idx + 1).padStart(2, '0')}`,
    status: idx % 2 === 0 ? 'Em Andamento' : 'Concluído',
    tags: [],
    versions: [],
    servers: [],
}));

const makeDemandas = (count) => Array.from({ length: count }, (_, idx) => ({
    _id: `d${String(idx + 1).padStart(2, '0')}`,
    demandaId: `DEM-${String(idx + 1).padStart(2, '0')}`,
    nome: `Demanda ${String(idx + 1).padStart(2, '0')}`,
    status: idx % 2 === 0 ? 'Testando' : 'Pendente',
    responsaveis: [],
    evidences: [],
}));

const makeUsers = (count) => Array.from({ length: count }, (_, idx) => ({
    _id: `u${String(idx + 1).padStart(2, '0')}`,
    username: `usuario.${String(idx + 1).padStart(2, '0')}`,
    name: `Usuario ${String(idx + 1).padStart(2, '0')}`,
    email: `u${idx + 1}@exemplo.local`,
    role: 'analyst',
}));

function FakeScenariosScreen() {
    const navigate = useNavigate();
    return (
        <div>
            <h1>Cenários Simulados</h1>
            <button type="button" onClick={() => navigate(-1)}>Voltar</button>
        </div>
    );
}

describe('ProjectsListPage: erro explícito, paginação e deleção', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(toast, 'success').mockImplementation(() => {});
        vi.spyOn(toast, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('exibe erro explícito em vez de estado vazio quando a carga falha e permite tentar novamente', async () => {
        let calls = 0;
        vi.spyOn(api, 'get').mockImplementation(() => {
            calls += 1;
            if (calls === 1) return Promise.reject(new Error('Servidor indisponível'));
            return Promise.resolve({ data: makeProjects(1) });
        });

        const user = userEvent.setup();
        renderWithAuth(<ProjectsListPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar os projetos/i);
        expect(screen.queryByText(/Nenhum projeto encontrado/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
        expect(await screen.findByText('Projeto 01')).toBeInTheDocument();
    });

    test('reconcilia a página ao excluir a última linha da última página', async () => {
        vi.spyOn(api, 'get').mockResolvedValue({ data: makeProjects(11) });
        vi.spyOn(api, 'delete').mockResolvedValue({ data: {} });

        const user = userEvent.setup();
        renderWithAuth(<ProjectsListPage />);

        await screen.findByText('Projeto 11');
        await user.click(screen.getByRole('button', { name: /Próxima/i }));

        expect(screen.getByText('Projeto 01')).toBeInTheDocument();
        expect(screen.getByText(/Página/i)).toHaveTextContent('Página 2 de 2');

        await user.click(screen.getByTitle('Deletar Projeto'));
        await user.click(screen.getByRole('button', { name: 'Deletar' }));

        await waitFor(() => expect(screen.queryByText('Projeto 01')).not.toBeInTheDocument());
        expect(screen.getByText('Projeto 11')).toBeInTheDocument();
        expect(screen.queryByText(/Página 2/i)).not.toBeInTheDocument();
    });

    test('mantém modal de exclusão aberto e mostra erro quando a API falha ao deletar', async () => {
        vi.spyOn(api, 'get').mockResolvedValue({ data: makeProjects(1) });
        vi.spyOn(api, 'delete').mockRejectedValue({
            response: { data: { message: 'Projeto protegido.' } },
        });

        const user = userEvent.setup();
        renderWithAuth(<ProjectsListPage />);

        await screen.findByText('Projeto 01');
        await user.click(screen.getByTitle('Deletar Projeto'));
        await user.click(screen.getByRole('button', { name: 'Deletar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Projeto protegido.');
        expect(screen.getByRole('button', { name: 'Deletar' })).toBeInTheDocument();
        expect(screen.getByText('Projeto 01')).toBeInTheDocument();
    });
});

describe('Navegação hierárquica com MemoryRouter preserva escopo, filtros e página', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(toast, 'success').mockImplementation(() => {});
        vi.spyOn(toast, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('voltar de Cenários -> Demandas -> Projetos restaura filtros e página sem trocar MemoryRouter', async () => {
        const projects = makeProjects(12);
        const demandas = makeDemandas(12);

        vi.spyOn(api, 'get').mockImplementation((url) => {
            if (url === '/projects') return Promise.resolve({ data: projects });
            if (url.startsWith('/demandas?projectId=')) return Promise.resolve({ data: demandas });
            return Promise.resolve({ data: [] });
        });

        const user = userEvent.setup();
        renderWithAuth(
            <Routes>
                <Route path="/projects" element={<ProjectsListPage />} />
                <Route path="/project/:projectId/demandas" element={<DemandasListPage />} />
                <Route path="/demanda/:demandaId/scenarios" element={<FakeScenariosScreen />} />
            </Routes>,
            ['/projects']
        );

        await screen.findByText('Projeto 12');

        // Aplica busca e vai para página 2? Primeiro filtra em Projetos.
        await user.type(screen.getByPlaceholderText('Pesquisar por Título...'), 'Projeto 0');
        await user.click(screen.getByText('Projeto 01'));

        // Na tela de demandas, aplica busca e navega para página 2 de demandas sem busca,
        // depois filtra e entra em cenários.
        await screen.findByText('Demanda 12');
        await user.click(screen.getByRole('button', { name: /Próxima/i }));
        expect(screen.getByText('Demanda 02')).toBeInTheDocument();

        await user.click(screen.getByText('Demanda 02'));
        expect(await screen.findByText('Cenários Simulados')).toBeInTheDocument();

        // Volta dos cenários para demandas (navigate(-1)).
        await user.click(screen.getByRole('button', { name: 'Voltar' }));
        await screen.findByText('Demanda 02');
        expect(screen.getByText(/Página/i)).toHaveTextContent('Página 2 de 2');

        // Volta de demandas para projetos.
        await user.click(screen.getByRole('button', { name: 'Voltar' }));
        await screen.findByText('Projeto 01');
        expect(screen.getByPlaceholderText('Pesquisar por Título...')).toHaveValue('Projeto 0');
        expect(screen.queryByText('Projeto 12')).not.toBeInTheDocument();
    });

    test('reconcilia a última página em DemandasListPage ao excluir a última demanda da página 2', async () => {
        vi.spyOn(api, 'get').mockResolvedValue({ data: makeDemandas(11) });
        vi.spyOn(api, 'delete').mockResolvedValue({ data: {} });

        const user = userEvent.setup();
        renderWithAuth(
            <Routes>
                <Route path="/project/:projectId/demandas" element={<DemandasListPage />} />
            </Routes>,
            ['/project/p01/demandas']
        );

        await screen.findByText('Demanda 11');
        await user.click(screen.getByRole('button', { name: /Próxima/i }));
        expect(screen.getByText('Demanda 01')).toBeInTheDocument();

        await user.click(screen.getByTitle('Deletar Demanda'));
        await user.click(screen.getByRole('button', { name: 'Deletar' }));

        await waitFor(() => expect(screen.queryByText('Demanda 01')).not.toBeInTheDocument());
        expect(screen.getByText('Demanda 11')).toBeInTheDocument();
    });
});

describe('EmailSettings, UsersManager e AuditLogsPage: estados assíncronos e ordenação', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(toast, 'success').mockImplementation(() => {});
        vi.spyOn(toast, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('EmailSettings mostra erro explícito em vez de formulário vazio quando o carregamento falha', async () => {
        let calls = 0;
        vi.spyOn(api, 'get').mockImplementation((url) => {
            calls += 1;
            if (calls <= 2) return Promise.reject(new Error('Erro 500'));
            if (url === '/config/email') {
                return Promise.resolve({
                    data: { host: 'smtp.teste.local', port: '587', user: 'a@b.c', pass: '', secure: false, from: 'a@b.c' },
                });
            }
            return Promise.resolve({ data: { Mantis: 'https://mantis.teste.local/' } });
        });

        const user = userEvent.setup();
        renderWithAuth(<EmailSettings />, ['/email-settings']);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar/i);
        expect(screen.queryByText('Nenhuma URL configurada.')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
        await waitFor(() => expect(screen.getByDisplayValue('smtp.teste.local')).toBeInTheDocument());
    });

    test('UsersManager reconcilia página após exclusão e exibe erro explícito na falha de carga', async () => {
        vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Falha ao listar'));
        const user = userEvent.setup();
        renderWithAuth(<UsersManager />, ['/users']);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar/i);
        expect(screen.queryByText('Nenhum usuário encontrado.')).not.toBeInTheDocument();

        vi.spyOn(api, 'get').mockResolvedValueOnce({ data: makeUsers(11) });
        vi.spyOn(api, 'delete').mockResolvedValue({ data: {} });

        await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
        await screen.findByText('usuario.01');

        await user.click(screen.getByRole('button', { name: /Próxima/i }));
        expect(screen.getByText('usuario.11')).toBeInTheDocument();

        await user.click(screen.getByTitle('Excluir'));
        await user.click(screen.getByRole('button', { name: 'Deletar' }));

        await waitFor(() => expect(screen.queryByText('usuario.11')).not.toBeInTheDocument());
        expect(screen.getByText('usuario.01')).toBeInTheDocument();
    });

    test('AuditLogsPage ignora resposta atrasada fora de ordem e distingue erro de vazio', async () => {
        const resolvers = [];
        vi.spyOn(api, 'get').mockImplementation((url) => {
            if (url === '/users/all') return Promise.resolve({ data: [] });
            if (url === '/audit') {
                return new Promise((resolve, reject) => {
                    resolvers.push({ resolve, reject });
                });
            }
            return Promise.resolve({ data: [] });
        });

        const user = userEvent.setup();
        renderWithAuth(<AuditLogsPage />, ['/audit-logs']);

        // Primeira carga conclui com 2 páginas.
        await act(async () => {
            resolvers[0].resolve({
                data: {
                    data: [{ _id: 'l1', action: 'CREATE', entity: 'Project', createdAt: '2026-01-01T10:00:00Z', user: { name: 'Ana', username: 'ana' } }],
                    pages: 3,
                },
            });
        });
        expect(await screen.findByText('Ana')).toBeInTheDocument();

        // Avança para página 2 e depois página 3 rapidamente.
        await user.click(screen.getByRole('button', { name: 'Próxima' }));
        await act(async () => {
            resolvers[1].resolve({
                data: {
                    data: [{ _id: 'l2', action: 'UPDATE', entity: 'Project', createdAt: '2026-01-02T10:00:00Z', user: { name: 'Bruno', username: 'bruno' } }],
                    pages: 3,
                },
            });
        });
        expect(await screen.findByText('Bruno')).toBeInTheDocument();

        // Dispara duas trocas rápidas de ordenação para criar resposta fora de ordem.
        await user.click(screen.getByRole('button', { name: /Ordenar por/i }));
        await user.click(screen.getByRole('button', { name: 'Usuário' }));
        await user.click(screen.getByRole('button', { name: 'Menu' }));

        const slowOrder = resolvers[2];
        const latestOrder = resolvers[3];

        await act(async () => {
            latestOrder.resolve({
                data: {
                    data: [{ _id: 'l4', action: 'DELETE', entity: 'User', createdAt: '2026-01-04T10:00:00Z', user: { name: 'Daniela', username: 'daniela' } }],
                    pages: 1,
                },
            });
        });
        expect(await screen.findByText('Daniela')).toBeInTheDocument();

        await act(async () => {
            slowOrder.resolve({
                data: {
                    data: [{ _id: 'l3', action: 'CREATE', entity: 'Demanda', createdAt: '2026-01-03T10:00:00Z', user: { name: 'Carlos', username: 'carlos' } }],
                    pages: 1,
                },
            });
        });
        expect(screen.getByText('Daniela')).toBeInTheDocument();
        expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    });

    test('AuditLogsPage exibe erro explícito sem mostrar estado vazio quando a consulta falha', async () => {
        vi.spyOn(api, 'get').mockImplementation((url) => {
            if (url === '/users/all') return Promise.resolve({ data: [] });
            return Promise.reject(new Error('Falha na auditoria'));
        });

        renderWithAuth(<AuditLogsPage />, ['/audit-logs']);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Falha na auditoria/i);
        expect(screen.queryByText('Nenhum registro encontrado.')).not.toBeInTheDocument();
    });

    test('DemandasListPage isola filtros por projeto e cancela carga pendente ao trocar de escopo', async () => {
        const signals = [];
        let resolveP1;
        vi.spyOn(api, 'get').mockImplementation((url, config) => {
            signals.push(config?.signal);
            if (url === '/demandas?projectId=p1') {
                return new Promise((resolve) => {
                    resolveP1 = () => resolve({ data: makeDemandas(1) });
                });
            }
            if (url === '/demandas?projectId=p2') {
                return Promise.resolve({
                    data: [{ _id: 'dx', demandaId: 'P2-01', nome: 'Demanda Projeto Dois', status: 'Pendente', responsaveis: [], evidences: [] }],
                });
            }
            return Promise.resolve({ data: [] });
        });

        function SwitchProjectButton() {
            const navigate = useNavigate();
            return <button type="button" onClick={() => navigate('/project/p2/demandas')}>Ir para P2</button>;
        }

        const user = userEvent.setup();
        renderWithAuth(
            <>
                <SwitchProjectButton />
                <Routes>
                    <Route path="/project/:projectId/demandas" element={<DemandasListPage />} />
                </Routes>
            </>,
            ['/project/p1/demandas']
        );

        await waitFor(() => expect(signals).toHaveLength(1));
        await user.click(screen.getByRole('button', { name: 'Ir para P2' }));

        expect(signals[0]?.aborted).toBe(true);
        await act(async () => {
            resolveP1();
        });
        expect(await screen.findByText('Demanda Projeto Dois')).toBeInTheDocument();
        expect(screen.queryByText('Demanda 01')).not.toBeInTheDocument();
    });
});
