import { act, renderHook } from '@testing-library/react';
import { StrictMode, useContext } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import api from '../src/api';
import { AuthContext } from '../src/context/AuthContext';
import { AuthProvider } from '../src/context/AuthProvider';
import { fakeToken } from './support/token';

const claims = { userId: 'u1', username: 'ana', name: 'Ana Analista', role: 'analyst' };

// StrictMode executa os efeitos de mount duas vezes, o que expõe qualquer restauração de sessão.
const wrapper = ({ children }) => <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode>;
const mountProvider = () => renderHook(() => useContext(AuthContext), { wrapper });

afterEach(() => vi.restoreAllMocks());

describe('efeitos de mount do AuthProvider', () => {
    test('não restaura a sessão de um token guardado no localStorage', async () => {
        const token = fakeToken(claims);
        localStorage.setItem('token', token);
        const request = vi.spyOn(api, 'request');

        const { result } = mountProvider();
        await act(async () => {});

        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(request).not.toHaveBeenCalled();
        expect(localStorage.getItem('token')).toBe(token);
    });
});

describe('login e logout no DOM', () => {
    test('login guarda o token e expõe o usuário decodificado', async () => {
        const token = fakeToken(claims);
        vi.spyOn(api, 'post').mockResolvedValue({ data: { token, user: { username: 'ana' } } });
        const { result } = mountProvider();

        let success;
        await act(async () => { success = await result.current.login('ana', 'segredo'); });

        expect(api.post).toHaveBeenCalledWith('/auth/login', { username: 'ana', password: 'segredo' });
        expect(success).toBe(true);
        expect(localStorage.getItem('token')).toBe(token);
        expect(result.current.user).toEqual(claims);
    });

    test('login recusado não guarda token nem usuário', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(api, 'post').mockRejectedValue({ response: { data: { message: 'Credenciais inválidas' } } });
        const { result } = mountProvider();

        let success;
        await act(async () => { success = await result.current.login('ana', 'errada'); });

        expect(success).toBe(false);
        expect(localStorage.getItem('token')).toBeNull();
        expect(result.current.user).toBeNull();
    });

    test('logout remove o token e limpa o usuário', async () => {
        vi.spyOn(api, 'post').mockResolvedValue({ data: { token: fakeToken(claims), user: { username: 'ana' } } });
        const { result } = mountProvider();
        await act(async () => { await result.current.login('ana', 'segredo'); });

        act(() => result.current.logout());

        expect(localStorage.getItem('token')).toBeNull();
        expect(result.current.user).toBeNull();
    });
});
