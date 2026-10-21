
import supabase from '../config/supabaseclient';
import { getRoleConfig } from '../config/roleConfig';
import { DASMOM_APP_URL } from '../config/appConfig';
import { getClientDeviceString } from '../utils/formatters';

const DUPLICATE_EMAIL_MESSAGE = 'Email already exists. Please use a different email address.';
const normalizeRoleName = role => String(role || '').trim().toLowerCase().replace(/_/g, ' ');
let cachedAuthUser = null;
let authUserLookupPromise = null;

export default class AuthService {
  constructor() {
    this.supabase = supabase;
    this._currentUser = null; 
    this.defaultTimeout = 15000;
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

  // Helper to guard long-running requests
  async _withTimeout(promise, ms) {
    const timeoutMs = typeof ms === 'number' ? ms : this.defaultTimeout;
    let timer;
    return Promise.race([
      promise,
      new Promise((_, rej) => timer = setTimeout(() => rej(new Error('Request timed out')), timeoutMs))
    ]).finally(() => clearTimeout(timer));
  }

  async _throwAccountCreationError(functionError) {
    const response = functionError?.context;
    let payload = null;

    try {
      if (response?.json) {
        payload = await (response.clone ? response.clone() : response).json();
      }
    } catch {
      payload = null;
    }

    if (payload?.code === 'EMAIL_ALREADY_EXISTS') {
      throw new Error(DUPLICATE_EMAIL_MESSAGE);
    }

    throw new Error(payload?.error || functionError?.message || 'Unable to create account. Please try again.');
  }

  async getUserTypeIdByRole(role) {
    const normalizedRole = normalizeRoleName(role);
    if (!normalizedRole) {
      throw new Error('Role is required');
    }

    const { data, error } = await this.supabase
      .from('user_type')
      .select('id, user_type')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const userType = (data || []).find(
      item => normalizeRoleName(item.user_type) === normalizedRole
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
    const normalizedRole = normalizeRoleName(role);

    if (!userId) throw new Error('User ID is required');

    try {
      // Prefer a direct public.users update so email_address is always populated
      // from the canonical auth email when the DB row exists.
      const { data: existingUser, error: selectError } = await this.supabase
        .from('users')
        .select('id, email_address')
        .eq('id', userId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existingUser) {
        const { error: updateError } = await this.supabase
          .from('users')
          .update({
            email_address: normalizedEmail || existingUser.email_address,
            usertype: existingUser.usertype || null,
          })
          .eq('id', userId);

        if (updateError) throw updateError;
      }

      // Use the security-definer RPC as the fallback/account-creation path.
      const { error: rpcError } = await this.supabase.rpc('create_patient_user_record', {
        p_user_id: userId,
        p_email: normalizedEmail,
        p_role: normalizedRole,
      });

      if (rpcError) {
        console.error('create_patient_user_record failed:', rpcError);
        throw rpcError;
      }

      console.log('✅ Created/updated user record via SECURITY DEFINER function for role:', normalizedRole);
    } catch (err) {
      console.error('❌ ensurePublicUserRecord error:', err);
      throw err;
    }
  }

  async createUserAccount({ email, password, role, metadata = {}, stationId = null, stationName = '' }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    const normalizedRole = normalizeRoleName(role);
    // Provide a default password for mothers/patients when not supplied
    if (!password && (normalizedRole === 'patient' || normalizedRole === 'mother')) {
      password = 'mother123!';
    }
    if (!password) {
      throw new Error('Password is required');
    }

    // Creating a patient with signUp() changes the browser's active session to
    // the new patient and can invalidate the staff access token. Use the
    // server-side function for patient accounts so the staff session remains
    // untouched for the following patient inserts.
    if (normalizedRole === 'patient' || normalizedRole === 'mother') {
      const { data: functionData, error: functionError } = await this._withTimeout(
        this.supabase.functions.invoke('create-mother', {
          body: {
            email: normalizedEmail,
            password,
            motherName: metadata?.full_name || normalizedEmail,
            stationId,
          }
        }),
        15000
      );

      if (functionError) await this._throwAccountCreationError(functionError);
      if (!functionData?.userId) throw new Error('Patient account function did not return a user ID');

      return { id: functionData.userId };
    }

    // Create staff accounts server-side so the browser's active staff session is untouched.
    const { data: functionData, error: functionError } = await this._withTimeout(
      this.supabase.functions.invoke('create-staff', {
        body: {
          email: normalizedEmail,
          password,
          role: normalizedRole,
          fullName: metadata?.full_name || normalizedEmail,
          stationId,
          stationName,
        }
      }),
      15000
    );

    if (functionError) await this._throwAccountCreationError(functionError);
    if (!functionData?.userId) throw new Error('Staff account function did not return a user ID');

    return { id: functionData.userId };
  }

  async signInWithGoogle(redirectTo = `${DASMOM_APP_URL}/login`) {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  }

  async login(email, password) {
    let authData, authError;
    try {
      ({ data: authData, error: authError } = await this._withTimeout(this.supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      }), 12000));
    } catch (err) {
      console.error('Auth signIn timed out or failed:', err);
      if (err instanceof TypeError || String(err).toLowerCase().includes('failed to fetch') || String(err).toLowerCase().includes('network')) {
        throw new Error('Network/CORS error contacting Supabase. Check VITE_SUPABASE_URL and VITE_SUPABASE_KEY, ensure the project allows CORS from http://localhost:5173, and use the anon/public key (not the service_role key). Original: ' + err.message);
      }
      throw err;
    }
    if (authError) {
      console.error('Auth signIn error:', authError);
      const authMessage = String(authError.message || '').toLowerCase();
      if (authError.status === 400 || authError.code === 'invalid_credentials' || authMessage.includes('invalid login credentials')) {
        throw new Error('Incorrect email or password. Please check your credentials and try again.');
      }
      throw authError;
    }

    const authUser = authData?.user;
    if (!authUser) throw new Error('Session not established');

    const { data: userData, error: userError } = await this._withTimeout(
      this.supabase
        .from('users')
        .select('id, email_address, usertype, is_archived, is_deactivated')
        .eq('id', authUser.id)
        .maybeSingle(),
      8000
    );

    if (userError) throw userError;
    if (!userData) throw new Error('User record not found in database');
    if (userData.is_deactivated) {
      await this.supabase.auth.signOut();
      throw new Error('This account has been deactivated. Please contact an administrator.');
    }

    let role = 'user';
    if (userData.usertype) {
      try {
        const { data: typeData, error: typeError } = await this._withTimeout(
          this.supabase
            .from('user_type')
            .select('user_type')
            .eq('id', userData.usertype)
            .maybeSingle(),
          5000
        );
        if (typeError) console.error('Error fetching user_type:', typeError);
        if (typeData && typeData.user_type) role = normalizeRoleName(typeData.user_type);
      } catch (err) {
        console.error('user_type lookup timed out:', err);
      }
    }

    const profile = await this.fetchProfileName(userData.id, role);
    const loginTimestamp = authData?.user?.last_sign_in_at || new Date().toISOString();
    this.recordLoginEvent(userData.id, loginTimestamp);

    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
      isArchived: Boolean(userData.is_archived),
      isDeactivated: Boolean(userData.is_deactivated),
      displayName: profile.displayName,
      fullName: profile.fullName,
      station: profile.assigned_station,
      stationId: profile.stationId || null,
      lastSignInAt: loginTimestamp,
    };

    this.saveUser(this._currentUser);
    return this._currentUser;
  }

  async fetchProfileName(userId, role) {
    let fullName = null;
    let displayName = null;
    let assignedStation = null;
    let assignedStationId = null;

    try {
      if (!['mother', 'patient'].includes(role)) {
        const { data, error } = await this.supabase
          .from('staff_profiles')
          .select('full_name, station_ass, stations:station_ass(id, station_name)')
          .eq('id', userId)
          .maybeSingle();
        
        if (data?.full_name) {
          fullName = data.full_name;
          displayName = data.full_name.split(' ')[0];
        }
        if (data?.stations?.station_name) {
          assignedStation = data.stations.station_name;
        }
        assignedStationId = data?.station_ass || data?.stations?.id || null;
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

    return { fullName, displayName, assigned_station: assignedStation, stationId: assignedStationId };
  }

  async getAuthUser() {
    // Only return cached user if it has a valid ID
    if (this._currentUser && this._currentUser.id) {
      return this._currentUser;
    }
    if (cachedAuthUser?.id) {
      this._currentUser = cachedAuthUser;
      return cachedAuthUser;
    }
    if (authUserLookupPromise) {
      const user = await authUserLookupPromise;
      this._currentUser = user;
      return user;
    }

    authUserLookupPromise = this._loadAuthUser();
    try {
      const user = await authUserLookupPromise;
      cachedAuthUser = user;
      return user;
    } finally {
      authUserLookupPromise = null;
    }
  }

  async _loadAuthUser() {
    
    let session;
    try {
      const sessRes = await this._withTimeout(this.supabase.auth.getSession(), 8000);
      session = sessRes?.data?.session || sessRes?.session || sessRes;
    } catch (err) {
      console.error('getSession timed out or failed:', err);
      this._currentUser = null;
      return null;
    }
    if (!session?.user) {
      this._currentUser = null;
      return null;
    }
    const authUser = session.user;

    let userData;
    try {
      const res = await this._withTimeout(
        this.supabase
          .from('users')
          .select('id, email_address, usertype, is_archived, is_deactivated')
          .eq('id', authUser.id)
          .maybeSingle(),
        this.defaultTimeout
      );
      userData = res.data || res;
    } catch (err) {
      console.error('users lookup timed out or failed:', err);
      this._currentUser = null;
      throw err;
    }

    if (!userData || !userData.id) {
      console.warn('No valid user data found');
      this._currentUser = null;
      return null;
    }
    if (userData.is_deactivated) {
      await this.supabase.auth.signOut();
      this._currentUser = null;
      return null;
    }

    let role = 'user';
    try {
      const typeRes = await this._withTimeout(
        this.supabase
          .from('user_type')
          .select('user_type')
          .eq('id', userData.usertype)
          .maybeSingle(),
        5000
      );
      const typeData = typeRes.data || typeRes;
      if (typeData?.user_type) role = normalizeRoleName(typeData.user_type);
    } catch (err) {
      console.error('user_type lookup timed out or failed:', err);
    }

    const profile = await this.fetchProfileName(userData.id, role);

    // Only cache if we have valid data
    this._currentUser = {
      id: userData.id,
      email: userData.email_address,
      role: role,
      isArchived: Boolean(userData.is_archived),
      isDeactivated: Boolean(userData.is_deactivated),
      displayName: profile.displayName,
      fullName: profile.fullName,
      station: profile.assigned_station,
      stationId: profile.stationId || null,
      lastSignInAt: authUser.last_sign_in_at || null,
    };

    this.saveUser(this._currentUser);
    return this._currentUser;
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.clearUser();
    console.log('User logged out');
  }

  // Keep user in-memory only; do not persist to localStorage
  clearUser() {
    this._currentUser = null;
    cachedAuthUser = null;
  }

  saveUser(user) {
    this._currentUser = user;
    cachedAuthUser = user;
  }

  getUser() {
    return this._currentUser || null;
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

  recordLoginEvent(userId, explicitTimestamp = null) {
    if (!userId) return null;
    const timestamp = explicitTimestamp || new Date().toISOString();
    const device = getClientDeviceString();
    const record = { timestamp, device };

    try {
      localStorage.setItem(`dasmom_last_login_${userId}`, JSON.stringify(record));
      localStorage.setItem('dasmom_last_login', JSON.stringify({
        time: timestamp,
        timestamp,
        device
      }));
    } catch (err) {
      console.warn('Failed to save login event to localStorage:', err);
    }

    try {
      this.supabase.auth.updateUser({
        data: {
          last_login_event: record
        }
      }).catch(err => {
        console.warn('Background sync of last_login_event to Supabase failed:', err);
      });
    } catch {}

    return record;
  }

  async getLoginHistory(userId) {
    // 1. Check user-specific localStorage first (immediate local state)
    try {
      if (userId) {
        const local = localStorage.getItem(`dasmom_last_login_${userId}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed?.timestamp) {
            return {
              timestamp: parsed.timestamp,
              device: parsed.device || getClientDeviceString()
            };
          }
        }
      }
    } catch (err) {
      console.warn('Error reading local login history:', err);
    }

    // 2. Check Supabase auth session or user
    try {
      let authUser = null;
      const sessRes = await this._withTimeout(this.supabase.auth.getSession(), 4000);
      authUser = sessRes?.data?.session?.user || null;
      if (!authUser) {
        const userRes = await this._withTimeout(this.supabase.auth.getUser(), 4000);
        authUser = userRes?.data?.user || null;
      }

      if (authUser && (!userId || authUser.id === userId)) {
        // A) User metadata event if synced
        const metaEvent = authUser.user_metadata?.last_login_event;
        if (metaEvent?.timestamp) {
          const result = {
            timestamp: metaEvent.timestamp,
            device: metaEvent.device || getClientDeviceString()
          };
          if (userId) {
            try {
              localStorage.setItem(`dasmom_last_login_${userId}`, JSON.stringify(result));
            } catch {}
          }
          return result;
        }

        // B) Native authUser.last_sign_in_at from Supabase Auth
        if (authUser.last_sign_in_at) {
          const result = {
            timestamp: authUser.last_sign_in_at,
            device: getClientDeviceString()
          };
          if (userId) {
            try {
              localStorage.setItem(`dasmom_last_login_${userId}`, JSON.stringify(result));
            } catch {}
          }
          return result;
        }

        // C) authUser.created_at
        if (authUser.created_at) {
          return {
            timestamp: authUser.created_at,
            device: getClientDeviceString()
          };
        }
      }
    } catch (err) {
      console.warn('Error fetching Supabase auth login history:', err);
    }

    // 3. Fallback to generic local storage
    try {
      const generic = localStorage.getItem('dasmom_last_login');
      if (generic) {
        const parsed = JSON.parse(generic);
        const ts = parsed?.timestamp || parsed?.time;
        if (ts) {
          return {
            timestamp: ts,
            device: parsed.device || getClientDeviceString()
          };
        }
      }
    } catch {}

    return null;
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