// import cron from 'node-cron';
// import User from '../models/User.js'; 
// import AppError from "./appError.js"

// const deleteExpiredUnverifiedUsers = async () => {
//     try {
//         const result = await User.deleteMany({
//             isVerified: false,
//             $or: [
//                 { emailOTPExpires: { $lt: Date.now() } },
//                 { phoneOTPExpires: { $lt: Date.now() } }
//             ]
//         });

//         console.log(`🧹 Cron Job: Deleted ${result.deletedCount} expired unverified users.`);
//     } catch (error) {
//         console.error('❌ Cron Job Error: Failed to delete expired users.', error);
//     }
// };

// export const startCronJobs = () => {
//     cron.schedule('*/30 * * * *', () => {
//         console.log('⏰ Running scheduled task: Deleting expired unverified users...');
//         deleteExpiredUnverifiedUsers();
//     });
// };




// utils/cronJobs.js (ব্যবহারকারীদের দেওয়া কোড সহ)

import cron from 'node-cron';
import User from '../models/User.js'; 
// campaignCronJob.js থেকে ফাংশনটি ইম্পোর্ট করুন
import { runCampaignDiscountJob } from './campaignCronJob.js'; 


// 1. Unverified User Deletion Logic (আপনার দেওয়া কোড)
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
    // 1. Unverified User Cron (প্রতি ৩০ মিনিটে)
    cron.schedule('* * * * *', () => {
        console.log('⏰ Running scheduled task: Deleting expired unverified users...');
        deleteExpiredUnverifiedUsers();
    });

    // 2. Campaign/Discount Cron (আপনার প্রয়োজন অনুযায়ী সময়সূচী, যেমন প্রতি ৫ মিনিটে)
    cron.schedule('* * * * *', () => { 
        console.log('💰 Running scheduled task: Campaign and Discount Update...');
        runCampaignDiscountJob();
    });

    console.log('✅ All Cron Jobs Scheduled: User Cleanup (30m) & Campaign Update (5m).');
};