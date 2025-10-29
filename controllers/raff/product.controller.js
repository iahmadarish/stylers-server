import Product from "../models/Product.js"
import ParentCategory from "../models/ParentCategory.js"
import SubCategory from "../models/SubCategory.js"
import DressType from "../models/DressType.js"
import Style from "../models/Style.js"
import Review from "../models/Review.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import { deleteImage, getPublicIdFromUrl } from "../utils/cloudinary.js"
import mongoose from "mongoose"
import { generateProductCode } from "../utils/productCodeGenerator.js" // Declare the generateProductCode function
import { checkAndNotifyStockStatus } from "../utils/stockNotifier.js"


// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    console.log("[DEBUG] Starting product creation...")
    console.log("[DEBUG] Request body keys:", Object.keys(req.body))
    console.log("[DEBUG] Files received:", req.files?.length || 0)

    // Parse product data from form data
    const productData = JSON.parse(req.body.productData)
    const uploadedFiles = req.files || []

    console.log("[DEBUG] Parsed product data:", productData)

    // Required fields validation
    const requiredFields = [
      "title",
      "description",
      "brand",
      "parentCategoryId",
      "subCategoryId",
      "dressTypeId",
      "styleId",
      "basePrice",
      "gender",
    ]

    for (const field of requiredFields) {
      if (!productData[field]) {
        console.log("[DEBUG] Missing required field:", field)
        return res.status(400).json({
          status: "error",
          message: `${field} is required`,
        })
      }
    }

    // Process images from uploaded files
    const images = []

    uploadedFiles.forEach((file, index) => {
      const colorCode = req.body[`imageColorCode_${index}`] || "#000000"
      const colorName = req.body[`imageColorName_${index}`] || "Unknown Color"

      images.push({
        url: file.path, // This will be the path where multer saved the file
        colorCode,
        colorName,
      })
    })

    console.log("[DEBUG] Processed images:", images.length)

    // Validate that we have at least one image
    if (images.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one image is required",
      })
    }

    // Validate that all color groups have images
    const colorGroupsInForm = new Set()
    images.forEach((img) => colorGroupsInForm.add(img.colorCode))

    console.log("[DEBUG] Available color codes in images:", Array.from(colorGroupsInForm))

    // Check if any color in variants doesn't have images
    if (productData.variants && productData.variants.length > 0) {
      console.log("[DEBUG] Validating variants against images...")
      for (const variant of productData.variants) {
        console.log("[DEBUG] Checking variant color:", variant.colorCode, variant.colorName)
        if (!colorGroupsInForm.has(variant.colorCode)) {
          return res.status(400).json({
            status: "error",
            message: `No images found for color: ${variant.colorName} (${variant.colorCode})`,
          })
        }
      }
    }

    // Create slug from title
    const slug = productData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    console.log("[DEBUG] Generated slug:", slug)

    let totalStock = 0
    const processedVariants = []

    if (productData.variants && productData.variants.length > 0) {
      console.log("[DEBUG] Processing variants:", productData.variants.length)

      for (let index = 0; index < productData.variants.length; index++) {
        const variant = productData.variants[index]
        console.log("[DEBUG] Processing variant", index, ":", variant)

        // Validate required fields
        if (!variant.colorCode || !variant.colorName || !variant.sizes || variant.sizes.length === 0) {
          console.log("[DEBUG] Invalid variant data:", variant)
          return res.status(400).json({
            status: "error",
            message: `Variant ${index + 1} is missing required fields (colorCode, colorName, or sizes)`,
          })
        }

        // Process sizes inside the variant
        variant.sizes.forEach((s) => {
          const variantData = {
            productCode: variant.productCode || generateProductCode(),
            colorCode: variant.colorCode,
            colorName: variant.colorName,
            size: s.size,
            dimension: s.dimension || "",
            stock: Number.parseInt(s.stock) || 0,
          }

          // okay: ONLY set variant-specific pricing if explicitly provided
          if (variant.basePrice !== undefined && variant.basePrice !== null && variant.basePrice !== "") {
            variantData.basePrice = Number.parseFloat(variant.basePrice)
          }

          // okay: CRITICAL FIX: Only set discount fields if explicitly provided
          // If discountPercentage is provided (even 0), set it explicitly
          if (variant.hasOwnProperty('discountPercentage')) {
            const discountPercentage = Number.parseFloat(variant.discountPercentage) || 0
            variantData.discountPercentage = discountPercentage

            if (discountPercentage > 0) {
              variantData.discountStartTime = variant.discountStartTime ? new Date(variant.discountStartTime) : undefined
              variantData.discountEndTime = variant.discountEndTime ? new Date(variant.discountEndTime) : undefined
            } else {
              // Explicitly set to 0 to prevent product-level discount inheritance
              variantData.discountPercentage = 0
              variantData.discountStartTime = null
              variantData.discountEndTime = null
            }
          } else {
            // okay: IMPORTANT: If discountPercentage is NOT provided in the form data,
            // set to null to explicitly indicate NO discount should be applied
            variantData.discountPercentage = null
            variantData.discountStartTime = null
            variantData.discountEndTime = null
          }

          processedVariants.push(variantData)
          totalStock += Number.parseInt(s.stock) || 0
          console.log("[DEBUG] Added variant:", variantData)
        })
      }
    }

    console.log("[DEBUG] Total processed variants:", processedVariants.length)
    console.log("[DEBUG] Total stock calculated:", totalStock)

    // Validate that we have at least one variant if variants are provided
    if (productData.variants && productData.variants.length > 0 && processedVariants.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one valid variant is required",
      })
    }

    // okay: CRITICAL FIX: Proper discount time handling
    const discountStartTime = productData.discountStartTime ? new Date(productData.discountStartTime) : undefined
    const discountEndTime = productData.discountEndTime ? new Date(productData.discountEndTime) : undefined

    // okay: IMPORTANT: Validate discount times if discount is provided
    const discountPercentage = Number.parseFloat(productData.discountPercentage) || 0
    if (discountPercentage > 0) {
      if (!discountStartTime || !discountEndTime) {
        return res.status(400).json({
          status: "error",
          message: "Discount start time and end time are required when discount percentage is set",
        })
      }
      if (discountEndTime <= discountStartTime) {
        return res.status(400).json({
          status: "error",
          message: "Discount end time must be after start time",
        })
      }
    }

    // Create the product object
    const newProduct = new Product({
      title: productData.title,
      description: productData.description,
      brand: productData.brand,
      slug,
      bulletPoints: productData.bulletPoints?.filter((point) => point.trim() !== "") || [],
      parentCategoryId: productData.parentCategoryId,
      subCategoryId: productData.subCategoryId,
      dressTypeId: productData.dressTypeId,
      styleId: productData.styleId,
      basePrice: Number.parseFloat(productData.basePrice),
      // okay: CRITICAL: Set discount fields properly
      discountPercentage: discountPercentage,
      discountStartTime: discountStartTime,
      discountEndTime: discountEndTime,
      images,
      variants: processedVariants,
      stock: totalStock,
      weight: productData.weight ? Number.parseFloat(productData.weight) : undefined,
      material: productData.material,
      pattern: productData.pattern,
      gender: productData.gender,
      isFeatured: productData.isFeatured || false,
      metaTitle: productData.metaTitle,
      metaDescription: productData.metaDescription,
      specifications:
        productData.specifications?.filter(
          (spec) => spec.key && spec.value && spec.key.trim() !== "" && spec.value.trim() !== "",
        ) || [],
      video: productData.video,
    })

    console.log("[DEBUG] Product object before save:", {
      basePrice: newProduct.basePrice,
      discountPercentage: newProduct.discountPercentage,
      discountStartTime: newProduct.discountStartTime,
      discountEndTime: newProduct.discountEndTime,
      variantsCount: newProduct.variants.length,
    })

    console.log("[DEBUG] About to save product...")

    // okay: IMPORTANT: Save the product - this will trigger pre-save hooks for price calculation
    const savedProduct = await newProduct.save()

    console.log("[DEBUG] Product saved successfully with calculated prices:")
    console.log("[DEBUG] Main price:", savedProduct.price)
    console.log("[DEBUG] Variants with prices:", savedProduct.variants?.map((v) => ({
      colorName: v.colorName,
      size: v.size,
      basePrice: v.basePrice,
      price: v.price,
      discountPercentage: v.discountPercentage,
    })))

    // Populate the category references for the response
    await savedProduct.populate("parentCategoryId subCategoryId dressTypeId styleId")

    res.status(201).json({
      status: "success",
      message: "Product created successfully",
      data: {
        product: savedProduct,
      },
    })
  } catch (error) {
    console.error("[DEBUG] Error creating product:", error)

    // Handle duplicate key errors (like duplicate slug)
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "A product with this title already exists",
      })
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors,
      })
    }

    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// @desc    Get all products
// @route   GET /api/products
// @access  Public
// export const getProducts = catchAsync(async (req, res, next) => {
//   // Build filter object
//   const filter = {}

//   if (!req.user || req.user.role !== "admin") {
//     // নন-অ্যাডমিনদের জন্য ডিফল্ট ফিল্টার
//     filter.isActive = true
//   } else {
//     // অ্যাডমিনদের জন্য: isActive কোয়েরি প্যারামিটার চেক করো
//     if (req.query.isActive !== undefined) {
//       filter.isActive = req.query.isActive === "true"
//     }
//     // যদি অ্যাডমিন কোনো কোয়েরি না পাঠায়, filter এ isActive থাকবে না, ফলে সব প্রোডাক্ট দেখাবে
//   }

//   if (req.query.parentCategoryId) {
//     filter.parentCategoryId = req.query.parentCategoryId
//   } else if (req.query.parentCategory) {
//     const parentCategory = await ParentCategory.findOne({ slug: req.query.parentCategory })
//     if (parentCategory) {
//       filter.parentCategoryId = parentCategory._id
//       console.log(`Found parent category: ${parentCategory.name} (${parentCategory._id})`)
//     } else {
//       console.log(`Parent category not found for slug: ${req.query.parentCategory}`)
//     }
//   }

//   // Handle sub category filtering (by slug or ObjectId)
//   if (req.query.subCategoryId) {
//     filter.subCategoryId = req.query.subCategoryId
//   } else if (req.query.subCategory) {
//     const subCategory = await SubCategory.findOne({ slug: req.query.subCategory })
//     if (subCategory) {
//       filter.subCategoryId = subCategory._id
//       console.log(`Found sub category: ${subCategory.name} (${subCategory._id})`)
//     } else {
//       console.log(`Sub category not found for slug: ${req.query.subCategory}`)
//     }
//   }

//   // Handle dress type filtering (by slug or ObjectId)
//   if (req.query.dressTypeId) {
//     filter.dressTypeId = req.query.dressTypeId
//   } else if (req.query.dressType) {
//     const dressType = await DressType.findOne({ slug: req.query.dressType })
//     if (dressType) {
//       filter.dressTypeId = dressType._id
//       console.log(`Found dress type: ${dressType.name} (${dressType._id})`)
//     } else {
//       console.log(`Dress type not found for slug: ${req.query.dressType}`)
//     }
//   }

//   // Handle style filtering (by slug or ObjectId)
//   if (req.query.styleId) {
//     filter.styleId = req.query.styleId
//   } else if (req.query.style) {
//     const style = await Style.findOne({ slug: req.query.style })
//     if (style) {
//       filter.styleId = style._id
//       console.log(`Found style: ${style.name} (${style._id})`)
//     } else {
//       console.log(`Style not found for slug: ${req.query.style}`)
//     }
//   }

//   // Color filtering
//   if (req.query.color) {
//     filter["images.colorName"] = { $regex: req.query.color, $options: "i" }
//   }

//   // okay: NEW: Product code filtering
//   if (req.query.productCode) {
//     filter["variants.productCode"] = req.query.productCode
//   }

//   // Other filters
//   if (req.query.gender) filter.gender = req.query.gender
//   if (req.query.brand) filter.brand = req.query.brand
//   if (req.query.isFeatured) filter.isFeatured = req.query.isFeatured === "true"

//   // Price range filter (using calculated price)
//   if (req.query.minPrice || req.query.maxPrice) {
//     filter.price = {}
//     if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice)
//     if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice)
//   }

//   // Search by title, description, or product code
//   if (req.query.search) {
//     filter.$or = [
//       { title: { $regex: req.query.search, $options: "i" } },
//       { description: { $regex: req.query.search, $options: "i" } },
//       { "variants.productCode": { $regex: req.query.search, $options: "i" } },
//     ]
//   }

//   // Debug logging
//   console.log("Received query params:", req.query)
//   console.log("Applied filter:", JSON.stringify(filter, null, 2))

//   // Pagination
//   const page = Number.parseInt(req.query.page, 10) || 1
//   const limit = Number.parseInt(req.query.limit, 10) || 10
//   const skip = (page - 1) * limit

//   // Sorting
//   const sortBy = req.query.sortBy || "createdAt"
//   const sortOrder = req.query.sortOrder === "asc" ? 1 : -1
//   const sort = { [sortBy]: sortOrder }

//   // Execute query with variants
//   const products = await Product.find(filter)
//   .select('title slug basePrice price discountPercentage images.url images.colorCode parentCategoryId subCategoryId isFeatured')
//     .sort(sort)
//     .skip(skip)
//     .limit(limit)
//     .populate([
//       { path: "parentCategoryId", select: "name slug" },
//       { path: "subCategoryId", select: "name slug" },
//       { path: "dressTypeId", select: "name slug" },
//       { path: "styleId", select: "name slug" },
//     ])

//   // Get total count for pagination
//   const total = await Product.countDocuments(filter)

//   console.log(`Found ${products.length} products out of ${total} total`)

//   res.status(200).json({
//     status: "success",
//     results: products.length,
//     pagination: {
//       total,
//       page,
//       limit,
//       pages: Math.ceil(total / limit),
//     },
//     data: {
//       products,
//     },
//   })
// })




export const getProducts = catchAsync(async (req, res, next) => {
  // Build filter object
  const filter = {}

  // ✅ Admin vs User access control
  if (!req.user || req.user.role !== "admin") {
    filter.isActive = true
  } else {
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true"
    }
  }

  // ✅ Advanced filtering (your existing code)
  if (req.query.parentCategoryId) {
    filter.parentCategoryId = req.query.parentCategoryId
  } else if (req.query.parentCategory) {
    const parentCategory = await ParentCategory.findOne({ slug: req.query.parentCategory })
    if (parentCategory) {
      filter.parentCategoryId = parentCategory._id
    }
  }

  // ... আপনার সব existing filters (subCategory, dressType, style, color, etc.)

  // ✅ Price range filter
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {}
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice)
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice)
  }

  // ✅ Search
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
      { "variants.productCode": { $regex: req.query.search, $options: "i" } },
    ]
  }

  // ✅ Pagination
  const page = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit

  // ✅ Smart sorting - latest first by default, but flexible
  const sortBy = req.query.sortBy || "createdAt"
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  // ✅ Optimized query - variants সহ কিন্তু selective fields
  const products = await Product.find(filter)
    .select('+variants') // ✅ variants include
    .select('title slug basePrice price discountPercentage images variants isFeatured createdAt') // ✅必要なfields
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

  const total = await Product.countDocuments(filter)

  // ✅ Better debugging
  console.log('=== PRODUCTS WITH VARIANTS ===');
  const productsWithVariants = products.filter(p => p.variants && p.variants.length > 0);
  console.log(`Products with variants: ${productsWithVariants.length}/${products.length}`);

  res.status(200).json({
    status: "success",
    results: products.length,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    data: {
      products,
    },
  })
})


export const getAllProductsForAdmin = catchAsync(async (req, res, next) => {
  // Build filter object
  const filter = {}

  if (!req.user || req.user.role !== "admin") {
    // নন-অ্যাডমিনদের জন্য ডিফল্ট ফিল্টার
    filter.isActive = true
  } else {
    // অ্যাডমিনদের জন্য: isActive কোয়েরি প্যারামিটার চেক করো
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true"
    }
    // যদি অ্যাডমিন কোনো কোয়েরি না পাঠায়, filter এ isActive থাকবে না, ফলে সব প্রোডাক্ট দেখাবে
  }

  if (req.query.parentCategoryId) {
    filter.parentCategoryId = req.query.parentCategoryId
  } else if (req.query.parentCategory) {
    const parentCategory = await ParentCategory.findOne({ slug: req.query.parentCategory })
    if (parentCategory) {
      filter.parentCategoryId = parentCategory._id
      console.log(`Found parent category: ${parentCategory.name} (${parentCategory._id})`)
    } else {
      console.log(`Parent category not found for slug: ${req.query.parentCategory}`)
    }
  }

  // Handle sub category filtering (by slug or ObjectId)
  if (req.query.subCategoryId) {
    filter.subCategoryId = req.query.subCategoryId
  } else if (req.query.subCategory) {
    const subCategory = await SubCategory.findOne({ slug: req.query.subCategory })
    if (subCategory) {
      filter.subCategoryId = subCategory._id
      console.log(`Found sub category: ${subCategory.name} (${subCategory._id})`)
    } else {
      console.log(`Sub category not found for slug: ${req.query.subCategory}`)
    }
  }

  // Handle dress type filtering (by slug or ObjectId)
  if (req.query.dressTypeId) {
    filter.dressTypeId = req.query.dressTypeId
  } else if (req.query.dressType) {
    const dressType = await DressType.findOne({ slug: req.query.dressType })
    if (dressType) {
      filter.dressTypeId = dressType._id
      console.log(`Found dress type: ${dressType.name} (${dressType._id})`)
    } else {
      console.log(`Dress type not found for slug: ${req.query.dressType}`)
    }
  }

  // Handle style filtering (by slug or ObjectId)
  if (req.query.styleId) {
    filter.styleId = req.query.styleId
  } else if (req.query.style) {
    const style = await Style.findOne({ slug: req.query.style })
    if (style) {
      filter.styleId = style._id
      console.log(`Found style: ${style.name} (${style._id})`)
    } else {
      console.log(`Style not found for slug: ${req.query.style}`)
    }
  }

  // Color filtering
  if (req.query.color) {
    filter["images.colorName"] = { $regex: req.query.color, $options: "i" }
  }

  // okay: NEW: Product code filtering
  if (req.query.productCode) {
    filter["variants.productCode"] = req.query.productCode
  }

  // Other filters
  if (req.query.gender) filter.gender = req.query.gender
  if (req.query.brand) filter.brand = req.query.brand
  if (req.query.isFeatured) filter.isFeatured = req.query.isFeatured === "true"

  // Price range filter (using calculated price)
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {}
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice)
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice)
  }

  // Search by title, description, or product code
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
      { "variants.productCode": { $regex: req.query.search, $options: "i" } },
    ]
  }

  // Debug logging
  console.log("Received query params:", req.query)
  console.log("Applied filter:", JSON.stringify(filter, null, 2))

  // Pagination
  const page = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit

  // Sorting
  const sortBy = req.query.sortBy || "createdAt"
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  // Execute query with variants
  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

  // Get total count for pagination
  const total = await Product.countDocuments(filter)

  console.log(`Found ${products.length} products out of ${total} total`)

  res.status(200).json({
    status: "success",
    results: products.length,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    data: {
      products,
    },
  })
})

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProduct = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid product ID format", 400))
  }

  const product = await Product.findById(req.params.id).populate([
    { path: "parentCategoryId", select: "name slug" },
    { path: "subCategoryId", select: "name slug" },
    { path: "dressTypeId", select: "name slug" },
    { path: "styleId", select: "name slug" },
  ])

  if (!product) {
    return next(new AppError("Product not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  })
})


export const updateProduct = catchAsync(async (req, res, next) => {
  console.log("=== UPDATE PRODUCT START ===");
  console.log("Product ID:", req.params.id);
  console.log("Files received:", req.files ? req.files.length : 0);

  try {
    // Parse JSON data
    let productData;
    if (typeof req.body.productData === "string") {
      productData = JSON.parse(req.body.productData);
    } else {
      productData = req.body;
    }

    console.log("Parsed product data:", {
      variantsCount: productData.variants ? productData.variants.length : 0,
      deleteImagesCount: productData.deleteImages ? productData.deleteImages.length : 0,
      basePrice: productData.basePrice,
      discountPercentage: productData.discountPercentage,
      discountStartTime: productData.discountStartTime,
      discountEndTime: productData.discountEndTime,
    });

    // Get existing product
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    // Handle image deletions first
    if (productData.deleteImages && productData.deleteImages.length > 0) {
      console.log("Deleting images:", productData.deleteImages);
      for (const imageUrl of productData.deleteImages) {
        try {
          const publicId = getPublicIdFromUrl(imageUrl);
          await deleteImage(publicId);
          console.log("Deleted image:", imageUrl);
        } catch (error) {
          console.error("Error deleting image:", error);
        }
      }

      // Remove deleted images from existing product
      existingProduct.images = existingProduct.images.filter(
        (img) => !productData.deleteImages.includes(typeof img === "string" ? img : img.url)
      );
    }

    // Process new images and create proper image structure
    const processedImages = [...existingProduct.images]; // Start with remaining existing images

    if (req.files && req.files.length > 0) {
      console.log("Processing", req.files.length, "new files");

      // Add new images with proper structure
      req.files.forEach((file, fileIndex) => {
        const colorCode = req.body[`imageColorCode_${fileIndex}`] || "#000000";
        const colorName = req.body[`imageColorName_${fileIndex}`] || "Default";

        processedImages.push({
          url: file.path,
          colorCode: colorCode,
          colorName: colorName,
        });

        console.log("Added new image with color:", colorCode, colorName);
      });
    }
    // Update the product images
    existingProduct.images = processedImages;

    // okay: CRITICAL: Update product-level pricing with time validation
    if (productData.basePrice !== undefined) {
      existingProduct.basePrice = Number.parseFloat(productData.basePrice);
    }

    // okay: FIXED: Only update discount times if new values are explicitly provided
    if (productData.discountPercentage !== undefined) {
      const newDiscountPercentage = Number.parseFloat(productData.discountPercentage) || 0;
      existingProduct.discountPercentage = newDiscountPercentage;

      // Only update times if they are explicitly provided in the request
      if (productData.discountStartTime !== undefined) {
        existingProduct.discountStartTime = productData.discountStartTime
          ? new Date(productData.discountStartTime)
          : null;
      }

      if (productData.discountEndTime !== undefined) {
        existingProduct.discountEndTime = productData.discountEndTime
          ? new Date(productData.discountEndTime)
          : null;
      }

      // If discount is being set to 0, clear the times
      if (newDiscountPercentage <= 0) {
        existingProduct.discountStartTime = null;
        existingProduct.discountEndTime = null;
      }
    }

    // okay: Process variants with proper pricing logic
    if (productData.variants && Array.isArray(productData.variants)) {
      console.log("Processing variants:", productData.variants.length);

      const processedVariants = productData.variants.map((variant) => {
        const processedVariant = {
          _id: variant._id,
          colorCode: variant.colorCode || "#000000",
          colorName: variant.colorName || "Default",
          size: variant.size || "",
          dimension: variant.dimension || "",
          stock: Number.parseInt(variant.stock) || 0,
          productCode: variant.productCode || generateProductCode(),
        };
        if (variant.basePrice !== undefined && variant.basePrice !== null && variant.basePrice !== "") {
          processedVariant.basePrice = Number.parseFloat(variant.basePrice);
        }
        if (variant.discountPercentage !== undefined && variant.discountPercentage !== null && variant.discountPercentage !== "") {
          const newVariantDiscountPercentage = Number.parseFloat(variant.discountPercentage);

          if (newVariantDiscountPercentage <= 0) {
            processedVariant.discountPercentage = 0;
            processedVariant.discountStartTime = null;
            processedVariant.discountEndTime = null;
          } else {
            processedVariant.discountPercentage = newVariantDiscountPercentage;
            processedVariant.discountStartTime = variant.discountStartTime ? new Date(variant.discountStartTime) : new Date();
            processedVariant.discountEndTime = variant.discountEndTime ? new Date(variant.discountEndTime) : null;
          }
        }

        return processedVariant;
      });
      // Calculate total stock from variants
      const totalStock = processedVariants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
      existingProduct.variants = processedVariants;
      existingProduct.stock = totalStock;
      console.log("Processed variants with pricing:", processedVariants.length);
    }

    // Update other fields
    const excludedFields = [
      "variants",
      "images",
      "deleteImages",
      "price",
      "discountPercentage",
      "discountStartTime",
      "discountEndTime",
    ];

    if (productData.isActive !== undefined) {
      existingProduct.isActive = productData.isActive;
      console.log(`[DEBUG] Updating isActive to: ${productData.isActive}`);
    }

    Object.keys(productData).forEach((key) => {
      if (productData[key] !== undefined && !excludedFields.includes(key)) {
        existingProduct[key] = productData[key];
      }
    });

    //IMPORTANT: Save the product
    const updatedProduct = await existingProduct.save();

    await updatedProduct.populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ]);

    console.log("Product updated successfully with calculated prices:");
    console.log("Main price:", updatedProduct.price);
    console.log(
      "Variants with calculated prices:",
      updatedProduct.variants?.map((v) => ({
        colorName: v.colorName,
        size: v.size,
        basePrice: v.basePrice,
        price: v.price,
        discountPercentage: v.discountPercentage,
      }))
    );

    res.status(200).json({
      status: "success",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error",
    });
  }
});




// controllers/product.controller.js
export const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
  if (!product) {
    return next(new AppError("Product not found", 404))
  }
  // Delete all product images from cloudinary
  const allImages = []
  // Collect images from general images array
  if (product.images && product.images.length > 0) {
    allImages.push(...product.images.map((img) => img.url))
  }
  // Collect images from color variants
  if (product.colorVariants && product.colorVariants.length > 0) {
    product.colorVariants.forEach((color) => {
      if (color.images && color.images.length > 0) {
        allImages.push(...color.images)
      }
    })
  }
  // Delete all collected images
  for (const imageUrl of allImages) {
    try {
      const publicId = getPublicIdFromUrl(imageUrl)
      await deleteImage(publicId)
    } catch (error) {
      console.error("Error deleting image:", error)
    }
  }

  // Delete the product
  await Product.findByIdAndDelete(req.params.id)

  // FIX: Send proper JSON response instead of 204
  res.status(200).json({
    status: "success",
    message: "Product deleted successfully",
    data: null,
  })
})

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = catchAsync(async (req, res, next) => {
  const limit = Number.parseInt(req.query.limit, 10) || 10
  const products = await Product.find({ isFeatured: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  })
})

// get product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const product = await Product.findOne({ slug }).populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.status(200).json(product)
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    })
  }
}

// NEW: Get product by product code
export const getProductByCode = async (req, res) => {
  try {
    const { code } = req.params

    const product = await Product.findOne({ productCode: code }).populate([
      { path: "parentCategoryId", select: "name slug" },
      { path: "subCategoryId", select: "name slug" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.status(200).json(product)
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    })
  }
}

// endpoint for get image by color
export const getProductImagesByColor = async (req, res) => {
  try {
    const { id, color } = req.params
    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    const images = product.getImagesByColor(color)
    res.json({
      success: true,
      color,
      images,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

export const getProductsByHierarchy = async (req, res) => {
  try {
    const { parentCategoryId, subCategoryId, dressTypeId, styleId } = req.params
    const filter = { isActive: true }
    if (parentCategoryId) filter.parentCategoryId = parentCategoryId
    if (subCategoryId) filter.subCategoryId = subCategoryId
    if (dressTypeId) filter.dressTypeId = dressTypeId
    if (styleId) filter.styleId = styleId
    const products = await Product.find(filter).populate([
      { path: "parentCategoryId", select: "name slug image" },
      { path: "subCategoryId", select: "name slug image" },
      { path: "dressTypeId", select: "name slug" },
      { path: "styleId", select: "name slug" },
    ])

    res.json({ success: true, products })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Advance filtering system for frontend. Don't make any changes for this features.
export const searchProducts = async (req, res) => {
  try {
    const { q } = req.query

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      })
    }
    const products = await Product.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { material: { $regex: q, $options: "i" } },
        { "variants.productCode": { $regex: q, $options: "i" } }, // NEW: Search by variant product code
      ],
      isActive: true,
    }).populate("parentCategoryId subCategoryId dressTypeId styleId")

    res.json({
      success: true,
      count: products.length,
      products,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

export const filterProducts = async (req, res) => {
  try {
    const {
      parentCategoryId,
      subCategoryId,
      dressType,
      style,
      minPrice,
      maxPrice,
      gender,
      brand,
      material,
      color,
      isFeatured,
      limit = 12,
      page = 1,
      sort = "-createdAt",
    } = req.query

    console.log("Received filters:", req.query)
    const filter = { isActive: true }
    // Category filtering
    if (parentCategoryId) {
      if (mongoose.Types.ObjectId.isValid(parentCategoryId)) {
        filter.parentCategoryId = parentCategoryId
      } else {
        const parentCategory = await ParentCategory.findOne({ slug: parentCategoryId })
        if (parentCategory) {
          filter.parentCategoryId = parentCategory._id
        }
      }
    }
    if (subCategoryId) {
      if (mongoose.Types.ObjectId.isValid(subCategoryId)) {
        filter.subCategoryId = subCategoryId
      } else {
        const subCategory = await SubCategory.findOne({ slug: subCategoryId })
        if (subCategory) {
          filter.subCategoryId = subCategory._id
        }
      }
    }
    if (dressType) {
      const dressTypeDoc = await DressType.findOne({ slug: dressType })
      if (dressTypeDoc) {
        filter.dressTypeId = dressTypeDoc._id
      }
    }
    if (style) {
      const styleDoc = await Style.findOne({ slug: style })
      if (styleDoc) {
        filter.styleId = styleDoc._id
      }
    }
    // Color filtering
    if (color) {
      filter["images.colorName"] = { $regex: color, $options: "i" }
    }
    // Basic filtering
    if (gender) filter.gender = gender
    if (brand) filter.brand = { $regex: brand, $options: "i" }
    if (material) filter.material = { $regex: material, $options: "i" }
    if (isFeatured) filter.isFeatured = isFeatured === "true"
    // Price filtering (using calculated price)
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    // Pagination
    const skip = (page - 1) * limit
    const products = await Product.find(filter)
      .populate("parentCategoryId subCategoryId dressTypeId styleId")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
    const total = await Product.countDocuments(filter)
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    })
  } catch (error) {
    console.error("Filter products error:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

export const getProductsByParentCategory = async (req, res) => {
  try {
    const products = await Product.find({
      parentCategoryId: req.params.parentCategoryId,
      isActive: true,
    }).populate("parentCategoryId subCategoryId dressTypeId styleId")

    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductsBySubCategory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // URL থেকে page নাও, না থাকলে default 1
        const limit = parseInt(req.query.limit) || 12; // প্রতি পেজে ১২টি পণ্য দেখাও
        const skip = (page - 1) * limit;

        const baseQuery = { subCategoryId: req.params.subId, isActive: true };

        // ১. মোট পণ্য সংখ্যা গণনা করো (Pagination এর জন্য)
        const totalProducts = await Product.countDocuments(baseQuery);
        
        // ২. Query-তে limit() এবং skip() ব্যবহার করো
        const products = await Product.find(baseQuery)
            .select('title slug basePrice currentPrice discountPercentage images.color') // ❗ ৩. শুধুমাত্র প্রয়োজনীয় ফিল্ডগুলো নির্বাচন করো
            .populate({
                path: 'parentCategoryId subCategoryId',
                select: 'name slug' // ❗ Populated Field-এও শুধু প্রয়োজনীয় ফিল্ড নির্বাচন করো
            })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            products,
            totalProducts,
            totalPages: Math.ceil(totalProducts / limit),
            currentPage: page,
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export const getProductsByDressType = async (req, res) => {
  try {
    const products = await Product.find({
      dressTypeId: req.params.dressTypeId,
      isActive: true,
    }).populate("parentCategoryId subCategoryId dressTypeId styleId")

    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductsByStyle = async (req, res) => {
  try {
    const products = await Product.find({
      styleId: req.params.styleId,
      isActive: true,
    }).populate("parentCategoryId subCategoryId dressTypeId styleId")

    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductByIdOrSlug = catchAsync(async (req, res, next) => {
  console.log("[DEBUG] 🚨 HIT: Comprehensive Detail Route /:idOrSlug");
  const value = req.params.idOrSlug

  const populateFields = [
    { path: "parentCategoryId", select: "name slug" },
    { path: "subCategoryId", select: "name slug" },
    { path: "dressTypeId", select: "name slug" },
    { path: "styleId", select: "name slug" },
  ]

  let product

  if (mongoose.Types.ObjectId.isValid(value)) {
    product = await Product.findById(value).populate(populateFields).lean()
  }

  if (!product) {
    product = await Product.findOne({ slug: value }).populate(populateFields).lean()
  }

  if (!product) {
    return next(new AppError("Product not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: { product },
  })
})

// okay: OPTIMIZED LAZY LOADING ENDPOINTS
export const getProductBasicInfo = async (req, res) => {
  try {
    console.log("[DEBUG] ⚠️ HIT: Basic Info Route /:slug/basic");
    const { slug } = req.params

    const product = await Product.findOne({ slug })
      .select("title basePrice price discountPercentage productCode slug images hasColorVariants brand gender stock")
      .lean()

    if (!product) {
      return res.status(404).json({ status: "error", message: "Product not found" })
    }

    res.status(200).json({ status: "success", data: { product } })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
}

export const getProductImages = async (req, res) => {
  try {
    const { slug } = req.params

    const product = await Product.findOne({ slug }).select("images colorVariants hasColorVariants").lean()

    if (!product) {
      return res.status(404).json({ status: "error", message: "Product not found" })
    }

    res.status(200).json({
      status: "success",
      data: {
        images: product.images,
        colorVariants: product.colorVariants,
      },
    })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
}

export const getProductSpecifications = async (req, res) => {
  try {
    const { slug } = req.params

    const product = await Product.findOne({ slug })
      .select("material pattern weight specifications metaTitle metaDescription")
      .lean()

    if (!product) {
      return res.status(404).json({ status: "error", message: "Product not found" })
    }

    res.status(200).json({ status: "success", data: { specs: product } })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
}

export const getProductPricing = async (req, res) => {
  try {
    const { slug } = req.params

    const product = await Product.findOne({ slug })
      .select("basePrice discountPercentage discountStartTime discountEndTime variants images")
      .lean()

    if (!product) {
      return res.status(404).json({ status: "error", message: "Product not found" })
    }

    // okay: NEW: Calculate current price based on discount timing
    const now = new Date()
    let currentPrice = product.basePrice
    let isDiscountActive = false

    if (product.discountPercentage && product.discountStartTime && product.discountEndTime) {
      const startTime = new Date(product.discountStartTime)
      const endTime = new Date(product.discountEndTime)

      if (now >= startTime && now <= endTime) {
        isDiscountActive = true
        currentPrice = product.basePrice * (1 - product.discountPercentage / 100)
      }
    }

    // okay: NEW: Calculate variant prices with timing
    const variantsWithPricing = product.variants.map((variant) => {
      let variantPrice = variant.basePrice || product.basePrice
      let variantDiscountActive = false

      if (variant.discountPercentage && variant.discountStartTime && variant.discountEndTime) {
        const variantStartTime = new Date(variant.discountStartTime)
        const variantEndTime = new Date(variant.discountEndTime)

        if (now >= variantStartTime && now <= variantEndTime) {
          variantDiscountActive = true
          variantPrice = (variant.basePrice || product.basePrice) * (1 - variant.discountPercentage / 100)
        }
      } else if (isDiscountActive && !variant.basePrice) {
        // Use product discount if variant has no specific pricing
        variantPrice = currentPrice
        variantDiscountActive = true
      }

      return {
        ...variant,
        currentPrice: variantPrice,
        isDiscountActive: variantDiscountActive,
      }
    })

    res.status(200).json({
      status: "success",
      data: {
        pricing: {
          basePrice: product.basePrice,
          currentPrice,
          discountPercentage: product.discountPercentage,
          isDiscountActive,
          discountStartTime: product.discountStartTime,
          discountEndTime: product.discountEndTime,
          variants: variantsWithPricing,
          images: product.images,
        },
      },
    })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
}

export const getProductReviewsBySlug = async (req, res) => {
  try {
    const { slug } = req.params

    const product = await Product.findOne({ slug }).select("_id")
    if (!product) {
      return res.status(404).json({ status: "error", message: "Product not found" })
    }

    const reviews = await Review.find({ productId: product._id, isApproved: true })
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    res.status(200).json({ status: "success", data: { reviews } })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
}
