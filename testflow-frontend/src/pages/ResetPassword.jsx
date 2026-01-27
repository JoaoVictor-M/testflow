import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

function ResetPassword() {
    const { token: paramToken } = useParams();
    const navigate = useNavigate();

    // Store token in state so we can clear URL
    const [token, setToken] = useState(paramToken);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [userData, setUserData] = useState(null);

    useEffect(() => {
        const validateToken = async () => {
            if (!paramToken) return;
            try {
                const response = await axios.get(`http://localhost:3000/auth/validate-reset-token/${paramToken}`);
                if (response.data.valid) {
                    setUserData({ name: response.data.name, username: response.data.username });
                    // Only set token in state if valid
                    setToken(paramToken);
                    // Clear URL
                    window.history.replaceState(null, '', '/reset-password');
                }
            } catch (error) {
                console.error("Token validation failed:", error);
                // If validation fails, token remains null (or we set an error state)
                setToken(null);
            }
        };
        validateToken();
    }, [paramToken]);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem.');
            return;
        }

        if (!passwordRegex.test(password)) {
            toast.error('A senha não atende aos requisitos de segurança.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!token) {
                toast.error('Token inválido ou perdido. Por favor, clique no link do email novamente.');
                return;
            }

            await axios.post('http://localhost:3000/auth/reset-password', {
                token,
                newPassword: password
            });
            toast.success('Senha definida com sucesso!');
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erro ao redefinir a senha.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // If no token, don't show the form (or show error state)
    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 overflow-hidden transition-colors">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-8 text-center transition-colors">
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Inválido ou Expirado</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Não foi possível verificar a solicitação de redefinição de senha.</p>
                    <button onClick={() => navigate('/login')} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Voltar para Login</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 overflow-hidden transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-8 transition-colors">
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                </div>
                <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Nova Senha</h2>
                {userData && (
                    <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
                        Olá, <strong className="text-gray-900 dark:text-white">{userData.name}</strong>
                    </p>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="relative group">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nova Senha</label>
                            <div className="relative">
                                <span
                                    className="cursor-help text-gray-400 hover:text-blue-500 transition-colors"
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => setShowTooltip(false)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                {/* Tooltip */}
                                {showTooltip && (
                                    <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-gray-800 dark:bg-slate-900 text-white text-xs rounded shadow-lg z-50">
                                        <p className="font-bold mb-1">Sua senha deve conter:</p>
                                        <ul className="list-disc list-inside">
                                            <li>Mínimo 8 caracteres</li>
                                            <li>Uma letra maiúscula</li>
                                            <li>Uma letra minúscula</li>
                                            <li>Um número</li>
                                            <li>Um caractere especial (@$!%*?&)</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className={`w-full input-style pr-10 ${password && !passwordRegex.test(password) ? 'border-red-500 focus:ring-red-500' : ''}`}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="********"
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                                onClick={() => setShowPassword(!showPassword)}
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
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Senha</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full input-style"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onPaste={(e) => e.preventDefault()}
                            placeholder="********"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSubmitting ? 'Salvando...' : 'Salvar'}
                    </button>
                </form>
            </div>
        </div >
    );
}

export default ResetPassword;
