import React, { useState, useEffect } from 'react';
import { 
    Search, Filter, Plus, Package, AlertTriangle, 
    CheckCircle2, RefreshCw, Edit2, Trash2, 
    ChevronDown, ChevronUp, Pill, Syringe, MoreVertical
} from 'lucide-react';
import InventoryService from '../../services/inventoryservice';
import '../../styles/pages/Inventory.css';

const inventoryService = new InventoryService();

const Inventory = () => {
    // State
    const [activeTab, setActiveTab] = useState('vaccines'); // 'vaccines' | 'supplements'
    const [loading, setLoading] = useState(true);
    const [vaccines, setVaccines] = useState([]);
    const [supplements, setSupplements] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(null); // { table, item }
    const [form, setForm] = useState({ item_name: '', quantity: '', unit: '', min_stock: 10 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vaxData, suppData] = await Promise.all([
                inventoryService.getVaccineInventory(),
                inventoryService.getSupplementInventory()
            ]);
            setVaccines(vaxData);
            setSupplements(suppData);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Subscribe to real-time changes
        const vaxSub = inventoryService.subscribeToInventory('vaccine_inventory', () => fetchData());
        const suppSub = inventoryService.subscribeToInventory('supplement_inventory', () => fetchData());

        return () => {
            vaxSub.unsubscribe();
            suppSub.unsubscribe();
        };
    }, []);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const table = activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory';
            await inventoryService.addInventoryItem(table, form);
            setShowAddModal(false);
            setForm({ item_name: '', quantity: '', unit: '', min_stock: 10 });
        } catch (error) {
            alert('Failed to add item: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateQuantity = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await inventoryService.updateInventoryQuantity(
                showUpdateModal.table, 
                showUpdateModal.item.id, 
                form.quantity
            );
            setShowUpdateModal(null);
            setForm({ item_name: '', quantity: '', unit: '', min_stock: 10 });
        } catch (error) {
            alert('Failed to update quantity: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (table, id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await inventoryService.deleteInventoryItem(table, id);
        } catch (error) {
            alert('Failed to delete item: ' + error.message);
        }
    };

    const getStatus = (qty, min) => {
        if (qty <= 0) return { label: 'Out of Stock', class: 'status-out' };
        if (qty < min) return { label: 'Low Stock', class: 'status-low' };
        return { label: 'In Stock', class: 'status-ok' };
    };

    const currentItems = activeTab === 'vaccines' ? vaccines : supplements;
    
    // Filtered data
    const filteredItems = currentItems.filter(item => {
        const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
        const status = getStatus(item.quantity, item.min_stock).label;
        const matchesStatus = statusFilter === 'All' || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Stats
    const totalItems = currentItems.length;
    const lowStockCount = currentItems.filter(i => i.quantity > 0 && i.quantity < i.min_stock).length;
    const outOfStockCount = currentItems.filter(i => i.quantity <= 0).length;

    return (
        <div className="inventory-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Package size={22} className="header-icon" /> Inventory Management</h1>
                    <p className="page-subtitle">Track and manage facility supplies for vaccines and supplements.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={16} /> Add {activeTab === 'vaccines' ? 'Vaccine' : 'Supplement'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="inv-stats-grid">
                <div className="stat-card stat-card--total">
                    <div className="stat-header">
                        <Package size={20} className="stat-icon" />
                        <span className="stat-label">Total Items</span>
                    </div>
                    <div className="stat-value">{totalItems}</div>
                </div>
                <div className="stat-card stat-card--low">
                    <div className="stat-header">
                        <AlertTriangle size={20} className="stat-icon" />
                        <span className="stat-label">Low Stock</span>
                    </div>
                    <div className="stat-value">{lowStockCount}</div>
                </div>
                <div className="stat-card stat-card--out">
                    <div className="stat-header">
                        <Package size={20} className="stat-icon" />
                        <span className="stat-label">Out of Stock</span>
                    </div>
                    <div className="stat-value">{outOfStockCount}</div>
                </div>
            </div>

            {/* Controls */}
            <div className="inv-controls">
                <div className="search-wrap">
                    <Search size={16} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search items..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filters-row">
                    <Filter size={14} className="filter-icon" />
                    <span>Filter:</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="All">All Status</option>
                        <option value="In Stock">In Stock</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="inv-tabs">
                <button 
                    className={`inv-tab ${activeTab === 'vaccines' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vaccines')}
                >
                    <Syringe size={15} /> Vaccines
                </button>
                <button 
                    className={`inv-tab ${activeTab === 'supplements' ? 'active' : ''}`}
                    onClick={() => setActiveTab('supplements')}
                >
                    <Pill size={15} /> Supplements
                </button>
            </div>

            {/* Table */}
            <div className="inv-card">
                <div className="table-wrapper">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Current Quantity</th>
                                <th>Unit</th>
                                <th>Status</th>
                                <th style={{textAlign: 'right'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-8">Loading inventory data...</td>
                                </tr>
                            ) : filteredItems.length > 0 ? (
                                filteredItems.map(item => {
                                    const status = getStatus(item.quantity, item.min_stock);
                                    return (
                                        <tr key={item.id} className="inv-row">
                                            <td className="item-name-cell">
                                                <strong>{item.item_name}</strong>
                                            </td>
                                            <td className="quantity-cell">
                                                <span className={`qty-text ${status.class}`}>
                                                    {item.quantity}
                                                </span>
                                            </td>
                                            <td className="unit-cell">{item.unit || 'pcs'}</td>
                                            <td>
                                                <span className={`status-badge ${status.class}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td style={{textAlign: 'right'}}>
                                                <div className="action-btns">
                                                    <button 
                                                        className="action-btn edit-btn" 
                                                        title="Update Stock"
                                                        onClick={() => {
                                                            setForm({ ...form, quantity: item.quantity });
                                                            setShowUpdateModal({ table: activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory', item });
                                                        }}
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button 
                                                        className="action-btn delete-btn" 
                                                        title="Delete Item"
                                                        onClick={() => handleDelete(activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory', item.id)}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="empty-state">
                                        <Package size={40} className="empty-icon" />
                                        <p>No inventory items found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add New {activeTab === 'vaccines' ? 'Vaccine' : 'Supplement'}</h2>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Item Name</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={form.item_name}
                                        onChange={e => setForm({...form, item_name: e.target.value})}
                                        placeholder="e.g. Iron Tablets"
                                    />
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Initial Quantity</label>
                                        <input 
                                            type="number" 
                                            required 
                                            value={form.quantity}
                                            onChange={e => setForm({...form, quantity: e.target.value})}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Unit</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={form.unit}
                                            onChange={e => setForm({...form, unit: e.target.value})}
                                            placeholder="pcs, vials, etc."
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Low Stock Threshold</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={form.min_stock}
                                        onChange={e => setForm({...form, min_stock: e.target.value})}
                                        placeholder="10"
                                    />
                                    <small>Alert will show if quantity falls below this number.</small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showUpdateModal && (
                <div className="modal-overlay" onClick={() => setShowUpdateModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Update Quantity</h2>
                            <p>{showUpdateModal.item.item_name}</p>
                        </div>
                        <form onSubmit={handleUpdateQuantity}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Current Stock: {showUpdateModal.item.quantity} {showUpdateModal.item.unit}</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={form.quantity}
                                        onChange={e => setForm({...form, quantity: e.target.value})}
                                        placeholder="Enter new quantity"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowUpdateModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Updating...' : 'Update Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
