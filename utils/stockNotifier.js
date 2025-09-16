import Product from "../models/Product.js"
import StockNotification from "../models/StockNotification.js"

// স্টক নোটিফিকেশন তৈরি এবং চেক করার ফাংশন
export const checkAndNotifyStockStatus = async (product, previousProduct = null) => {
  try {
    // যদি প্রোডাক্ট নতুন তৈরি হয়
    if (!previousProduct) {
      if (product.stockStatus === "out_of_stock" || product.stockStatus === "low_stock") {
        await createStockNotification(product, null, product.stockStatus)
      }
      return
    }

    // প্রোডাক্ট স্টক স্ট্যাটাস পরিবর্তন চেক করুন
    if (product.stockStatus !== previousProduct.stockStatus) {
      await createStockNotification(product, null, product.stockStatus)
    }

    // ভ্যারিয়েন্ট লেভেল স্টক স্ট্যাটাস পরিবর্তন চেক করুন
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const previousVariant = previousProduct.variants.id(variant._id)
        
        if (previousVariant && variant.stockStatus !== previousVariant.stockStatus) {
          await createStockNotification(product, variant, variant.stockStatus)
        }
      }
    }
  } catch (error) {
    console.error("Error in stock notification:", error)
  }
}

const createStockNotification = async (product, variant, type) => {
  let message = ""
  
  if (variant) {
    // ভ্যারিয়েন্ট নোটিফিকেশন
    if (type === "out_of_stock") {
      message = `${product.title} - ${variant.colorName} - ${variant.size} is out of stock`
    } else if (type === "low_stock") {
      message = `${product.title} - ${variant.colorName} - ${variant.size} is low on stock (${variant.stock} left)`
    } else if (type === "back_in_stock") {
      message = `${product.title} - ${variant.colorName} - ${variant.size} is back in stock`
    }
  } else {
    // প্রোডাক্ট নোটিফিকেশন
    if (type === "out_of_stock") {
      message = `${product.title} is out of stock`
    } else if (type === "low_stock") {
      message = `${product.title} is low on stock (${product.stock} left)`
    } else if (type === "back_in_stock") {
      message = `${product.title} is back in stock`
    } else if (type === "pre_order") {
      message = `${product.title} is available for pre-order`
    }
  }

  const notification = new StockNotification({
    productId: product._id,
    productTitle: product.title,
    variantId: variant ? variant._id : null,
    variantInfo: variant ? {
      colorCode: variant.colorCode,
      colorName: variant.colorName,
      size: variant.size
    } : null,
    type: type,
    message: message,
  })

  await notification.save()
  console.log("Stock notification created:", message)
}