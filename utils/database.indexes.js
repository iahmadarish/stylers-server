// Database indexes for better performance
import mongoose from "mongoose"

export const createProductIndexes = async () => {
  const Product = mongoose.model("Product")

  try {
    // Single field indexes
    await Product.createIndex({ slug: 1 })
    await Product.createIndex({ parentCategoryId: 1 })
    await Product.createIndex({ subCategoryId: 1 })
    await Product.createIndex({ isActive: 1 })
    await Product.createIndex({ isFeatured: 1 })
    await Product.createIndex({ createdAt: -1 })
    await Product.createIndex({ price: 1 })

    // Compound indexes for common queries
    await Product.createIndex({ parentCategoryId: 1, isActive: 1 })
    await Product.createIndex({ subCategoryId: 1, isActive: 1 })
    await Product.createIndex({ isActive: 1, isFeatured: 1 })
    await Product.createIndex({ parentCategoryId: 1, subCategoryId: 1, isActive: 1 })

    // Text index for search
    await Product.createIndex({
      title: "text",
      description: "text",
      brand: "text",
    })

    console.log("Product indexes created successfully")
  } catch (error) {
    console.error("Error creating indexes:", error)
  }
}

export const createReviewIndexes = async () => {
  const Review = mongoose.model("Review")

  try {
    await Review.createIndex({ productId: 1 })
    await Review.createIndex({ productId: 1, isApproved: 1 })
    await Review.createIndex({ createdAt: -1 })

    console.log("Review indexes created successfully")
  } catch (error) {
    console.error("Error creating review indexes:", error)
  }
}
