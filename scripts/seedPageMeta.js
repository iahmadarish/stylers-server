import mongoose from 'mongoose';
import PageMeta from '../models/PageMeta.js';

const defaultPages = [
  {
    pageName: 'Home',
    pageSlug: 'home',
    metaTitle: 'StyleHub - Fashion for Everyone | Online Clothing Store',
    metaDescription: 'Discover the latest fashion trends for men, women and kids. Shop from our exclusive collection of clothing, accessories and more with free shipping.',
    metaKeywords: 'fashion, clothing, men fashion, women fashion, kids fashion, online shopping, stylehub, clothes, apparel',
    canonicalUrl: 'https://yourstore.com',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'About Us',
    pageSlug: 'about-us',
    metaTitle: 'About StyleHub - Our Story & Mission | Fashion Store',
    metaDescription: 'Learn about StyleHub journey, our mission to provide quality fashion, and our commitment to customer satisfaction. Discover what makes us different.',
    metaKeywords: 'about us, our story, company mission, fashion brand, clothing store, stylehub about',
    canonicalUrl: 'https://yourstore.com/about-us',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Blog',
    pageSlug: 'blog',
    metaTitle: 'Fashion Blog - Latest Trends & Style Tips | StyleHub',
    metaDescription: 'Read our fashion blog for the latest style trends, outfit ideas, fashion tips, and industry insights. Stay updated with the fashion world.',
    metaKeywords: 'fashion blog, style tips, fashion trends, outfit ideas, fashion news, style guide',
    canonicalUrl: 'https://yourstore.com/blog',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Contact',
    pageSlug: 'contact',
    metaTitle: 'Contact Us - Get in Touch | StyleHub Customer Support',
    metaDescription: 'Contact StyleHub customer support for any queries, feedback, or assistance. We are here to help you with your fashion needs.',
    metaKeywords: 'contact us, customer support, help, feedback, query, fashion store contact',
    canonicalUrl: 'https://yourstore.com/contact',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Products',
    pageSlug: 'products',
    metaTitle: 'Products - Shop All Collections | StyleHub Fashion Store',
    metaDescription: 'Browse our complete product collection. Find men, women, and kids clothing, accessories, and more. Latest fashion at great prices.',
    metaKeywords: 'products, shop, collections, clothing, accessories, fashion items, online store',
    canonicalUrl: 'https://yourstore.com/products',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Privacy Policy',
    pageSlug: 'privacy-policy',
    metaTitle: 'Privacy Policy - Data Protection | StyleHub',
    metaDescription: 'Read our privacy policy to understand how we collect, use, and protect your personal information. Your privacy is important to us.',
    metaKeywords: 'privacy policy, data protection, personal information, privacy, terms',
    canonicalUrl: 'https://yourstore.com/privacy-policy',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Terms of Service',
    pageSlug: 'terms-of-service',
    metaTitle: 'Terms of Service - User Agreement | StyleHub',
    metaDescription: 'Review our terms of service to understand the rules and guidelines for using our website and services.',
    metaKeywords: 'terms of service, user agreement, terms and conditions, website terms',
    canonicalUrl: 'https://yourstore.com/terms-of-service',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Shipping Policy',
    pageSlug: 'shipping-policy',
    metaTitle: 'Shipping Policy - Delivery Information | StyleHub',
    metaDescription: 'Learn about our shipping policies, delivery times, shipping costs, and international shipping options.',
    metaKeywords: 'shipping policy, delivery, shipping info, free shipping, international shipping',
    canonicalUrl: 'https://yourstore.com/shipping-policy',
    isActive: true,
    lastUpdatedBy: 'system'
  },
  {
    pageName: 'Return Policy',
    pageSlug: 'return-policy',
    metaTitle: 'Return & Refund Policy | StyleHub Fashion Store',
    metaDescription: 'Understand our return and refund policy. Learn how to return items, eligibility criteria, and refund process.',
    metaKeywords: 'return policy, refund policy, returns, exchanges, money back',
    canonicalUrl: 'https://yourstore.com/return-policy',
    isActive: true,
    lastUpdatedBy: 'system'
  }
];

const seedDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://imishaqbd:care2trainingdev@cluster0.klofv.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0';
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