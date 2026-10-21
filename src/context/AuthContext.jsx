import React, { createContext, useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import AuthService from '../services/authservice';
import supabase from '../config/supabaseclient';
import { NATIVE_AUTH_CALLBACK_URL } from '../config/appConfig';
import { isAndroidApp } from '../services/secureStorage';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
  isAuthLoading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const userRef = useRef(null);
  userRef.current = user;
  const authService = new AuthService();

  useEffect(() => {
    let isMounted = true;
    let initRequest = 0;
    let signInInitTimer = null;
    let appUrlListener = null;
    let handledOAuthCallback = null;

    const showGoogleLoginError = message => {
      sessionStorage.setItem('dasmom_google_login_error', message);
      window.dispatchEvent(new CustomEvent('dasmom-google-login-error', { detail: message }));
    };

    const handleAppUrl = async url => {
      let callbackUrl;
      try {
        callbackUrl = new URL(url);
      } catch (error) {
        console.error('Unable to parse app callback URL:', error);
        return;
      }

      const expectedCallback = new URL(NATIVE_AUTH_CALLBACK_URL);
      if (
        callbackUrl.protocol !== expectedCallback.protocol
        || callbackUrl.host !== expectedCallback.host
        || callbackUrl.pathname !== expectedCallback.pathname
        || handledOAuthCallback === url
      ) return;

      handledOAuthCallback = url;
      try {
        await Browser.close();
      } catch (error) {
        console.warn('Unable to close the Google sign-in browser:', error);
      }

      const oauthError = callbackUrl.searchParams.get('error_description')
        || callbackUrl.searchParams.get('error');
      if (oauthError) {
        showGoogleLoginError(oauthError);
        return;
      }

      const code = callbackUrl.searchParams.get('code');
      if (!code) {
        showGoogleLoginError('Google sign-in did not return an authorization code. Please try again.');
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } catch (error) {
        console.error('Unable to complete Google sign-in in the app:', error);
        showGoogleLoginError(error.message || 'Google sign-in could not be completed. Please try again.');
      }
    };

    if (isAndroidApp()) {
      CapacitorApp.addListener('appUrlOpen', ({ url }) => handleAppUrl(url))
        .then(listener => {
          if (isMounted) appUrlListener = listener;
          else listener.remove();
        })
        .catch(error => console.error('Unable to register the app URL listener:', error));

      CapacitorApp.getLaunchUrl()
        .then(launchUrl => {
          if (isMounted && launchUrl?.url) return handleAppUrl(launchUrl.url);
          return undefined;
        })
        .catch(error => console.error('Unable to read the app launch URL:', error));
    }

    const initAuth = async (isTokenRefresh = false) => {
      const requestId = ++initRequest;
      try {
        if (!isTokenRefresh) {
          authService.clearUser();
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          if (isMounted && requestId === initRequest) {
            setUser(null);
            console.log('AuthContext: No active session, user not loaded');
          }
        } else {
          // If token refreshed and user is already loaded with matching ID, no reload needed
          if (isTokenRefresh && userRef.current?.id === session.user.id) {
            return;
          }

          const current = await authService.getAuthUser();
          const isGoogleLogin = session.user.app_metadata?.provider === 'google';
          if (isGoogleLogin && current?.id) {
            authService.recordLoginEvent(current.id);
          }
          localStorage.removeItem('dasmom_google_email');
          if (isMounted && requestId === initRequest) {

            if (!current) {
              if (isGoogleLogin) {
                sessionStorage.setItem(
                  'dasmom_google_login_error',
                  'This Google account is not linked to a registered DasMom account.'
                );
                window.dispatchEvent(new CustomEvent('dasmom-google-login-error', {
                  detail: 'This Google account is not linked to a registered DasMom account.'
                }));
                try {
                  const { error: cleanupError } = await supabase.functions.invoke(
                    'google-account-check',
                    { body: { action: 'cleanup' } }
                  );
                  if (cleanupError) console.error('Unable to clean up unregistered Google account:', cleanupError);
                } catch (cleanupError) {
                  console.error('Unable to clean up unregistered Google account:', cleanupError);
                }
              }
              await supabase.auth.signOut();
              return;
            }
            // Only update state if user changed to prevent re-render storms
            if (!userRef.current || userRef.current.id !== current?.id || userRef.current.role !== current?.role) {
              setUser(current);
            }
            console.log('AuthContext: User loaded from active session', current);
          }
        }
      }
      catch (err) {
        console.error('AuthContext: Error during auth init', err);
        if (isMounted && requestId === initRequest) {
          setUser(null);
        }
      } finally {
        if (isMounted && requestId === initRequest) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        initRequest += 1;
        authService.clearUser();
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Silent token refresh: if user is already loaded and matches, do not teardown state
          if (userRef.current?.id === session.user.id) {
            return;
          }
          initAuth(true);
        } else {
          initRequest += 1;
          setUser(null);
          setIsAuthLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        if (userRef.current?.id === session.user.id) {
          return;
        }
        if (signInInitTimer !== null) window.clearTimeout(signInInitTimer);
        signInInitTimer = window.setTimeout(() => {
          signInInitTimer = null;
          initAuth(false);
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      if (signInInitTimer !== null) window.clearTimeout(signInInitTimer);
      appUrlListener?.remove();
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};