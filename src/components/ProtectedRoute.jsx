import { Navigate } from 'react-router-dom';
import AuthService from '../services/authservice';

const ProtectedRoute = ({ children, pageKey }) => {
    const authService = new AuthService();
    const user = authService.getUser();

    if (!user) {
        return <Navigate to="/" />;
    }

    if (!authService.accessCheck(user, pageKey)) {
        return <Navigate to="/unauthorized" />;
    }

    return children;
};

export default ProtectedRoute;