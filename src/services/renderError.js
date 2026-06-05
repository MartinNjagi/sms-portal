const ERRORS = {
    401: {
        title: 'Authentication Required',
        message: 'Please sign in to continue.',
        icon: 'bi-key',
        actionUrl: '/login',
        actionText: 'Go to Login'
    },
    403: {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        icon: 'bi-shield-lock',
        actionUrl: '/login',
        actionText: 'Go to Login'
    },
    404: {
        title: 'Page Not Found',
        message: 'The page you requested does not exist.',
        icon: 'bi-search',
        actionUrl: '/dashboard',
        actionText: 'Return to Dashboard'
    },
    500: {
        title: 'Internal Server Error',
        message: 'An unexpected error occurred.',
        icon: 'bi-exclamation-triangle',
        actionUrl: '/dashboard',
        actionText: 'Return to Dashboard'
    }
};

module.exports = (res, code, overrides = {}) => {
    // Fall back to 500 if an unknown error code is passed
    const error = ERRORS[code] || ERRORS[500];

    return res.status(code).render('errors/index.njk', {
        code,
        ...error,
        ...overrides
    });
};