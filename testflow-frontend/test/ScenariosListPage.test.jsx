import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import api from '../src/api';
import { AuthContext } from '../src/context/AuthContext';
import ScenariosListPage from '../src/pages/ScenariosListPage';

const DEMANDA_ID = 'demanda-ordem-1';

const initialFixture = () => [
    {
        _id: '65a000000000000000000030',
        title: 'Último cenário',
        description: 'Fluxo de checkout',
        steps: ['Abrir checkout'],
        expectedResult: 'Pedido concluído',
        demanda: DEMANDA_ID,
        status: 'Passou',
        mantisLink: '',
        createdAt: '2026-01-12T10:00:00.000Z',
        updatedAt: '2026-01-12T10:00:00.000Z',
    },
    {
        _id: '65a000000000000000000022',
        title: 'Empate B',
        description: 'Fluxo de cadastro',
        steps: ['Preencher formulário'],
        expectedResult: 'Conta criada',
        demanda: DEMANDA_ID,
        status: 'Com Erro',
        mantisLink: '',
        createdAt: '2026-01-11T10:00:00.000Z',
        updatedAt: '2026-01-11T10:00:00.000Z',
    },
    {
        _id: '65a000000000000000000010',
        title: 'Primeiro cenário',
        description: 'Fluxo de login',
        steps: ['Informar credenciais'],
        expectedResult: 'Acesso liberado',
        demanda: DEMANDA_ID,
        status: 'Passou',
        mantisLink: '',
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-01-10T10:00:00.000Z',
    },
    {
        _id: '65a000000000000000000021',
        title: 'Empate A',
        description: 'Fluxo de cadastro',
        steps: ['Validar campos'],
        expectedResult: 'Validação exibida',
        demanda: DEMANDA_ID,
        status: 'Aguardando',
        mantisLink: '',
        createdAt: '2026-01-11T10:00:00.000Z',
        updatedAt: '2026-01-11T10:00:00.000Z',
    },
];

const compareChronologically = (a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt) || a._id.localeCompare(b._id);

function createScenarioBackendMock() {
    const store = initialFixture();
    let seq = 40;

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
        if (url === `/scenarios?demandaId=${DEMANDA_ID}`) {
            const sorted = [...store].sort(compareChronologically).map((item) => ({ ...item }));
            return { data: sorted };
        }
        throw new Error(`GET inesperado: ${url}`);
    });

    vi.spyOn(api, 'post').mockImplementation(async (url, payload) => {
        if (url !== '/scenarios') throw new Error(`POST inesperado: ${url}`);
        seq += 1;
        const createdAt = new Date(Date.UTC(2026, 0, 15, 10, seq, 0)).toISOString();
        const created = {
            _id: `65a0000000000000000000${seq}`,
            title: payload.title,
            description: payload.description,
            steps: payload.steps,
            expectedResult: payload.expectedResult,
            demanda: payload.demanda,
            status: 'Aguardando',
            mantisLink: '',
            createdAt,
            updatedAt: createdAt,
        };
        store.push(created);
        return { data: { ...created } };
    });

    vi.spyOn(api, 'put').mockImplementation(async (url, payload) => {
        const id = url.replace('/scenarios/', '');
        const index = store.findIndex((item) => item._id === id);
        if (index < 0) throw new Error(`PUT inesperado: ${url}`);
        const updated = {
            ...store[index],
            title: payload.title,
            description: payload.description,
            steps: payload.steps,
            expectedResult: payload.expectedResult,
            updatedAt: new Date(Date.UTC(2026, 0, 20, 12, 0, 0)).toISOString(),
        };
        store[index] = updated;
        return { data: { ...updated } };
    });

    return { store };
}

function renderPage() {
    return render(
        <AuthContext.Provider value={{ user: { role: 'analyst', name: 'Ana Teste' } }}>
            <MemoryRouter initialEntries={[`/demanda/${DEMANDA_ID}/scenarios`]}>
                <Routes>
                    <Route path="/demanda/:demandaId/scenarios" element={<ScenariosListPage />} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

const displayedTitles = () =>
    screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

describe('listagem de cenários: ordenação cronológica estável', () => {
    let originalGetAnimations;

    beforeAll(() => {
        if (!globalThis.ResizeObserver) {
            globalThis.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            };
        }
        originalGetAnimations = Element.prototype.getAnimations;
        Element.prototype.getAnimations = () => [];
    });

    afterAll(() => {
        Element.prototype.getAnimations = originalGetAnimations;
    });

    beforeEach(() => {
        createScenarioBackendMock();
        vi.spyOn(toast, 'success').mockImplementation(() => {});
        vi.spyOn(toast, 'error').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    async function fillField(user, label, value) {
        const input = screen.getByLabelText(label);
        await user.click(input);
        await user.clear(input);
        await user.paste(value);
    }

    test('exibe cenários na ordem crescente de criação com desempate estável', async () => {
        renderPage();

        await screen.findByText('Primeiro cenário');

        expect(displayedTitles()).toEqual([
            'Primeiro cenário',
            'Empate A',
            'Empate B',
            'Último cenário',
        ]);
    });

    test('criar cenário posiciona no fim da ordem cronológica e mantém após recarga', async () => {
        const user = userEvent.setup();
        const { unmount } = renderPage();
        await screen.findByText('Primeiro cenário');

        await user.click(screen.getByRole('button', { name: '+ Novo Cenário' }));
        await fillField(user, 'Título', 'Cenário recém-criado');
        await fillField(user, 'Descrição', 'Fluxo adicional');
        await fillField(user, 'Passos (um por linha)', 'Passo único');
        await fillField(user, 'Resultado Esperado', 'Salvo na ordem');
        await user.click(screen.getByRole('button', { name: 'Salvar Cenário' }));

        await waitFor(() => {
            expect(displayedTitles()).toEqual([
                'Primeiro cenário',
                'Empate A',
                'Empate B',
                'Último cenário',
                'Cenário recém-criado',
            ]);
        });

        unmount();
        renderPage();
        await screen.findByText('Cenário recém-criado');

        expect(displayedTitles()).toEqual([
            'Primeiro cenário',
            'Empate A',
            'Empate B',
            'Último cenário',
            'Cenário recém-criado',
        ]);
    });

    test('duplicar cenário antigo posiciona a cópia na ordem cronológica e mantém após recarga', async () => {
        const user = userEvent.setup();
        const { unmount } = renderPage();
        await screen.findByText('Primeiro cenário');

        await user.click(screen.getByText('Primeiro cenário'));
        await user.click(screen.getByTitle('Duplicar Cenário'));
        await user.click(screen.getByRole('button', { name: 'Duplicar Cenário' }));

        await waitFor(() => {
            expect(displayedTitles()).toEqual([
                'Primeiro cenário',
                'Empate A',
                'Empate B',
                'Último cenário',
                'Primeiro cenário (Cópia)',
            ]);
        });

        unmount();
        renderPage();
        await screen.findByText('Primeiro cenário (Cópia)');

        expect(displayedTitles()).toEqual([
            'Primeiro cenário',
            'Empate A',
            'Empate B',
            'Último cenário',
            'Primeiro cenário (Cópia)',
        ]);
    });

    test('editar cenário mantém a posição original antes e depois da recarga', async () => {
        const user = userEvent.setup();
        const { unmount } = renderPage();
        await screen.findByText('Primeiro cenário');

        await user.click(screen.getByText('Primeiro cenário'));
        await user.click(screen.getByRole('button', { name: 'Editar' }));
        await fillField(user, 'Título', 'Primeiro cenário editado');
        await user.click(screen.getByRole('button', { name: 'Atualizar Cenário' }));

        await waitFor(() => {
            expect(displayedTitles()).toEqual([
                'Primeiro cenário editado',
                'Empate A',
                'Empate B',
                'Último cenário',
            ]);
        });

        unmount();
        renderPage();
        await screen.findByText('Primeiro cenário editado');

        expect(displayedTitles()).toEqual([
            'Primeiro cenário editado',
            'Empate A',
            'Empate B',
            'Último cenário',
        ]);
    });

    test('busca textual e filtro por status conservam a ordem relativa', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Primeiro cenário');

        const searchInput = screen.getByPlaceholderText('Pesquisar cenários...');
        await user.click(searchInput);
        await user.paste('cadastro');
        expect(displayedTitles()).toEqual(['Empate A', 'Empate B']);

        await user.clear(searchInput);
        await user.click(screen.getByRole('button', { name: /Filtros/ }));
        await user.selectOptions(screen.getByLabelText('Status'), 'Passou');
        expect(displayedTitles()).toEqual(['Primeiro cenário', 'Último cenário']);

        await user.click(searchInput);
        await user.paste('Fluxo');
        expect(displayedTitles()).toEqual(['Primeiro cenário', 'Último cenário']);
    });
});
