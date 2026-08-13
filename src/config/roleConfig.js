export const getRoleConfig = (role) => {
  const configs = {
    admin: { redirect: '/dashboard', allowedPages: ['admin'] },
    'cho personnel': { redirect: '/dashboard', allowedPages: ['admin'] },
    staff: { redirect: '/dashboard', allowedPages: ['admin'] },
    mother: { redirect: '/mother-home', allowedPages: ['mother'] },
    patient: { redirect: '/mother-home', allowedPages: ['mother'] },
    user: { redirect: '/dashboard', allowedPages: [] }
  };
  return configs[role] || configs.user;
};