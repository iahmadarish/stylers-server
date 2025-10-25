import Notification from '../models/Notification.js';


export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({})
            .sort({ timestamp: -1 })
            .limit(50);
        const unreadCount = await Notification.countDocuments({ isRead: false });

        res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        const unreadCount = await Notification.countDocuments({ isRead: false });
        res.json({
            success: true,
            notification,
            unreadCount
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};