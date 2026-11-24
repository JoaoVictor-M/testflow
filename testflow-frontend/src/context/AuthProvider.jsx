import { useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-hot-toast/headless';
import api from '../api';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    // Não há restauração assíncrona: recarregar exige um novo login.

    const login = async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { token, user } = response.data;

            localStorage.setItem('token', token);

            // Decodificar valida token
            const decoded = jwtDecode(token);

            setUser({
                username: decoded.username,
                name: decoded.name, // [NEW]
                role: decoded.role,
                userId: decoded.userId
            });

            toast.success(`Bem-vindo, ${user.username}!`);
            return true;
        } catch (error) {
            console.error('Login error', error);
            toast.error(error.response?.data?.message || 'Erro ao realizar login');
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        toast('Você saiu do sistema.', { icon: '👋' });
    };

    const registerUser = async (userData) => {
        try {
            await api.post('/auth/register', userData);
            toast.success('Usuário criado com sucesso!');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erro ao criar usuário');
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading: false, login, logout, registerUser }}>
            {children}
        </AuthContext.Provider>
    );
};
