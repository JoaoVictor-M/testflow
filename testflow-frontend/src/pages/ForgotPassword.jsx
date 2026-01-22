import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Mail } from 'lucide-react';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await axios.post('http://localhost:3000/auth/forgot-password', { username, email });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao processar solicitação.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifique seu Email</h2>
                    <p className="text-gray-600 mb-6">
                        Enviamos um link de recuperação para <strong>{email}</strong>.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
                    >
                        Voltar para o Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <div className="mb-6">
                    <Link to="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4">
                        <ArrowLeft size={16} className="mr-1" /> Voltar
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Esqueceu a senha?</h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Digite seu usuário e email para receber um link de redefinição.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full input-style"
                            placeholder="Seu nome de usuário"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full input-style"
                            placeholder="seu.email@exemplo.com"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
