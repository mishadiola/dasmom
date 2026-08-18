import supabase from '../config/supabaseclient';
import AuthService from './authservice'; // ← now you have real AuthService

const normalizeInventoryRole = (value) => String(value ?? '').trim().toLowerCase();
const isAdminRole = (role) => {
  const normalized = normalizeInventoryRole(role);
  return normalized === 'admin' || normalized === 'super admin' || normalized === 'super-admin' || normalized.includes('admin');
};

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

    // Resolve authoritative role from DB (users.usertype) with fallback to staff_profiles
    let role = normalizeInventoryRole(user.role);
    try {
      const { data: userRow } = await this.supabase
        .from('users')
        .select('id, usertype')
        .eq('id', user.id)
        .maybeSingle();
      if (userRow?.usertype) {
        const { data: t } = await this.supabase
          .from('user_type')
          .select('user_type')
          .eq('id', userRow.usertype)
          .maybeSingle();
        if (t?.user_type) role = normalizeInventoryRole(t.user_type);
      } else {
        const { data: sp } = await this.supabase
          .from('staff_profiles')
          .select('station_ass')
          .eq('id', user.id)
          .maybeSingle();
        if (sp) role = 'staff';
      }
    } catch (err) {
      console.warn('Failed to resolve role from DB, falling back to session role:', err);
    }

    if (!isAdminRole(role)) throw new Error('Only admins can modify inventory');
    console.debug('Inventory._ensureAdmin resolved role=', role, 'for user=', user?.id);
  }

  async _resolveStationId(stationName) {
    if (!stationName || !stationName.trim()) {
      throw new Error('Destination station is required');
    }
    return await this.auth.getOrCreateStationId(stationName.trim());
  }

  async getCurrentUserScope() {
    return await this._getCurrentUserScope();
  }

  async _getCurrentUserScope() {
    const user = await this.auth.getAuthUser();
    if (!user?.id) {
      return { role: 'user', stationId: null, stationName: null, userId: null };
    }

    let role = normalizeInventoryRole(user.role);
    let stationId = null;
    let stationName = null;

    try {
      const { data: userRow } = await this.supabase
        .from('users')
        .select('id, usertype')
        .eq('id', user.id)
        .maybeSingle();

      if (userRow?.usertype) {
        const { data: typeRow } = await this.supabase
          .from('user_type')
          .select('user_type')
          .eq('id', userRow.usertype)
          .maybeSingle();

        if (typeRow?.user_type) {
          role = normalizeInventoryRole(typeRow.user_type);
        }
      }

      if (isAdminRole(role)) {
        return { role: 'admin', stationId: null, stationName: null, userId: user.id };
      }

      if (['staff', 'cho personnel'].includes(role)) {
        const { data: staffRow } = await this.supabase
          .from('staff_profiles')
          .select('station_ass')
          .eq('id', user.id)
          .maybeSingle();

        stationId = staffRow?.station_ass || null;

        if (stationId) {
          const { data: stationRow } = await this.supabase
            .from('stations')
            .select('station_name')
            .eq('id', stationId)
            .maybeSingle();

          stationName = stationRow?.station_name || null;
        }
      }
    } catch (err) {
      console.warn('Inventory user scope lookup failed:', err);
    }

    return { role, stationId, stationName, userId: user.id };
  }

  async getStationInventorySnapshot() {
    const scope = await this._getCurrentUserScope();
    const isAdmin = scope.role === 'admin';

    if (!isAdmin && !scope.stationId) {
      return [];
    }

    // Fetch station vaccine inventory
    let vaccineQuery = this.supabase
      .from('station_vaccine_inventory')
      .select('id, station_id, vaccine_id, quantity, batch, updated_at, stations:station_id (station_name)');

    if (!isAdmin && scope.stationId) {
      vaccineQuery = vaccineQuery.eq('station_id', scope.stationId);
    }

    const { data: vaccineStationData, error: vaccineStationError } = await vaccineQuery;
    if (vaccineStationError) throw vaccineStationError;

    // Fetch station supplement inventory
    let supplementQuery = this.supabase
      .from('station_supplement_inventory')
      .select('id, station_id, supplement_inventory_id, quantity, batch, updated_at, stations:station_id (station_name)');

    if (!isAdmin && scope.stationId) {
      supplementQuery = supplementQuery.eq('station_id', scope.stationId);
    }

    const { data: supplementStationData, error: supplementStationError } = await supplementQuery;
    if (supplementStationError) throw supplementStationError;

    // Get unique vaccine IDs and fetch their details from central inventory
    const vaccineIds = [...new Set((vaccineStationData || []).map(row => row.vaccine_id).filter(Boolean))];
    let vaccineDetails = {};
    if (vaccineIds.length > 0) {
      const { data: vaccineData, error: vaccineError } = await this.supabase
        .from('vaccine_inventory')
        .select('id, vaccine_name, unit, max_quantity, brand, expiration_date, doses, manufactured_date')
        .in('id', vaccineIds);
      if (vaccineError) throw vaccineError;
      vaccineDetails = Object.fromEntries((vaccineData || []).map(row => [row.id, row]));
    }

    // Get unique supplement IDs and fetch their details from central inventory
    const supplementIds = [...new Set((supplementStationData || []).map(row => row.supplement_inventory_id).filter(Boolean))];
    let supplementDetails = {};
    if (supplementIds.length > 0) {
      const { data: supplementData, error: supplementError } = await this.supabase
        .from('supplement_inventory')
        .select('id, supplement_name, unit, max_quant, brand, expiration_date, batch_number, manufactured_date');
      if (supplementError) throw supplementError;
      supplementDetails = Object.fromEntries((supplementData || []).map(row => [row.id, row]));
    }

    // Combine station data with central inventory details
    const rows = [
      ...(vaccineStationData || []).map(row => {
        const vaxDetail = vaccineDetails[row.vaccine_id] || {};
        return {
          id: row.id,
          station: row.stations?.station_name || 'Unknown station',
          item_name: vaxDetail.vaccine_name || 'Unknown vaccine',
          item_type: 'Vaccine',
          quantity: Number(row.quantity) || 0,
          unit: vaxDetail.unit || 'vials',
          batch: row.batch || null,
          last_updated: row.updated_at || null,
          brand: vaxDetail.brand || '',
          expiration_date: vaxDetail.expiration_date || null
        };
      }),
      ...(supplementStationData || []).map(row => {
        const suppDetail = supplementDetails[row.supplement_inventory_id] || {};
        return {
          id: row.id,
          station: row.stations?.station_name || 'Unknown station',
          item_name: suppDetail.supplement_name || 'Unknown supplement',
          item_type: 'Supplement',
          quantity: Number(row.quantity) || 0,
          unit: suppDetail.unit || 'pcs',
          batch: row.batch || null,
          last_updated: row.updated_at || null,
          brand: suppDetail.brand || '',
          expiration_date: suppDetail.expiration_date || null
        };
      })
    ];

    return rows.sort((a, b) => {
      const stationCompare = (a.station || '').localeCompare(b.station || '');
      if (stationCompare !== 0) return stationCompare;
      return (a.item_name || '').localeCompare(b.item_name || '');
    });
  }

  async getStationDistributionHistory() {
    const scope = await this._getCurrentUserScope();
    const isAdmin = scope.role === 'admin';

    const vaccineQuery = this.supabase
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
      `);

    const supplementQuery = this.supabase
      .from('supplement_distribution')
      .select(`
        id,
        distributed_date,
        quantity,
        station_id,
        stations:station_id (station_name),
        distributed_by,
        users:distributed_by (email_address),
        supplement_id,
        supplement_inventory:supplement_id (supplement_name, brand, batch_number, unit)
      `);

    if (!isAdmin) {
      if (!scope.stationId) {
        return [];
      }
      vaccineQuery.eq('station_id', scope.stationId);
      supplementQuery.eq('station_id', scope.stationId);
    }

    const [vaccineResult, supplementResult] = await Promise.all([vaccineQuery, supplementQuery]);

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
      remarks: ''
    }));

    return [...vaccineRecords, ...supplementRecords].sort((a, b) => {
      const aTime = a.distribution_date ? new Date(a.distribution_date).getTime() : 0;
      const bTime = b.distribution_date ? new Date(b.distribution_date).getTime() : 0;
      return bTime - aTime;
    });
  }

  async distributeInventory({ itemType, itemId, quantity, destinationStation, distributedBy, distributedDate, remarks, stationBatch = null }) {
    if (!itemType || !['vaccine', 'supplement'].includes(itemType)) {
      throw new Error('Invalid item type for distribution');
    }

    if (itemType === 'vaccine') {
      return await this.distributeVaccine(itemId, quantity, destinationStation, distributedBy, distributedDate, remarks, stationBatch);
    }

    return await this.distributeSupplement(itemId, quantity, destinationStation, distributedBy, distributedDate, remarks, stationBatch);
  }

  async distributeVaccine(vaccineId, quantity, stationName, distributedBy, distributedDate = new Date().toISOString().split('T')[0], remarks = null, stationBatch = null) {

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
      .select('id, quantity, batch')
      .eq('station_id', station_id)
      .eq('vaccine_id', vaccineId)
      .maybeSingle();

    if (stationFetchError) throw stationFetchError;

    let stationInventory;
    // Station should have its own batch value; do not copy main inventory batch
    if (stationExisting) {
      const existingBatch = stationExisting.batch ?? null;
      const batchToSet = stationBatch !== null && stationBatch !== undefined && stationBatch !== '' ? stationBatch : existingBatch;

      const { data, error } = await this.supabase
        .from('station_vaccine_inventory')
        .update({ quantity: Number(stationExisting.quantity) + qty, batch: batchToSet, updated_at: distributedDate })
        .eq('id', stationExisting.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    } else {
      const { data, error } = await this.supabase
        .from('station_vaccine_inventory')
        .insert([{ station_id, vaccine_id: vaccineId, quantity: qty, batch: stationBatch || null, updated_at: distributedDate }])
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    }

    return { distribution: distData, updatedMain, stationInventory };
  }

  async distributeSupplement(supplementId, quantity, stationName, distributedBy, distributedDate = new Date().toISOString().split('T')[0], remarks = null, stationBatch = null) {

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
      .select('id, quantity, batch')
      .eq('station_id', station_id)
      .eq('supplement_inventory_id', supplementId)
      .maybeSingle();

    if (stationFetchError) throw stationFetchError;

    let stationInventory;
    // Station supplement should use its own batch field
    if (stationExisting) {
      const existingBatch = stationExisting.batch ?? null;
      const batchToSet = stationBatch !== null && stationBatch !== undefined && stationBatch !== '' ? stationBatch : existingBatch;

      const { data, error } = await this.supabase
        .from('station_supplement_inventory')
        .update({ quantity: Number(stationExisting.quantity) + qty, batch: batchToSet, updated_at: distributedDate })
        .eq('id', stationExisting.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    } else {
      const { data, error } = await this.supabase
        .from('station_supplement_inventory')
        .insert([{ station_id, supplement_inventory_id: supplementId, quantity: qty, batch: stationBatch || null, updated_at: distributedDate }])
        .select()
        .maybeSingle();
      if (error) throw error;
      stationInventory = data;
    }

    return { distribution: distData, updatedMain, stationInventory };
  }

  async getVaccineInventory() {
    try {
      const scope = await this._getCurrentUserScope();
      const isAdmin = scope.role === 'admin';

      let query = supabase
        .from('vaccine_inventory')
        .select('id, vaccine_name, quantity, unit, max_quantity, created_by, created_at, brand, expiration_date, doses, batch, manufactured_date')
        .limit(200);

      if (!isAdmin) {
        if (!scope.stationId) return [];

        query = supabase
          .from('station_vaccine_inventory')
          .select(`
            id,
            station_id,
            vaccine_id,
            quantity,
            batch,
            updated_at,
            vaccine_inventory:vaccine_id (
              vaccine_name,
              unit,
              max_quantity,
              brand,
              expiration_date,
              doses,
              manufactured_date
            )
          `)
          .eq('station_id', scope.stationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vaccine inventory:', error);
        return [];
      }

      const mapped = (data || []).map(row => {
        const inventoryRow = row?.vaccine_inventory || {};
        const name = row?.vaccine_name ?? row?.item_name ?? inventoryRow?.vaccine_name ?? inventoryRow?.item_name ?? 'Unknown vaccine';
        const quantity = Number(row?.quantity ?? 0);
        const maxStock = Number(row?.max_quantity ?? inventoryRow?.max_quantity ?? 0);
        const percentage = maxStock ? Math.round((quantity / maxStock) * 100) : 0;
        
        let status = 'ok';
        // Preserve archived status from database
        const dbStatus = row?.status ?? inventoryRow?.status;
        if (dbStatus === 'archived') {
            status = 'archived';
        } else {
            if (quantity <= 0) status = 'critical';
            else if (percentage <= 20) status = 'low';
            else if (percentage <= 50) status = 'medium';
        }

        if (!isAdmin) {
          return {
            id: row?.vaccine_id ?? row?.id ?? inventoryRow?.id ?? '',
            item_name: name,
            quantity,
            unit: inventoryRow?.unit || row?.unit || 'vials',
            max_stock: maxStock,
            status,
            brand: inventoryRow?.brand || row?.brand || '',
            expiration_date: inventoryRow?.expiration_date || row?.expiration_date || null,
            doses: inventoryRow?.doses || row?.doses || null,
            batch: row?.batch ?? inventoryRow?.batch ?? null,
            manufactured_date: inventoryRow?.manufactured_date || row?.manufactured_date || null
          };
        }

        return {
          id: row.id,
          item_name: name,
          quantity: row.quantity,
          unit: row.unit || 'vials',
          max_stock: maxStock,
          status,
          brand: row.brand,
          expiration_date: row.expiration_date,
          doses: row.doses,
          batch: row.batch,
          manufactured_date: row.manufactured_date
        };
      });

      return mapped;
    } catch (err) {
      console.error('Vaccine inventory query failed:', err);
      return [];
    }
  }

  async getSupplementInventory() {
    try {
      const scope = await this._getCurrentUserScope();
      const isAdmin = scope.role === 'admin';

      let query = supabase
        .from('supplement_inventory')
        .select('id, supplement_name, quantity, unit, max_quant, created_by, created_at, brand, expiration_date, batch_number, manufactured_date')
        .limit(200);

      if (!isAdmin) {
        if (!scope.stationId) return [];

        query = supabase
          .from('station_supplement_inventory')
          .select(`
            id,
            station_id,
            supplement_inventory_id,
            quantity,
            batch,
            updated_at,
            supplement_inventory:supplement_inventory_id (
              supplement_name,
              unit,
              max_quant,
              brand,
              expiration_date,
              batch_number,
              manufactured_date
            )
          `)
          .eq('station_id', scope.stationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching supplement inventory:', error);
        return [];
      }

      return (data || []).map(row => {
        const inventoryRow = row?.supplement_inventory || {};
        const name = row?.supplement_name ?? row?.item_name ?? inventoryRow?.supplement_name ?? inventoryRow?.item_name ?? 'Unknown supplement';
        const quantity = Number(row?.quantity ?? 0);
        const maxStock = Number(row?.max_quant ?? inventoryRow?.max_quant ?? 0);
        const percentage = maxStock ? Math.round((quantity / maxStock) * 100) : 0;
        
        let status = 'ok';
        // Preserve archived status from database
        const dbStatus = row?.status ?? inventoryRow?.status;
        if (dbStatus === 'archived') {
            status = 'archived';
        } else {
            if (quantity <= 0) status = 'critical';
            else if (percentage <= 20) status = 'low';
            else if (percentage <= 50) status = 'medium';
        }

        if (!isAdmin) {
          return {
            id: row?.supplement_inventory_id ?? row?.id ?? inventoryRow?.id ?? '',
            item_name: name,
            quantity,
            unit: inventoryRow?.unit || row?.unit || 'pcs',
            max_stock: maxStock,
            status,
            brand: inventoryRow?.brand || row?.brand || '',
            expiration_date: inventoryRow?.expiration_date || row?.expiration_date || null,
            batch_number: row?.batch ?? inventoryRow?.batch_number ?? null,
            manufactured_date: inventoryRow?.manufactured_date || row?.manufactured_date || null
          };
        }

        return {
          id: row.id,
          item_name: name,
          quantity: row.quantity,
          unit: row.unit || 'pcs',
          max_stock: maxStock,
          status,
          brand: row.brand,
          expiration_date: row.expiration_date,
          batch_number: row.batch_number,
          manufactured_date: row.manufactured_date
        };
      });
    } catch (err) {
      console.error('Supplement inventory query failed:', err);
      return [];
    }
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