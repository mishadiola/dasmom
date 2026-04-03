import { Navigate } from 'react-router-dom';
import AuthService from './services/authservice';

const authService = new AuthService();

export default function ProtectedRoute({ children }) {
    const user = authService.getUser();

    if (!user) return <Navigate to="/" />;

    if (!authService.accessCheck(user, 'admin')) {
        authService.logout();
        return <Navigate to="/" />;
    }

    return children;
}