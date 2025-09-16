import express from "express"
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  searchProducts,
  filterProducts,
  getProductsByParentCategory,
  getProductsBySubCategory,
  getProductsByDressType,
  getProductsByStyle,
  getProductsByHierarchy,
  getProductImagesByColor, // new added for by color wise filter
  getProductByIdOrSlug,
  getProductBasicInfo,
  getProductImages,
  getProductSpecifications,
  getProductPricing,
  // getProductReviewsBySlug
} from "../controllers/product.controller.js"
// import { getProductReviews } from "../controllers/review.controller.js"
import { protect, restrictTo } from "../middleware/auth.middleware.js"
import { productUpload } from "../utils/cloudinary.js"
import Product from "../models/Product.js"
import ParentCategory from "../models/ParentCategory.js"
import { getProductReviews } from "../controllers/review.controller.js"

const router = express.Router()

// Add this before your routes
router.options("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.status(200).end();
});

router.options("/:id", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.status(200).end();
});



// Public routes
router.get("/search", searchProducts)
router.get("/filter", filterProducts)
router.get("/featured", getFeaturedProducts)
router.get("/parent-category/:parentCategoryId", getProductsByParentCategory)
router.get("/sub-category/:subCategoryId", getProductsBySubCategory)
router.get("/dress-type/:dressTypeId", getProductsByDressType)
router.get("/style/:styleId", getProductsByStyle)
router.get("/hierarchy/:parentCategoryId/:subCategoryId?/:dressTypeId?/:styleId?", getProductsByHierarchy)

// 
router.get("/:id/images/:color", getProductImagesByColor)


router.get("/", getProducts)
router.get("/:productId/reviews", getProductReviews)

router.get('/by-sub/:subId', async (req, res) => {
  try {
    const products = await Product.find({ 
      subCategoryId: req.params.subId,
      isActive: true 
    }).populate('parentCategoryId subCategoryId');

    res.json({ 
      success: true,
      products 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/by-parent/:parentId', async (req, res) => {
  try {
    const parent = await ParentCategory.findById(req.params.parentId)
      .populate({
        path: 'subcategories',
        populate: {
          path: 'products',
          match: { isActive: true }
        }
      })
      .populate('products');

    const allProducts = [
      ...parent.products,
      ...parent.subcategories.flatMap(sub => sub.products)
    ];

    res.json({ 
      success: true,
      products: allProducts 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:idOrSlug", getProductByIdOrSlug);


router.get("/:slug/basic", getProductBasicInfo);
router.get("/:slug/images", getProductImages);
router.get("/:slug/specifications", getProductSpecifications);
router.get("/:slug/pricing", getProductPricing);
// router.get("/:slug/reviews", getProductReviewsBySlug);
router.get("/:slug/reviews", getProductReviews)


// আপনার product routes এ নিচের মতো করে প্রাইস ফেচ করুন
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found"
      });
    }

    // রিয়েল-টাইম প্রাইস ক্যালকুলেট করুন
    const realTimePrice = product.getCurrentPrice();
    const variantsWithRealTimePrices = product.variants.map(variant => ({
      ...variant.toObject(),
      realTimePrice: product.getCurrentPrice(variant._id)
    }));

    res.status(200).json({
      status: "success",
      data: {
        product: {
          ...product.toObject(),
          price: realTimePrice,
          variants: variantsWithRealTimePrices
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};


// Admin routes
router.use(protect)
router.use(restrictTo("admin", "executive"))
router.post("/", productUpload.array("images", 50), createProduct)
router.route("/:id")
  .patch(productUpload.array("images", 10), updateProduct)
  .delete(deleteProduct)

export default router