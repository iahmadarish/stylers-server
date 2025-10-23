import { getIo } from "./socket.js"; 
import User from "../models/User.js"; 

/**
 * Creates and emits a real-time notification for a newly created or updated order.
 * @param {object} order - The Mongoose Order document.
 * @param {string} type - The type of order (e.g., 'COD', 'ONLINE', 'GUEST').
 */
export const emitOrderNotification = async (order, type = 'ONLINE') => {
    try {
        const io = getIo(); 
        let customerName = order.shippingAddress.fullName || `a ${type} Customer`;
        if (order.userId) {
            const user = await User.findById(order.userId, 'name');
            if (user && user.name) {
                customerName = user.name;
            }
        }
        const notificationMessage = `New ${type} Order #${order.orderNumber} placed by ${customerName}`;
        const notificationData = {
            message: notificationMessage,
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            timestamp: new Date().toISOString(),
            link: `/orders/${order._id}`,
            paymentMethod: `${type} Payment`,
            customerName: customerName,
        };
        const notification = new Notification({
            message: notificationData.message,
            orderId: order._id,
            orderNumber: order.orderNumber,
            link: notificationData.link,
            type: 'ORDER', 
            isRead: false, 
        });
        await notification.save();
        
        io.emit('newOrderNotification', { 
            ...notificationData, 
            _id: notification._id, 
            isRead: false
        }); 
        
        console.log(`[Socket.IO] Emitted and saved new ${type} order notification: ${order.orderNumber}`);

    } catch (socketError) {
        console.error(`[Socket.IO] Error emitting/saving notification for ${type} Order:`, socketError.message);
    }
};