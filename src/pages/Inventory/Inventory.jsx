import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Package,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Archive,
  ArchiveRestore,
  Syringe,
  Pill,
} from 'lucide-react';
import InventoryService from '../../services/inventoryservice';
import PatientService from '../../services/patientservice';
import '../../styles/pages/Inventory.css';

const inventoryService = new InventoryService();
const patientService = new PatientService();

const Inventory = () => {
  const [activeTab, setActiveTab] = useState('vaccines');
  const [loading, setLoading] = useState(true);
  const [vaccines, setVaccines] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeSummaryFilter, setActiveSummaryFilter] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [vaccStats, setVaccStats] = useState({ mothersPending: 0, newbornsPending: 0 });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(null);
  const [form, setForm] = useState({ item_name: '', quantity: '', max_stock: '', unit: 'vials' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const itemsPerPage = 20;

  const vaccineUnitOptions = ['vials', 'doses', 'ml'];
  const supplementUnitOptions = ['tablets', 'capsules', 'sachets', 'bottles'];
  const unitOptions = activeTab === 'vaccines' ? vaccineUnitOptions : supplementUnitOptions;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vaxData, suppData, statsData] = await Promise.all([
        inventoryService.getVaccineInventory(),
        inventoryService.getSupplementInventory(),
        patientService.getVaccinationStats()
      ]);

      setVaccStats(statsData || { mothersPending: 0, newbornsPending: 0 });

      const mappedVaccines = (vaxData || []).map(row => ({
        id: row?.id || '',
        item_name: row?.vaccine_name || row?.item_name || 'Unknown',
        quantity: row?.quantity || 0,
        max_stock: row?.max_stock || 500,
        unit: row?.unit || 'vials',
        status: row?.status || 'active',
      }));
      const mappedSupplements = (suppData || []).map(row => ({
        id: row?.id || '',
        item_name: row?.supplement_name || row?.item_name || 'Unknown',
        quantity: row?.quantity || 0,
        max_stock: row?.max_stock || 1000,
        unit: row?.unit || 'tablets',
        status: row?.status || 'active',
      }));

      setVaccines(mappedVaccines);
      setSupplements(mappedSupplements);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const vaxSub = inventoryService.subscribeToInventory('vaccine_inventory', () => fetchData());
    const suppSub = inventoryService.subscribeToInventory('supplement_inventory', () => fetchData());

    return () => {
      vaxSub.unsubscribe();
      suppSub.unsubscribe();
    };
  }, []);

  const getStatus = (qty, maxStock) => {
    if (qty <= 0) return { label: 'Out of Stock', class: 'status-out' };
    // 20% of max stock threshold
    const threshold = maxStock ? Math.ceil(maxStock * 0.2) : 20;
    if (qty <= threshold) return { label: 'Low Stock', class: 'status-low' };
    return { label: 'In Stock', class: 'status-ok' };
  };

  const getStockPercentage = (current, max) => {
    if (!max || max === 0) return 0;
    const percentage = Math.round((current / max) * 100);
    return Math.min(100, Math.max(0, percentage));
  };

  const currentItems = activeTab === 'vaccines' ? vaccines : supplements;

  const filteredItems = currentItems
    .filter(item => item && typeof item === 'object')
    .filter(item => {
      const matchesSearch = (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const status = getStatus(item.quantity || 0, item.max_stock).label;
      const matchesStatus = statusFilter === 'All' || status === statusFilter;
      
      // Apply archive filter
      const itemStatus = item.status || 'active';
      const matchesArchive = archiveFilter === 'all' || itemStatus === archiveFilter;
      
      // Apply summary card filter
      let matchesSummary = true;
      if (activeSummaryFilter === 'lowStock') {
        const threshold = item.max_stock ? Math.ceil(item.max_stock * 0.2) : 20;
        matchesSummary = (item.quantity || 0) > 0 && (item.quantity || 0) <= threshold;
      } else if (activeSummaryFilter === 'outOfStock') {
        matchesSummary = (item.quantity || 0) <= 0;
      }
      // If activeSummaryFilter is 'all' or null, show all items
      
      return matchesSearch && matchesStatus && matchesSummary && matchesArchive;
    });

  const totalItems = (currentItems || []).length;
  const lowStockCount = (currentItems || []).filter(i => {
    const threshold = i?.max_stock ? Math.ceil(i.max_stock * 0.2) : 20;
    return (i?.quantity || 0) > 0 && (i?.quantity || 0) <= threshold;
  }).length;
  const outOfStockCount = (currentItems || []).filter(i => (i?.quantity || 0) <= 0).length;

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, statusFilter, activeSummaryFilter, archiveFilter]);

  const handleAddSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const table = activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory';

      const payload = {
        item_name: form.item_name,
        quantity: Number(form.quantity),
        max_stock: Number(form.max_stock) || (activeTab === 'vaccines' ? 500 : 1000),
        unit: form.unit,
      };

      await inventoryService.addInventoryItem(table, payload);

      setShowAddModal(false);
      setForm({ item_name: '', quantity: '', max_stock: '', unit: activeTab === 'vaccines' ? 'vials' : 'tablets' });
    } catch (error) {
      alert('Failed to add item: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuantity = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inventoryService.updateInventoryQuantity(
        showUpdateModal.table,
        showUpdateModal.item.id,
        Number(form.quantity),
        Number(form.max_stock)
      );
      setShowUpdateModal(null);
      setForm({ item_name: '', quantity: '', max_stock: '', unit: '' });
    } catch (error) {
      alert('Failed to update quantity: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (table, id) => {
    if (!window.confirm('Are you sure you want to archive this item? It will be removed from active lists but can be restored.')) return;
    try {
      // Soft delete: Update status to 'archived' instead of deleting
      const { error } = await inventoryService.supabase
        .from(table)
        .update({ status: 'archived' })
        .eq('id', id);
      
      if (error) throw error;
      fetchData(); // Refresh data
    } catch (error) {
      alert('Failed to archive item: ' + error.message);
    }
  };

  const handleRestore = async (table, id) => {
    if (!window.confirm('Are you sure you want to restore this item? It will be moved back to active lists.')) return;
    try {
      // Restore: Update status to 'active'
      const { error } = await inventoryService.supabase
        .from(table)
        .update({ status: 'active' })
        .eq('id', id);
      
      if (error) throw error;
      fetchData(); // Refresh data
    } catch (error) {
      alert('Failed to restore item: ' + error.message);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Package size={22} className="header-icon" /> Inventory Management
          </h1>
          <p className="page-subtitle">Track and manage facility supplies for vaccines and supplements.</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setForm({ item_name: '', quantity: '', max_stock: activeTab === 'vaccines' ? 500 : 1000, unit: activeTab === 'vaccines' ? 'vials' : 'tablets' });
              setShowAddModal(true);
            }}
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      <div className="inv-stats-grid">
        <div 
          className={`stat-card stat-card--lilac ${activeSummaryFilter === null ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter(null)}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--lilac">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{totalItems}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div 
          className={`stat-card stat-card--orange ${activeSummaryFilter === 'lowStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('lowStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--orange">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value">{lowStockCount}</div>
          <div className="stat-label">Low Stock</div>
        </div>
        <div 
          className={`stat-card stat-card--rose ${activeSummaryFilter === 'outOfStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('outOfStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--rose">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{outOfStockCount}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
        <div className="stat-card stat-card--pink" style={{ cursor: 'default' }}>
          <div className="stat-top">
            <div className="stat-icon stat-icon--pink">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value">{vaccStats.mothersPending}</div>
          <div className="stat-label">Mothers Pending Vaccines</div>
        </div>
        <div className="stat-card stat-card--sage" style={{ cursor: 'default' }}>
          <div className="stat-top">
            <div className="stat-icon stat-icon--sage">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value">{vaccStats.newbornsPending}</div>
          <div className="stat-label">Newborns Pending Vaccines</div>
        </div>
      </div>

      <div className="inv-main-layout">
        <div className="inv-table-col">

      <div className="inv-controls">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filters-row">
          <Filter size={14} className="filter-icon" />
          <span>Filter:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <Archive size={14} className="filter-icon" />
          <select
            value={archiveFilter}
            onChange={e => setArchiveFilter(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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

      <div className="inv-card">
        <div className="table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="row-number-header">#</th>
                <th>Item Name</th>
                <th>Stock Level</th>
                <th>Unit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    Loading inventory data...
                  </td>
                </tr>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item, index) => {
                  const status = getStatus(item.quantity, item.max_stock);
                  const percentage = getStockPercentage(item.quantity || 0, item.max_stock || 500);
                  const rowNumber = startIndex + index + 1;
                  return (
                    <tr key={item.id} className="inv-row">
                      <td className="row-number-cell">{rowNumber}</td>
                      <td className="item-name-cell">
                        <strong>{item.item_name}</strong>
                      </td>
                      <td className="quantity-cell">
                        <div className="stock-level-display">
                          <div className="stock-text">
                            <span className={`qty-text ${status.class}`}>
                              {item.quantity}
                            </span>
                            <span className="stock-separator">/</span>
                            <span className="stock-max">{item.max_stock}</span>
                            <span className="stock-percentage">({percentage}%)</span>
                          </div>
                          <div className="stock-progress-bar">
                            <div 
                              className="stock-progress-fill"
                              style={{ 
                                width: `${percentage}%`,
                                background: percentage <= 20 ? '#e05c73' : percentage <= 50 ? '#e8b84b' : '#6db8a0'
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="unit-cell">{item.unit || 'tablets'}</td>
                      <td>
                        <span className={`status-badge ${status.class}`}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns">
                          <button
                            className="action-btn edit-btn"
                            title="Update Stock"
                            onClick={() => {
                              setForm({
                                ...form,
                                quantity: item.quantity,
                                max_stock: item.max_stock,
                              });
                              setShowUpdateModal({
                                table:
                                  activeTab === 'vaccines'
                                    ? 'vaccine_inventory'
                                    : 'supplement_inventory',
                                item,
                              });
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          {item.status === 'archived' ? (
                            <button
                              className="action-btn restore-btn"
                              title="Restore Item"
                              onClick={() =>
                                handleRestore(
                                  activeTab === 'vaccines'
                                    ? 'vaccine_inventory'
                                    : 'supplement_inventory',
                                  item.id
                                )
                              }
                            >
                              <ArchiveRestore size={13} />
                            </button>
                          ) : (
                            <button
                              className="action-btn archive-btn"
                              title="Archive Item"
                              onClick={() =>
                                handleArchive(
                                  activeTab === 'vaccines'
                                    ? 'vaccine_inventory'
                                    : 'supplement_inventory',
                                  item.id
                                )
                              }
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {filteredItems.length > itemsPerPage && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length}
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── ALERTS PANEL ── */}
    <div className="inv-side-col">
        <div className="inv-card">
            <div className="inv-card-head" style={{ padding: '16px 20px', borderBottom: '1px solid #f0f2f5' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Notifications & Alerts
                </h2>
            </div>
            <div className="alerts-list" style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {lowStockCount > 0 && (
                    <div className="alert-item alert-warning" style={{ background: 'rgba(232,184,75,0.07)', display: 'flex', gap: '10px', padding: '10px', borderRadius: '10px' }}>
                        <div className="alert-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: '#e8b84b' }}></div>
                        <div className="alert-body">
                            <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 2px' }}>Low Stock Warning</p>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{lowStockCount} items are running low on stock.</span>
                        </div>
                    </div>
                )}
                {outOfStockCount > 0 && (
                    <div className="alert-item alert-critical" style={{ background: 'rgba(224,92,115,0.07)', display: 'flex', gap: '10px', padding: '10px', borderRadius: '10px' }}>
                        <div className="alert-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: '#e05c73' }}></div>
                        <div className="alert-body">
                            <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 2px' }}>Out of Stock</p>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{outOfStockCount} items are currently out of stock!</span>
                        </div>
                    </div>
                )}
                {vaccStats.mothersPending > 0 && (
                    <div className="alert-item alert-info" style={{ background: 'rgba(91,174,208,0.07)', display: 'flex', gap: '10px', padding: '10px', borderRadius: '10px' }}>
                        <div className="alert-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: '#5baed0' }}></div>
                        <div className="alert-body">
                            <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 2px' }}>Patient Action Required</p>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{vaccStats.mothersPending} mothers pending vaccines.</span>
                        </div>
                    </div>
                )}
                {lowStockCount === 0 && outOfStockCount === 0 && vaccStats.mothersPending === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                        No urgent alerts.
                    </div>
                )}
            </div>
        </div>
    </div>
  </div>

      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add New Item</h2>
              <p>Specify which inventory type this item belongs to.</p>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Item Category</label>
                  <select
                    value={activeTab}
                    onChange={e => {
                      const nextTab = e.target.value;
                      setActiveTab(nextTab);
                      setForm(prev => ({
                        ...prev,
                        unit: nextTab === 'vaccines' ? 'vials' : 'pcs',
                      }));
                    }}
                    className="form-control"
                  >
                    <option value="vaccines">Vaccine</option>
                    <option value="supplements">Supplement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    required
                    value={form.item_name}
                    onChange={e =>
                      setForm({ ...form, item_name: e.target.value })
                    }
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
                      onChange={e =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Maximum Stock Capacity</label>
                    <input
                      type="number"
                      required
                      value={form.max_stock}
                      onChange={e =>
                        setForm({ ...form, max_stock: e.target.value })
                      }
                      placeholder={activeTab === 'vaccines' ? '500' : '1000'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select
                      required
                      value={form.unit}
                      onChange={e =>
                        setForm({ ...form, unit: e.target.value })
                      }
                    >
                      {unitOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowUpdateModal(null)}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Update Quantity</h2>
              <p>{showUpdateModal.item.item_name}</p>
            </div>
            <form onSubmit={handleUpdateQuantity}>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    Current Stock: {showUpdateModal.item.quantity}{' '}
                    {showUpdateModal.item.unit}
                  </label>
                  <input
                    type="number"
                    required
                    value={form.quantity}
                    onChange={e =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    placeholder="Enter new quantity"
                  />
                </div>
                <div className="form-group">
                  <label>Maximum Stock Capacity</label>
                  <input
                    type="number"
                    required
                    value={form.max_stock}
                    onChange={e =>
                      setForm({ ...form, max_stock: e.target.value })
                    }
                    placeholder="Enter maximum stock capacity"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowUpdateModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
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