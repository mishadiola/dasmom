
import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';

export default class AuthService {
  constructor() {
    this.supabase = supabase;
    this._currentUser = null; 
  }

  async getOrCreateStationId(stationName) {
    if (!stationName || !stationName.trim()) return null;
    const normalizedName = stationName.trim();

    const { data: existing, error: selectError } = await this.supabase
      .from('stations')
      .select('id')
      .eq('station_name', normalizedName)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Error resolving station:', selectError);
      throw selectError;
    }

    if (existing?.id) return existing.id;

    const { data: inserted, error: insertError } = await this.supabase
      .from('stations')
      .insert({ station_name: normalizedName })
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error('Error creating station:', insertError);
      throw insertError;
    }

    return inserted?.id || null;
  }

  async getUserTypeIdByRole(role) {
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!normalizedRole) {
      throw new Error('Role is required');
    }

    const { data, error } = await this.supabase
      .from('user_type')
      .select('id, user_type')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const userType = (data || []).find(
      item => item.user_type?.toLowerCase().trim() === normalizedRole
    );

    if (userType?.id) return userType.id;

    const { data: insertedRole, error: insertError } = await this.supabase
      .from('user_type')
      .insert({ user_type: normalizedRole })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return insertedRole?.id;
  }

  async ensurePublicUserRecord({ userId, email, role }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (!userId) throw new Error('User ID is required');

    const userTypeId = await this.getUserTypeIdByRole(normalizedRole);

    const payload = {
      id: userId,
      email_address: normalizedEmail,
      usertype: userTypeId,
    };

    const { error: directInsertError } = await this.supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (!directInsertError) return;

    console.warn('Direct users upsert failed, trying database helper fallback:', directInsertError);

    const { error: rpcError } = await this.supabase.rpc('ensure_public_user_row', {
      p_user_id: userId,
      p_email: normalizedEmail,
      p_role: normalizedRole,
    });

    if (rpcError) {
      const { data: existingUser, error: lookupError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (lookupError || !existingUser) {
        throw directInsertError;
      }
    }
  }

  async createUserAccount({ email, password, role, metadata = {} }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error('Email and password are required');
    }

    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          role: String(role || '').trim().toLowerCase(),
          ...(metadata || {})
        }
      }
    });

    if (authError) throw authError;

    const authUser = authData?.user;
    if (!authUser?.id) {
      throw new Error('Failed to create auth user');
    }

    try {
      await this.ensurePublicUserRecord({
        userId: authUser.id,
        email: normalizedEmail,
        role,
      });
    } catch (userInsertError) {
      console.error('Failed to create public users row for auth account:', userInsertError);
      throw userInsertError;
    }

    return authUser;
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
    if (!userData) throw new Error('User record not found in database');

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

    const profile = await this.fetchProfileName(userData.id, role);

    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
      displayName: profile.displayName,
      fullName: profile.fullName,
    };

    this.saveUser(this._currentUser);
    return this._currentUser;
  }

  async fetchProfileName(userId, role) {
    let fullName = null;
    let displayName = null;

    try {
      if (role === 'admin' || role.includes('staff') || role === 'cho personnel' || role.includes('midwife') || role.includes('doctor')) {
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

    if (!fullName) {
      const email = this._currentUser?.email || 'User';
      displayName = email.split('@')[0];
      fullName = displayName;
    }

    return { fullName, displayName };
  }

  async getAuthUser() {
    if (this._currentUser) return this._currentUser;
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session?.user) return null;
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

    this.saveUser(this._currentUser);
    return this._currentUser;
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.clearUser();
    console.log('User logged out');
  }

  clearUser() {
    this._currentUser = null;
    localStorage.removeItem('user');
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


  async getFullStaffProfile(userId) {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('*, stations:station_ass (id, station_name)')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      data.barangay_assignment = data.stations?.station_name || data.barangay_assignment;
    }
    return data;
  }

  async updateStaffProfile(userId, { fullName, contactNo, barangayAssignment }) {
    const stationId = barangayAssignment ? await this.getOrCreateStationId(barangayAssignment) : null;
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .update({
        full_name: fullName,
        contact_no: contactNo,
        station_ass: stationId
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