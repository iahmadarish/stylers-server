import mongoose from 'mongoose';
import HeroSlide from '../models/HeroSection.js';

const seedHeroSlides = [
  {
    title: "",
    subtitle: "Shop Now",
    year: "",
    description: "",
    desktopImage: "https://res.cloudinary.com/dcilg3xjd/image/upload/f_auto,q_auto,w_auto/v1758798928/Group_6_2_ughypg.png",
    mobileImage: "",
    category: "kids",
    link: "/products/men/denim-and-jeans",
    metaTitle: "Kids Fashion Collection",
    metaDescription: "Discover the latest kids fashion trends and comfortable clothing",
    order: 0,
    isActive: true
  },
  {
    title: "",
    subtitle: "Shop Now",
    year: "",
    description: "",
    desktopImage: "https://res.cloudinary.com/dm6lzpfxp/image/upload/f_auto,q_auto,w_auto/v1758812801/2_2200_x_1238_px_1_fjqbip.png",
    mobileImage: "",
    category: "men",
    link: "/products/men/t-shirt",
    metaTitle: "Men's T-Shirt Collection",
    metaDescription: "Explore premium quality men's t-shirts in various styles and colors",
    order: 1,
    isActive: true
  },
  {
    title: "",
    subtitle: "Shop Now",
    year: "",
    description: "",
    desktopImage: "https://res.cloudinary.com/dcilg3xjd/image/upload/f_auto,q_auto,w_auto/v1758795577/1_2200-1238_iatni1.png",
    mobileImage: "",
    category: "men",
    link: "/products/men/twill-chino-pants",
    metaTitle: "Men's Chino Pants",
    metaDescription: "Stylish and comfortable twill chino pants for men",
    order: 2,
    isActive: true
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect('mongodb+srv://imishaqbd:care2trainingdev@cluster0.klofv.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');

    // Clear existing slides
    await HeroSlide.deleteMany({});
    console.log('Cleared existing slides');

    // Insert new slides
    await HeroSlide.insertMany(seedHeroSlides);
    console.log('Hero slides seeded successfully');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();