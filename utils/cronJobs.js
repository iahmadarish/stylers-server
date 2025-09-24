import cron from 'node-cron';
import User from '../models/User.js'; 
import AppError from "./appError.js"

const deleteExpiredUnverifiedUsers = async () => {
    try {
        const result = await User.deleteMany({
            isVerified: false,
            $or: [
                { emailOTPExpires: { $lt: Date.now() } },
                { phoneOTPExpires: { $lt: Date.now() } }
            ]
        });

        console.log(`🧹 Cron Job: Deleted ${result.deletedCount} expired unverified users.`);
    } catch (error) {
        console.error('❌ Cron Job Error: Failed to delete expired users.', error);
    }
};

export const startCronJobs = () => {
    cron.schedule('*/30 * * * *', () => {
        console.log('⏰ Running scheduled task: Deleting expired unverified users...');
        deleteExpiredUnverifiedUsers();
    });
};

