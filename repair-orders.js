import mongoose from 'mongoose';
import Order from './models/Order.js';
import Product from './models/Product.js';
import ParentCategory from './models/ParentCategory.js';
import SubCategory from './models/SubCategory.js';
import DressType from './models/DressType.js';
import Style from './models/Style.js';


const repairOrders = async () => {
  try {
    // আপনার MongoDB connection string দিয়ে replace করুন
    await mongoose.connect('mongodb+srv://stylersoutfit:JvsZ68lDMaAHMOe1@cluster0.fogeg0e.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB...');
    
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders to repair`);

    let repairedCount = 0;

    for (const order of orders) {
      let orderUpdated = false;
      
      for (const item of order.items) {
        if (item.variantId && (!item.variantDetails || !item.variantDetails.size)) {
          try {
            const product = await Product.findById(item.productId);
            if (product && product.variants) {
              const variant = product.variants.id(item.variantId);
              if (variant) {
                item.variantDetails = {
                  productCode: variant.productCode || '',
                  colorCode: variant.colorCode || '',
                  colorName: variant.colorName || '',
                  size: variant.size || '',
                  dimension: variant.dimension || '',
                  stock: variant.stock || 0,
                  stockStatus: variant.stockStatus || 'in_stock',
                  price: variant.price || product.basePrice,
                  discountPercentage: variant.discountPercentage || 0
                };
                orderUpdated = true;
                console.log(`✅ Updated variant: ${variant.size} in order ${order.orderNumber}`);
              }
            }
          } catch (error) {
            console.log(`❌ Could not repair item in order ${order.orderNumber}:`, error.message);
          }
        }
      }

      if (orderUpdated) {
        await order.save();
        repairedCount++;
        console.log(`💾 Order ${order.orderNumber} saved successfully`);
      }
    }

    console.log(`\n🎉 Repair completed!`);
    console.log(`Total orders processed: ${orders.length}`);
    console.log(`Orders repaired: ${repairedCount}`);
    console.log(`Orders unchanged: ${orders.length - repairedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

repairOrders();