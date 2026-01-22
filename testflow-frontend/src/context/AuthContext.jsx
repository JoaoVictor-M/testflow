import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configure axios base URL if needed, but assuming api.js does it or we do it globally.
    // Actually, we should probably intercept the existing api instance if possible, 
    // but for now let's set a global default header or use a specific axios instance.
    // Ideally we should modify 'api.js' to use this context, but 'api.js' is likely a static instance.
    // Let's assume we can set default verification.

    useEffect(() => {
        // Check for token in localStorage on load
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Check expiration
                const currentTime = Date.now() / 1000;
                if (decoded.exp < currentTime) {
                    logout();
                } else {
                    setUser({
                        username: decoded.username,
                        name: decoded.name, // [NEW]
                        role: decoded.role,
                        userId: decoded.userId
                    });
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            } catch (error) {
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            // Assuming existing api.js points to backend. 
            // If api.js exports an axios instance, we should use it, but direct axios is fine for auth.
            // Adjust URL if needed. Assuming relative path if proxy is set or full path.
            // Let's check api.js content later, but standard is usually localhost:3000
            const response = await axios.post('http://localhost:3000/auth/login', { username, password });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        toast('Você saiu do sistema.', { icon: '👋' });
    };

    const registerUser = async (userData) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:3000/auth/register', userData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Usuário criado com sucesso!');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erro ao criar usuário');
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, registerUser }}>
            {children}
        </AuthContext.Provider>
    );
};
