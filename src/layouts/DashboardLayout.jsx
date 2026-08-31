import React, { useState, useEffect, useRef, useContext } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Baby, AlertTriangle, CalendarCheck,
    HeartPulse, Syringe, Truck, Activity, BarChart3, Settings,
    Bell, LogOut, Menu, X, ChevronLeft, ChevronRight, Search, Shield,
    MapPin, FileText, Stethoscope, RefreshCw, ClipboardList, Package
} from 'lucide-react';
import '../styles/layouts/DashboardLayout.css';
import logo from '../assets/images/dasmom_logo.png';
import { AuthContext } from '../context/AuthContext';
import PatientService from '../services/patientservice';
import supabase from '../config/supabaseclient';
import { useModal } from '../context/ModalContext';
import MotherAIChatAssistant from '../components/MotherDashboard/MotherAIChatAssistant';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import { requestNotificationPermission, scheduleMotherReminders, getRoleNotificationSummary } from '../services/notificationservice';
import { buildMotherScheduleItems } from '../utils/motherSchedule';
import { loadMotherPatient } from '../services/motherOfflineService';

const NAV_ITEMS = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        ],
    },
    {
        section: 'Maternal Care',
        items: [
            { label: 'Patient Profiles', icon: Users, path: '/dashboard/patients' },
            { label: 'High Risk Cases', icon: AlertTriangle, path: '/dashboard/high-risk' },
            { label: 'Visits & Scheduling', icon: CalendarCheck, path: '/dashboard/prenatal' },
            { label: 'Delivery Outcomes', icon: Stethoscope, path: '/dashboard/deliveries' },
            { label: 'Postpartum Records', icon: FileText, path: '/dashboard/postpartum' },
        ],
    },
    {
        section: 'Health Programs',
        items: [
            { label: 'Newborn Records', icon: Baby, path: '/dashboard/newborns' },
            { label: 'Distribution Records', icon: Syringe, path: '/dashboard/vaccinations' },
            { label: 'Inventory Management', icon: Package, path: '/dashboard/inventory' },
        ],
    },
    {
        section: 'Reports',
        items: [
            { label: 'Station Reports', icon: MapPin, path: '/dashboard/stations' },
            { label: 'Analytics', icon: BarChart3, path: '/dashboard/analytics' },
        ],
    },
    {
        section: 'System',
        items: [
            { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
        ],
    },
];



const DashboardLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarMobile, setSidebarMobile] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifFilter, setNotifFilter] = useState('all');
    const [notifications, setNotifications] = useState([]);
    const [notifCount, setNotifCount] = useState(0);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const userMenuRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout: authLogout } = useContext(AuthContext);
    const { confirm } = useModal();
    const patientService = new PatientService();

    // Determine if we are in User View based on path
    const isUserView = location.pathname.startsWith('/mother-home');

    // Click outside to close user menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };

        if (userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userMenuOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSidebarOpen(false);
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isUserView || !user || !['mother', 'patient'].includes((user.role || '').toLowerCase())) return;
        const permissionWasHandled = localStorage.getItem('dasmom-permission-requested') === 'true';
        const permissionDenied = localStorage.getItem('dasmom-permission-denied') === 'true';
        if (!permissionWasHandled && !permissionDenied) {
            setShowPermissionModal(true);
        }
    }, [isUserView, user]);

    useEffect(() => {
        if (!isUserView || !user || !['mother', 'patient'].includes((user.role || '').toLowerCase())) return undefined;

        let listener;
        const syncWhenOnline = async (status) => {
            if (!status.connected) return;
            const patient = await loadMotherPatient(user);
            if (patient) await scheduleMotherReminders(patient, user);
        };

        const registerNetworkListener = async () => {
            if (!Capacitor.isPluginAvailable('Network')) return;
            listener = await Network.addListener('networkStatusChange', syncWhenOnline);
        };

        registerNetworkListener().catch((error) => console.error('Failed to register mother sync listener:', error));
        return () => listener?.remove();
    }, [isUserView, user]);

    const handleNotificationPermission = async (allow) => {
        setShowPermissionModal(false);

        if (!allow) {
            localStorage.setItem('dasmom-permission-denied', 'true');
            localStorage.setItem('dasmom-permission-requested', 'true');
            return;
        }

        const result = await requestNotificationPermission();
        localStorage.setItem('dasmom-permission-requested', 'true');
        localStorage.setItem('dasmom-permission-status', result.granted ? 'granted' : 'denied');

        if (result.granted && user?.id) {
            const patient = await patientService.getPatientById(user.id);
            if (patient) {
                await scheduleMotherReminders(patient, user);
            }
        }
    };

    // Fetch real notifications from database
    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user) {
                setNotifications([]);
                setNotifCount(0);
                return;
            }

            try {
                let notifList = [];

                if (isUserView && ['mother', 'patient'].includes((user.role || '').toLowerCase())) {
                    const patient = await loadMotherPatient(user);

                    const scheduleItems = patient ? (patient.schedule || buildMotherScheduleItems(patient)) : [];
                    notifList = getRoleNotificationSummary(user.role, scheduleItems);
                } else {
                    const today = new Date().toISOString().split('T')[0];

                    const { data: todayAppts } = await supabase
                        .from('prenatal_visits')
                        .select(`visit_date, patient_basic_info (first_name, last_name, barangay)`)
                        .eq('visit_date', today)
                        .limit(5);

                    if (todayAppts && todayAppts.length > 0) {
                        notifList.push({ category: 'appointments', type: 'info', text: `${todayAppts.length} prenatal visit${todayAppts.length > 1 ? 's' : ''} scheduled today`, time: 'Today' });
                    }

                    const { data: inventory } = await supabase
                        .from('vaccine_inventory')
                        .select('vaccine_name, quantity, max_quantity')
                        .limit(100);

                    if (inventory && inventory.length > 0) {
                        inventory.filter(item => {
                            const percentage = item.max_quantity ? (item.quantity / item.max_quantity) * 100 : 0;
                            return percentage > 0 && percentage <= 20;
                        }).slice(0, 5).forEach(item => {
                            const percentage = Math.round((item.quantity / item.max_quantity) * 100);
                            notifList.push({ category: 'inventory', type: 'warning', text: `${item.vaccine_name} low stock (${item.quantity}/${item.max_quantity} units - ${percentage}%)`, time: 'Inventory' });
                        });
                    }

                    if ((user.role || '').toLowerCase() !== 'admin') {
                        const { data: upcomingVisits } = await supabase
                            .from('prenatal_visits')
                            .select('visit_date, patient_basic_info (first_name, last_name)')
                            .gte('visit_date', today)
                            .limit(3);

                        if (upcomingVisits && upcomingVisits.length > 0) {
                            upcomingVisits.forEach((visit) => {
                                notifList.push({ category: 'appointments', type: 'info', text: `${visit.patient_basic_info.first_name} ${visit.patient_basic_info.last_name} has an upcoming prenatal visit`, time: 'Upcoming' });
                            });
                        }
                    }

                    if ((user.role || '').toLowerCase() === 'admin') {
                        notifList = notifList.filter(item => item.category !== 'appointments');
                    }
                }

                setNotifications(notifList);
                setNotifCount(notifList.length);
            } catch (error) {
                console.error('Error fetching notifications:', error);
                setNotifications([]);
                setNotifCount(0);
            }
        };

        fetchNotifications();
    }, [user, isUserView, patientService]);

    const handleLogout = async () => {
        setUserMenuOpen(false);
        const confirmed = await confirm({
            title: 'Confirm Logout',
            text: 'Are you sure you want to log out of DasMom+? You will need to login again to access the system.',
            confirmText: 'Yes, Logout',
            cancelText: 'Stay Logged In',
            iconType: 'logout'
        });
        
        if (confirmed) {
            await authLogout();
            navigate(isUserView ? '/mother-login' : '/');
        }
    };

    // Filter nav items based on view
    const filteredNavItems = isUserView ? [
        {
            section: 'My Dashboard',
            items: [
                { label: 'Home', icon: LayoutDashboard, path: '/mother-home' },
                { label: 'My Vitals', icon: Activity, path: '/mother-home/user-vitals' },
                { label: 'Appointments', icon: CalendarCheck, path: '/mother-home/user-appointments' },
            ]
        },
        {
            section: 'Health Info',
            items: [
                { label: 'Pregnancy Tips', icon: HeartPulse, path: '/mother-home/user-tips' },
                { label: 'Vaccination Info', icon: Syringe, path: '/mother-home/user-vaccinations' },
                { label: 'Pregnancy & Delivery Info', icon: ClipboardList, path: '/mother-home/user-delivery-info' },
            ]
        }
    ] : NAV_ITEMS;

    return (
        <div className={`app-shell ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>

            {/* ── Mobile Overlay ── */}
            {sidebarMobile && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarMobile(false)}
                    aria-hidden="true"
                />
            )}

            {/* ═══════════════════════════════
                SIDEBAR
            ═══════════════════════════════ */}
            <aside className={`sidebar ${sidebarMobile ? 'sidebar--mobile-open' : ''}`} aria-label="Main navigation">

                {/* Sidebar header */}
                <div className="sidebar-header">
                    <button 
                        className="sidebar-brand" 
                        onClick={() => navigate('/dashboard')}
                        aria-label="Go to Dashboard"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                        <img src={logo} alt="DasMom+" className="sidebar-logo" />
                        {(sidebarOpen || sidebarMobile) && (
                            <div className="sidebar-brand-text">
                                <span className="sidebar-brand-name">DasMom<span>+</span></span>
                                <span className="sidebar-brand-sub">Health System</span>
                            </div>
                        )}
                    </button>
                    <button
                        className="sidebar-toggle desktop-toggle"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <ChevronLeft size={16} />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="sidebar-nav">
                    {filteredNavItems.map((group) => (
                        <div key={group.section} className="nav-group">
                            {(sidebarOpen || sidebarMobile) && (
                                <span className="nav-group-label">{group.section}</span>
                            )}
                            {group.items.map(({ label, icon: Icon, path }) => (
                                <NavLink
                                    key={path}
                                    to={path}
                                    className={({ isActive }) => {
                                        // For Mother side routes, use exact matching (all are distinct)
                                        if (isUserView) {
                                            const isExactMatch = location.pathname === path;
                                            return `nav-item${isExactMatch ? ' nav-item--active' : ''}`;
                                        }
                                        // For Staff side, use prefix matching for nested routes
                                        // but ensure only one item is active at a time
                                        if (path === '/dashboard') {
                                            const isExactMatch = location.pathname === path;
                                            return `nav-item${isExactMatch ? ' nav-item--active' : ''}`;
                                        }
                                        // For other staff routes, check if current path starts with this path
                                        // and is not the root dashboard
                                        const isPrefixMatch = location.pathname.startsWith(path) && location.pathname !== '/dashboard';
                                        return `nav-item${isPrefixMatch ? ' nav-item--active' : ''}`;
                                    }}
                                    title={!(sidebarOpen || sidebarMobile) ? label : undefined}
                                    onClick={() => setSidebarMobile(false)}
                                >
                                    <Icon size={18} className="nav-icon" aria-hidden="true" />
                                    {(sidebarOpen || sidebarMobile) && (
                                        <span className="nav-label">{label}</span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Sidebar footer */}
                <div className="sidebar-footer">
                    <button className="sidebar-logout" onClick={handleLogout} aria-label="Logout">
                        <LogOut size={17} aria-hidden="true" />
                        {(sidebarOpen || sidebarMobile) && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* ═══════════════════════════════
                MAIN AREA
            ═══════════════════════════════ */}
            <div className="main-area">

                {/* Removed floating mobile handle in favor of topbar hamburger menu */}
                {/* ── Top Header ── */}
                <header className="topbar" style={{ justifyContent: 'space-between' }} role="banner">
                    
                    {/* Mobile Hamburger Menu / Logo */}
                    <div className="topbar-left">
                        {!isUserView ? (
                            <button 
                                className="mobile-menu-btn mobile-only" 
                                onClick={() => setSidebarMobile(true)}
                                aria-label="Open mobile menu"
                            >
                                <Menu size={24} />
                            </button>
                        ) : (
                            <div className="mobile-logo mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                                <img src={logo} alt="DasMom+" style={{ width: '28px', height: '28px' }} />
                                <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '18px', letterSpacing: '-0.5px' }}>DASMOM<span style={{color: 'var(--color-rose)'}}>+</span></span>
                            </div>
                        )}
                    </div>

                    {/* Right side */}
                    <div className="topbar-right">
                        {/* Notifications */}
                        <div className="topbar-notif-wrap">
                            <button
                                className="topbar-icon-btn"
                                onClick={() => setNotifOpen((v) => !v)}
                                aria-label="Notifications"
                                aria-expanded={notifOpen}
                            >
                                <Bell size={19} />
                                {notifCount > 0 && (
                                    <span className="notif-badge">{notifCount}</span>
                                )}
                            </button>
                            {notifOpen && !isUserView && (
                                <div className="notif-panel" role="dialog" aria-label="Notifications">
                                    <div className="notif-header">
                                        <h3>Notifications</h3>
                                        <div className="notif-header-actions">
                                            <select 
                                                className="notif-filter-select"
                                                value={notifFilter}
                                                onChange={(e) => setNotifFilter(e.target.value)}
                                            >
                                                <option value="all">All</option>
                                                <option value="appointments">Appointments</option>
                                                <option value="inventory">Inventory</option>
                                                <option value="patients">Patients</option>
                                            </select>
                                            <button onClick={() => setNotifOpen(false)} aria-label="Close">
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className="notif-list">
                                        {notifications.length === 0 ? (
                                            <li className="notif-empty">No notifications</li>
                                        ) : (
                                            notifications
                                                .filter(n => notifFilter === 'all' || n.category === notifFilter)
                                                .map((n, i) => (
                                                    <li key={i} className={`notif-item notif-item--${n.type}`}>
                                                        <span className="notif-dot" aria-hidden="true" />
                                                        <div>
                                                            <p>{n.text}</p>
                                                            <time>{n.time}</time>
                                                        </div>
                                                    </li>
                                                ))
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* User profile */}
                        <div className="topbar-user-wrap" style={{ position: 'relative' }} ref={userMenuRef}>
                            <div className="topbar-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                                <div className="user-avatar" aria-hidden="true">
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'User')}&background=b9818a&color=fff`} alt={user?.fullName || 'User'} className="user-avatar-img" />
                                </div>
                                <div className="user-info">
                                    <span className="user-name">{user?.fullName || 'User'}</span>
                                    {!isUserView && (
                                        <span className="user-role">
                                            <Shield size={10} aria-hidden="true" />
                                            {user?.role?.toUpperCase() || 'STAFF'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {userMenuOpen && (
                                <div className="user-menu-panel">
                                    <div className="user-menu-header">
                                        <p className="user-menu-name">{user?.fullName || 'User'}</p>
                                        <p className="user-menu-email">{user?.email || 'user@example.com'}</p>
                                    </div>
                                    <div className="user-menu-links">
                                        <button className="user-menu-item" onClick={() => {
                                            navigate(isUserView ? '/mother-home/user-account' : '/dashboard/settings?tab=profile');
                                            setUserMenuOpen(false);
                                        }}>
                                            <Users size={15} /> View Account
                                        </button>
                                        <button className="user-menu-item" onClick={() => {
                                            navigate(isUserView ? '/mother-home/user-settings' : '/dashboard/settings');
                                            setUserMenuOpen(false);
                                        }}>
                                            <Settings size={15} /> Settings
                                        </button>
                                    </div>
                                    <div className="user-menu-footer">
                                        <button className="user-menu-logout" onClick={handleLogout}>
                                            <LogOut size={15} /> Logout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <NotificationPermissionModal
                    isOpen={showPermissionModal}
                    onAllow={() => handleNotificationPermission(true)}
                    onDismiss={() => handleNotificationPermission(false)}
                    onClose={() => handleNotificationPermission(false)}
                />

                {/* ── Page Content ── */}
                <main className="page-content" id="main-content" tabIndex={-1}>
                    <Outlet />
                </main>

                {/* ── Mobile Bottom Navigation (User View) ── */}
                {isUserView && (
                    <nav className="mobile-bottom-nav">
                        <NavLink to="/mother-home" end className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <LayoutDashboard size={20} />
                            <span>Home</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-appointments" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <CalendarCheck size={20} />
                            <span>Visits</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-vitals" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <Activity size={20} />
                            <span>Records</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-vaccinations" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <Syringe size={20} />
                            <span>Vaccines</span>
                        </NavLink>
                        <button className={`bottom-nav-item ${mobileMoreOpen ? 'active' : ''}`} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}>
                            <Menu size={20} />
                            <span>More</span>
                        </button>
                    </nav>
                )}

                {/* ── Mobile More Menu Overlay ── */}
                {isUserView && mobileMoreOpen && (
                    <div className="mobile-more-overlay" onClick={() => setMobileMoreOpen(false)}>
                        <div className="mobile-more-menu" onClick={e => e.stopPropagation()}>
                            <div className="mobile-more-header">
                                <h3>More Options</h3>
                                <button className="mobile-more-close" onClick={() => setMobileMoreOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mobile-more-content">
                                <NavLink to="/mother-home/user-delivery-info" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><HeartPulse size={18} /></div>
                                    <span>Pregnancy Information</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-tips" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><FileText size={18} /></div>
                                    <span>Daily Health Tips</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-account" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><Users size={18} /></div>
                                    <span>My Profile</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-settings" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><Settings size={18} /></div>
                                    <span>Settings</span>
                                </NavLink>
                            </div>
                        </div>
                    </div>
                )}
            </div>



            {/* ── Mother Portal AI Chat Assistant ── */}
            {isUserView && <MotherAIChatAssistant />}
        </div>
    );
};

export default DashboardLayout;
