import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReleaseNotes from '../components/ReleaseNotes';
import { APP_VERSION } from '../version';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showReleaseNotes, setShowReleaseNotes] = useState(false);
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
        <div className="min-h-screen h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 overflow-hidden px-4 transition-colors">
            <ReleaseNotes
                isOpen={showReleaseNotes}
                onClose={() => setShowReleaseNotes(false)}
                version={APP_VERSION}
            />

            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 p-8 transform transition-all">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-500">TestFlow</h1>
                    <button
                        onClick={() => setShowReleaseNotes(true)}
                        className="text-xs text-gray-400 dark:text-gray-500 mt-1 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                    >
                        {APP_VERSION}
                    </button>
                    {/* <p className="text-sm text-gray-500 mt-2">Faça login para continuar</p> Removido conforme solicitado */}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900 dark:text-white text-sm"
                            placeholder="Digite seu usuário"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900 dark:text-white text-sm pr-10"
                                placeholder="Digite sua senha"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div className="flex justify-end mt-1">
                            <button
                                type="button"
                                onClick={() => navigate('/forgot-password')}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold shadow-md transition-all transform hover:-translate-y-0.5"
                    >
                        Entrar
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
                    <p>© 2026 TestFlow. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
