import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';

export default class AuthService {
    constructor() {
        this.supabase = supabase;
    }

    // 🔐 LOGIN
    async login(email, password) {
        try {
            const { data: user, error: userError } = await this.supabase
                .from('Users')
                .select('id, email_address, password, usertype')
                .eq('email_address', email)
                .maybeSingle();

            if (userError) throw userError;
            if (!user) throw new Error('User not found');

            if (user.password !== password) {
                throw new Error('Invalid password');
            }

            const { data: typeData, error: typeError } = await this.supabase
                .from('User_type')
                .select('user_type')
                .eq('id', user.usertype)
                .maybeSingle();

            if (typeError) throw typeError;
            if (!typeData) throw new Error('User type not found');

            return {
                id: user.id,
                email: user.email_address,
                role: typeData.user_type
            };

        } catch (err) {
            console.error('AuthService.login error:', err);
            throw err;
        }
    }

    //ACCESS CONTROL
    accessCheck(user, pageKey) {
        if (!user || !user.role) return false;

        const config = getRoleConfig(user.role);
        return config.allowedPages.includes(pageKey);
    }

    // REDIRECT BASED ON ROLE
    getRedirectRoute(role) {
        return getRoleConfig(role).redirect;
    }

    // STORE USER
    saveUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    //GET USER
    getUser() {
        return JSON.parse(localStorage.getItem('user'));
    }

    //LOGOUT
    logout() {
        localStorage.removeItem('user');
    }
}