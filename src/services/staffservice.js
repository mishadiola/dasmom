import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();

export default class StaffService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get user type ID by role name (case-insensitive)
   */
  async getUserTypeIdByRole(role) {
    try {
      const { data, error } = await this.supabase
        .from('user_type')
        .select('id, user_type')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Find user type case-insensitively by role
      const userType = (data || []).find(
        ut => ut.user_type?.toLowerCase().trim() === role.toLowerCase().trim()
      );

      if (!userType) {
        throw new Error(`User type '${role}' not found in user_type table`);
      }

      return userType.id;
    } catch (error) {
      console.error('❌ getUserTypeIdByRole:', error);
      throw error;
    }
  }

  /**
   * Fetch all staff members with their details
   */
  async getAllStaff() {
    try {
      const { data, error } = await this.supabase
        .from('staff_profiles')
        .select(`
          id,
          full_name,
          employee_id,
          barangay_assignment,
          created_at,
          users (
            email_address,
            user_type (
              user_type
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(staff => ({
        id: staff.id,
        name: staff.full_name,
        email: staff.users?.email_address || 'N/A',
        role: staff.users?.user_type?.user_type || 'Staff',
        station: staff.barangay_assignment || 'No Assignment',
        employeeId: staff.employee_id,
        status: 'Active',
        lastLogin: 'N/A',
        avatar: staff.full_name
          ?.split(' ')
          .map(n => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'ST',
      }));
    } catch (error) {
      console.error('❌ getAllStaff:', error);
      return [];
    }
  }

  /**
   * Get all unique barangay assignments (stations)
   */
  async getAllStations() {
    try {
      const { data, error } = await this.supabase
        .from('staff_profiles')
        .select('barangay_assignment')
        .not('barangay_assignment', 'is', null);

      if (error) throw error;

      const stations = [...new Set(
        (data || [])
          .map(s => s.barangay_assignment)
          .filter(Boolean)
      )];

      return stations.sort();
    } catch (error) {
      console.error('❌ getAllStations:', error);
      return [];
    }
  }

  /**
   * Add new staff member to database
   */
  async addStaff({ fullName, email, password, role, station }) {
    try {
      // Validate required fields
      if (!fullName || !email || !password || !role) {
        throw new Error('Missing required fields');
      }

      // 1. Get user type ID by role
      const userTypeId = await this.getUserTypeIdByRole(role);

      // 2. Create user in auth (users table)
      const staffId = crypto.randomUUID();

      const { error: userError } = await this.supabase.from('users').insert({
        id: staffId,
        email_address: email.trim().toLowerCase(),
        password: password, // Note: This should be hashed in production
        usertype: userTypeId,
      });

      if (userError) throw userError;

      // 3. Create staff profile (barangay_assignment can be new or existing)
      const { data: staffData, error: staffError } = await this.supabase
        .from('staff_profiles')
        .insert({
          id: staffId,
          full_name: fullName,
          barangay_assignment: station && station.trim() ? station.trim() : null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (staffError) throw staffError;

      return this.mapStaffData(staffData);
    } catch (error) {
      console.error('❌ addStaff:', error);
      throw error;
    }
  }

  /**
   * Update staff profile
   */
  async updateStaff(staffId, { fullName, role, station, contactNo }) {
    try {
      // If role is provided, update the user type
      if (role) {
        const userTypeId = await this.getUserTypeIdByRole(role);
        const { error: userTypeError } = await this.supabase
          .from('users')
          .update({ usertype: userTypeId })
          .eq('id', staffId);

        if (userTypeError) throw userTypeError;
      }

      const { data, error } = await this.supabase
        .from('staff_profiles')
        .update({
          full_name: fullName,
          barangay_assignment: station && station.trim() ? station.trim() : null,
          contact_no: contactNo,
        })
        .eq('id', staffId)
        .select()
        .single();

      if (error) throw error;

      return this.mapStaffData(data);
    } catch (error) {
      console.error('❌ updateStaff:', error);
      throw error;
    }
  }

  /**
   * Delete staff member
   */
  async deleteStaff(staffId) {
    try {
      // Delete from staff_profiles first
      const { error: profileError } = await this.supabase
        .from('staff_profiles')
        .delete()
        .eq('id', staffId);

      if (profileError) throw profileError;

      // Then delete from users table
      const { error: userError } = await this.supabase
        .from('users')
        .delete()
        .eq('id', staffId);

      if (userError) throw userError;

      return true;
    } catch (error) {
      console.error('❌ deleteStaff:', error);
      throw error;
    }
  }

  /**
   * Get single staff member
   */
  async getStaffById(staffId) {
    try {
      const { data, error } = await this.supabase
        .from('staff_profiles')
        .select(`
          *,
          users (
            email_address,
            user_type (
              user_type
            )
          )
        `)
        .eq('id', staffId)
        .single();

      if (error) throw error;

      return this.mapStaffData(data);
    } catch (error) {
      console.error('❌ getStaffById:', error);
      return null;
    }
  }

  /**
   * Map staff database data to UI format
   */
  mapStaffData(data) {
    return {
      id: data.id,
      name: data.full_name,
      email: data.users?.email_address || 'N/A',
      role: data.users?.user_type?.user_type || 'Staff',
      station: data.barangay_assignment || 'No Assignment',
      employeeId: data.employee_id,
      status: 'Active',
      avatar: data.full_name
        ?.split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'ST',
    };
  }
}
