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
    const initAuth = async () => {
      try {
        const current = await authService.getAuthUser();
        if (current) {
          setUser(current);
          console.log('AuthContext: User re-hydrated from session', current);
        }
      } catch (err) {
        console.error('AuthContext: Error re-hydrating user', err);
      }
    };
    initAuth();
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