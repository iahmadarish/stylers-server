// import mongoose from 'mongoose';
// import ParentCategory from '../models/ParentCategory.js';
// import SubCategory from '../models/SubCategory.js';
// import Product from '../models/Product.js';

// const fixAllReferences = async () => {
//   // ১. সাবক্যাটেগরি থেকে প্যারেন্ট ক্যাটেগরি আপডেট
//   const subCategories = await SubCategory.find();
//   for (const subCat of subCategories) {
//     await ParentCategory.findByIdAndUpdate(
//       subCat.parentCategoryId,
//       { $addToSet: { subcategories: subCat._id } }
//     );
//   }

//   // ২. প্রোডাক্ট থেকে প্যারেন্ট/সাব ক্যাটেগরি আপডেট
//   const products = await Product.find();
//   for (const product of products) {
//     await ParentCategory.findByIdAndUpdate(
//       product.parentCategoryId,
//       { $addToSet: { products: product._id } }
//     );
    
//     await SubCategory.findByIdAndUpdate(
//       product.subCategoryId,
//       { $addToSet: { products: product._id } }
//     );
//   }

//   console.log('✅ All references fixed successfully');
// };

// // ডাটাবেস কানেকশন
// mongoose.connect('mongodb+srv://stylersoutfit:JvsZ68lDMaAHMOe1@cluster0.fogeg0e.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
// .then(() => {
//   console.log('Connected to DB');
//   return fixAllReferences();
// })
// .then(() => process.exit(0))
// .catch(err => {
//   console.error('Error:', err);
//   process.exit(1);
// });


// const fixProductReferences = async () => {
//   const products = await Product.find({});
  
//   for (const product of products) {
//     // প্যারেন্ট ক্যাটেগরি আপডেট
//     await ParentCategory.findByIdAndUpdate(
//       product.parentCategoryId,
//       { $addToSet: { products: product._id } }
//     );

//     // সাবক্যাটেগরি আপডেট
//     await SubCategory.findByIdAndUpdate(
//       product.subCategoryId,
//       { $addToSet: { products: product._id } }
//     );

//     console.log(`Fixed references for product: ${product.title}`);
//   }
// };