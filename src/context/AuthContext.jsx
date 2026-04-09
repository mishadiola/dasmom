import { createContext, useState, useEffect } from 'react';
import AuthService from '../services/authservice';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const authService = new AuthService();

  useEffect(() => {
    const current = authService.getAuthUser();
    if (current) {
      setUser(current);
      console.log('AuthContext: current user found on mount', current);
    }
  }, []);

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};