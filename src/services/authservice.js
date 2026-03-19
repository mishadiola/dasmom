import supabase from '../config/supabaseclient';

export default class AuthService {
    constructor() {
        this.supabase = supabase;
    }

    /**
     * Login a user by email and password
     * Returns user info and type if successful
     */
    async login(email, password) {
        try {
            // Fetch user from Users table; maybeSingle returns object or null
            const { data: user, error: userError } = await this.supabase
                .from('Users')
                .select('id, email_address, password, usertype')
                .eq('email_address', email)
                .maybeSingle();

            if (userError) throw userError;
            if (!user) throw new Error('User not found');

            // Password check (plaintext for now; replace with hash check for production)
            if (user.password !== password) {
                throw new Error('Invalid password');
            }

            // Fetch user type
            const { data: typeData, error: typeError } = await this.supabase
                .from('User_type')
                .select('user_type')
                .eq('id', user.usertype)
                .maybeSingle(); // assume one type per user

            if (typeError) throw typeError;
            if (!typeData) throw new Error('User type not found');

            return {
                id: user.id,
                email: user.email_address,
                usertype: typeData.user_type
            };
        } catch (err) {
            console.error('AuthService.login error:', err);
            throw err;
        }
    }

    /**
     * Check if the user has access to a page based on allowed roles
     * @param {Object} user - user object from login()
     * @param {Array} allowedRoles - e.g. ['Staff', 'Admin']
     * @returns {Boolean} true if access allowed
     */
    accessCheck(user, allowedRoles = []) {
        if (!user || !user.usertype) return false;
        return allowedRoles.includes(user.usertype);
    }
}