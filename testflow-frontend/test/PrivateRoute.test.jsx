import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import PrivateRoute from '../src/components/PrivateRoute';
import { AuthContext } from '../src/context/AuthContext';

// Mesmo desenho do App: qualquer usuário logado, analista e admin, só admin.
function renderAt(path, user, loading = false) {
    render(
        <AuthContext.Provider value={{ user, loading }}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/login" element={<p>Tela de login</p>} />
                    <Route element={<PrivateRoute />}>
                        <Route path="/" element={<p>Tela inicial</p>} />
                    </Route>
                    <Route element={<PrivateRoute requiredRole={['admin', 'analyst']} />}>
                        <Route path="/usuarios" element={<p>Tela de usuários</p>} />
                    </Route>
                    <Route element={<PrivateRoute requiredRole="admin" />}>
                        <Route path="/auditoria" element={<p>Tela de auditoria</p>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

const as = (role) => ({ username: `qa.${role}`, role });

describe('rotas protegidas por perfil', () => {
    test('sem usuário vai para o login', () => {
        renderAt('/', null);

        expect(screen.getByText('Tela de login')).toBeInTheDocument();
    });

    test('enquanto a sessão carrega não decide nem mostra a tela', () => {
        renderAt('/auditoria', null, true);

        expect(screen.getByText('Carregando...')).toBeInTheDocument();
        expect(screen.queryByText('Tela de login')).not.toBeInTheDocument();
    });

    test.each([
        ['admin', '/', 'Tela inicial'],
        ['analyst', '/', 'Tela inicial'],
        ['viewer', '/', 'Tela inicial'],
        ['admin', '/usuarios', 'Tela de usuários'],
        ['analyst', '/usuarios', 'Tela de usuários'],
        ['viewer', '/usuarios', 'Tela inicial'],
        ['admin', '/auditoria', 'Tela de auditoria'],
        ['analyst', '/auditoria', 'Tela inicial'],
        ['viewer', '/auditoria', 'Tela inicial'],
    ])('o perfil %s abrindo %s vê "%s"', (role, path, expected) => {
        renderAt(path, as(role));

        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
