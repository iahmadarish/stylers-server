import mongoose from 'mongoose';
import TrendingOffer from '../models/TrendingOffer.js';

const seedOffers = [
  {
    brand: "PAARÉL",
    title: "DROP SHOULDER TEE",
    discount: "40% off",
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/6_t0e6jd.png",
    link: "/products/men/t-shirt",
    order: 0,
    isActive: true
  },
  {
    brand: "PAARÉL", 
    title: "DROP SHOULDER TEE", 
    discount: "40% off",
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/1_nfzza4.png",
    link: "/products/men/t-shirt",
    order: 1,
    isActive: true
  },
  // ... add all other offers
];

const seedDatabase = async () => {
  try {
    await mongoose.connect('mongodb+srv://imishaqbd:care2trainingdev@cluster0.klofv.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');

    await TrendingOffer.deleteMany({});
    console.log('✅ Cleared existing offers');

    await TrendingOffer.insertMany(seedOffers);
    console.log('✅ Trending offers seeded successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();