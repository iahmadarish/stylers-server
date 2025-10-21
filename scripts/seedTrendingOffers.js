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
  {
    brand: "PAARÉL",
    title: "DROP SHOULDER TEE",
    discount: "40% off",
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/2_a1wwjp.png", 
    link: "/products/men/t-shirt",
    order: 2,
    isActive: true
  },
  {
    brand: "PAARÉL",
    title: "TWILL CHINO PANTS",
    discount: "40% off",
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/5_whrgex.png",
    link: "/products/men/twill-chino-pants",
    order: 3,
    isActive: true
  },
  {
    brand: "PAARÉL",
    title: "WASHED DENIM",
    discount: "40% off",
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/4_ryx2hl.png",
    link: "/products/men/denim-and-jeans",
    order: 4,
    isActive: true
  },
  {
    brand: "PAARÉL",
    title: "CARGO PANTS",
    discount: "40% off", 
    image: "https://res.cloudinary.com/dcilg3xjd/image/upload/v1758802934/3_o5mker.png",
    link: "/products/men/cargo-pants",
    order: 5,
    isActive: true
  }
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