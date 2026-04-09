/*
import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';

export default class AuthService {
    constructor() {
        this.supabase = supabase;
    }

    // ===============================
    // LOGIN using Users table (manual)
    // ===============================
    async login(email, password) {
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const trimmedPassword = password.trim();

            // Fetch user from Users table
            const { data: user, error: userError } = await this.supabase
                .from('Users')
                .select('id, email_address, password, usertype')
                .eq('email_address', normalizedEmail)
                .maybeSingle();

            if (userError) throw userError;
            if (!user) throw new Error('User not found');

            // Compare password manually
            if (user.password.trim() !== trimmedPassword) {
                throw new Error('Invalid password');
            }

            // Fetch role/type
            const { data: typeData, error: typeError } = await this.supabase
                .from('User_type')
                .select('user_type')
                .eq('id', user.usertype)
                .maybeSingle();

            if (typeError) throw typeError;
            if (!typeData) throw new Error('User type not found');

            const loggedInUser = {
                id: user.id,
                email: user.email_address,
                role: typeData.user_type
            };

            // Save to localStorage
            this.saveUser(loggedInUser);

            return loggedInUser;

        } catch (err) {
            console.error('AuthService.login error:', err);
            throw err;
        }
    }

    // ===============================
    // SAVE / GET / LOGOUT USER
    // ===============================
    saveUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    }

    logout() {
        localStorage.removeItem('user');
    }

    // ===============================
    // ACCESS CONTROL
    // ===============================
    accessCheck(user, pageKey) {
        if (!user || !user.role) return false;
        const config = getRoleConfig(user.role);
        return config.allowedPages.includes(pageKey);
    }

    getRedirectRoute(role) {
        return getRoleConfig(role).redirect;
    }

    // ===============================
    // GET CURRENT STAFF INFO
    // ===============================
    async getCurrentUser() {
        const user = this.getUser();
        if (!user) return null;

        const { data, error } = await this.supabase
            .from('staff_profiles')
            .select('id, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error('AuthService.getCurrentStaff error:', error);
            return null;
        }

        return data; // { id, full_name }
    }
}*/

/*
import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';

export default class AuthService {
    constructor() {
        this.supabase = supabase;
    }

    async login(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        const { data: user, error: userError } = await this.supabase
            .from('Users')
            .select('id, email_address, password, usertype')
            .eq('email_address', normalizedEmail)
            .maybeSingle();

        if (userError) throw userError;
        if (!user) throw new Error('User not found');

        if (user.password.trim() !== trimmedPassword) {
            throw new Error('Invalid password');
        }

        const { data: typeData, error: typeError } = await this.supabase
            .from('User_type')
            .select('user_type')
            .eq('id', user.usertype)
            .maybeSingle();

        if (typeError) throw typeError;
        if (!typeData) throw new Error('User type not found');

        const loggedInUser = {
            id: user.id,          
            email: user.email_address,
            role: typeData.user_type
        };

        this.saveUser(loggedInUser);

        return loggedInUser;
    }

    saveUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }
r
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    }

    async getCurrentStaffProfile() {
        const user = this.getUser();

        console.log("CURRENT USER:", user);

        if (!user || !user.id) {
            console.error("No user or user.id");
            return null;
        }

        const { data, error } = await this.supabase
            .from('staff_profiles')
            .select('*')
            .eq('id', user.id);

        console.log("STAFF QUERY RESULT:", data);
        console.log("STAFF QUERY ERROR:", error);

        if (error) return null;

        return data && data.length > 0 ? data[0] : null;
    }

    logout() {
        localStorage.removeItem('user');
    }

    accessCheck(user, pageKey) {
        if (!user || !user.role) return false;
        const config = getRoleConfig(user.role);
        return config.allowedPages.includes(pageKey);
    }

    getRedirectRoute(role) {
        return getRoleConfig(role).redirect;
    }
}*/
import supabase from '../config/supabaseclient';

export default class AuthService {
  constructor() {
    this.supabase = supabase;
    this._currentUser = null; 
  }

  async login(email, password) {
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });
    if (authError) throw authError;

    const { data: { user: authUser } } = await this.supabase.auth.getUser();
    if (!authUser) throw new Error('Session not established');

    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('id, email_address, usertype')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) throw new Error('User not found');

    console.log('RAW userFull from DB:', userData);
 
    let role = 'user';
    if (userData.usertype) {
      const { data: typeData, error: typeError } = await this.supabase
        .from('user_type')
        .select('user_type')
        .eq('id', userData.usertype)
        .maybeSingle();

      if (typeError) console.error('Error fetching user_type:', typeError);
      if (typeData && typeData.user_type) role = typeData.user_type.toLowerCase();
    }

    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
    };

    console.log('LOGIN SUCCESS:', this._currentUser);

    return this._currentUser;
  }

  getAuthUser() {
    return this._currentUser;
  }

  async logout() {
    await this.supabase.auth.signOut();
    this._currentUser = null;
    console.log('User logged out');
  }
}