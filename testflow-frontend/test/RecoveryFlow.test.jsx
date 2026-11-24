import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '../src/context/AuthContext';
import ForgotPassword from '../src/pages/ForgotPassword';
import Login from '../src/pages/Login';
import ResetPassword from '../src/pages/ResetPassword';

const { mockGet, mockPost } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
}));

vi.mock('../src/api', () => ({
    default: {
        get: mockGet,
        post: mockPost,
    },
}));

function renderFlow(initialEntry, login = vi.fn()) {
    return render(
        <AuthContext.Provider value={{ login }}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/" element={<p>Tela inicial</p>} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe('fluxo de recuperação e redefinição de senha', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        window.history.replaceState(null, '', '/testflow');
    });

    describe('esqueci minha senha', () => {
        test('exibe resposta genérica sem confirmar existência da conta', async () => {
            mockPost.mockResolvedValueOnce({
                data: { message: 'Se os dados estiverem corretos, um email de recuperação será enviado.' },
            });
            renderFlow('/forgot-password');
            const user = userEvent.setup();

            await user.type(screen.getByPlaceholderText('Seu nome de usuário'), 'qualquer.conta');
            await user.type(screen.getByPlaceholderText('seu.email@exemplo.com'), 'qualquer@example.test');
            await user.click(screen.getByRole('button', { name: 'Enviar Link de Recuperação' }));

            expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', {
                username: 'qualquer.conta',
                email: 'qualquer@example.test',
            });
            expect(await screen.findByText(/Se os dados estiverem corretos/i)).toBeInTheDocument();
            expect(screen.queryByText(/Enviamos um link de recuperação para/i)).not.toBeInTheDocument();
        });

        test('mostra aviso quando o limite de tentativas é atingido ou a rede falha', async () => {
            mockPost
                .mockRejectedValueOnce({
                    response: {
                        status: 429,
                        data: { message: 'Muitas tentativas. Aguarde alguns instantes e tente novamente.' },
                    },
                })
                .mockRejectedValueOnce(new Error('Network Error'));

            renderFlow('/forgot-password');
            const user = userEvent.setup();

            await user.type(screen.getByPlaceholderText('Seu nome de usuário'), 'ana.teste');
            await user.type(screen.getByPlaceholderText('seu.email@exemplo.com'), 'ana@example.test');
            await user.click(screen.getByRole('button', { name: 'Enviar Link de Recuperação' }));

            expect(await screen.findByRole('alert')).toHaveTextContent(/Muitas tentativas/i);

            await user.click(screen.getByRole('button', { name: 'Enviar Link de Recuperação' }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível conectar/i);
        });

        test('ajuda contextual abre e fecha com foco de teclado e toque', async () => {
            renderFlow('/forgot-password');
            const user = userEvent.setup();
            const helpButton = screen.getByRole('button', { name: /Ajuda sobre recuperação/i });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            act(() => {
                helpButton.focus();
            });
            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            await user.keyboard('{Escape}');
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            fireEvent.pointerDown(helpButton, { pointerType: 'touch' });
            fireEvent.click(helpButton);
            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            fireEvent.pointerDown(document.body, { pointerType: 'touch' });
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('redefinição de senha', () => {
        test('mantém a base /testflow ao limpar o token da URL após validação', async () => {
            const replaceSpy = vi.spyOn(window.history, 'replaceState');
            mockGet.mockResolvedValueOnce({
                data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
            });

            renderFlow('/reset-password/token-valido-123');

            expect(await screen.findByText('Maria Teste')).toBeInTheDocument();
            expect(replaceSpy).toHaveBeenCalled();
            const lastUrl = replaceSpy.mock.calls.at(-1)[2];
            expect(lastUrl).toMatch(/^\/testflow(\/|$)/);
            expect(lastUrl).not.toContain('token-valido-123');
            replaceSpy.mockRestore();
        });

        test('falha de rede na validação não afirma token inválido e permite tentar novamente', async () => {
            mockGet
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({
                    data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
                });

            renderFlow('/reset-password/token-rede-123');
            const user = userEvent.setup();

            expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
            expect(screen.queryByText(/Link Inválido ou Expirado/i)).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(await screen.findByText('Maria Teste')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Digite sua nova senha')).toBeInTheDocument();
        });

        test('limite temporário (429) na validação permite tentar novamente sem afirmar token inválido', async () => {
            mockGet
                .mockRejectedValueOnce({
                    response: {
                        status: 429,
                        data: { message: 'Muitas tentativas. Aguarde alguns instantes e tente novamente.' },
                    },
                })
                .mockResolvedValueOnce({
                    data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
                });

            renderFlow('/reset-password/token-rate-limit');
            const user = userEvent.setup();

            expect(await screen.findByRole('alert')).toHaveTextContent(/Muitas tentativas/i);
            expect(screen.queryByText(/Link Inválido ou Expirado/i)).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
            expect(await screen.findByText('Maria Teste')).toBeInTheDocument();
        });

        test('token inválido ou expirado exibe estado próprio sem oferecer retry enganoso', async () => {
            mockGet.mockRejectedValueOnce({
                response: { status: 400, data: { message: 'Token inválido ou expirado' } },
            });

            renderFlow('/reset-password/token-expirado');

            expect(await screen.findByText('Link Inválido ou Expirado')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
        });

        test('ajuda de requisitos de senha funciona com foco e toque', async () => {
            mockGet.mockResolvedValueOnce({
                data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
            });

            renderFlow('/reset-password/token-ajuda');
            const user = userEvent.setup();

            const helpButton = await screen.findByRole('button', { name: /Requisitos da senha/i });
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            act(() => {
                helpButton.focus();
            });
            expect(screen.getByRole('tooltip')).toHaveTextContent(/Mínimo 8 caracteres/i);

            await user.keyboard('{Escape}');
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            fireEvent.pointerDown(helpButton, { pointerType: 'touch' });
            fireEvent.click(helpButton);
            expect(screen.getByRole('tooltip')).toHaveTextContent(/Mínimo 8 caracteres/i);

            fireEvent.pointerDown(helpButton, { pointerType: 'touch' });
            fireEvent.click(helpButton);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        test('sucesso da redefinição navega ao login mantendo o feedback visível e a URL na base /testflow', async () => {
            const replaceSpy = vi.spyOn(window.history, 'replaceState');
            mockGet.mockResolvedValueOnce({
                data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
            });
            mockPost.mockResolvedValueOnce({
                data: { message: 'Senha alterada com sucesso' },
            });

            renderFlow('/reset-password/token-sucesso');
            const user = userEvent.setup();

            await user.type(await screen.findByPlaceholderText('Digite sua nova senha'), 'Senha@123');
            await user.type(screen.getByPlaceholderText('Confirme sua nova senha'), 'Senha@123');
            await user.click(screen.getByRole('button', { name: 'Definir Senha e Entrar' }));

            expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
                token: 'token-sucesso',
                newPassword: 'Senha@123',
            });
            expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(/Senha redefinida com sucesso/i);
            await waitFor(() => {
                expect(replaceSpy.mock.calls.at(-1)[2]).toBe('/testflow');
            });
            replaceSpy.mockRestore();
        });

        test('falha de rede ao enviar nova senha preserva o formulário para nova tentativa', async () => {
            mockGet.mockResolvedValueOnce({
                data: { valid: true, name: 'Maria Teste', username: 'maria.teste' },
            });
            mockPost
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({ data: { message: 'Senha alterada com sucesso' } });

            renderFlow('/reset-password/token-retry-submit');
            const user = userEvent.setup();

            const passwordInput = await screen.findByPlaceholderText('Digite sua nova senha');
            await user.type(passwordInput, 'Senha@123');
            await user.type(screen.getByPlaceholderText('Confirme sua nova senha'), 'Senha@123');
            await user.click(screen.getByRole('button', { name: 'Definir Senha e Entrar' }));

            await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
            expect(passwordInput).toHaveValue('Senha@123');
            expect(screen.queryByText(/Link Inválido ou Expirado/i)).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Definir Senha e Entrar' }));
            expect(await screen.findByRole('status')).toHaveTextContent(/Senha redefinida com sucesso/i);
        });
    });
});
