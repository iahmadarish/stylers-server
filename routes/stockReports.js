import express from "express";
import Product from "../models/Product.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, admin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      lowStockOnly = false 
    } = req.query;
    
    let query = { isActive: true };
    
    if (status) {
      query.stockStatus = status;
    }
    
    if (lowStockOnly === "true") {
      query.stockStatus = "low_stock";
    }
    
    const products = await Product.find(query)
      .select("title stock stockStatus lowStockThreshold variants")
      .sort({ stock: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(query);
    
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