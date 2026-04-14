import supabase from '../config/supabaseclient';
import AuthService from './authservice'; // ← now you have real AuthService

class InventoryService {
  constructor() {
    this.auth = new AuthService();
    this.subscribers = {
      vaccine_inventory: [],
      supplement_inventory: [],
    };
  }

  async _ensureAdmin() {
    const user = await this.auth.getAuthUser();
    if (!user) throw new Error('No user session');
    if (user.role !== 'admin') throw new Error('Only admins can modify inventory');
  }

  async getVaccineInventory() {
    const { data, error } = await supabase
      .from('vaccine_inventory')
      .select('id, vaccine_name, quantity, min_stock, created_by, created_at');

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      item_name: row.vaccine_name,
      quantity: row.quantity ?? 0,
      min_stock: row.min_stock ?? 0,
      unit: 'vials',
    }));
  }

  async getSupplementInventory() {
    const { data, error } = await supabase
      .from('supplement_inventory')
      .select('id, supplement_name, quantity, min_stock, created_by, created_at');

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      item_name: row.supplement_name,
      quantity: row.quantity ?? 0,
      min_stock: row.min_stock ?? 0,
      unit: 'units',
    }));
  }

  async addInventoryItem(table, { item_name, quantity }) {
    await this._ensureAdmin(); // only admins

    const currentUser = await this.auth.getAuthUser();
    if (!currentUser) throw new Error('No logged‑in user');

    const payload = {
      quantity: Number(quantity),
      created_by: currentUser.id, // ← this is likely the missing field
    };

    if (table === 'vaccine_inventory') {
      payload.vaccine_name = item_name;
    } else if (table === 'supplement_inventory') {
      payload.supplement_name = item_name;
    } else {
      throw new Error('Unsupported table: ' + table);
    }

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select();

    if (error) {
      console.error('addInventoryItem error:', error);
      throw error;
    }

    return data;
  }

  async updateInventoryQuantity(table, id, newQuantity) {
    await this._ensureAdmin(); // only admins

    const { data, error } = await supabase
      .from(table)
      .update({ quantity: Number(newQuantity) })
      .eq('id', id)
      .select();

    if (error) throw error;

    return data[0];
  }

  async deleteInventoryItem(table, id) {
    await this._ensureAdmin(); // only admins

    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    return data;
  }

  subscribeToInventory(table, callback) {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        () => callback()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        () => callback()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        () => callback()
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}

export default InventoryService;