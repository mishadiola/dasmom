import React, { useState, useEffect, useRef, useContext } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Baby, AlertTriangle, CalendarCheck,
    HeartPulse, Syringe, Truck, Activity, BarChart3, Settings,
    Bell, LogOut, Menu, X, ChevronLeft, Search, Shield,
    MapPin, FileText, Stethoscope, RefreshCw, ClipboardList
} from 'lucide-react';
import '../styles/layouts/DashboardLayout.css';
import logo from '../assets/images/dasmom_logo.png';
import { AuthContext } from '../context/AuthContext';

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
            { label: 'Postpartum Records', icon: FileText, path: '/dashboard/postpartum' },
        ],
    },
    {
        section: 'Health Programs',
        items: [
            { label: 'Vaccines & Supplements', icon: Syringe, path: '/dashboard/vaccinations' },
            { label: 'Delivery Outcomes', icon: Stethoscope, path: '/dashboard/deliveries' },
            { label: 'Newborn Tracking', icon: Baby, path: '/dashboard/newborns' },
            { label: 'Pregnancy Resources', icon: HeartPulse, path: '/dashboard/resources' },
        ],
    },
    {
        section: 'Reports',
        items: [
            { label: 'Barangay Reports', icon: MapPin, path: '/dashboard/barangay' },
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
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const userMenuRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout: authLogout } = useContext(AuthContext);

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
                    <div className="sidebar-brand">
                        <img src={logo} alt="DasMom+" className="sidebar-logo" />
                        {sidebarOpen && (
                            <div className="sidebar-brand-text">
                                <span className="sidebar-brand-name">DasMom<span>+</span></span>
                                <span className="sidebar-brand-sub">Health System</span>
                            </div>
                        )}
                    </div>
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
                                    end={path === '/dashboard'}
                                    className={({ isActive }) =>
                                        `nav-item${isActive ? ' nav-item--active' : ''}`
                                    }
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

                {/* ── Top Header ── */}
                <header className="topbar" role="banner">
                    {/* Left side */}
                    <div className="topbar-left">
                        <button
                            className="topbar-menu-btn mobile-only"
                            onClick={() => setSidebarMobile(true)}
                            aria-label="Open navigation"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="topbar-search">
                            <Search size={15} className="search-icon" aria-hidden="true" />
                            <input
                                type="search"
                                placeholder="Search patient, barangay, ID…"
                                className="search-input"
                                aria-label="Search"
                            />
                        </div>
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
                                {/* Optional: notifications can be added back when data is available */}
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
                                                <option value="alert">Alerts</option>
                                                <option value="warning">Warnings</option>
                                                <option value="info">Info</option>
                                            </select>
                                            <button onClick={() => setNotifOpen(false)} aria-label="Close">
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className="notif-list">
                                        {[
                                            { type: 'alert', text: 'Maria R. – BP critically high', time: '5 min ago' },
                                            { type: 'warning', text: 'TT Vaccine stock below threshold', time: '1 hr ago' },
                                            { type: 'info', text: '3 prenatal visits scheduled today', time: '2 hrs ago' },
                                            { type: 'warning', text: 'Ana Cruz missed her 32-week visit', time: 'Yesterday' },
                                            { type: 'info', text: 'New newborn registered – Brgy. 5', time: 'Yesterday' },
                                        ].filter(n => notifFilter === 'all' || n.type === notifFilter).map((n, i) => (
                                            <li key={i} className={`notif-item notif-item--${n.type}`}>
                                                <span className="notif-dot" aria-hidden="true" />
                                                <div>
                                                    <p>{n.text}</p>
                                                    <time>{n.time}</time>
                                                </div>
                                            </li>
                                        ))}
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
