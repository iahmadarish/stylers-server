
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, 
  },
  message: {
    type: String,
    required: true,
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  orderNumber: String,
  link: String,
  type: {
    type: String,
    default: 'ORDER',
  },
  isRead: { // 
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;