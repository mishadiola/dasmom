export const getRoleConfig = (role) => {
  const configs = {
    admin: { redirect: '/dashboard', allowedPages: ['dashboard', 'reports', 'analytics'] },
    'cho personnel': { redirect: '/dashboard', allowedPages: ['dashboard', 'reports', 'analytics'] },
    staff: { redirect: '/dashboard', allowedPages: ['dashboard', 'reports'] },
    'station staff': { redirect: '/dashboard', allowedPages: ['dashboard', 'reports'] },
    mother: { redirect: '/mother-home', allowedPages: ['mother'] },
    patient: { redirect: '/mother-home', allowedPages: ['mother'] },
    user: { redirect: '/dashboard', allowedPages: [] }
  };
  const normalizedRole = String(role || 'user').trim().toLowerCase().replace(/_/g, ' ');
  if (configs[normalizedRole]) return configs[normalizedRole];
  return normalizedRole
    ? { redirect: '/dashboard', allowedPages: ['dashboard'] }
    : configs.user;
};