import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AuthContext } from '../src/context/AuthContext';
import Login from '../src/pages/Login';

function renderLogin(login) {
    render(
        <AuthContext.Provider value={{ login }}>
            <MemoryRouter initialEntries={['/login']}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<p>Tela inicial</p>} />
                    <Route path="/forgot-password" element={<p>Recuperar senha</p>} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

async function fillAndSubmit(user, password) {
    await user.type(screen.getByPlaceholderText('Digite seu usuário'), 'ana.analista');
    await user.type(screen.getByPlaceholderText('Digite sua senha'), password);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('tela de login', () => {
    test('envia usuário e senha e abre a tela inicial quando o login dá certo', async () => {
        const login = vi.fn().mockResolvedValue(true);
        renderLogin(login);

        await fillAndSubmit(userEvent.setup(), 'senha-correta');

        expect(login).toHaveBeenCalledExactlyOnceWith('ana.analista', 'senha-correta');
        expect(await screen.findByText('Tela inicial')).toBeInTheDocument();
    });

    test('permanece na tela de login quando o login falha', async () => {
        const login = vi.fn().mockResolvedValue(false);
        renderLogin(login);

        await fillAndSubmit(userEvent.setup(), 'senha-errada');

        expect(login).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
        expect(screen.queryByText('Tela inicial')).not.toBeInTheDocument();
    });

    test('mostra e esconde a senha digitada', async () => {
        renderLogin(vi.fn());
        const user = userEvent.setup();
        const password = screen.getByPlaceholderText('Digite sua senha');

        expect(password).toHaveAttribute('type', 'password');
        await user.click(password.nextElementSibling);
        expect(password).toHaveAttribute('type', 'text');
    });

    test('leva à recuperação de senha', async () => {
        renderLogin(vi.fn());

        await userEvent.setup().click(screen.getByRole('button', { name: 'Esqueci minha senha' }));

        expect(await screen.findByText('Recuperar senha')).toBeInTheDocument();
    });
});
