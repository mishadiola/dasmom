import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();

export default class InventoryService {
    constructor() {
        this.supabase = supabase;
    }

    async getCurrentUserId() {
        const user = await authService.getAuthUser();
        return user?.id || null;
    }

    /**
     * Fetch all items from vaccine_inventory
     */
    async getVaccineInventory() {
        try {
            const { data, error } = await this.supabase
                .from('vaccine_inventory')
                .select('*')
                .order('item_name', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching vaccine inventory:', error);
            return [];
        }
    }

    /**
     * Fetch all items from supplement_inventory
     */
    async getSupplementInventory() {
        try {
            const { data, error } = await this.supabase
                .from('supplement_inventory')
                .select('*')
                .order('item_name', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching supplement inventory:', error);
            return [];
        }
    }

    /**
     * Add a new item to either table
     * @param {string} table - 'vaccine_inventory' or 'supplement_inventory'
     * @param {object} item - { item_name, quantity, unit, min_stock }
     */
    async addInventoryItem(table, item) {
        try {
            const createdBy = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .from(table)
                .insert([{
                    item_name: item.item_name,
                    quantity: parseInt(item.quantity) || 0,
                    unit: item.unit,
                    min_stock: parseInt(item.min_stock) || 10,
                    created_by: createdBy
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error adding item to ${table}:`, error);
            throw error;
        }
    }

    /**
     * Update stock quantity for an item
     * @param {string} table - 'vaccine_inventory' or 'supplement_inventory'
     * @param {string} id - Item ID
     * @param {number} newQuantity - The total new quantity
     */
    async updateInventoryQuantity(table, id, newQuantity) {
        try {
            const { data, error } = await this.supabase
                .from(table)
                .update({ quantity: parseInt(newQuantity) })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error updating quantity in ${table}:`, error);
            throw error;
        }
    }

    /**
     * Delete an inventory item
     */
    async deleteInventoryItem(table, id) {
        try {
            const { error } = await this.supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error deleting item from ${table}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to real-time changes
     */
    subscribeToInventory(table, callback) {
        return this.supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: table },
                (payload) => {
                    console.log(`🔔 Real-time change in ${table}:`, payload);
                    callback(payload);
                }
            )
            .subscribe();
    }
}
