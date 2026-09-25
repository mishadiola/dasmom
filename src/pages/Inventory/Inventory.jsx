import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import useClickOutside from '../../hooks/useClickOutside';
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
  ChevronRight,
  Truck,
  Eye,
  Activity,
  ChevronUp,
  Bell,
  BarChart3,
  ClipboardList,
  ArrowLeft,
  MapPin,
  Calendar,
  Send,
  Hash,
  Download
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import InventoryService from '../../services/inventoryservice';
import PatientService from '../../services/patientservice';
import { useModal } from '../../context/ModalContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExportModal from '../../components/ExportModal';
import { isBatchExpired, getInventoryStatus } from '../../utils/inventoryUtils';
import '../../styles/components/SharedFilters.css';
import '../../styles/pages/Inventory.css';

const inventoryService = new InventoryService();
const patientService = new PatientService();

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isAdminRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'super admin' || normalized === 'super-admin' || normalized.includes('admin');
};

const formatReadableDate = (dateString) => {
    if (!dateString) return dateString;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const Inventory = () => {
  const { alert: customAlert, confirm } = useModal();
  const { user } = useContext(AuthContext);
  const [userScope, setUserScope] = useState({ role: 'user', stationId: null, stationName: null, userId: user?.id || null });
  const [availableStations, setAvailableStations] = useState([]);
  const isAdmin = isAdminRole(userScope.role);
  const visibleStations = useMemo(() => {
    if (!userScope.stationName) return availableStations;
    if (isAdmin) return availableStations;
    return [userScope.stationName];
  }, [availableStations, isAdmin, userScope.stationName]);
  const [activeTab, setActiveTab] = useState('vaccines');
  const [mainTab, setMainTab] = useState('inventory');
  const [distPage, setDistPage] = useState(1);
  const distItemsPerPage = 10;
  const [showStationInventory, setShowStationInventory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vaccines, setVaccines] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activePopover, setActivePopover] = useState(null);
  const filterRowRef = useRef(null);
  useClickOutside(filterRowRef, () => setActivePopover(null));
  const [activeSummaryFilter, setActiveSummaryFilter] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [dateFilterError, setDateFilterError] = useState('');

  const hasActiveFilters = statusFilter !== 'All' || archiveFilter !== 'active' || searchTerm !== '' || dateFilter !== 'all';

  const clearFilters = () => {
      setStatusFilter('All');
      setArchiveFilter('active');
      setSearchTerm('');
      setDateFilter('all');
      setCustomDateFrom('');
      setCustomDateTo('');
      setDateFilterError('');
      setActivePopover(null);
  };
  const [archivedIds, setArchivedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('inventory_archived_ids');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [vaccStats, setVaccStats] = useState({ mothersPending: 0, newbornsPending: 0 });
  const [pendingVaccinations, setPendingVaccinations] = useState([]);

  // Station Distribution states
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedDistRecord, setSelectedDistRecord] = useState(null);
  const [distributionHistory, setDistributionHistory] = useState([]);
  const [stationCurrentInventory, setStationCurrentInventory] = useState([]);
  const [distForm, setDistForm] = useState({
    item_type: 'vaccine',
    item_id: '',
    quantity: '',
    destination_station: '',
    distribution_date: new Date().toISOString().split('T')[0],
    released_by: '',
    remarks: '',
  });

  // History section filters state
  const [historySearch, setHistorySearch] = useState('');
  const [historyStationFilter, setHistoryStationFilter] = useState('All');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('All');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [historyCustomDateFrom, setHistoryCustomDateFrom] = useState('');
  const [historyCustomDateTo, setHistoryCustomDateTo] = useState('');
  const [historyDateFilterError, setHistoryDateFilterError] = useState('');
  const [showDistExportModal, setShowDistExportModal] = useState(false);

  // Expandable rows for station inventory
  const [expandedStationRows, setExpandedStationRows] = useState({});

  // Station inventory now directly uses fetched current stock data, not distribution history
  // Group by station + item_name + item_type, with batch/brand variants as children
  const stationInventory = useMemo(() => {
    if (!stationCurrentInventory || stationCurrentInventory.length === 0) return [];

    const grouped = {};

    stationCurrentInventory.forEach(row => {
      const groupKey = `${row.station || 'Unknown'}||${row.item_type || 'Unknown'}||${row.item_name || 'Unknown'}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          groupKey,
          station: row.station || 'Unknown',
          item_name: row.item_name || 'Unknown',
          item_type: row.item_type || 'Unknown',
          unit: row.unit || (row.item_type === 'Vaccine' ? 'vials' : 'pcs'),
          brand: row.brand || '',
          expiration_date: row.expiration_date || null,
          totalQuantity: 0,
          variants: []
        };
      }

      grouped[groupKey].totalQuantity += Number(row.quantity) || 0;
      grouped[groupKey].variants.push({
        id: row.id,
        quantity: Number(row.quantity) || 0,
        batch: row.batch || 'N/A',
        unit: row.unit || grouped[groupKey].unit,
        brand: row.brand || grouped[groupKey].brand,
        last_updated: row.last_updated || null
      });
    });

    return Object.values(grouped).sort((a, b) => {
      const stationCmp = (a.station || '').localeCompare(b.station || '');
      if (stationCmp !== 0) return stationCmp;
      const typeCmp = (a.item_type || '').localeCompare(b.item_type || '');
      if (typeCmp !== 0) return typeCmp;
      return (a.item_name || '').localeCompare(b.item_name || '');
    });
  }, [stationCurrentInventory]);

  // Handle auto-populating user info when context resolves
  useEffect(() => {
    if (user) {
      setDistForm(prev => ({
        ...prev,
        released_by: user.fullName || user.email?.split('@')[0] || prev.released_by
      }));
    }
  }, [user]);

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

  const dateValidation = useMemo(() => {
    let isValid = true;
    let mfgError = '';
    let expError = '';
    let expWarning = '';

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (form.manufactured_date) {
      const mDate = new Date(form.manufactured_date);
      mDate.setHours(0, 0, 0, 0);
      if (mDate > now) {
        isValid = false;
        mfgError = 'Manufactured date cannot be in the future.';
      }
    }

    if (form.expiration_date) {
      const eDate = new Date(form.expiration_date);
      eDate.setHours(0, 0, 0, 0);
      if (eDate < now) {
        isValid = false;
        expError = 'This item has already expired. Please enter a valid expiration date.';
      } else if (eDate.getTime() === now.getTime()) {
        expWarning = 'This item expires today.';
      }

      if (form.manufactured_date) {
        const mDate = new Date(form.manufactured_date);
        mDate.setHours(0, 0, 0, 0);
        if (eDate < mDate) {
          isValid = false;
          expError = 'Expiration date cannot be earlier than the manufactured date.';
        }
      }
    }

    return { isValid, mfgError, expError, expWarning };
  }, [form.manufactured_date, form.expiration_date]);

  const loadPendingVaccinations = async () => {
    try {
      const { data, error } = await inventoryService.supabase
        .from('vaccinations')
        .select('vaccine_inventory_id')
        .in('status', ['Pending', 'Overdue']);
      if (error) throw error;
      setPendingVaccinations(data || []);
    } catch (error) {
      console.error('Error loading pending vaccinations:', error);
      setPendingVaccinations([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vaxData, suppData, statsData, stationsData] = await Promise.all([
        inventoryService.getVaccineInventory(),
        inventoryService.getSupplementInventory(),
        patientService.getVaccinationStats(),
        patientService.getAvailableStations()
      ]);

      setAvailableStations(stationsData && stationsData.length > 0 ? stationsData : [
        'Salawag',
        'Dasma I',
        'Dasma 2',
        'Dasma 3',
        'Dasma 4',
        'Armstrong',
        'City Health Office 3'
      ]);

      console.log('Inventory data fetched - vaccines:', vaxData?.length || 0, 'supplements:', suppData?.length || 0, 'stats:', statsData);

      setVaccStats(statsData || { mothersPending: 0, newbornsPending: 0 });
      await loadPendingVaccinations();

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
        manufactured_date: row?.manufactured_date || null,
        created_at: row?.created_at || null
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
        manufactured_date: row?.manufactured_date || null,
        created_at: row?.created_at || null
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
    let isCurrent = true;

    const loadScope = async () => {
      try {
        const scope = await inventoryService.getCurrentUserScope();
        if (isCurrent) setUserScope(scope);
      } catch (error) {
        console.warn('Inventory user scope lookup failed:', error);
      }
    };

    loadScope();
    fetchData();

    const vaxSub = inventoryService.subscribeToInventory('vaccine_inventory', () => fetchData());
    const suppSub = inventoryService.subscribeToInventory('supplement_inventory', () => fetchData());

    return () => {
      isCurrent = false;
      vaxSub.unsubscribe();
      suppSub.unsubscribe();
    };
  }, [user?.id]);

  // Separate effect for station inventory to prevent clearing on central inventory updates
  useEffect(() => {
    let isCurrent = true;

    const fetchStationData = async () => {
      try {
        const stationInventoryData = await inventoryService.getStationInventorySnapshot();
        if (isCurrent) setStationCurrentInventory(stationInventoryData || []);

        const history = await inventoryService.getStationDistributionHistory();
        if (isCurrent) setDistributionHistory(history || []);
      } catch (err) {
        console.warn('Failed to fetch station inventory/distribution data:', err);
        if (isCurrent) {
          setStationCurrentInventory([]);
          setDistributionHistory([]);
        }
      }
    };

    fetchStationData();

    // Subscribe to station inventory tables for real-time updates
    const stationVaccineSub = inventoryService.supabase
      .channel('realtime:station_vaccine_inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_vaccine_inventory' }, () => {
        if (isCurrent) fetchStationData();
      })
      .subscribe();

    const stationSupplementSub = inventoryService.supabase
      .channel('realtime:station_supplement_inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_supplement_inventory' }, () => {
        if (isCurrent) fetchStationData();
      })
      .subscribe();

    return () => {
      isCurrent = false;
      inventoryService.supabase.removeChannel(stationVaccineSub);
      inventoryService.supabase.removeChannel(stationSupplementSub);
    };
  }, [user?.id]);

  const getStatus = (qty, maxStock, hasExpiredStock) => {
    return getInventoryStatus(qty, maxStock, hasExpiredStock);
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
      
      const isExpired = isBatchExpired(vaccine.expiration_date || vaccine.expiry_date);
      vaccine.isExpired = isExpired;
      
      // Add to totals (excluding expired stock from usable quantity if it has quantity > 0, wait: 
      // "Any totals representing usable/current stock should exclude quantities belonging to expired batches where appropriate.")
      if (!isExpired) {
        grouped[name].total_quantity += vaccine.quantity || 0;
      }
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
      
      const isExpired = isBatchExpired(supplement.expiration_date || supplement.expiry_date);
      supplement.isExpired = isExpired;
      
      if (!isExpired) {
        grouped[name].total_quantity += supplement.quantity || 0;
      }
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
    .map(item => {
      // Filter the items within the group based on the archiveFilter
      const filteredSubItems = item.items.filter(i => {
        const isArchived = archivedIds.includes(i.id) || i.status === 'archived';
        if (archiveFilter === 'active' && isArchived) return false;
        if (archiveFilter === 'archived' && !isArchived) return false;
        
        if (dateFilter !== 'all') {
          const dDate = i.created_at ? new Date(i.created_at) : null;
          if (!dDate || isNaN(dDate.getTime())) return false;
          
          const now = new Date();
          if (dateFilter === 'this_month') {
              if (dDate.getMonth() !== now.getMonth() || dDate.getFullYear() !== now.getFullYear()) return false;
          } else if (dateFilter === 'this_year') {
              if (dDate.getFullYear() !== now.getFullYear()) return false;
          } else if (dateFilter === 'custom' && customDateFrom && customDateTo) {
              const from = new Date(`${customDateFrom}T00:00:00`);
              const to = new Date(`${customDateTo}T23:59:59.999`);
              if (dDate < from || dDate > to) return false;
          }
        }
        
        return true;
      }).map(i => {
        // If it's in our local storage archived list, enforce the status so UI reflects it
        if (archivedIds.includes(i.id)) {
            return { ...i, status: 'archived' };
        }
        return i;
      });

      const total_quantity = filteredSubItems.reduce((sum, i) => sum + (i.isExpired ? 0 : (i.quantity || 0)), 0);
      const total_max_stock = filteredSubItems.reduce((sum, i) => sum + (i.max_stock || i.max_quantity || i.max_quant || 0), 0);
      const hasExpiredStock = filteredSubItems.some(i => i.isExpired && (i.quantity || 0) > 0);

      return {
        ...item,
        items: filteredSubItems,
        total_quantity,
        total_max_stock,
        hasExpiredStock
      };
    })
    .filter(item => {
      // Only show groups that have at least one item matching the archive filter
      if (item.items.length === 0) return false;

      const matchesSearch = (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const status = getStatus(item.total_quantity || 0, item.total_max_stock, item.hasExpiredStock).label;
      const matchesStatus = statusFilter === 'All' || status === statusFilter || (statusFilter === 'Expired' && status === 'EXPIRED');
      
      // Apply summary card filter
      let matchesSummary = true;
      if (activeSummaryFilter === 'lowStock') {
        const percentage = item.total_max_stock ? Math.round((item.total_quantity || 0) / item.total_max_stock * 100) : 0;
        matchesSummary = !item.hasExpiredStock && (item.total_quantity || 0) > 0 && percentage <= 20;
      } else if (activeSummaryFilter === 'mediumStock') {
        const percentage = item.total_max_stock ? Math.round((item.total_quantity || 0) / item.total_max_stock * 100) : 0;
        matchesSummary = !item.hasExpiredStock && percentage > 20 && percentage <= 50;
      } else if (activeSummaryFilter === 'normalStock') {
        const percentage = item.total_max_stock ? Math.round((item.total_quantity || 0) / item.total_max_stock * 100) : 0;
        matchesSummary = !item.hasExpiredStock && percentage > 50;
      } else if (activeSummaryFilter === 'outOfStock') {
        matchesSummary = !item.hasExpiredStock && (item.total_quantity || 0) <= 0;
      } else if (activeSummaryFilter === 'expiredStock') {
        matchesSummary = !!item.hasExpiredStock;
      }
      
      return matchesSearch && matchesStatus && matchesSummary;
    });

  const totalItems = (currentItems || []).length;
  const getStockCount = (items) => {
    const lowStockCount = items.filter(i => {
      const percentage = i?.total_max_stock ? Math.round((i?.total_quantity || 0) / i?.total_max_stock * 100) : 0;
      return (i?.total_quantity || 0) > 0 && percentage <= 20;
    }).length;
    const mediumStockCount = items.filter(i => {
      const percentage = i?.total_max_stock ? Math.round((i?.total_quantity || 0) / i?.total_max_stock * 100) : 0;
      return percentage > 20 && percentage <= 50;
    }).length;
    const normalCount = items.filter(i => {
      const percentage = i?.total_max_stock ? Math.round((i?.total_quantity || 0) / i?.total_max_stock * 100) : 0;
      return percentage > 50;
    }).length;
    const outOfStockCount = items.filter(i => (i?.total_quantity || 0) <= 0).length;
    return { lowStockCount, mediumStockCount, normalCount, outOfStockCount };
  };
  const { lowStockCount, mediumStockCount, normalCount, outOfStockCount } = getStockCount(currentItems);

  const inventoryAlerts = useMemo(() => {
    const alerts = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const allItems = [...(vaccines || []), ...(supplements || [])].filter(item => 
      !archivedIds.includes(item.id) && item.status !== 'archived'
    );

    let outOfStockGroups = [];
    let lowStockGroups = [];
    let expiredBatches = [];
    let expiringSoonBatches = [];
    let insufficientStockAlerts = [];

    const groupedByName = {};
    allItems.forEach(item => {
      const name = item.item_name;
      if (!groupedByName[name]) {
        groupedByName[name] = { name, totalQuantity: 0, totalMaxStock: 0, usableQuantity: 0, unit: item.unit || 'units' };
      }
      const group = groupedByName[name];
      group.totalQuantity += item.quantity || 0;
      group.totalMaxStock += item.max_stock || 0;
      
      let isExpired = false;
      
      if (item.expiration_date) {
        const expDate = new Date(item.expiration_date);
        expDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) {
          isExpired = true;
          if (item.quantity > 0) expiredBatches.push(item);
        } else if (daysUntil <= 30) {
          if (item.quantity > 0) expiringSoonBatches.push(item);
        }
      }
      
      if (!isExpired) {
        group.usableQuantity += item.quantity || 0;
      }
    });

    const demandByItemName = {};
    (pendingVaccinations || []).forEach(row => {
      if (row.vaccine_inventory_id) {
        const matchedItem = allItems.find(i => i.id === row.vaccine_inventory_id);
        if (matchedItem && matchedItem.item_name) {
          demandByItemName[matchedItem.item_name] = (demandByItemName[matchedItem.item_name] || 0) + 1;
        }
      }
    });

    Object.values(groupedByName).forEach(group => {
      const demand = demandByItemName[group.name] || 0;
      if (demand > group.usableQuantity) {
        insufficientStockAlerts.push({ group, shortage: demand - group.usableQuantity, demand });
      }

      if (group.totalQuantity <= 0) {
        outOfStockGroups.push(group);
      } else {
        const percentage = group.totalMaxStock ? Math.round((group.totalQuantity / group.totalMaxStock) * 100) : 0;
        if (percentage <= 20) {
          lowStockGroups.push(group);
        }
      }
    });

    if (outOfStockGroups.length > 0) {
      alerts.push({
        id: 'outOfStock',
        type: 'outOfStock',
        priority: 1,
        title: 'Out of Stock',
        message: outOfStockGroups.length === 1
          ? `${outOfStockGroups[0].name} is currently out of stock.`
          : `${outOfStockGroups.length} inventory items are currently out of stock.`,
        color: '#e05c73',
        onClick: () => {
          setActiveSummaryFilter('outOfStock');
          setSearchTerm(outOfStockGroups.length === 1 ? outOfStockGroups[0].name : '');
          setMainTab('inventory');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (expiredBatches.length > 0) {
      alerts.push({
        id: 'expired',
        type: 'expired',
        priority: 2,
        title: 'Expired Stock',
        message: expiredBatches.length === 1
          ? `1 inventory batch has expired and requires attention.`
          : `${expiredBatches.length} inventory batches have expired and require attention.`,
        color: '#e05c73',
        onClick: () => {
           setSearchTerm(expiredBatches.length === 1 ? expiredBatches[0].item_name : '');
           setActiveSummaryFilter('expiredStock');
           setMainTab('inventory');
           window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (insufficientStockAlerts.length > 0) {
      alerts.push({
        id: 'insufficient',
        type: 'insufficient',
        priority: 3,
        title: 'Insufficient Stock for Upcoming Vaccinations',
        message: insufficientStockAlerts.length === 1
          ? `${insufficientStockAlerts[0].group.name} is short by ${insufficientStockAlerts[0].shortage} doses for upcoming scheduled vaccinations.`
          : `${insufficientStockAlerts.length} items have insufficient stock for upcoming scheduled vaccinations.`,
        color: '#e05c73',
        onClick: () => {
           setSearchTerm(insufficientStockAlerts.length === 1 ? insufficientStockAlerts[0].group.name : '');
           setActiveSummaryFilter(null);
           setMainTab('inventory');
           window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (lowStockGroups.length > 0) {
      alerts.push({
        id: 'lowStock',
        type: 'lowStock',
        priority: 4,
        title: 'Low Stock',
        message: lowStockGroups.length === 1
          ? `${lowStockGroups[0].name} has ${lowStockGroups[0].totalQuantity} ${lowStockGroups[0].unit} remaining.`
          : `${lowStockGroups.length} inventory items are running low on stock.`,
        color: '#e05c73',
        onClick: () => {
          setActiveSummaryFilter('lowStock');
          setSearchTerm(lowStockGroups.length === 1 ? lowStockGroups[0].name : '');
          setMainTab('inventory');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (expiringSoonBatches.length > 0) {
      alerts.push({
        id: 'expiringSoon',
        type: 'expiringSoon',
        priority: 5,
        title: 'Expiring Soon',
        message: expiringSoonBatches.length === 1
          ? `1 inventory batch will expire soon.`
          : `${expiringSoonBatches.length} inventory batches will expire soon.`,
        color: '#e8b84b',
        onClick: () => {
           setSearchTerm(expiringSoonBatches.length === 1 ? expiringSoonBatches[0].item_name : '');
           setActiveSummaryFilter(null);
           setMainTab('inventory');
           window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  }, [vaccines, supplements, archivedIds, pendingVaccinations]);

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, statusFilter, activeSummaryFilter, archiveFilter, dateFilter, customDateFrom, customDateTo]);

  const [showExportModal, setShowExportModal] = useState(false);

  const getFilterDescription = () => {
    const typeStr = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    let desc = `Type: ${typeStr}`;
    if (statusFilter !== 'All') desc += ` · Status: ${statusFilter}`;
    if (activeSummaryFilter) desc += ` · Summary: ${activeSummaryFilter}`;
    if (archiveFilter !== 'active') desc += ` · Archive: ${archiveFilter}`;
    if (searchTerm) desc += ` · Search: "${searchTerm}"`;
    return desc;
  };

  const getExportData = (dateRange) => {
    const rows = [];
    filteredItems.forEach(group => {
      group.items.forEach(item => {
        let includeItem = true;
        if (dateRange && (dateRange.from || dateRange.to)) {
          if (!item.last_updated) {
             includeItem = false;
          } else {
             const uDate = new Date(item.last_updated);
             if (dateRange.from && uDate < dateRange.from) includeItem = false;
             if (dateRange.to && uDate > dateRange.to) includeItem = false;
          }
        }
        
        if (includeItem) {
          rows.push({
            'Item Name': item.item_name || group.item_name || 'N/A',
            'Category / Type': activeTab === 'vaccines' ? 'Vaccine' : 'Supplement',
            'Current Stock': item.quantity || 0,
            'Unit': item.unit || group.unit || (activeTab === 'vaccines' ? 'vials' : 'tablets'),
            'Stock Status': getStatus(item.quantity || 0, item.max_stock || item.max_quantity || item.max_quant || 0, item.isExpired).label,
            'Expiration Date': formatReadableDate(item.expiration_date) || 'N/A',
            'Batch/Lot Number': item.batch || item.batch_number || 'N/A',
            'Last Updated': formatReadableDate(item.last_updated) || 'N/A'
          });
        }
      });
    });
    return rows;
  };

  const handleExport = (exportConfig) => {
    const { format, dateRange, reportPeriodText } = exportConfig;
    const data = getExportData(dateRange);
    const filterDesc = getFilterDescription();
    const fullDesc = `${reportPeriodText} · ${filterDesc}`;
    
    if (format === 'excel') {
      let worksheetData = [
        ["Report: DASMOM+ Inventory Management Report"],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Scope: ${fullDesc}`],
        []
      ];

      if (data.length > 0) {
        worksheetData = worksheetData.concat([
          Object.keys(data[0]),
          ...data.map(obj => Object.values(obj))
        ]);
      } else {
        worksheetData.push(["No records found for the selected period and filters."]);
      }

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      if (data.length > 0) {
        const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 15) }));
        ws['!cols'] = colWidths;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Inventory_Report_${dateStr}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text("DASMOM+ Inventory Management Report", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Scope: ${fullDesc}`, 14, 34);
      
      if (data.length === 0) {
        doc.text("No records found for the selected period and filters.", 14, 46);
      } else {
        const head = [Object.keys(data[0])];
        const body = data.map(obj => Object.values(obj));
        
        doc.autoTable({
          startY: 42,
          head: head,
          body: body,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [185, 129, 138] }
        });
      }
      
      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`Inventory_Report_${dateStr}.pdf`);
    }
  };

  const handleDistExport = (exportConfig) => {
    const { format, dateRange, reportPeriodText } = exportConfig;
    
    let toExport = distributionHistory;
    if (dateRange && (dateRange.from || dateRange.to)) {
      toExport = distributionHistory.filter(d => {
        const dDate = d.distribution_date ? new Date(d.distribution_date) : null;
        if (!dDate) return false;
        if (dateRange.from && dDate < dateRange.from) return false;
        if (dateRange.to && dDate > dateRange.to) return false;
        return true;
      });
    }
    
    const exportData = toExport.map(d => ({
      'Date': formatReadableDate(d.distribution_date),
      'Item Name': d.item_name || '',
      'Item Type': d.item_type || '',
      'Quantity': d.quantity || 0,
      'Destination Station': d.destination_station || '',
      'Released By': d.released_by || '',
      'Brand': d.brand || 'N/A',
      'Batch': d.batch && d.batch !== 'N/A' ? d.batch : 'N/A',
      'Remarks': d.remarks || ''
    }));
    
    if (format === 'excel') {
      let worksheetData = [
        ["Report: DASMOM+ Station Distribution Report"],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Period: ${reportPeriodText}`],
        []
      ];
      if (exportData.length > 0) {
        worksheetData = worksheetData.concat([
          Object.keys(exportData[0]),
          ...exportData.map(obj => Object.values(obj))
        ]);
      } else {
        worksheetData.push(["No distribution records found for the selected period."]);
      }
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      if (exportData.length > 0) {
        ws['!cols'] = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Distribution");
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Station_Distribution_${dateStr}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text("DASMOM+ Station Distribution Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Period: ${reportPeriodText}`, 14, 34);
      if (exportData.length === 0) {
        doc.text("No distribution records found for the selected period.", 14, 46);
      } else {
        const head = [Object.keys(exportData[0])];
        const body = exportData.map(obj => Object.values(obj));
        doc.autoTable({
          startY: 42,
          head: head,
          body: body,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [185, 129, 138] }
        });
      }
      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`Station_Distribution_${dateStr}.pdf`);
    }
  };

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
    if (!dateValidation.isValid) {
      alert('Please correct the date errors before adding.');
      return;
    }
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
      await customAlert({ title: 'Error', text: 'Failed to add item: ' + error.message, iconType: 'danger' });
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
      await customAlert({ title: 'Error', text: 'Failed to update quantity: ' + error.message, iconType: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDistributionSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const table = distForm.item_type === 'vaccine' ? 'vaccine_inventory' : 'supplement_inventory';
      const availableList = distForm.item_type === 'vaccine' ? vaccines : supplements;
      const selectedItem = availableList.find(item => item.id === distForm.item_id);

      if (!selectedItem) {
        await customAlert({ title: 'Invalid Selection', text: 'Please select a valid item.', iconType: 'warning' });
        setIsSubmitting(false);
        return;
      }

      const qtyToDistribute = Number(distForm.quantity);
      if (isNaN(qtyToDistribute) || qtyToDistribute <= 0) {
        await customAlert({ title: 'Invalid Quantity', text: 'Please enter a valid quantity.', iconType: 'warning' });
        setIsSubmitting(false);
        return;
      }

      if (qtyToDistribute > selectedItem.quantity) {
        await customAlert({ title: 'Insufficient Stock', text: `Cannot distribute more than available stock (${selectedItem.quantity} ${selectedItem.unit}).`, iconType: 'warning' });
        setIsSubmitting(false);
        return;
      }

      // Prefer using the service so DB inserts happen (distribution + station inventory)
      let distributedById = user?.id;
      if (!distributedById) {
        try {
          const authUser = await inventoryService.auth.getAuthUser();
          distributedById = authUser?.id;
        } catch (err) {
          // ignore - will still proceed without a user id
        }
      }

      const result = await inventoryService.distributeInventory({
        itemType: distForm.item_type,
        itemId: distForm.item_id,
        quantity: qtyToDistribute,
        destinationStation: distForm.destination_station,
        distributedBy: distributedById || null,
        distributedDate: distForm.distribution_date,
        remarks: distForm.remarks || null
      });

      // Build a UI record (prefer DB-provided fields when available)
      const distData = result?.distribution || result?.distribution?.[0] || null;
      const releasedBy = user?.fullName || user?.email?.split('@')[0] || distData?.distributed_by || 'Local User';

      const newRecord = {
        id: distData?.id || `dist-${Date.now()}`,
        distribution_date: distData?.distributed_date || distForm.distribution_date,
        item_name: selectedItem.item_name,
        brand: selectedItem.brand || '',
        batch: result?.stationInventory?.batch ?? null,
        item_type: distForm.item_type === 'vaccine' ? 'Vaccine' : 'Supplement',
        quantity: distData?.quantity || qtyToDistribute,
        unit: selectedItem.unit,
        destination_station: distForm.destination_station,
        released_by: releasedBy,
        remarks: distData?.remarks || distForm.remarks || ''
      };

      setDistributionHistory(prev => [newRecord, ...prev]);

      // Reset form & close
      setShowDistributionModal(false);
      setDistForm({
        item_type: 'vaccine',
        item_id: '',
        quantity: '',
        destination_station: '',
        distribution_date: new Date().toISOString().split('T')[0],
        released_by: user?.fullName || user?.email?.split('@')[0] || '',
        remarks: '',
      });

      // Refresh stats and inventory immediately
      await fetchData();
      await customAlert({ title: 'Success', text: 'Distribution successful! Stock levels updated.', iconType: 'success' });
    } catch (error) {
      console.error('Error distributing inventory:', error);
      await customAlert({ title: 'Error', text: 'Failed to distribute items: ' + error.message, iconType: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleArchive = async (table, ids) => {
    const isConfirmed = await confirm({
      title: 'Archive Item',
      text: `Are you sure you want to archive ${ids.length > 1 ? 'these items' : 'this item'}? It will be removed from active lists but can be restored.`,
      confirmText: 'Yes, Archive',
      cancelText: 'Cancel',
      iconType: 'archive'
    });
    if (!isConfirmed) return;
    try {
      const newArchivedIds = [...new Set([...archivedIds, ...ids])];
      setArchivedIds(newArchivedIds);
      localStorage.setItem('inventory_archived_ids', JSON.stringify(newArchivedIds));
      
      // Update UI manually or just rely on state change causing re-render
      // fetchData() is optional if we just rely on state
    } catch (error) {
      await customAlert({ title: 'Error', text: 'Failed to archive item: ' + error.message, iconType: 'danger' });
    }
  };

  const handleRestore = async (table, ids) => {
    const isConfirmed = await confirm({
      title: 'Restore Item',
      text: `Are you sure you want to restore ${ids.length > 1 ? 'these items' : 'this item'}? It will be moved back to active lists.`,
      confirmText: 'Yes, Restore',
      cancelText: 'Cancel',
      iconType: 'info'
    });
    if (!isConfirmed) return;
    try {
      const newArchivedIds = archivedIds.filter(id => !ids.includes(id));
      setArchivedIds(newArchivedIds);
      localStorage.setItem('inventory_archived_ids', JSON.stringify(newArchivedIds));
      
    } catch (error) {
      await customAlert({ title: 'Error', text: 'Failed to restore item: ' + error.message, iconType: 'danger' });
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

  // Distribution history filtering + pagination
  const filteredDistHistory = distributionHistory.filter(rec => {
    const search = historySearch.toLowerCase();
    const matchesSearch = !search || rec.item_name?.toLowerCase().includes(search) || rec.destination_station?.toLowerCase().includes(search) || rec.released_by?.toLowerCase().includes(search);
    const matchesStation = historyStationFilter === 'All' || rec.destination_station === historyStationFilter;
    const matchesType = historyTypeFilter === 'All' || rec.item_type === historyTypeFilter;
    
    let matchesDate = true;
    if (historyDateFilter !== 'all') {
      const dDate = rec.distribution_date ? new Date(rec.distribution_date) : null;
      if (!dDate || isNaN(dDate.getTime())) {
        matchesDate = false;
      } else {
        const now = new Date();
        if (historyDateFilter === 'this_month') {
          matchesDate = dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
        } else if (historyDateFilter === 'this_year') {
          matchesDate = dDate.getFullYear() === now.getFullYear();
        } else if (historyDateFilter === 'custom' && historyCustomDateFrom && historyCustomDateTo) {
          const from = new Date(`${historyCustomDateFrom}T00:00:00`);
          const to = new Date(`${historyCustomDateTo}T23:59:59.999`);
          matchesDate = dDate >= from && dDate <= to;
        }
      }
    }
    
    return matchesSearch && matchesStation && matchesType && matchesDate;
  });
  const distTotalPages = Math.ceil(filteredDistHistory.length / distItemsPerPage);
  const distStartIndex = (distPage - 1) * distItemsPerPage;
  const paginatedDistHistory = filteredDistHistory.slice(distStartIndex, distStartIndex + distItemsPerPage);

  // Distribution summary stats
  const distSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const totalDistributed = distributionHistory.reduce((sum, rec) => sum + (Number(rec.quantity) || 0), 0);
    const thisMonthDists = distributionHistory.filter(rec => {
      const d = new Date(rec.distribution_date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const distributionsThisMonth = thisMonthDists.length;
    const stationsSupplied = [...new Set(distributionHistory.map(r => r.destination_station).filter(Boolean))].length;
    const itemsDistributed = [...new Set(distributionHistory.map(r => r.item_name).filter(Boolean))].length;

    return { totalDistributed, distributionsThisMonth, stationsSupplied, itemsDistributed };
  }, [distributionHistory]);

  return (
    <div className="inventory-page">

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══════════ VIEW 1: CHO INVENTORY MANAGEMENT ═══════════ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainTab === 'inventory' && (
      <>
      {/* ══════════ HEADER ══════════ */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Package size={22} className="header-icon" /> Inventory Management
          </h1>
          <p className="page-subtitle">Track and manage vaccine and supplement supplies across CHO stations to help maintain adequate stock levels.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowExportModal(true)}
          >
            <Download size={16} /> Export
          </button>
          <button
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setMainTab('distribution')}
          >
            <Truck size={16} /> Station Distribution
          </button>
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
          className={`stat-card stat-card--rose ${activeSummaryFilter === 'lowStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('lowStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease', background: '#e29b9d' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--rose" style={{ background: 'rgba(255, 255, 255, 0.3)', color: '#803035' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value">{lowStockCount}</div>
          <div className="stat-label">Low Stock</div>
        </div>
        <div 
          className={`stat-card stat-card--orange ${activeSummaryFilter === 'mediumStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('mediumStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <div className="stat-top">
            <div className="stat-icon stat-icon--orange">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{mediumStockCount}</div>
          <div className="stat-label">Medium Stock</div>
        </div>
        <div 
          className={`stat-card ${activeSummaryFilter === 'outOfStock' ? 'stat-card--active' : ''}`}
          onClick={() => setActiveSummaryFilter('outOfStock')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease', background: '#d1d5db' }}
        >
          <div className="stat-top">
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.5)', color: '#4b5563', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{outOfStockCount}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
      </div>

      <div className="inv-main-layout">
        <div className="inv-table-col">

      {!isAdmin && userScope.stationName && (
        <div className="station-scope-banner" style={{ marginBottom: '12px', padding: '10px 14px', background: '#eef6ff', border: '1px solid #d6e9ff', borderRadius: '10px', color: '#235f9c', fontSize: '13px', fontWeight: '600' }}>
          Viewing inventory for: {userScope.stationName}
        </div>
      )}

      <div className="shared-controls-card">
        <div className="shared-search-wrap">
          <Search size={16} className="shared-search-icon" />
          <input
            type="text"
            className="shared-search-input"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="shared-filters-row" ref={filterRowRef}>
          <span className="filters-label"><Filter size={13} /> Filters:</span>
          
          {/* Status Filter */}
          <div className="filter-dropdown-container">
            <button 
                className={`filter-btn ${statusFilter !== 'All' ? 'active-filter' : ''}`}
                onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <Activity size={14} className="filter-btn-icon" />
                <span>{statusFilter === 'All' ? 'All Statuses' : statusFilter}</span>
                <ChevronDown size={14} className="filter-btn-icon" />
            </button>
            {activePopover === 'status' && (
                <div className="filter-popover">
                    <div className="popover-title">Status</div>
                    <div className="popover-options">
                        <button className={`popover-opt-btn ${statusFilter === 'All' ? 'selected' : ''}`} onClick={() => { setStatusFilter('All'); setActivePopover(null); }}>All Status</button>
                        <button className={`popover-opt-btn ${statusFilter === 'Expired' || statusFilter === 'EXPIRED' ? 'selected' : ''}`} onClick={() => { setStatusFilter('Expired'); setActivePopover(null); }}>Expired</button>
                        <button className={`popover-opt-btn ${statusFilter === 'Normal' ? 'selected' : ''}`} onClick={() => { setStatusFilter('Normal'); setActivePopover(null); }}>Normal</button>
                        <button className={`popover-opt-btn ${statusFilter === 'Medium Stock' ? 'selected' : ''}`} onClick={() => { setStatusFilter('Medium Stock'); setActivePopover(null); }}>Medium Stock</button>
                        <button className={`popover-opt-btn ${statusFilter === 'Low Stock' ? 'selected' : ''}`} onClick={() => { setStatusFilter('Low Stock'); setActivePopover(null); }}>Low Stock</button>
                        <button className={`popover-opt-btn ${statusFilter === 'Out of Stock' ? 'selected' : ''}`} onClick={() => { setStatusFilter('Out of Stock'); setActivePopover(null); }}>Out of Stock</button>
                    </div>
                </div>
            )}
          </div>

          {/* Archive Filter */}
          <div className="filter-dropdown-container">
            <button 
                className={`filter-btn ${archiveFilter !== 'active' ? 'active-filter' : ''}`}
                onClick={() => setActivePopover(activePopover === 'archive' ? null : 'archive')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <Archive size={14} className="filter-btn-icon" />
                <span>{archiveFilter === 'active' ? 'Active' : 'Archived'}</span>
                <ChevronDown size={14} className="filter-btn-icon" />
            </button>
            {activePopover === 'archive' && (
                <div className="filter-popover">
                    <div className="popover-title">Archive</div>
                    <div className="popover-options">
                        <button className={`popover-opt-btn ${archiveFilter === 'active' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('active'); setActivePopover(null); }}>Active</button>
                        <button className={`popover-opt-btn ${archiveFilter === 'archived' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('archived'); setActivePopover(null); }}>Archived</button>
                        <button className={`popover-opt-btn ${archiveFilter === 'all' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('all'); setActivePopover(null); }}>All</button>
                    </div>
                </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="filter-dropdown-container">
            <button 
                className={`filter-btn ${dateFilter !== 'all' ? 'active-filter' : ''}`}
                onClick={() => setActivePopover(activePopover === 'date' ? null : 'date')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <Calendar size={14} className="filter-btn-icon" /> 
                <span>Date: {
                    dateFilter === 'all' ? 'All Time' :
                    dateFilter === 'this_month' ? 'This Month' :
                    dateFilter === 'this_year' ? 'This Year' :
                    'Custom'
                }</span>
                <ChevronDown size={14} className="filter-btn-icon" />
            </button>
            
            {activePopover === 'date' && (
                <div className="filter-popover" style={{ minWidth: '240px' }}>
                    <div className="popover-title">Date</div>
                    <div className="popover-options">
                        <button className={`popover-opt-btn ${dateFilter === 'all' ? 'selected' : ''}`} onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>All Time</button>
                        <button className={`popover-opt-btn ${dateFilter === 'this_month' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_month'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>This Month</button>
                        <button className={`popover-opt-btn ${dateFilter === 'this_year' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_year'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>This Year</button>
                        <button className={`popover-opt-btn ${dateFilter === 'custom' ? 'selected' : ''}`} onClick={() => { setDateFilter('custom'); setDateFilterError(''); }}>Custom Range</button>
                    </div>
                    {dateFilter === 'custom' && (
                        <div className="date-custom-range-section">
                            <div className="date-custom-range-fields">
                                <div className="date-custom-field">
                                    <label>From</label>
                                    <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setDateFilterError(''); }} />
                                </div>
                                <div className="date-custom-field">
                                    <label>To</label>
                                    <input type="date" value={customDateTo} min={customDateFrom} onChange={e => { setCustomDateTo(e.target.value); setDateFilterError(''); }} />
                                </div>
                            </div>
                            {dateFilterError && (
                                <div className="date-filter-error">
                                    <AlertTriangle size={12} /> {dateFilterError}
                                </div>
                            )}
                            <div className="date-custom-actions">
                                <button className="date-custom-cancel" onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>Cancel</button>
                                <button className="date-custom-apply" onClick={() => {
                                    if (!customDateFrom || !customDateTo) {
                                        setDateFilterError('Both dates are required.');
                                        return;
                                    }
                                    if (new Date(customDateFrom) > new Date(customDateTo)) {
                                        setDateFilterError('From date cannot be later than To.');
                                        return;
                                    }
                                    setDateFilterError('');
                                    setActivePopover(null);
                                }}>Apply</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
          {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
          )}

          <button
            className="clear-filters-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
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

      {isAdmin && (
      <div className="inv-card">
        <div className="table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="row-number-header">#</th>
                <th>Item Name</th>
                <th>Total Stock</th>
                <th>Unit</th>
                <th>Batch Info</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8">
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
                                background: status.label === 'EXPIRED' ? '#e05c73' : percentage <= 20 ? '#e05c73' : percentage <= 50 ? '#e8b84b' : '#6db8a0'
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="unit-cell">{item.unit || 'tablets'}</td>
                      <td className="expiration-cell">
                        {item.items.length > 0 ? (
                          <div className="batch-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {item.items.map((subItem, idx) => {
                              const batchNumber = activeTab === 'vaccines' ? subItem.batch : subItem.batch_number;
                              const batchLabel = batchNumber ? `Batch ${batchNumber}` : 'Batch';
                              const isExpired = subItem.isExpired;
                              return (
                                <div key={idx} className="batch-item" style={{ fontSize: '11px', color: '#666' }}>
                                  <strong style={{ color: '#444' }}>{batchLabel}:</strong> {subItem.expiration_date ? 
                                    (isExpired ? 
                                      <span style={{ color: '#e05c73', fontWeight: '600' }}>Expired {new Date(subItem.expiration_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} <span style={{ padding: '2px 4px', background: '#fce8eb', borderRadius: '4px', fontSize: '9px', marginLeft: '4px' }}>EXPIRED</span></span> : 
                                      `Expires ${new Date(subItem.expiration_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`) : 
                                    'No Expiry'
                                  }
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#999' }}>-</span>
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
                                handleRestore(
                                  activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory',
                                  archivedItems.map(i => i.id)
                                );
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
                                const activeItems = item.items.filter(i => (i.status || 'active') !== 'archived');
                                handleArchive(
                                  activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory',
                                  activeItems.map(i => i.id)
                                );
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
                        <td colSpan="7" style={{ padding: '0' }}>
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
                                const subStatus = getStatus(subItem.quantity, subItem.max_stock, subItem.isExpired);
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
                                      <div><strong>Unit:</strong> {subItem.unit || 'N/A'}</div>
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
                                          onClick={() => handleArchive(
                                            activeTab === 'vaccines' ? 'vaccine_inventory' : 'supplement_inventory',
                                            [subItem.id]
                                          )}
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
                  <td colSpan="7" className="text-center py-8">
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
      )}

      <div className="inv-side-col">
        <div className="inv-card">
          <div className="inv-card-head" style={{ padding: '16px 20px', borderBottom: '1px solid #f0f2f5' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> Notifications & Alerts
            </h2>
          </div>
          <div className="alerts-list" style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inventoryAlerts.length > 0 ? (
              inventoryAlerts.map((alert, index) => (
                <div 
                  key={`${alert.id}-${index}`}
                  className="alert-item clickable-alert" 
                  style={{ 
                    background: `${alert.color}12`, // 0.07 opacity using hex alpha approximation
                    display: 'flex', 
                    gap: '10px', 
                    padding: '10px', 
                    borderRadius: '10px', 
                    alignItems: 'center' 
                  }}
                  onClick={alert.onClick}
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      alert.onClick();
                    }
                  }}
                >
                  <div className="alert-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: alert.color }}></div>
                  <div className="alert-body" style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 2px', color: alert.color }}>{alert.title}</p>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{alert.message}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: alert.color, opacity: 0.7 }} />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                No inventory alerts at this time.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
    )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══════════ VIEW 2: STATION DISTRIBUTION ═══════════ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainTab === 'distribution' && (
      <>
      {/* ══════════ DISTRIBUTION HEADER ══════════ */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Truck size={22} className="header-icon" /> Station Distribution
          </h1>
          <p className="page-subtitle">Transfer vaccines and supplements from CHO inventory to registered health stations.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowDistExportModal(true)}
          >
            <Download size={16} /> Export
          </button>
          <button
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setMainTab('inventory')}
          >
            <ArrowLeft size={16} /> Back to Inventory
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => {
              setDistForm({
                item_type: 'vaccine',
                item_id: '',
                quantity: '',
                destination_station: '',
                distribution_date: new Date().toISOString().split('T')[0],
                released_by: user?.fullName || user?.email?.split('@')[0] || '',
                remarks: '',
              });
              setShowDistributionModal(true);
            }}
          >
            <Plus size={16} /> New Distribution
          </button>
        </div>
      </div>

      {/* ── DISTRIBUTION SUMMARY CARDS ── */}
      <div className="inv-stats-grid">
        <div className="stat-card stat-card--lilac">
          <div className="stat-top">
            <div className="stat-icon stat-icon--lilac">
              <Send size={20} />
            </div>
          </div>
          <div className="stat-value">{distSummary.totalDistributed}</div>
          <div className="stat-label">Total Distributed</div>
        </div>
        <div className="stat-card stat-card--sage">
          <div className="stat-top">
            <div className="stat-icon stat-icon--sage">
              <Calendar size={20} />
            </div>
          </div>
          <div className="stat-value">{distSummary.distributionsThisMonth}</div>
          <div className="stat-label">Distributions This Month</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-top">
            <div className="stat-icon stat-icon--orange">
              <MapPin size={20} />
            </div>
          </div>
          <div className="stat-value">{distSummary.stationsSupplied}</div>
          <div className="stat-label">Stations Supplied</div>
        </div>
        <div className="stat-card stat-card--yellow">
          <div className="stat-top">
            <div className="stat-icon stat-icon--yellow">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value">{distSummary.itemsDistributed}</div>
          <div className="stat-label">Items Distributed</div>
        </div>
      </div>

      {/* ── DISTRIBUTION SEARCH & FILTERS ── */}
      <div className="shared-controls-card">
        <div className="shared-search-wrap">
          <Search size={16} className="shared-search-icon" />
          <input
            type="text"
            className="shared-search-input"
            placeholder="Search item or station..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
          />
        </div>
        <div className="shared-filters-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="filters-label"><Filter size={13} /> Filters:</span>
          <select
            value={isAdmin ? historyStationFilter : (visibleStations.includes(historyStationFilter) ? historyStationFilter : (visibleStations[0] || 'All'))}
            onChange={e => setHistoryStationFilter(e.target.value)}
            disabled={!isAdmin && visibleStations.length <= 1}
            className="filter-btn"
            style={{ cursor: !isAdmin && visibleStations.length <= 1 ? 'not-allowed' : 'pointer' }}
          >
            {isAdmin ? <option value="All">All Stations</option> : null}
            {(isAdmin ? availableStations : visibleStations).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={historyTypeFilter}
            onChange={e => setHistoryTypeFilter(e.target.value)}
            className="filter-btn"
            style={{ cursor: 'pointer' }}
          >
            <option value="All">All Item Types</option>
            <option value="Vaccine">Vaccines</option>
            <option value="Supplement">Supplements</option>
          </select>
          
          {/* Date Filter */}
          <div className="filter-dropdown-container" style={{ position: 'relative' }}>
            <button 
                className={`filter-btn ${historyDateFilter !== 'all' ? 'active-filter' : ''}`}
                onClick={() => setActivePopover(activePopover === 'distDate' ? null : 'distDate')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <Calendar size={14} className="filter-btn-icon" /> 
                <span>Date: {
                    historyDateFilter === 'all' ? 'All Time' :
                    historyDateFilter === 'this_month' ? 'This Month' :
                    historyDateFilter === 'this_year' ? 'This Year' :
                    'Custom'
                }</span>
                <ChevronDown size={14} className="filter-btn-icon" />
            </button>
            
            {activePopover === 'distDate' && (
                <div className="filter-popover" style={{ minWidth: '240px' }}>
                    <div className="popover-title">Distribution Date</div>
                    <div className="popover-options">
                        <button className={`popover-opt-btn ${historyDateFilter === 'all' ? 'selected' : ''}`} onClick={() => { setHistoryDateFilter('all'); setHistoryCustomDateFrom(''); setHistoryCustomDateTo(''); setHistoryDateFilterError(''); setActivePopover(null); }}>All Time</button>
                        <button className={`popover-opt-btn ${historyDateFilter === 'this_month' ? 'selected' : ''}`} onClick={() => { setHistoryDateFilter('this_month'); setHistoryCustomDateFrom(''); setHistoryCustomDateTo(''); setHistoryDateFilterError(''); setActivePopover(null); }}>This Month</button>
                        <button className={`popover-opt-btn ${historyDateFilter === 'this_year' ? 'selected' : ''}`} onClick={() => { setHistoryDateFilter('this_year'); setHistoryCustomDateFrom(''); setHistoryCustomDateTo(''); setHistoryDateFilterError(''); setActivePopover(null); }}>This Year</button>
                        <button className={`popover-opt-btn ${historyDateFilter === 'custom' ? 'selected' : ''}`} onClick={() => { setHistoryDateFilter('custom'); setHistoryDateFilterError(''); }}>Custom Range</button>
                    </div>
                    {historyDateFilter === 'custom' && (
                        <div className="date-custom-range-section">
                            <div className="date-custom-range-fields">
                                <div className="date-custom-field">
                                    <label>From</label>
                                    <input type="date" value={historyCustomDateFrom} onChange={e => { setHistoryCustomDateFrom(e.target.value); setHistoryDateFilterError(''); }} />
                                </div>
                                <div className="date-custom-field">
                                    <label>To</label>
                                    <input type="date" value={historyCustomDateTo} min={historyCustomDateFrom} onChange={e => { setHistoryCustomDateTo(e.target.value); setHistoryDateFilterError(''); }} />
                                </div>
                            </div>
                            {historyDateFilterError && (
                                <div className="date-filter-error">
                                    <AlertTriangle size={12} /> {historyDateFilterError}
                                </div>
                            )}
                            <div className="date-custom-actions">
                                <button className="date-custom-cancel" onClick={() => { setHistoryDateFilter('all'); setHistoryCustomDateFrom(''); setHistoryCustomDateTo(''); setHistoryDateFilterError(''); setActivePopover(null); }}>Cancel</button>
                                <button className="date-custom-apply" onClick={() => {
                                    if (!historyCustomDateFrom || !historyCustomDateTo) {
                                        setHistoryDateFilterError('Both dates are required.');
                                        return;
                                    }
                                    if (new Date(historyCustomDateFrom) > new Date(historyCustomDateTo)) {
                                        setHistoryDateFilterError('From date cannot be later than To.');
                                        return;
                                    }
                                    setHistoryDateFilterError('');
                                    setActivePopover(null);
                                }}>Apply</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>

          {(historySearch || historyStationFilter !== 'All' || historyTypeFilter !== 'All' || historyDateFilter !== 'all') && (
            <button className="clear-filters-btn" onClick={() => { setHistorySearch(''); setHistoryStationFilter('All'); setHistoryTypeFilter('All'); setHistoryDateFilter('all'); setHistoryCustomDateFrom(''); setHistoryCustomDateTo(''); setHistoryDateFilterError(''); }}>Clear All</button>
          )}
        </div>
      </div>

    {/* ── STATION INVENTORY ── */}
    <div className="inv-card" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
      <div className="inv-card-head" style={{ padding: '18px 24px', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={17} /> Station Inventory
          </h2>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>Current stock held by each registered health station.</p>
        </div>
        <span style={{ fontSize: '13px', color: '#555' }}>{stationInventory.length} entries</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Expand</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Station</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Item</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Type</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'center', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Total Qty</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Unit</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Brand</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Expiration Date</th>
            </tr>
          </thead>
          <tbody>
            {stationInventory.length > 0 ? stationInventory.map((group, groupIndex) => {
              const isExpanded = expandedStationRows[group.groupKey];
              return (
                <React.Fragment key={group.groupKey}>
                  {/* Parent Row */}
                  <tr style={{ borderBottom: '1px solid #f0f2f5', backgroundColor: '#fafbfc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>
                      <button
                        onClick={() => setExpandedStationRows(prev => ({
                          ...prev,
                          [group.groupKey]: !prev[group.groupKey]
                        }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                            color: '#666'
                          }}
                        />
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: '600' }}>{group.station}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: '600' }}>{group.item_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{group.item_type}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', textAlign: 'center', color: '#2c5282' }}>{group.totalQuantity}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{group.unit}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>{group.brand || 'N/A'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>{group.expiration_date ? new Date(group.expiration_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>

                  {/* Child Rows (Batch Variants) */}
                  {isExpanded && group.variants.map((variant, variantIndex) => (
                    <tr key={`${group.groupKey}-variant-${variantIndex}`} style={{ borderBottom: '1px solid #f0f2f5', backgroundColor: '#fff9f9' }}>
                      <td style={{ padding: '8px 16px' }}></td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}></td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: '#666' }}>
                        Batch: <strong>{variant.batch}</strong>
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: '#666' }}></td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', textAlign: 'center', color: '#555' }}>{variant.quantity}</td>
                      <td style={{ padding: '8px 16px', fontSize: '11px', color: '#666' }}>{variant.unit || 'N/A'}</td>
                      <td style={{ padding: '8px 16px', fontSize: '11px', color: '#666' }}>{variant.brand || 'N/A'}</td>
                      <td style={{ padding: '8px 16px', fontSize: '11px', color: '#999' }}>
                        Updated: {variant.last_updated ? new Date(variant.last_updated).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            }) : (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                  No station inventory records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* ── STATION DISTRIBUTION HISTORY ── */}
      <div className="inv-card" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
        <div className="inv-card-head" style={{ padding: '18px 24px', borderBottom: '1px solid #f0f2f5' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={17} /> Distribution History
          </h2>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>Track supplies released from CHO inventory to health stations.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'center', background: '#fafbfc', borderBottom: '1px solid #eee' }}>#</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Date</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Item</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Type</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'center', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Quantity</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Destination Station</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Released By</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'left', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Remarks</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'center', background: '#fafbfc', borderBottom: '1px solid #eee' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDistHistory.length > 0 ? (
                paginatedDistHistory.map((rec, idx) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #f0f2f5', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#888', textAlign: 'center', fontWeight: '600' }}>{distStartIndex + idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }}>{formatReadableDate(rec.distribution_date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>
                      <div style={{ fontWeight: '600' }}>{rec.item_name}</div>
                      {rec.brand && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{rec.brand}{rec.batch && rec.batch !== 'N/A' ? ` · Batch ${rec.batch}` : ''}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: rec.item_type === 'Vaccine' ? 'rgba(91,174,208,0.12)' : 'rgba(147,111,199,0.12)', color: rec.item_type === 'Vaccine' ? '#3a8db5' : '#7a4fa8' }}>
                        {rec.item_type === 'Vaccine' ? <Syringe size={11} /> : <Pill size={11} />}
                        {rec.item_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#333', textAlign: 'center' }}>{rec.quantity} <span style={{ fontWeight: 400, color: '#888', fontSize: '11px' }}>{rec.unit}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{rec.destination_station}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>{rec.released_by}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#777', maxWidth: '200px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rec.remarks || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '5px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedDistRecord(rec)}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '13px', fontStyle: 'italic' }}>
                    No distribution records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Distribution History Pagination */}
        {filteredDistHistory.length > distItemsPerPage && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {distStartIndex + 1}-{Math.min(distStartIndex + distItemsPerPage, filteredDistHistory.length)} of {filteredDistHistory.length}
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setDistPage(prev => Math.max(1, prev - 1))}
                disabled={distPage === 1}
              >
                Previous
              </button>
              <span className="pagination-page-info">
                Page {distPage} of {distTotalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setDistPage(prev => Math.min(distTotalPages, prev + 1))}
                disabled={distPage === distTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

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
                    style={dateValidation.mfgError ? { border: '1px solid #e05c73' } : {}}
                  />
                  {dateValidation.mfgError && (
                    <span style={{ color: '#e05c73', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      ⚠ {dateValidation.mfgError}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    value={form.expiration_date}
                    onChange={e =>
                      setForm({ ...form, expiration_date: e.target.value })
                    }
                    style={dateValidation.expError ? { border: '1px solid #e05c73' } : dateValidation.expWarning ? { border: '1px solid #e8b84b' } : {}}
                  />
                  {dateValidation.expError && (
                    <span style={{ color: '#e05c73', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      ⚠ {dateValidation.expError}
                    </span>
                  )}
                  {dateValidation.expWarning && !dateValidation.expError && (
                    <span style={{ color: '#e8b84b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      ⚠ {dateValidation.expWarning}
                    </span>
                  )}
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
                  disabled={isSubmitting || !dateValidation.isValid}
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

      {/* ── STATION DISTRIBUTION MODAL ── */}
      {showDistributionModal && (
        <div className="modal-overlay" onClick={() => setShowDistributionModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '580px' }}
          >
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={18} /> New Station Distribution</h2>
              <p>Transfer available CHO stock to a registered station.</p>
            </div>
            <form onSubmit={handleDistributionSubmit}>
              <div className="modal-body">
                {/* Item Type */}
                <div className="form-group">
                  <label>Item Type <span style={{ color: '#e05c73' }}>*</span></label>
                  <select
                    required
                    value={distForm.item_type}
                    onChange={e => setDistForm({ ...distForm, item_type: e.target.value, item_id: '' })}
                    className="form-control"
                  >
                    <option value="vaccine">Vaccine</option>
                    <option value="supplement">Supplement</option>
                  </select>
                </div>

                {/* Item */}
                <div className="form-group">
                  <label>Item <span style={{ color: '#e05c73' }}>*</span></label>
                  <select
                    required
                    value={distForm.item_id}
                    onChange={e => setDistForm({ ...distForm, item_id: e.target.value })}
                    className="form-control"
                  >
                    <option value="">— Select item —</option>
                    {(distForm.item_type === 'vaccine' ? vaccines : supplements)
                      .filter(item => item.quantity > 0 && item.status !== 'archived')
                      .map(item => (
                        <option key={item.id} value={item.id}>
                          {item.item_name}{item.brand ? ` (${item.brand})` : ''} — {item.quantity} {item.unit} available
                        </option>
                      ))}
                  </select>
                </div>

                {/* Available CHO Stock + Quantity + Remaining */}
                {distForm.item_id && (() => {
                  const sel = (distForm.item_type === 'vaccine' ? vaccines : supplements).find(i => i.id === distForm.item_id);
                  if (!sel) return null;
                  const qtyNum = Number(distForm.quantity) || 0;
                  const exceedsStock = qtyNum > sel.quantity;
                  const remaining = sel.quantity - qtyNum;
                  return (
                    <>
                      {/* Available CHO Stock */}
                      <div style={{ background: 'rgba(109,184,160,0.08)', border: '1px solid rgba(109,184,160,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Available CHO Stock</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#3d8870' }}>{sel.quantity.toLocaleString()} {sel.unit}</span>
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>Quantity to Distribute <span style={{ color: '#e05c73' }}>*</span></label>
                          <input
                            type="number"
                            required
                            min="1"
                            max={sel.quantity}
                            value={distForm.quantity}
                            onChange={e => setDistForm({ ...distForm, quantity: e.target.value })}
                            placeholder={`Max: ${sel.quantity}`}
                            style={{ borderColor: exceedsStock ? '#e05c73' : undefined }}
                          />
                          {exceedsStock && (
                            <span style={{ color: '#e05c73', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                              Cannot exceed available stock ({sel.quantity} {sel.unit}).
                            </span>
                          )}
                        </div>
                        <div className="form-group">
                          <label>Unit</label>
                          <input
                            type="text"
                            readOnly
                            value={sel.unit}
                            style={{ backgroundColor: '#f5f5f5', color: '#666', cursor: 'not-allowed' }}
                          />
                        </div>
                      </div>

                      {/* Remaining CHO Stock */}
                      {qtyNum > 0 && (
                        <div style={{ background: exceedsStock ? 'rgba(224,92,115,0.06)' : 'rgba(91,174,208,0.06)', border: `1px solid ${exceedsStock ? 'rgba(224,92,115,0.2)' : 'rgba(91,174,208,0.2)'}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Remaining CHO Stock</span>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: exceedsStock ? '#e05c73' : '#3a8db5' }}>{remaining < 0 ? '—' : remaining.toLocaleString()} {remaining >= 0 ? sel.unit : ''}</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Destination Health Station */}
                <div className="form-group">
                  <label>Destination Health Station <span style={{ color: '#e05c73' }}>*</span></label>
                  <select
                    required
                    value={distForm.destination_station}
                    onChange={e => setDistForm({ ...distForm, destination_station: e.target.value })}
                    className="form-control"
                  >
                    <option value="">— Select station —</option>
                    {availableStations.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Distribution Date & Released By */}
                <div className="form-grid">
                  <div className="form-group">
                    <label>Distribution Date <span style={{ color: '#e05c73' }}>*</span></label>
                    <input
                      type="date"
                      required
                      value={distForm.distribution_date}
                      onChange={e => setDistForm({ ...distForm, distribution_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Released By <span style={{ color: '#e05c73' }}>*</span></label>
                    <input
                      type="text"
                      required
                      value={distForm.released_by}
                      onChange={e => setDistForm({ ...distForm, released_by: e.target.value })}
                      placeholder="Staff name"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="form-group">
                  <label>Remarks <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    rows={3}
                    value={distForm.remarks}
                    onChange={e => setDistForm({ ...distForm, remarks: e.target.value })}
                    placeholder="Notes or reason for this distribution..."
                    style={{ width: '100%', resize: 'vertical', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDistributionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Truck size={15} />
                  {isSubmitting ? 'Processing...' : 'Confirm Distribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW DISTRIBUTION DETAILS MODAL ── */}
      {selectedDistRecord && (
        <div className="modal-overlay" onClick={() => setSelectedDistRecord(null)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Eye size={17} /> Distribution Details</h2>
              <p>Transaction log for this distribution record.</p>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'Date', value: formatReadableDate(selectedDistRecord.distribution_date) },
                  { label: 'Item Type', value: selectedDistRecord.item_type },
                  { label: 'Item Name', value: selectedDistRecord.item_name, fullWidth: true },
                  { label: 'Brand', value: selectedDistRecord.brand || '—' },
                  { label: 'Batch', value: selectedDistRecord.batch || '—' },
                  { label: 'Quantity', value: `${selectedDistRecord.quantity} ${selectedDistRecord.unit}` },
                  { label: 'Destination Station', value: selectedDistRecord.destination_station, fullWidth: true },
                  { label: 'Released By', value: selectedDistRecord.released_by, fullWidth: true },
                  { label: 'Remarks', value: selectedDistRecord.remarks || '—', fullWidth: true }
                ].map(({ label, value, fullWidth }) => (
                  <div key={label} style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '14px', color: '#333', fontWeight: label === 'Item Name' || label === 'Quantity' ? '600' : '400' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedDistRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        onExport={handleExport} 
        title="Export Inventory Records"
      />
      <ExportModal 
        isOpen={showDistExportModal} 
        onClose={() => setShowDistExportModal(false)} 
        onExport={handleDistExport} 
        title="Export Station Distribution"
      />
    </div>
  );
};

export default Inventory;