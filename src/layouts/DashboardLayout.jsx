import React, { useState, useEffect, useRef, useContext } from 'react';
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
            { label: 'Newborn Tracking', icon: Baby, path: '/dashboard/newborns' },
            { label: 'Vaccines & Supplements', icon: Syringe, path: '/dashboard/vaccinations' },
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
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const userMenuRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout: authLogout } = useContext(AuthContext);
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

    // Fetch real notifications from database
    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user || isUserView) {
                setNotifications([]);
                setNotifCount(0);
                return;
            }

            try {
                const today = new Date().toISOString().split('T')[0];
                const notifList = [];

                // Fetch today's appointments
                const { data: todayAppts } = await supabase
                    .from('prenatal_visits')
                    .select(`
                        visit_date,
                        patient_basic_info (first_name, last_name, barangay)
                    `)
                    .eq('visit_date', today)
                    .limit(5);

                if (todayAppts && todayAppts.length > 0) {
                    notifList.push({
                        category: 'appointments',
                        type: 'info',
                        text: `${todayAppts.length} prenatal visit${todayAppts.length > 1 ? 's' : ''} scheduled today`,
                        time: 'Today'
                    });
                }

                // Fetch missed appointments (past visits not completed)
                const { data: missedAppts } = await supabase
                    .from('prenatal_visits')
                    .select(`
                        visit_date,
                        patient_basic_info (first_name, last_name)
                    `)
                    .lt('visit_date', today)
                    .eq('status', 'Upcoming')
                    .limit(3);

                if (missedAppts && missedAppts.length > 0) {
                    missedAppts.forEach(appt => {
                        const patient = appt.patient_basic_info;
                        notifList.push({
                            category: 'appointments',
                            type: 'warning',
                            text: `${patient?.first_name} ${patient?.last_name} missed prenatal visit`,
                            time: 'Missed'
                        });
                    });
                }

                // Fetch low stock inventory items (≤20% = low stock)
                const { data: inventory } = await supabase
                    .from('vaccine_inventory')
                    .select('vaccine_name, quantity, max_quantity')
                    .limit(100);

                if (inventory && inventory.length > 0) {
                    inventory
                        .filter(item => {
                            const percentage = (item.quantity / item.max_quantity) * 100;
                            return percentage > 0 && percentage <= 20; // Low stock: 1-20%
                        })
                        .slice(0, 5)
                        .forEach(item => {
                            const percentage = Math.round((item.quantity / item.max_quantity) * 100);
                            notifList.push({
                                category: 'inventory',
                                type: 'warning',
                                text: `${item.vaccine_name} low stock (${item.quantity}/${item.max_quantity} units - ${percentage}%)`,
                                time: 'Inventory'
                            });
                        });
                }

                // Fetch high-risk patients
                const { data: highRiskPatients } = await supabase
                    .from('pregnancy_info')
                    .select(`
                        calculated_risk,
                        patient_basic_info (first_name, last_name, barangay)
                    `)
                    .neq('calculated_risk', 'Normal')
                    .not('calculated_risk', 'is', null)
                    .limit(3);

                if (highRiskPatients && highRiskPatients.length > 0) {
                    highRiskPatients.forEach(patient => {
                        notifList.push({
                            category: 'patients',
                            type: 'alert',
                            text: `${patient.patient_basic_info.first_name} ${patient.patient_basic_info.last_name} - ${patient.calculated_risk}`,
                            time: patient.patient_basic_info.barangay
                        });
                    });
                }

                setNotifications(notifList);
                setNotifCount(notifList.length);

                // Set up real-time subscription for notifications
                const subscription = supabase
                    .channel('notifications-channel')
                    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                        fetchNotifications(); // Refresh notifications on any database change
                    })
                    .subscribe();

                return () => {
                    supabase.removeChannel(subscription);
                };

            } catch (error) {
                console.error('Error fetching notifications:', error);
                setNotifications([]);
                setNotifCount(0);
            }
        };

        fetchNotifications();
    }, [user, isUserView]);

    const handleLogout = () => {
        setShowLogoutModal(true);
        setUserMenuOpen(false);
    };

    const confirmLogout = async () => {
        setShowLogoutModal(false);
        await authLogout();
        navigate(isUserView ? '/mother-login' : '/');
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
                        {sidebarOpen && (
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
                            {sidebarOpen && (
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
                                    title={!sidebarOpen ? label : undefined}
                                    onClick={() => setSidebarMobile(false)}
                                >
                                    <Icon size={18} className="nav-icon" aria-hidden="true" />
                                    {sidebarOpen && (
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
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* ═══════════════════════════════
                MAIN AREA
            ═══════════════════════════════ */}
            <div className="main-area">

                {/* ── Mobile Sidebar Toggle Handle ── */}
                {!sidebarMobile && (
                    <div className="mobile-only" style={{
                        position: 'fixed',
                        top: '50%',
                        left: '0',
                        transform: 'translateY(-50%)',
                        zIndex: 45,
                    }}>
                        <button
                            onClick={() => setSidebarMobile(true)}
                            aria-label="Open sidebar"
                            style={{
                                background: 'var(--color-rose)',
                                color: 'white',
                                border: 'none',
                                padding: '16px 8px',
                                borderRadius: '0 8px 8px 0',
                                boxShadow: '3px 0 12px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}

                {/* ── Top Header ── */}
                <header className="topbar" style={{ justifyContent: 'flex-end' }} role="banner">

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

                {/* ── Page Content ── */}
                <main className="page-content" id="main-content" tabIndex={-1}>
                    <Outlet />
                </main>
            </div>

            {/* ── Logout Confirmation Modal ── */}
            {showLogoutModal && (
                <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}>
                    <div className="logout-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="logout-modal-icon">
                            <LogOut size={28} />
                        </div>
                        <h2 className="logout-modal-title">Confirm Logout</h2>
                        <p className="logout-modal-text">
                            Are you sure you want to log out of <strong>DasMom+</strong>? 
                            You will need to login again to access the system.
                        </p>
                        <div className="logout-modal-actions">
                            <button 
                                className="logout-btn-cancel" 
                                onClick={() => setShowLogoutModal(false)}
                            >
                                Stay Logged In
                            </button>
                            <button 
                                className="logout-btn-confirm" 
                                onClick={confirmLogout}
                            >
                                Yes, Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardLayout;
