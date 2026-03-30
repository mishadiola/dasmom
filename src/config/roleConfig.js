export const ROLE_CONFIG = {
    patient: {
        redirect: '/dashboard/user-vaccinations',
        allowedPages: ['mother']
    },
    admin: {
        redirect: '/dashboard',
        allowedPages: ['admin']
    },
    staff: {
        redirect: '/dashboard',
        allowedPages: ['admin']
    }
};

//unknown roles
export const getRoleConfig = (role) => {
    return ROLE_CONFIG[role] || {
        redirect: '/unauthorized',
        allowedPages: []
    };
};