import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const PrivateRoute = ({ requiredRole }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Carregando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
        // Se o usuário não tem o papel necessário (e não é admin, que tem acesso a tudo), redireciona
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
