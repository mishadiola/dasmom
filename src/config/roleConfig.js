export const getRoleConfig = (role) => {
  const configs = {
    admin: { redirect: '/dashboard', allowedPages: ['admin'] },
    mother: { redirect: '/dashboard/mother-home', allowedPages: ['mother'] },
    user: { redirect: '/dashboard', allowedPages: [] }
  };
  return configs[role] || configs.user;
};