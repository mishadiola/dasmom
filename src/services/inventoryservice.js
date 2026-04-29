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
      .select('id, vaccine_name, quantity, unit, max_quantity, created_by, created_at, brand, expiration_date, doses');

    if (error) {
      console.error('Error fetching vaccine inventory:', error);
      throw error;
    }

    console.log('Vaccine inventory raw data:', data?.length || 0, data);

    return (data || []).map(row => {
      // Calculate status based on stock level
      const percentage = row.max_quantity ? Math.round((row.quantity / row.max_quantity) * 100) : 0;
      let status = 'ok';
      if (row.quantity <= 0) {
        status = 'critical';
      } else if (percentage <= 20) {
        status = 'low';
      } else if (percentage <= 50) {
        status = 'medium';
      }
      
      return {
        id: row.id,
        item_name: row.vaccine_name,
        quantity: row.quantity,
        unit: row.unit || 'vials',
        max_stock: row.max_quantity,
        status: status,
        brand: row.brand,
        expiration_date: row.expiration_date,
        doses: row.doses
      };
    });
  }

  async getSupplementInventory() {
    const { data, error } = await supabase
      .from('supplement_inventory')
      .select('id, supplement_name, quantity, unit, max_quant, created_by, created_at, brand, expiration_date');

    if (error) {
      console.error('Error fetching supplement inventory:', error);
      throw error;
    }

    console.log('Supplement inventory raw data:', data?.length || 0, data);

    return (data || []).map(row => {
      // Calculate status based on stock level
      const percentage = row.max_quant ? Math.round((row.quantity / row.max_quant) * 100) : 0;
      let status = 'ok';
      if (row.quantity <= 0) {
        status = 'critical';
      } else if (percentage <= 20) {
        status = 'low';
      } else if (percentage <= 50) {
        status = 'medium';
      }
      
      return {
        id: row.id,
        item_name: row.supplement_name,
        quantity: row.quantity,
        unit: row.unit || 'pcs',
        max_stock: row.max_quant,
        status: status,
        brand: row.brand,
        expiration_date: row.expiration_date
      };
    });
  }

  async addInventoryItem(table, { item_name, quantity, max_stock, unit, brand, expiration_date }) {
    await this._ensureAdmin(); // only admins

    const currentUser = await this.auth.getAuthUser();
    if (!currentUser) throw new Error('No logged‑in user');

    console.log('addInventoryItem called with:', { item_name, quantity, max_stock, unit, brand, expiration_date });

    // Check for existing item with same name, brand, and expiration date
    let query = supabase
      .from(table)
      .select('id, quantity');

    if (table === 'vaccine_inventory') {
      query = query.eq('vaccine_name', item_name);
    } else {
      query = query.eq('supplement_name', item_name);
    }

    // Add brand filter if provided
    if (brand) {
      query = query.eq('brand', brand);
    } else {
      query = query.is('brand', null);
    }

    // Add expiration date filter
    if (expiration_date) {
      query = query.eq('expiration_date', expiration_date);
    } else {
      query = query.is('expiration_date', null);
    }

    const { data: existingItems, error: checkError } = await query.limit(1);

    if (checkError) {
      console.error('Error checking for existing item:', checkError);
      throw checkError;
    }

    if (existingItems && existingItems.length > 0) {
      // Update existing item by adding to quantity
      const existingItem = existingItems[0];
      const newQuantity = existingItem.quantity + Number(quantity);
      const payload = {
        quantity: newQuantity
      };

      // Use correct field name based on table
      if (table === 'vaccine_inventory') {
        payload.max_quantity = Number(max_stock);
      } else {
        payload.max_quant = Number(max_stock);
      }

      console.log('Updating existing item:', { existingItem, newQuantity, payload });

      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', existingItem.id)
        .select();

      if (error) throw error;
      console.log(`Updated existing ${item_name} quantity from ${existingItem.quantity} to ${newQuantity}`);
      return data;
    }

    // Insert new item if no duplicate found
    const payload = {
      quantity: Number(quantity),
      unit: unit || (table === 'vaccine_inventory' ? 'vials' : 'pcs'),
      created_by: currentUser.id,
      brand: brand || null,
      expiration_date: expiration_date || null
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

    console.log('Inserting new item with payload:', payload);

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select();

    if (error) {
      console.error('addInventoryItem error:', error);
      throw error;
    }

    console.log('Successfully inserted item:', data);
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