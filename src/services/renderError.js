const ERRORS = {
    401: {
        title: 'Authentication Required',
        message: 'Please sign in to continue.',
        icon: 'bi-key'
    },
    403: {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        icon: 'bi-shield-lock'
    },
    404: {
        title: 'Page Not Found',
        message: 'The page you requested does not exist.',
        icon: 'bi-search'
    },
    500: {
        title: 'Internal Server Error',
        message: 'An unexpected error occurred.',
        icon: 'bi-exclamation-triangle'
    }
};

module.exports = (res, code, overrides = {}) => {
    const error = ERRORS[code] || ERRORS[500];

    return res.status(code).render('errors/index.njk', {
        code,
        ...error,
        ...overrides
    });
};