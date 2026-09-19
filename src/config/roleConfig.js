export const getRoleConfig = (role) => {
  const configs = {
    admin: { redirect: '/dashboard', allowedPages: ['dashboard', 'reports', 'analytics'] },
    'cho personnel': { redirect: '/dashboard', allowedPages: ['dashboard', 'reports', 'analytics'] },
    staff: { redirect: '/dashboard', allowedPages: ['dashboard'] },
    mother: { redirect: '/mother-home', allowedPages: ['mother'] },
    patient: { redirect: '/mother-home', allowedPages: ['mother'] },
    user: { redirect: '/dashboard', allowedPages: [] }
  };
  return configs[role] || configs.user;
};