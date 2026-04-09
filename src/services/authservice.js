
import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';

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

    // 1. Fetch user role and info from internal 'users' table
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('id, email_address, usertype')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) throw new Error('User record not found in database');

    // 2. Resolve Role
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

    // 3. Fetch Full Name based on role
    const profile = await this.fetchProfileName(userData.id, role);

    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
      displayName: profile.displayName,
      fullName: profile.fullName,
    };

    return this._currentUser;
  }

  async fetchProfileName(userId, role) {
    let fullName = null;
    let displayName = null;

    try {
      if (role === 'admin' || role.includes('staff') || role.includes('midwife') || role.includes('doctor')) {
        const { data, error } = await this.supabase
          .from('staff_profiles')
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();
        
        if (data?.full_name) {
          fullName = data.full_name;
          displayName = data.full_name.split(' ')[0];
        }
      } else if (role === 'mother' || role === 'patient') {
        const { data, error } = await this.supabase
          .from('patient_basic_info')
          .select('first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        
        if (data?.first_name) {
          fullName = `${data.first_name} ${data.last_name}`;
          displayName = data.first_name;
        }
      }
    } catch (err) {
      console.error('Error fetching profile name:', err);
    }

    // Fallback if no profile found
    if (!fullName) {
      const email = this._currentUser?.email || 'User';
      displayName = email.split('@')[0];
      fullName = displayName;
    }

    return { fullName, displayName };
  }

  async getAuthUser() {
    if (this._currentUser) return this._currentUser;

    // Try to re-hydrate from active Supabase session
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session?.user) return null;

    // Re-login logic without password (using session)
    const authUser = session.user;
    
    const { data: userData } = await this.supabase
      .from('users')
      .select('id, email_address, usertype')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!userData) return null;

    let role = 'user';
    const { data: typeData } = await this.supabase
      .from('user_type')
      .select('user_type')
      .eq('id', userData.usertype)
      .maybeSingle();
    if (typeData?.user_type) role = typeData.user_type.toLowerCase();

    const profile = await this.fetchProfileName(userData.id, role);

    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
      displayName: profile.displayName,
      fullName: profile.fullName,
    };

    return this._currentUser;
  }


  async logout() {
    await this.supabase.auth.signOut();
    this._currentUser = null;
    localStorage.removeItem('user');
    console.log('User logged out');
  }

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

  accessCheck(user, pageKey) {
    if (!user || !user.role) return false;
    const config = getRoleConfig(user.role);
    return config.allowedPages.includes(pageKey);
  }

  getRedirectRoute(role) {
    if (!role) return '/';
    const config = getRoleConfig(role);
    return config ? config.redirect : '/';
  }

  // ─── Profile & Security ───

  async getFullStaffProfile(userId) {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateStaffProfile(userId, { fullName, contactNo, barangayAssignment }) {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .update({
        full_name: fullName,
        contact_no: contactNo,
        barangay_assignment: barangayAssignment
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePassword(newPassword) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  }
}