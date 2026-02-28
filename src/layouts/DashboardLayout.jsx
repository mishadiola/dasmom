import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Baby, AlertTriangle, CalendarCheck,
    HeartPulse, Syringe, Truck, Activity, BarChart3, Settings,
    Bell, LogOut, Menu, X, ChevronLeft, Search, Shield,
    MapPin, FileText, Stethoscope
} from 'lucide-react';
import '../styles/layouts/DashboardLayout.css';
import logo from '../assets/images/dasmom_logo.png';

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
            { label: 'Pregnancy Tracking', icon: HeartPulse, path: '/dashboard/pregnancy' },
            { label: 'High Risk Cases', icon: AlertTriangle, path: '/dashboard/high-risk' },
            { label: 'Prenatal Visits', icon: CalendarCheck, path: '/dashboard/prenatal' },
            { label: 'Postpartum Records', icon: FileText, path: '/dashboard/postpartum' },
        ],
    },
    {
        section: 'Health Programs',
        items: [
            { label: 'Vaccinations & Supplements', icon: Syringe, path: '/dashboard/vaccinations' },
            { label: 'Delivery Outcomes', icon: Stethoscope, path: '/dashboard/deliveries' },
            { label: 'Newborn Tracking', icon: Baby, path: '/dashboard/newborns' },
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

const MOCK_USER = {
    name: 'Maria Santos',
    role: 'CHO Staff',
    avatar: 'MS',
    notifications: 5,
};

const DashboardLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarMobile, setSidebarMobile] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => navigate('/login');

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
                    {NAV_ITEMS.map((group) => (
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
                                aria-label={`Notifications (${MOCK_USER.notifications} unread)`}
                                aria-expanded={notifOpen}
                            >
                                <Bell size={19} />
                                {MOCK_USER.notifications > 0 && (
                                    <span className="notif-badge" aria-hidden="true">
                                        {MOCK_USER.notifications}
                                    </span>
                                )}
                            </button>
                            {notifOpen && (
                                <div className="notif-panel" role="dialog" aria-label="Notifications">
                                    <div className="notif-header">
                                        <h3>Notifications</h3>
                                        <button onClick={() => setNotifOpen(false)} aria-label="Close">
                                            <X size={15} />
                                        </button>
                                    </div>
                                    <ul className="notif-list">
                                        {[
                                            { type: 'alert', text: 'Maria R. – BP critically high', time: '5 min ago' },
                                            { type: 'warning', text: 'TT Vaccine stock below threshold', time: '1 hr ago' },
                                            { type: 'info', text: '3 prenatal visits scheduled today', time: '2 hrs ago' },
                                            { type: 'warning', text: 'Ana Cruz missed her 32-week visit', time: 'Yesterday' },
                                            { type: 'info', text: 'New newborn registered – Brgy. 5', time: 'Yesterday' },
                                        ].map((n, i) => (
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
                        <div className="topbar-user">
                            <div className="user-avatar" aria-hidden="true">
                                {MOCK_USER.avatar}
                            </div>
                            <div className="user-info">
                                <span className="user-name">{MOCK_USER.name}</span>
                                <span className="user-role">
                                    <Shield size={10} aria-hidden="true" />
                                    {MOCK_USER.role}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── Page Content ── */}
                <main className="page-content" id="main-content" tabIndex={-1}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
