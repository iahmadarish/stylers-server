import mongoose from 'mongoose';
import PageMeta from '../models/PageMeta.js';

const defaultPages = [
  {
    pageName: 'Home',
    pageSlug: 'paarel',
    metaTitle: 'PAARÉL|Best Online Clothing Store in Bangladesh',
    metaDescription: 'Shop the best online clothing store in Bangladesh – PAARÉL. Explore the premium men’s and women’s fashion with modern design, quality fabrics, and fast delivery.',
    metaKeywords: 'fashion, clothing, men fashion, women fashion, kids fashion, online shopping, stylehub, clothes, apparel',
    canonicalUrl: 'https://paarel.com/',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'About Us',
    pageSlug: 'about-stylers-outfit',
    metaTitle: 'PAARÉL | About Us – Modern Fashion & Stylish Clothing in Bangladesh',
    metaDescription: 'Learn about PAARÉL, a Bangladeshi fashion brand offering stylish, high-quality clothing for men, women, and kids with everyday comfort in mind.',
    metaKeywords: 'about us, our story, company mission, fashion brand, clothing store, stylehub about',
    canonicalUrl: 'https://paarel.com/about-stylers-outfit',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Blog',
    pageSlug: 'blog',
    metaTitle: 'PAARÉL Fashion Blog – Style Tips & Trends',
    metaDescription: 'Read PAARÉL’s blog for the latest fashion tips, styling ideas, and trends in Bangladesh, helping you stay stylish every day.',
    metaKeywords: 'fashion blog, style tips, fashion trends, outfit ideas, fashion news, style guide',
    canonicalUrl: 'https://paarel.com/blog',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Contact',
    pageSlug: 'contact',
    metaTitle: 'Get in Touch with PAARÉL – We are Here to Help',
    metaDescription: 'Have questions or need assistance? Reach out to PAARÉLs customer support for prompt and friendly service. We are here to help you.',
    metaKeywords: 'contact us, customer support, help, feedback, query, fashion store contact',
    canonicalUrl: 'https://paarel.com/contact',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Products',
    pageSlug: 'products',
    metaTitle: 'Shop PAARÉL – Trendy Apparel for Every Season',
    metaDescription: 'Discover PAARÉLs curated collection of mens, womens, and kids clothing Stylish, comfortable, and perfect for any occasion. Shop now!',
    metaKeywords: 'products, shop, collections, clothing, accessories, fashion items, online store',
    canonicalUrl: 'https://paarel.com/products/',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Privacy Policy',
    pageSlug: 'privacy-policy',
    metaTitle: 'PAARÉL Privacy Policy – Your Data, Our Care',
    metaDescription: 'Read PAARÉL’s privacy policy to understand how we protect your personal information and ensure a safe and secure shopping experience.',
    metaKeywords: 'privacy policy, data protection, personal information, privacy, terms',
    canonicalUrl: 'https://paarel.com/privacy-policy',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Terms of Service',
    pageSlug: 'terms-of-service',
    metaTitle: 'PAARÉL Terms of Service – Shop with Confidence',
    metaDescription: 'Review PAARÉL’s terms of service to understand your rights, our policies, and how we ensure a smooth and trustworthy shopping experience.',
    metaKeywords: 'terms of service, user agreement, terms and conditions, website terms',
    canonicalUrl: 'https://paarel.com/terms-and-condition',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Shipping Policy',
    pageSlug: 'shipping-policy',
    metaTitle: 'PAARÉL Shipping – Fast & Free Delivery Across Bangladesh',
    metaDescription: 'Enjoy free shipping on orders over TK 4,000. Fast delivery across Bangladesh with secure packaging and easy tracking. Shop with confidence at PAARÉL.',
    metaKeywords: 'shipping policy, delivery, shipping info, free shipping, international shipping',
    canonicalUrl: 'https://paarel.com/shipping',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Return Policy',
    pageSlug: 'return-policy',
    metaTitle: 'PAARÉL Return Policy – Easy & Hassle-Free Returns',
    metaDescription: 'Learn about PAARÉL’s return policy. Enjoy simple, hassle-free returns on your orders, ensuring a smooth and worry-free shopping experience.',
    metaKeywords: 'return policy, refund policy, returns, exchanges, money back',
    canonicalUrl: 'https://paarel.com/return-policy',
    isActive: true,
    lastUpdatedBy: 'system'
  }
];

const seedDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stylersoutfit:JvsZ68lDMaAHMOe1@cluster0.fogeg0e.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing page meta
    await PageMeta.deleteMany({});
    console.log('Cleared existing page meta data');

    // Insert default pages
    await PageMeta.insertMany(defaultPages);
    console.log('Page meta data seeded successfully');

    // Get count and display summary
    const pageCount = await PageMeta.countDocuments();
    const pages = await PageMeta.find().sort({ pageName: 1 });
    
    console.log(`Total pages seeded: ${pageCount}`);
    
    console.log('\n📋 Seeded Pages:');
    pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.pageName} - /${page.pageSlug}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.log('❌ Unhandled Rejection:', err);
  process.exit(1);
});

seedDatabase();