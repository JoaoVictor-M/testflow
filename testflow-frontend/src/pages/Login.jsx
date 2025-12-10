import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(username, password);
        if (success) {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen h-screen flex items-center justify-center bg-gray-50 overflow-hidden px-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 p-8 transform transition-all">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-blue-600">TestFlow</h1>
                    <p className="text-sm text-gray-500 mt-2">Faça login para continuar</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900 text-sm"
                            placeholder="Digite seu usuário"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900 text-sm"
                            placeholder="Digite sua senha"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold shadow-md transition-all transform hover:-translate-y-0.5"
                    >
                        Entrar
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-400">
                    <p>© 2024 TestFlow. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
