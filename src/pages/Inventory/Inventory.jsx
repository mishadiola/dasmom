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
  ChevronDown,
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
  const [form, setForm] = useState({ 
    item_name: '', 
    quantity: '', 
    max_stock: '', 
    unit: 'vials', 
    brand: '', 
    expiration_date: '',
    batch_number: '',
    manufactured_date: ''
  });
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedExistingItem, setSelectedExistingItem] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
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

      console.log('Inventory data fetched - vaccines:', vaxData?.length || 0, 'supplements:', suppData?.length || 0, 'stats:', statsData);

      setVaccStats(statsData || { mothersPending: 0, newbornsPending: 0 });

      const mappedVaccines = (vaxData || []).map(row => ({
        id: row?.id || '',
        item_name: row?.vaccine_name || row?.item_name || 'Unknown',
        quantity: row?.quantity || 0,
        max_stock: row?.max_quantity || row?.max_stock || 500,
        unit: row?.unit || 'vials',
        status: row?.status || 'active', // Note: This is a custom status field, not from DB
        brand: row?.brand || '',
        expiration_date: row?.expiration_date || null,
        doses: row?.doses || null,
        batch: row?.batch || null,
        manufactured_date: row?.manufactured_date || null
      }));
      const mappedSupplements = (suppData || []).map(row => ({
        id: row?.id || '',
        item_name: row?.supplement_name || row?.item_name || 'Unknown',
        quantity: row?.quantity || 0,
        max_stock: row?.max_quant || row?.max_stock || 1000,
        unit: row?.unit || 'tablets',
        status: row?.status || 'active', // Note: This is a custom status field, not from DB
        brand: row?.brand || '',
        expiration_date: row?.expiration_date || null,
        batch_number: row?.batch_number || null,
        manufactured_date: row?.manufactured_date || null
      }));

      console.log('Mapped vaccines:', mappedVaccines.length, 'Mapped supplements:', mappedSupplements.length);

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
    
    const percentage = maxStock ? Math.round((qty / maxStock) * 100) : 0;
    
    if (percentage <= 20) return { label: 'Low Stock', class: 'status-low' };
    if (percentage <= 50) return { label: 'Medium Stock', class: 'status-medium' };
    return { label: 'In Stock', class: 'status-ok' };
  };

  const getStockPercentage = (current, max) => {
    if (!max || max === 0) return 0;
    const percentage = Math.round((current / max) * 100);
    return Math.min(100, Math.max(0, percentage));
  };

  // Group vaccines by name only (not brand), keep all batches
  const groupVaccinesByName = (vaccineList) => {
    if (!vaccineList || vaccineList.length === 0) {
      console.log('Debug: No vaccines to group');
      return [];
    }
    
    const grouped = {};
    
    vaccineList.forEach(vaccine => {
      const name = vaccine.item_name;
      
      if (!name) return; // Skip items without name
      
      if (!grouped[name]) {
        grouped[name] = {
          item_name: name,
          total_quantity: 0,
          total_max_stock: 0,
          unit: vaccine.unit,
          status: 'active',
          items: [] // Keep original items for details
        };
      }
      
      // Add to totals
      grouped[name].total_quantity += vaccine.quantity || 0;
      grouped[name].total_max_stock += vaccine.max_stock || 0;
      
      // Store original item
      grouped[name].items.push(vaccine);
    });
    
    const result = Object.values(grouped).map(group => {
      // Sort items by batch number
      const sortedItems = group.items.sort((a, b) => {
        const batchA = a.batch || 0;
        const batchB = b.batch || 0;
        return batchA - batchB;
      });
      
      group.items = sortedItems;
      return group;
    });
    
    console.log('Debug: Grouped vaccines:', result.length, 'Sample:', result[0]?.item_name);
    return result;
  };

  // Group supplements by name only (not brand), keep all batches
  const groupSupplementsByName = (supplementList) => {
    if (!supplementList || supplementList.length === 0) {
      console.log('Debug: No supplements to group');
      return [];
    }
    
    const grouped = {};
    
    supplementList.forEach(supplement => {
      const name = supplement.item_name;
      
      if (!name) return; // Skip items without name
      
      if (!grouped[name]) {
        grouped[name] = {
          item_name: name,
          total_quantity: 0,
          total_max_stock: 0,
          unit: supplement.unit,
          status: 'active',
          items: [] // Keep original items for details
        };
      }
      
      // Add to totals
      grouped[name].total_quantity += supplement.quantity || 0;
      grouped[name].total_max_stock += supplement.max_stock || 0;
      
      // Store original item
      grouped[name].items.push(supplement);
    });
    
    const result = Object.values(grouped).map(group => {
      // Sort items by batch number
      const sortedItems = group.items.sort((a, b) => {
        const batchA = a.batch_number || 0;
        const batchB = b.batch_number || 0;
        return batchA - batchB;
      });
      
      group.items = sortedItems;
      return group;
    });
    
    console.log('Debug: Grouped supplements:', result.length, 'Sample:', result[0]?.item_name);
    return result;
  };

  const currentItems = activeTab === 'vaccines' ? groupVaccinesByName(vaccines) : groupSupplementsByName(supplements);

  // Debug: Log data flow
  console.log('Debug Inventory - vaccines:', vaccines.length, 'supplements:', supplements.length, 'currentItems:', currentItems.length);

  const filteredItems = currentItems
    .filter(item => item && typeof item === 'object')
    .filter(item => {
      const matchesSearch = (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const status = getStatus(item.total_quantity || 0, item.total_max_stock).label;
      const matchesStatus = statusFilter === 'All' || status === statusFilter;
      
      // Apply archive filter (check if any items in the group are archived)
      // Items without a status field are considered active
      const hasActiveItems = item.items.some(i => !i.status || i.status === 'active' || i.status === 'ok' || i.status === 'low' || i.status === 'medium' || i.status === 'critical');
      const hasArchivedItems = item.items.some(i => i.status === 'archived');
      let matchesArchive = true;
      if (archiveFilter === 'active') matchesArchive = hasActiveItems;
      else if (archiveFilter === 'archived') matchesArchive = hasArchivedItems;
      
      // Apply summary card filter
      let matchesSummary = true;
      if (activeSummaryFilter === 'lowStock') {
        const percentage = item.total_max_stock ? Math.round((item.total_quantity || 0) / item.total_max_stock * 100) : 0;
        matchesSummary = percentage > 0 && percentage <= 20;
      } else if (activeSummaryFilter === 'mediumStock') {
        const percentage = item.total_max_stock ? Math.round((item.total_quantity || 0) / item.total_max_stock * 100) : 0;
        matchesSummary = percentage > 20 && percentage <= 50;
      } else if (activeSummaryFilter === 'outOfStock') {
        matchesSummary = (item.total_quantity || 0) <= 0;
      }
      
      return matchesSearch && matchesStatus && matchesSummary && matchesArchive;
    });

  const totalItems = (currentItems || []).length;
  const getStockCount = (items) => {
    const lowStockCount = items.filter(i => {
      const percentage = i?.total_max_stock ? Math.round((i?.total_quantity || 0) / i?.total_max_stock * 100) : 0;
      return percentage > 0 && percentage <= 20;
    }).length;
    const mediumStockCount = items.filter(i => {
      const percentage = i?.total_max_stock ? Math.round((i?.total_quantity || 0) / i?.total_max_stock * 100) : 0;
      return percentage > 20 && percentage <= 50;
    }).length;
    const outOfStockCount = items.filter(i => (i?.total_quantity || 0) <= 0).length;
    return { lowStockCount, mediumStockCount, outOfStockCount };
  };
  const { lowStockCount, mediumStockCount, outOfStockCount } = getStockCount(currentItems);

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, statusFilter, activeSummaryFilter, archiveFilter]);

  const generateBatchNumber = async (itemName) => {
    try {
      const table = activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory';
      const nameField = activeTab === 'vaccines' ? 'vaccine_name' : 'supplement_name';
      const batchField = activeTab === 'vaccines' ? 'batch' : 'batch_number';
      
      // Query existing items with same name (regardless of brand) to get the highest batch number
      const { data, error } = await inventoryService.supabase
        .from(table)
        .select(batchField)
        .eq(nameField, itemName);
      
      if (error) throw error;
      
      // Get the highest batch number and increment by 1
      const existingBatches = (data || []).map(item => item[batchField]).filter(b => b !== null && b !== undefined);
      const maxBatch = existingBatches.length > 0 ? Math.max(...existingBatches) : 0;
      
      return maxBatch + 1;
    } catch (error) {
      console.error('Error generating batch number:', error);
      return 1; // Default to 1 if there's an error
    }
  };

  const handleAddSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const table = activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory';

      // Auto-generate batch number
      const autoBatchNumber = await generateBatchNumber(form.item_name);

      // Map form fields to correct database field names
      const payload = {
        item_name: form.item_name,
        quantity: Number(form.quantity),
        max_stock: Number(form.max_stock) || (activeTab === 'vaccines' ? 500 : 1000),
        unit: form.unit,
        brand: form.brand,
        expiration_date: form.expiration_date || null,
        batch_number: autoBatchNumber,
        manufactured_date: form.manufactured_date
      };

      console.log('handleAddSubmit - form values:', form);
      console.log('handleAddSubmit - payload being sent:', payload);

      // Use inventory service which handles upsert logic (same brand + expiration = update)
      await inventoryService.addInventoryItem(table, payload);

      setShowAddModal(false);
      setModalSearchTerm('');
      setSearchResults([]);
      setSelectedExistingItem(null);
      setForm({ item_name: '', quantity: '', max_stock: '', unit: activeTab === 'vaccines' ? 'vials' : 'tablets', brand: '', expiration_date: '', batch_number: '', manufactured_date: '' });
    } catch (error) {
      console.error('handleAddSubmit error:', error);
      alert('Failed to add item: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchInventory = async (searchValue) => {
    setModalSearchTerm(searchValue);
    if (!searchValue || searchValue.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const table = activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory';
      const nameField = activeTab === 'vaccines' ? 'vaccine_name' : 'supplement_name';
      
      const { data, error } = await inventoryService.supabase
        .from(table)
        .select('*')
        .ilike(nameField, `%${searchValue}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching inventory:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectExistingItem = (item) => {
    setSelectedExistingItem(item);
    setForm({
      item_name: activeTab === 'vaccines' ? item.vaccine_name : item.supplement_name,
      brand: item.brand || '',
      expiration_date: item.expiration_date || '',
      batch_number: '', // Will be auto-generated on save
      manufactured_date: item.manufactured_date || '',
      unit: item.unit || (activeTab === 'vaccines' ? 'vials' : 'tablets'),
      max_stock: activeTab === 'vaccines' ? item.max_quantity || 500 : item.max_quant || 1000,
      quantity: ''
    });
    setSearchResults([]);
    setModalSearchTerm('');
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
      setForm({ item_name: '', quantity: '', max_stock: '', unit: '', brand: '', expiration_date: '' });
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
              setForm({ item_name: '', quantity: '', max_stock: activeTab === 'vaccines' ? 500 : 1000, unit: activeTab === 'vaccines' ? 'vials' : 'tablets', brand: '', expiration_date: '', batch_number: '', manufactured_date: '' });
              setModalSearchTerm('');
              setSearchResults([]);
              setSelectedExistingItem(null);
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
          className={`stat-card stat-card--yellow ${activeSummaryFilter === 'mediumStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('mediumStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--yellow">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{mediumStockCount}</div>
          <div className="stat-label">Medium Stock</div>
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
            <option value="Medium Stock">Medium Stock</option>
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
                <th>Total Stock</th>
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
                  const status = getStatus(item.total_quantity, item.total_max_stock);
                  const percentage = getStockPercentage(item.total_quantity || 0, item.total_max_stock || 500);
                  const rowNumber = startIndex + index + 1;
                  return (
                    <>
                    <tr key={`${item.item_name}-${index}`} className="inv-row">
                      <td className="row-number-cell">
                        {item.items.length > 0 && (
                          <button
                            onClick={() => setExpandedRow(expandedRow === rowNumber ? null : rowNumber)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span style={{ fontSize: '12px', fontWeight: '500' }}>{rowNumber}</span>
                            {expandedRow === rowNumber ? (
                              <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        )}
                        {item.items.length === 0 && <span style={{ fontSize: '12px', fontWeight: '500' }}>{rowNumber}</span>}
                      </td>
                      <td className="item-name-cell">
                        <strong>{item.item_name}</strong>
                      </td>
                      <td className="quantity-cell">
                        <div className="stock-level-display">
                          <div className="stock-text">
                            <span className={`qty-text ${status.class}`}>
                              {item.total_quantity}
                            </span>
                            <span className="stock-separator">/</span>
                            <span className="stock-max">{item.total_max_stock}</span>
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
                      <td className="expiration-cell">
                        {item.items.length > 0 ? (
                          <div className="batch-list">
                            {item.items.map((subItem, idx) => (
                              <div key={idx} className="batch-item">
                                {subItem.expiration_date ? 
                                  new Date(subItem.expiration_date).toLocaleDateString() : 
                                  '-'
                                }
                              </div>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
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
                                quantity: item.total_quantity,
                                max_stock: item.total_max_stock,
                              });
                              setShowUpdateModal({
                                table:
                                  activeTab === 'vaccines'
                                    ? 'vaccine_inventory'
                                    : 'supplement_inventory',
                                item: item.items[0], // Use first item for editing
                              });
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          {item.items.some(i => i.status === 'archived') ? (
                            <button
                              className="action-btn restore-btn"
                              title="Restore All Items"
                              onClick={() => {
                                // Restore all archived items in this group
                                const archivedItems = item.items.filter(i => i.status === 'archived');
                                archivedItems.forEach(archivedItem => {
                                  handleRestore(
                                    activeTab === 'vaccines'
                                      ? 'vaccine_inventory'
                                      : 'supplement_inventory',
                                    archivedItem.id
                                  );
                                });
                              }}
                            >
                              <ArchiveRestore size={13} />
                            </button>
                          ) : (
                            <button
                              className="action-btn archive-btn"
                              title="Archive All Items"
                              onClick={() => {
                                // Archive all active items in this group
                                const activeItems = item.items.filter(i => (i.status || 'active') === 'active');
                                activeItems.forEach(activeItem => {
                                  handleArchive(
                                    activeTab === 'vaccines'
                                      ? 'vaccine_inventory'
                                      : 'supplement_inventory',
                                    activeItem.id
                                  );
                                });
                              }}
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRow === rowNumber && item.items.length > 0 && (
                      <tr key={`detail-${item.item_name}-${index}`} className="inv-row-detail">
                        <td colSpan="6" style={{ padding: '0' }}>
                          <div style={{
                            padding: '16px 20px',
                            background: '#f8f9fa',
                            borderBottom: '1px solid #e9ecef'
                          }}>
                            <h4 style={{
                              margin: '0 0 12px 0',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#333'
                            }}>
                              Detailed Batch Information for {item.item_name}
                            </h4>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                              gap: '12px'
                            }}>
                              {item.items.map((subItem, idx) => {
                                const subStatus = getStatus(subItem.quantity, subItem.max_stock);
                                const subPercentage = getStockPercentage(subItem.quantity || 0, subItem.max_stock || 500);
                                const daysUntilExpiry = subItem.expiration_date 
                                  ? Math.ceil((new Date(subItem.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))
                                  : null;
                                const expiryStatus = daysUntilExpiry !== null
                                  ? daysUntilExpiry < 0
                                    ? { label: 'Expired', class: 'status-out' }
                                    : daysUntilExpiry <= 30
                                      ? { label: 'Expiring Soon', class: 'status-low' }
                                      : daysUntilExpiry <= 90
                                        ? { label: 'Expiring', class: 'status-medium' }
                                        : { label: 'Good', class: 'status-ok' }
                                  : { label: 'No Date', class: 'status-medium' };
                                const batchNumber = activeTab === 'vaccines' ? subItem.batch : subItem.batch_number;
                                return (
                                  <div key={idx} style={{
                                    background: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e9ecef',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '8px'
                                    }}>
                                      <span style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#333'
                                      }}>
                                        Batch {batchNumber || 'N/A'}
                                      </span>
                                      <span className={`status-badge ${expiryStatus.class}`} style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                      }}>
                                        {expiryStatus.label}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6', marginBottom: '12px' }}>
                                      <div><strong>Brand:</strong> {subItem.brand || 'N/A'}</div>
                                      <div><strong>Quantity:</strong> {subItem.quantity} / {subItem.max_stock} ({subPercentage}%)</div>
                                      <div><strong>Stock Status:</strong> <span className={`status-badge ${subStatus.class}`} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px' }}>{subStatus.label}</span></div>
                                      <div><strong>Expiration:</strong> {subItem.expiration_date ? new Date(subItem.expiration_date).toLocaleDateString() : 'N/A'}</div>
                                      {daysUntilExpiry !== null && (
                                        <div><strong>Days Until Expiry:</strong> {daysUntilExpiry < 0 ? `${Math.abs(daysUntilExpiry)} days overdue` : `${daysUntilExpiry} days`}</div>
                                      )}
                                      <div><strong>Manufactured:</strong> {subItem.manufactured_date ? new Date(subItem.manufactured_date).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div style={{
                                      display: 'flex',
                                      gap: '8px',
                                      borderTop: '1px solid #e9ecef',
                                      paddingTop: '8px'
                                    }}>
                                      <button
                                        onClick={() => {
                                          setForm({
                                            item_name: item.item_name,
                                            brand: subItem.brand || '',
                                            quantity: subItem.quantity,
                                            max_stock: subItem.max_stock,
                                            unit: subItem.unit,
                                            expiration_date: subItem.expiration_date || '',
                                            batch_number: batchNumber || '',
                                            manufactured_date: subItem.manufactured_date || ''
                                          });
                                          setShowUpdateModal({
                                            table: activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory',
                                            item: subItem
                                          });
                                          setExpandedRow(null);
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          background: '#e3f2fd',
                                          color: '#1976d2',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        <Edit2 size={12} /> Edit
                                      </button>
                                      {subItem.status !== 'archived' && (
                                        <button
                                          onClick={() => handleArchive(subItem.id)}
                                          style={{
                                            flex: 1,
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            background: '#ffebee',
                                            color: '#c62828',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                          }}
                                        >
                                          <Archive size={12} /> Archive
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
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
              <p>Search existing items or add a new one.</p>
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
                        brand: '',
                        expiration_date: '',
                        batch_number: '',
                        manufactured_date: ''
                      }));
                      setSearchResults([]);
                      setModalSearchTerm('');
                      setSelectedExistingItem(null);
                    }}
                    className="form-control"
                  >
                    <option value="vaccines">Vaccine</option>
                    <option value="supplements">Supplement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Search Existing Items</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={modalSearchTerm}
                      onChange={e => handleSearchInventory(e.target.value)}
                      placeholder="Search by item name..."
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                    {searchResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {searchResults.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectExistingItem(item)}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                            onMouseLeave={e => e.target.style.background = 'white'}
                          >
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>
                              {activeTab === 'vaccines' ? item.vaccine_name : item.supplement_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              Brand: {item.brand || 'N/A'} | Qty: {item.quantity} {item.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e =>
                      setForm({ ...form, brand: e.target.value })
                    }
                    placeholder="e.g. Pfizer"
                  />
                </div>
                <div className="form-group">
                  <label>Batch Number (Auto-generated)</label>
                  <input
                    type="text"
                    value={form.batch_number || 'Auto-generated on save'}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: '#f5f5f5',
                      color: '#666'
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Manufactured Date</label>
                  <input
                    type="date"
                    value={form.manufactured_date}
                    onChange={e =>
                      setForm({ ...form, manufactured_date: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    value={form.expiration_date}
                    onChange={e =>
                      setForm({ ...form, expiration_date: e.target.value })
                    }
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
                  onClick={() => {
                    setShowAddModal(false);
                    setModalSearchTerm('');
                    setSearchResults([]);
                    setSelectedExistingItem(null);
                  }}
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
            style={{ maxWidth: '420px' }}
          >
            <div className="modal-header">
              <h2>Update Stock</h2>
              <p>{showUpdateModal.item.item_name}</p>
            </div>
            <form onSubmit={handleUpdateQuantity}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ textTransform: 'none', fontSize: '13px', fontWeight: 600 }}>
                    Current Stock: <strong>{showUpdateModal.item.quantity} {showUpdateModal.item.unit}</strong>
                  </label>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>New Quantity</label>
                    <input
                      type="number"
                      required
                      value={form.quantity}
                      onChange={e =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Capacity</label>
                    <input
                      type="number"
                      required
                      value={form.max_stock}
                      onChange={e =>
                        setForm({ ...form, max_stock: e.target.value })
                      }
                      placeholder="Enter max stock"
                    />
                  </div>
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
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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