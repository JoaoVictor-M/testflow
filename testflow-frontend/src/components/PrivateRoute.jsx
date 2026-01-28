import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const PrivateRoute = ({ requiredRole }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-white">Carregando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!roles.includes(user.role) && user.role !== 'admin') {
            // Se o usuário não tem o papel necessário (e não é admin, que tem acesso a tudo), redireciona
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
};

export default PrivateRoute;
