import express from "express";
import Product from "../models/Product.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// স্টক রিপোর্ট পাওয়ার জন্য (এডমিন Only)
router.get("/", protect, admin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      lowStockOnly = false 
    } = req.query;
    
    let query = { isActive: true };
    
    // স্ট্যাটাস অনুযায়ী ফিল্টার
    if (status) {
      query.stockStatus = status;
    }
    
    // শুধুমাত্র লো-স্টক প্রোডাক্ট দেখানোর জন্য
    if (lowStockOnly === "true") {
      query.stockStatus = "low_stock";
    }
    
    const products = await Product.find(query)
      .select("title stock stockStatus lowStockThreshold variants")
      .sort({ stock: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(query);
    
    // স্টক সামারি তৈরি করুন
    const stockSummary = {
      totalProducts: total,
      inStock: await Product.countDocuments({ ...query, stockStatus: "in_stock" }),
      lowStock: await Product.countDocuments({ ...query, stockStatus: "low_stock" }),
      outOfStock: await Product.countDocuments({ ...query, stockStatus: "out_of_stock" }),
      preOrder: await Product.countDocuments({ ...query, stockStatus: "pre_order" })
    };
    
    res.json({
      products,
      stockSummary,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;