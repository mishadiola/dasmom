import React, { useState, useEffect, useRef, useContext } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, User, Baby, AlertTriangle, CalendarCheck,
    HeartPulse, Syringe, Truck, Activity, BarChart3, Settings,
    Bell, LogOut, Menu, X, ChevronLeft, ChevronRight, Search, Shield,
    MapPin, FileText, Stethoscope, RefreshCw, ClipboardList, Package, Languages, Check
} from 'lucide-react';
import '../styles/layouts/DashboardLayout.css';
import logo from '../assets/images/dasmom_logo.png';
import { AuthContext } from '../context/AuthContext';
import PatientService from '../services/patientservice';
import supabase from '../config/supabaseclient';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import MotherAIChatAssistant from '../components/MotherDashboard/MotherAIChatAssistant';

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
    const [notifFilter, setNotifFilter] = useState('active');
    const [notifications, setNotifications] = useState([]);
    const [notifCount, setNotifCount] = useState(0);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
    const userMenuRef = useRef(null);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout: authLogout } = useContext(AuthContext);
    const { confirm } = useModal();
    const { language, toggleLanguage, t } = useLanguage();
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

    // Click outside or press Esc to close notifications panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setNotifOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setNotifOpen(false);
            }
        };

        if (notifOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [notifOpen]);

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
                        id,
                        patient_id,
                        visit_date,
                        patient_basic_info (first_name, last_name, barangay)
                    `)
                    .eq('visit_date', today)
                    .limit(5);

                if (todayAppts && todayAppts.length > 0) {
                    todayAppts.forEach(appt => {
                        const patient = appt.patient_basic_info;
                        notifList.push({
                            category: 'appointments',
                            type: 'info',
                            text: `Prenatal visit scheduled today for ${patient?.first_name} ${patient?.last_name}`,
                            time: 'Today',
                            targetPath: '/dashboard/prenatal',
                            targetState: { highlightVisitId: appt.id, patientId: appt.patient_id }
                        });
                    });
                }

                // Fetch missed appointments (past visits not completed)
                const { data: missedAppts } = await supabase
                    .from('prenatal_visits')
                    .select(`
                        id,
                        patient_id,
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
                            time: 'Missed',
                            targetPath: '/dashboard/prenatal',
                            targetState: { highlightVisitId: appt.id, patientId: appt.patient_id, filterStatus: 'Upcoming' }
                        });
                    });
                }

                // Fetch low stock inventory items (≤20% = low stock)
                const { data: inventory } = await supabase
                    .from('vaccine_inventory')
                    .select('id, vaccine_name, quantity, max_quantity')
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
                                time: 'Inventory',
                                targetPath: '/dashboard/inventory',
                                targetState: { highlightItemId: item.id }
                            });
                        });
                }

                // Fetch high-risk patients from prenatal_visits (calculated_risk is in prenatal_visits, not pregnancy_info)
                const { data: highRiskPatients } = await supabase
                    .from('prenatal_visits')
                    .select(`
                        id,
                        patient_id,
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
                            time: patient.patient_basic_info.barangay,
                            targetPath: '/dashboard/patients',
                            targetState: { highlightPatientId: patient.patient_id }
                        });
                    });
                }

                // Process and resolve status
                const resolvedIds = JSON.parse(window.localStorage.getItem('dasmom.resolvedNotifs') || '[]');
                
                notifList.forEach(n => {
                    const idString = `${n.category}_${n.text}_${n.targetPath}`;
                    // Simple hash or encode for safe ID
                    n.id = btoa(encodeURIComponent(idString));
                    n.isResolved = resolvedIds.includes(n.id);
                });

                setNotifications(notifList);
                setNotifCount(notifList.filter(n => !n.isResolved).length);

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

    const handleNotificationClick = (notif) => {
        setNotifOpen(false);
        if (notif.targetPath) {
            navigate(notif.targetPath, { state: notif.targetState });
        }
    };

    const handleResolve = (id) => {
        const resolvedIds = JSON.parse(window.localStorage.getItem('dasmom.resolvedNotifs') || '[]');
        if (!resolvedIds.includes(id)) {
            resolvedIds.push(id);
            window.localStorage.setItem('dasmom.resolvedNotifs', JSON.stringify(resolvedIds));
            
            // Update local state
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isResolved: true } : n));
            setNotifCount(prev => Math.max(0, prev - 1));
        }
    };

    const handleLogout = async () => {
        setUserMenuOpen(false);
        const confirmed = await confirm({
            title: isUserView ? t('confirm_logout_title') : 'Confirm Logout',
            text: isUserView ? t('confirm_logout_text') : 'Are you sure you want to log out of DasMom+? You will need to login again to access the system.',
            confirmText: isUserView ? t('confirm_logout_yes') : 'Yes, Logout',
            cancelText: isUserView ? t('confirm_logout_no') : 'Stay Logged In',
            iconType: 'logout'
        });
        
        if (confirmed) {
            await authLogout();
            navigate(isUserView ? '/mother-login' : '/');
        }
    };

    // Filter nav items based on view
    const canViewReports = ['admin', 'cho personnel'].includes(String(user?.role || '').toLowerCase());
    const filteredNavItems = isUserView ? [
        {
            section: t('nav_section_dashboard'),
            items: [
                { label: t('nav_home'), icon: LayoutDashboard, path: '/mother-home' },
                { label: t('nav_my_vitals'), icon: Activity, path: '/mother-home/user-vitals' },
                { label: t('nav_appointments'), icon: CalendarCheck, path: '/mother-home/user-appointments' },
            ]
        },
        {
            section: t('nav_section_health'),
            items: [
                { label: t('nav_pregnancy_tips'), icon: HeartPulse, path: '/mother-home/user-tips' },
                { label: t('nav_vaccination_info'), icon: Syringe, path: '/mother-home/user-vaccinations' },
                { label: t('nav_delivery_info'), icon: ClipboardList, path: '/mother-home/user-delivery-info' },
            ]
        }
    ] : NAV_ITEMS.filter(group => group.section !== 'Reports' || canViewReports);

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
                        {(sidebarOpen || sidebarMobile) && <span>{isUserView ? t('nav_logout') : 'Logout'}</span>}
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
                        {/* Language Toggle - Mother side only */}
                        {isUserView && (
                            <button
                                className="lang-toggle-btn"
                                onClick={toggleLanguage}
                                aria-label={language === 'en' ? 'Switch to Filipino' : 'Switch to English'}
                                title={language === 'en' ? 'Switch to Filipino' : 'Switch to English'}
                            >
                                <Languages size={15} />
                                <span className="lang-label-full">{t('lang_switch_label')}</span>
                                <span className="lang-label-short">{t('lang_switch_label_short')}</span>
                            </button>
                        )}

                        {/* Notifications */}
                        <div className="topbar-notif-wrap" ref={notifRef}>
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
                                                <option value="active">Active</option>
                                                <option value="resolved">Resolved</option>
                                                <option value="all">All</option>
                                                <option value="appointments">Appointments (Active)</option>
                                                <option value="inventory">Inventory (Active)</option>
                                                <option value="patients">Patients (Active)</option>
                                            </select>
                                            <button onClick={() => setNotifOpen(false)} aria-label="Close">
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className="notif-list">
                                        {(() => {
                                            const filteredNotifs = notifications.filter(n => {
                                                if (notifFilter === 'active') return !n.isResolved;
                                                if (notifFilter === 'resolved') return n.isResolved;
                                                if (notifFilter === 'all') return true;
                                                return n.category === notifFilter && !n.isResolved;
                                            });

                                            if (filteredNotifs.length === 0) {
                                                return (
                                                    <li className="notif-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        <Check size={16} /> No {notifFilter === 'resolved' ? 'resolved' : 'active'} notifications
                                                    </li>
                                                );
                                            }

                                            return filteredNotifs.map((n, i) => (
                                                <li key={n.id || i} className={`notif-item notif-item--${n.type}`} onClick={() => handleNotificationClick(n)} style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span className="notif-dot" aria-hidden="true" style={{ opacity: n.isResolved ? 0.3 : 1 }} />
                                                    <div style={{ flex: 1, color: n.isResolved ? 'var(--color-text-muted)' : 'inherit' }}>
                                                        <p>{n.text}</p>
                                                        <time>{n.time}</time>
                                                    </div>
                                                    {!n.isResolved && (
                                                        <button
                                                            title="Mark as resolved"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleResolve(n.id);
                                                            }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--color-text-light)',
                                                                cursor: 'pointer',
                                                                padding: '6px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '50%',
                                                                marginLeft: '8px'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-light)'}
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                    )}
                                                </li>
                                            ));
                                        })()}
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
                                            <User size={15} /> {isUserView ? t('menu_view_account') : 'My Profile'}
                                        </button>
                                        <button className="user-menu-item" onClick={() => {
                                            navigate(isUserView ? '/mother-home/user-settings' : '/dashboard/settings');
                                            setUserMenuOpen(false);
                                        }}>
                                            <Settings size={15} /> {isUserView ? t('menu_settings') : 'Settings'}
                                        </button>
                                    </div>
                                    <div className="user-menu-footer">
                                        <button className="user-menu-logout" onClick={handleLogout}>
                                            <LogOut size={15} /> {isUserView ? t('menu_logout') : 'Logout'}
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

                {/* ── Mobile Bottom Navigation (User View) ── */}
                {isUserView && (
                    <nav className="mobile-bottom-nav">
                        <NavLink to="/mother-home" end className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <LayoutDashboard size={20} />
                            <span>{t('bottom_home')}</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-appointments" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <CalendarCheck size={20} />
                            <span>{t('bottom_visits')}</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-vitals" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <Activity size={20} />
                            <span>{t('bottom_records')}</span>
                        </NavLink>
                        <NavLink to="/mother-home/user-vaccinations" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                            <Syringe size={20} />
                            <span>{t('bottom_vaccines')}</span>
                        </NavLink>
                        <button className={`bottom-nav-item ${mobileMoreOpen ? 'active' : ''}`} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}>
                            <Menu size={20} />
                            <span>{t('bottom_more')}</span>
                        </button>
                    </nav>
                )}

                {/* ── Mobile More Menu Overlay ── */}
                {isUserView && mobileMoreOpen && (
                    <div className="mobile-more-overlay" onClick={() => setMobileMoreOpen(false)}>
                        <div className="mobile-more-menu" onClick={e => e.stopPropagation()}>
                            <div className="mobile-more-header">
                                <h3>{t('more_options')}</h3>
                                <button className="mobile-more-close" onClick={() => setMobileMoreOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mobile-more-content">
                                <NavLink to="/mother-home/user-delivery-info" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><HeartPulse size={18} /></div>
                                    <span>{t('more_pregnancy_info')}</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-tips" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><FileText size={18} /></div>
                                    <span>{t('more_daily_tips')}</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-account" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><User size={18} /></div>
                                    <span>{t('more_my_profile')}</span>
                                </NavLink>
                                <NavLink to="/mother-home/user-settings" className="mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                                    <div className="mobile-more-icon-wrap"><Settings size={18} /></div>
                                    <span>{t('more_settings')}</span>
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
