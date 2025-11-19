// reassignOrders.js
import mongoose from "mongoose";

import Order from "../models/Order.js"; 

const OLD_USER_ID_STRING = "68d40e7920eda385add68b25";
const NEW_USER_ID_STRING = "691d9322b8b7a47764d96068";
const TARGET_EMAIL = "niharikanitu20@gmail.com"; 

const MONGODB_URI = "mongodb+srv://imishaqbd:care2trainingdev@cluster0.klofv.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0"; 

async function reassignOrdersToNewUser() {
    console.log("👉 অর্ডার রি-অ্যাসাইনমেন্ট প্রক্রিয়া শুরু হচ্ছে...");
    
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB তে সফলভাবে কানেক্ট করা হয়েছে।");

    const oldUserId = new mongoose.Types.ObjectId(OLD_USER_ID_STRING);
    const newUserId = new mongoose.Types.ObjectId(NEW_USER_ID_STRING);

    const filter = {
        isGuestOrder: false, 
        userId: oldUserId, 
        "shippingAddress.email": TARGET_EMAIL 
    };


    const update = {
        $set: { 
            userId: newUserId 
        }
    };

    try {
        const result = await Order.updateMany(filter, update);

        console.log("------------------------------------------");
        console.log(`✅ অপারেশন সফলভাবে সম্পন্ন হয়েছে!`);
        console.log("------------------------------------------");
        console.log(`🔍 ম্যাচিং অর্ডার পাওয়া গেছে: ${result.matchedCount}`);
        console.log(`✏️ সফলভাবে আপডেট করা হয়েছে: ${result.modifiedCount}`);
        console.log(`Status: ${result.matchedCount === result.modifiedCount ? 'সব অর্ডার অ্যাসাইন করা হয়েছে।' : 'কিছু অর্ডার আপডেট হয়নি বা পাওয়া যায়নি।'}`);
        console.log("------------------------------------------");

    } catch (error) {
        console.error("❌ অর্ডার রি-অ্যাসাইন করার সময় মারাত্মক ত্রুটি হয়েছে:", error);
    } finally {
        await mongoose.disconnect();
        console.log("👋 MongoDB কানেকশন বন্ধ করা হলো।");
    }
}

reassignOrdersToNewUser();