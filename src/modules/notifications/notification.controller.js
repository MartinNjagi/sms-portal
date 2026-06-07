const goEngineWrapper = require('../../services/goEngineWrapper');

const notificationsController = {};

notificationsController.renderNotificationsPage = async (req, res, next) => {
    try {
        // Go side already differentiates admin vs client on GET /notifications
        const notifications = await goEngineWrapper.getNotifications(req);

        res.render('notifications/index.njk', {
            title: 'Notification Centre',
            alias: 'notifications',
            user: req.user,
            notifications,
        });
    } catch (error) {
        next(error);
    }
};

notificationsController.getNotifications = async (req, res, next) => {
    try {
        const { user_id, page } = req.query;
        const result = await goEngineWrapper.getNotifications(req, { user_id, page });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

notificationsController.markRead = async (req, res, next) => {
    try {
        const result = await goEngineWrapper.markNotificationRead(req, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

notificationsController.markAllRead = async (req, res, next) => {
    try {
        const result = await goEngineWrapper.markAllNotificationsRead(req);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

module.exports = notificationsController;