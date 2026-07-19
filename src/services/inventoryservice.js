import supabase from '../config/supabaseclient';
import AuthService from './authservice'; // ← now you have real AuthService

class InventoryService {
  constructor() {
    this.auth = new AuthService();
    this.supabase = supabase;
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

  async _resolveStationId(stationName) {
    if (!stationName || !stationName.trim()) {
      throw new Error('Destination station is required');
    }
    return await this.auth.getOrCreateStationId(stationName.trim());
  }

  async getStationDistributionHistory() {
    const [vaccineResult, supplementResult] = await Promise.all([
      this.supabase
        .from('vaccine_distribution')
        .select(`
          id,
          distributed_date,
          quantity,
          remarks,
          station_id,
          stations:station_id (station_name),
          distributed_by,
          users:distributed_by (email_address),
          vaccine_id,
          vaccine_inventory:vaccine_id (vaccine_name, brand, batch, unit)
        `),
      this.supabase
        .from('supplement_distribution')
        .select(`
          id,
          distributed_date,
          quantity,
          remarks,
          station_id,
          stations:station_id (station_name),
          distributed_by,
          users:distributed_by (email_address),
          supplement_id,
          supplement_inventory:supplement_id (supplement_name, brand, batch_number, unit)
        `)
    ]);

    if (vaccineResult.error) {
      console.error('Error fetching vaccine distribution history:', vaccineResult.error);
      throw vaccineResult.error;
    }
    if (supplementResult.error) {
      console.error('Error fetching supplement distribution history:', supplementResult.error);
      throw supplementResult.error;
    }

    const vaccineRecords = (vaccineResult.data || []).map(row => ({
      id: row.id,
      distribution_date: row.distributed_date,
      item_name: row.vaccine_inventory?.vaccine_name || 'Unknown',
      brand: row.vaccine_inventory?.brand || '',
      batch: row.vaccine_inventory?.batch || null,
      item_type: 'Vaccine',
      quantity: row.quantity,
      unit: row.vaccine_inventory?.unit || 'vials',
      destination_station: row.stations?.station_name || 'Unknown',
      released_by: row.users?.email_address || row.distributed_by || 'Unknown',
      remarks: row.remarks || ''
    }));

    const supplementRecords = (supplementResult.data || []).map(row => ({
      id: row.id,
      distribution_date: row.distributed_date,
      item_name: row.supplement_inventory?.supplement_name || 'Unknown',
      brand: row.supplement_inventory?.brand || '',
      batch: row.supplement_inventory?.batch_number || null,
      item_type: 'Supplement',
      quantity: row.quantity,
      unit: row.supplement_inventory?.unit || 'pcs',
      destination_station: row.stations?.station_name || 'Unknown',
      released_by: row.users?.email_address || row.distributed_by || 'Unknown',
      remarks: row.remarks || ''
    }));

    return [...vaccineRecords, ...supplementRecords].sort((a, b) => {
      const aTime = a.distribution_date ? new Date(a.distribution_date).getTime() : 0;
      const bTime = b.distribution_date ? new Date(b.distribution_date).getTime() : 0;
      return bTime - aTime;
    });
  }

  async distributeInventory({ itemType, itemId, quantity, destinationStation, distributedBy, distributedDate, remarks }) {
    if (!itemType || !['vaccine', 'supplement'].includes(itemType)) {
      throw new Error('Invalid item type for distribution');
    }

    if (itemType === 'vaccine') {
      return await this.distributeVaccine(itemId, quantity, destinationStation, distributedBy, distributedDate, remarks);
    }

    return await this.distributeSupplement(itemId, quantity, destinationStation, distributedBy, distributedDate, remarks);
  }

  async distributeVaccine(vaccineId, quantity, stationName, distributedBy, distributedDate = new Date().toISOString().split('T')[0], remarks = null) {
    await this._ensureAdmin();

    const qty = Number(quantity);
    if (!vaccineId) throw new Error('Vaccine item is required');
    if (!stationName) throw new Error('Destination station is required');
    if (!distributedBy) throw new Error('Distributed by must be a valid user id');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than zero');

    const station_id = await this._resolveStationId(stationName);
    const { data: item, error: fetchError } = await this.supabase
      .from('vaccine_inventory')
      .select('id, quantity')
      .eq('id', vaccineId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) throw new Error('Selected vaccine item was not found');
    if (item.quantity < qty) throw new Error('Insufficient vaccine stock for distribution');

    const { data: updatedMain, error: updateError } = await this.supabase
      .from('vaccine_inventory')
      .update({ quantity: item.quantity - qty })
      .eq('id', vaccineId)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    const { data: distData, error: distError } = await this.supabase
      .from('vaccine_distribution')
      .insert([{ 
        vaccine_id: vaccineId,
        station_id,
        distributed_by: distributedBy,
        quantity: qty,
        distributed_date: distributedDate,
        remarks: remarks || null
      }])
      .select()
      .maybeSingle();

    if (distError) throw distError;

    const { data: stationExisting, error: stationFetchError } = await this.supabase
      .from('station_vaccine_inventory')
      .select('id, quantity')
      .eq('station_id', station_id)
      .eq('vaccine_id', vaccineId)
      .maybeSingle();

    if (stationFetchError) throw stationFetchError;

    let stationInventory;
    if (stationExisting) {
      const { data, error } = await this.supabase
        .from('station_vaccine_inventory')
        .update({ quantity: Number(stationExisting.quantity) + qty, updated_at: distributedDate })
        .eq('id', stationExisting.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    } else {
      const { data, error } = await this.supabase
        .from('station_vaccine_inventory')
        .insert([{ station_id, vaccine_id: vaccineId, quantity: qty, updated_at: distributedDate }])
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    }

    return { distribution: distData, updatedMain, stationInventory };
  }

  async distributeSupplement(supplementId, quantity, stationName, distributedBy, distributedDate = new Date().toISOString().split('T')[0], remarks = null) {
    await this._ensureAdmin();

    const qty = Number(quantity);
    if (!supplementId) throw new Error('Supplement item is required');
    if (!stationName) throw new Error('Destination station is required');
    if (!distributedBy) throw new Error('Distributed by must be a valid user id');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than zero');

    const station_id = await this._resolveStationId(stationName);
    const { data: item, error: fetchError } = await this.supabase
      .from('supplement_inventory')
      .select('id, quantity')
      .eq('id', supplementId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) throw new Error('Selected supplement item was not found');
    if (item.quantity < qty) throw new Error('Insufficient supplement stock for distribution');

    const { data: updatedMain, error: updateError } = await this.supabase
      .from('supplement_inventory')
      .update({ quantity: item.quantity - qty })
      .eq('id', supplementId)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    const { data: distData, error: distError } = await this.supabase
      .from('supplement_distribution')
      .insert([{ 
        supplement_id: supplementId,
        station_id,
        distributed_by: distributedBy,
        quantity: qty,
        distributed_date: distributedDate,
      }])
      .select()
      .maybeSingle();

    if (distError) throw distError;

    const { data: stationExisting, error: stationFetchError } = await this.supabase
      .from('station_supplement_inventory')
      .select('id, quantity')
      .eq('station_id', station_id)
      .eq('supplement_inventory_id', supplementId)
      .maybeSingle();

    if (stationFetchError) throw stationFetchError;

    let stationInventory;
    if (stationExisting) {
      const { data, error } = await this.supabase
        .from('station_supplement_inventory')
        .update({ quantity: Number(stationExisting.quantity) + qty, updated_at: distributedDate })
        .eq('id', stationExisting.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    } else {
      const { data, error } = await this.supabase
        .from('station_supplement_inventory')
        .insert([{ station_id, supplement_inventory_id: supplementId, quantity: qty, updated_at: distributedDate }])
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    }

    return { distribution: distData, updatedMain, stationInventory };
  }

  async getVaccineInventory() {
    const { data, error } = await supabase
      .from('vaccine_inventory')
      .select('id, vaccine_name, quantity, unit, max_quantity, created_by, created_at, brand, expiration_date, doses, batch, manufactured_date');

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
        doses: row.doses,
        batch: row.batch,
        manufactured_date: row.manufactured_date
      };
    });
  }

  async getSupplementInventory() {
    const { data, error } = await supabase
      .from('supplement_inventory')
      .select('id, supplement_name, quantity, unit, max_quant, created_by, created_at, brand, expiration_date, batch_number, manufactured_date');

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
        expiration_date: row.expiration_date,
        batch_number: row.batch_number,
        manufactured_date: row.manufactured_date
      };
    });
  }

  async addInventoryItem(table, { item_name, quantity, max_stock, unit, brand, expiration_date, batch_number, manufactured_date }) {
    await this._ensureAdmin(); // only admins

    const currentUser = await this.auth.getAuthUser();
    if (!currentUser) throw new Error('No logged‑in user');

    console.log('addInventoryItem called with:', { item_name, quantity, max_stock, unit, brand, expiration_date, batch_number, manufactured_date });

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
      expiration_date: expiration_date || null,
      manufactured_date: manufactured_date || null
    };

    // Add batch field based on table type
    if (table === 'vaccine_inventory') {
      payload.batch = batch_number ? Number(batch_number) : null;
    } else if (table === 'supplement_inventory') {
      payload.batch_number = batch_number ? Number(batch_number) : null;
    }

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