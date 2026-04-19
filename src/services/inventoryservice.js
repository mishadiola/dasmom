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
      .select('id, vaccine_name, quantity, unit, max_quantity, created_by, created_at');

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      item_name: row.vaccine_name,
      quantity: row.quantity,
      unit: row.unit || 'vials',
      max_stock: row.max_quantity,
      status: row.status,
    }));
  }

  async getSupplementInventory() {
    const { data, error } = await supabase
      .from('supplement_inventory')
      .select('id, supplement_name, quantity, unit, max_quant, created_by, created_at');

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      item_name: row.supplement_name,
      quantity: row.quantity,
      unit: row.unit || 'pcs',
      max_stock: row.max_quant,
      status: row.status,
    }));
  }

  async addInventoryItem(table, { item_name, quantity, max_stock, unit }) {
    await this._ensureAdmin(); // only admins

    const currentUser = await this.auth.getAuthUser();
    if (!currentUser) throw new Error('No logged‑in user');

    const payload = {
      quantity: Number(quantity),
      unit: unit || (table === 'vaccine_inventory' ? 'vials' : 'pcs'),
      created_by: currentUser.id,
    };

    if (table === 'vaccine_inventory') {
      payload.vaccine_name = item_name;
      payload.max_quantity = Number(max_stock);
    } else if (table === 'supplement_inventory') {
      payload.supplement_name = item_name;
      payload.max_quant = Number(max_stock);
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

  async updateInventoryQuantity(table, id, newQuantity, newMaxStock) {
    await this._ensureAdmin(); // only admins

    const payload = {
      quantity: Number(newQuantity),
    };

    if (newMaxStock !== undefined && newMaxStock !== null) {
      if (table === 'vaccine_inventory') {
        payload.max_quantity = Number(newMaxStock);
      } else if (table === 'supplement_inventory') {
        payload.max_quant = Number(newMaxStock);
      }
    }

    const { data, error } = await supabase
      .from(table)
      .update(payload)
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