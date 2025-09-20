import mongoose from "mongoose"
import slugify from "slugify"

const specificationSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
})

// Function to generate random product code
const generateProductCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random number
}

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    bulletPoints: [
      {
        type: String,
        trim: true,
      },
    ],
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentCategory",
      required: [true, "Parent category is required"],
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: [true, "Sub category is required"],
    },
    dressTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DressType",
      required: [true, "Dress type is required"],
    },
    styleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Style",
      required: [true, "Style is required"],
    },
    // ✅ Base price (original price before discount)
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Base price cannot be negative"],
    },
    // ✅ Calculated price after discount (basePrice - discount)
    price: {
      type: Number,
      min: [0, "Price cannot be negative"],
    },
    // ✅ Discount percentage (0-100) with timing
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, "Discount percentage cannot be negative"],
      max: [100, "Discount percentage cannot exceed 100"],
    },
    discountStartTime: {
      type: Date,
      validate: {
        validator: function (value) {
          // If discount percentage is set, start time should be provided
          if (this.discountPercentage > 0 && !value) {
            return false
          }
          return true
        },
        message: "Discount start time is required when discount percentage is set",
      },
    },
    discountEndTime: {
      type: Date,
      validate: {
        validator: function (value) {
          // If discount percentage is set, end time should be provided
          if (this.discountPercentage > 0 && !value) {
            return false
          }
          // End time should be after start time
          if (value && this.discountStartTime && value <= this.discountStartTime) {
            return false
          }
          return true
        },
        message: "Discount end time is required and must be after start time when discount percentage is set",
      },
    },
    images: [
      {
        url: {
          type: String,
          required: [true, "Image URL is required"],
        },
        colorCode: {
          type: String,
          required: false,
          default: "#000000",
        },
        colorName: {
          type: String,
          required: false,
          trim: true,
        },
      },
    ],
    // ✅ NEW: Variants with color + size combinations
    variants: [
      {
        productCode: {
          type: String,
          required: true,
          default: generateProductCode,
        },
        colorCode: {
          type: String,
          required: true,
          validate: {
            validator: function (value) {
              // Check if this color code exists in the images array
              const parent = this.parent()
              if (parent && parent.images) {
                return parent.images.some((img) => img.colorCode === value)
              }
              return true
            },
            message: "Color code must match one of the image color codes",
          },
        },
        colorName: {
          type: String,
          required: true,
          trim: true,
        },
        size: {
          type: String,
          required: true,
          trim: true,

        },
        dimension: {
          type: String,
          trim: true,
        },
        stock: {
          type: Number,
          required: true,
          min: [0, "Variant stock cannot be negative"],
          default: 0,
        },
        stockStatus: {
          type: String,
          enum: ["in_stock", "low_stock", "out_of_stock", "pre_order"],
          default: "in_stock",
          required: false
        },
        lowStockThreshold: {
          type: Number,
          default: 10,
          min: [0, "Low stock threshold cannot be negative"],
          required: false
        },
        allowBackorders: {
          type: Boolean,
          default: false,
          required: false
        },
        basePrice: {
          type: Number,
          min: [0, "Variant base price cannot be negative"],
          // Optional - will use product basePrice if not provided
        },
        price: {
          type: Number,
          min: [0, "Variant price cannot be negative"],
          // Will be calculated from basePrice and discount
        },
        discountPercentage: {
          type: Number,
          min: [0, "Variant discount percentage cannot be negative"],
          max: [100, "Variant discount percentage cannot exceed 100"],
          // Will use product discountPercentage if not provided
        },
        discountStartTime: {
          type: Date,
          validate: {
            validator: function (value) {
              if (this.discountPercentage > 0 && !value) {
                return false
              }
              return true
            },
            message: "Variant discount start time is required when discount percentage is set",
          },
        },
        discountEndTime: {
          type: Date,
          validate: {
            validator: function (value) {
              if (this.discountPercentage > 0 && !value) {
                return false
              }
              if (value && this.discountStartTime && value <= this.discountStartTime) {
                return false
              }
              return true
            },
            message:
              "Variant discount end time is required and must be after start time when discount percentage is set",
          },
        },
      },
    ],
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    weight: {
      type: Number,
      min: [0, "Weight cannot be negative"],
    },
    material: {
      type: String,
      trim: true,
    },
    pattern: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Men", "Women", "Kids", "Unisex"],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
    },
    specifications: [specificationSchema],
    video: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)


productSchema.methods.updateStockStatus = function () {
  // Product level stocck status 
  if (this.stock <= 0) {
    this.stockStatus = this.allowBackorders ? "pre_order" : "out_of_stock";
  } else if (this.stock <= this.lowStockThreshold) {
    this.stockStatus = "low_stock";
  } else {
    this.stockStatus = "in_stock";
  }

  // Variant level stock status 
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach(variant => {
      if (variant.stock <= 0) {
        variant.stockStatus = "out_of_stock";
      } else if (variant.stock <= this.lowStockThreshold) {
        variant.stockStatus = "low_stock";
      } else {
        variant.stockStatus = "in_stock";
      }
    });
  }
};

productSchema.pre("save", async  function (next) {
  console.log("=== PRE-SAVE HOOK TRIGGERED ===")

  // Generate slug from title
   if (this.isModified("title") || this.isNew) {
    let baseSlug = slugify(this.title, { lower: true });
    let finalSlug = baseSlug;
    let counter = 1;

    // Check if slug already exists
    while (true) {
      const existingProduct = await mongoose.models.Product.findOne({ slug: finalSlug });
      if (!existingProduct || (this._id && existingProduct._id.equals(this._id))) {
        break;
      }
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = finalSlug;
    console.log(`Generated slug: ${this.slug}`);
  }

  // ✅ Calculate main product price with time validation
  if (
    this.isModified("basePrice") ||
    this.isModified("discountPercentage") ||
    this.isModified("discountStartTime") ||
    this.isModified("discountEndTime") ||
    this.isNew // ✅ CRITICAL: Also trigger on new documents
  ) {
    console.log("Calculating main product price...")

    const now = new Date()
    const isDiscountActive =
      this.discountPercentage > 0 &&
      this.discountStartTime &&
      this.discountEndTime &&
      now >= this.discountStartTime &&
      now <= this.discountEndTime

    console.log("Main product discount check:", {
      discountPercentage: this.discountPercentage,
      discountStartTime: this.discountStartTime,
      discountEndTime: this.discountEndTime,
      currentTime: now,
      isDiscountActive,
      isNew: this.isNew
    })

    if (isDiscountActive) {
      const discountAmount = (this.basePrice * this.discountPercentage) / 100
      this.price = Math.round(this.basePrice - discountAmount)
      console.log(`Main price calculated: ${this.basePrice} - ${discountAmount} = ${this.price}`)
    } else {
      this.price = this.basePrice
      console.log(`Main price set to base price: ${this.price}`)
    }
  }

  // ✅ Calculate variant prices with proper time validation
  if (
    this.variants &&
    this.variants.length > 0 &&
    (this.isModified("variants") || this.isNew) // ✅ CRITICAL: Also trigger on new documents
  ) {
    console.log("Calculating variant prices...")

    this.variants.forEach((variant, index) => {
      // Generate product code if not provided
      if (!variant.productCode) {
        variant.productCode = generateProductCode()
      }

      // ✅ Determine the base price for this variant
      const variantBasePrice = variant.basePrice || this.basePrice
// ✅ Determine discount percentage and timing
let effectiveDiscountPercentage = 0
let effectiveDiscountStart = null
let effectiveDiscountEnd = null

// ✅ CRITICAL FIX: Check if variant has EXPLICITLY set discount (not null or undefined)
const hasVariantDiscount = variant.discountPercentage !== null && 
                          variant.discountPercentage !== undefined && 
                          variant.discountPercentage > 0

const hasExplicitNoDiscount = variant.discountPercentage === null

if (hasVariantDiscount) {
  // Variant has its own discount
  effectiveDiscountPercentage = variant.discountPercentage
  effectiveDiscountStart = variant.discountStartTime
  effectiveDiscountEnd = variant.discountEndTime
  console.log(`Variant ${index} using own discount: ${effectiveDiscountPercentage}%`)
} else if (hasExplicitNoDiscount) {
  // ✅ EXPLICITLY NO DISCOUNT - variant has null discountPercentage
  effectiveDiscountPercentage = 0
  effectiveDiscountStart = null
  effectiveDiscountEnd = null
  console.log(`Variant ${index} explicitly has no discount (null)`)
}else if (!variant.basePrice && this.discountPercentage > 0) {
  effectiveDiscountPercentage = this.discountPercentage
  effectiveDiscountStart = this.discountStartTime
  effectiveDiscountEnd = this.discountEndTime
  console.log(`Variant ${index} using product discount: ${effectiveDiscountPercentage}%`)
} else {
  // No discount at all
  effectiveDiscountPercentage = 0
  effectiveDiscountStart = null
  effectiveDiscountEnd = null
  console.log(`Variant ${index} has no discount`)
}

      // ✅ Check if discount is currently active
      const now = new Date()
      const isVariantDiscountActive =
        effectiveDiscountPercentage > 0 &&
        effectiveDiscountStart &&
        effectiveDiscountEnd &&
        now >= effectiveDiscountStart &&
        now <= effectiveDiscountEnd

      console.log(`Variant ${index} discount check:`, {
        variantBasePrice,
        effectiveDiscountPercentage,
        effectiveDiscountStart,
        effectiveDiscountEnd,
        currentTime: now,
        isVariantDiscountActive
      })

      // ✅ Calculate variant price
      if (isVariantDiscountActive) {
        const discountAmount = (variantBasePrice * effectiveDiscountPercentage) / 100
        variant.price = Math.round(variantBasePrice - discountAmount)
        console.log(`Variant ${index} price calculated: ${variantBasePrice} - ${discountAmount} = ${variant.price}`)
      } else {
        variant.price = variantBasePrice
        console.log(`Variant ${index} price set to base: ${variant.price}`)
      }
    })

    // ✅ Calculate total stock from variants
    this.stock = this.variants.reduce((total, variant) => total + (variant.stock || 0), 0)
    console.log(`Total stock calculated: ${this.stock}`)
  }

  // ✅ Update stock status after price calculations
  this.updateStockStatus()
  console.log("=== PRE-SAVE HOOK COMPLETED ===")
  next()
})

// ✅ Method to check if discount is currently active
productSchema.methods.isDiscountActive = function () {
  const now = new Date()
  const isActive = (
    this.discountPercentage > 0 &&
    this.discountStartTime &&
    this.discountEndTime &&
    now >= this.discountStartTime &&
    now <= this.discountEndTime
  )

  console.log("Product discount active check:", {
    discountPercentage: this.discountPercentage,
    startTime: this.discountStartTime,
    endTime: this.discountEndTime,
    currentTime: now,
    isActive
  })

  return isActive
}

// ✅ Method to check if variant discount is currently active
productSchema.methods.isVariantDiscountActive = function (variantId) {
  const variant = this.variants.id(variantId)
  if (!variant) {
    throw new Error("Variant not found")
  }

  const now = new Date()

  // Check variant-specific discount first
  if (variant.discountPercentage !== undefined && variant.discountPercentage > 0) {
    const isActive = (
      variant.discountStartTime &&
      variant.discountEndTime &&
      now >= variant.discountStartTime &&
      now <= variant.discountEndTime
    )

    console.log("Variant discount active check (own):", {
      variantId,
      discountPercentage: variant.discountPercentage,
      startTime: variant.discountStartTime,
      endTime: variant.discountEndTime,
      currentTime: now,
      isActive
    })

    return isActive
  }

  // Fall back to product-level discount
  const isActive = (
    this.discountPercentage > 0 &&
    this.discountStartTime &&
    this.discountEndTime &&
    now >= this.discountStartTime &&
    now <= this.discountEndTime
  )

  console.log("Variant discount active check (product-level):", {
    variantId,
    discountPercentage: this.discountPercentage,
    startTime: this.discountStartTime,
    endTime: this.discountEndTime,
    currentTime: now,
    isActive
  })

  return isActive
}

// Method to get current effective price (considering discount timing)
// productSchema.methods.getCurrentPrice = function (variantId = null) {
//   if (variantId) {
//     const variant = this.variants.id(variantId)
//     if (!variant) {
//       throw new Error("Variant not found")
//     }

//     const basePrice = variant.basePrice || this.basePrice

//     // Check variant-specific discount first
//     if (variant.discountPercentage !== undefined && variant.discountPercentage > 0) {
//       const now = new Date()
//       const isActive = (
//         variant.discountStartTime &&
//         variant.discountEndTime &&
//         now >= variant.discountStartTime &&
//         now <= variant.discountEndTime
//       )

//       if (isActive) {
//         const discountAmount = (basePrice * variant.discountPercentage) / 100
//         const finalPrice = Math.round(basePrice - discountAmount)
//         console.log(`Variant ${variantId} current price (own discount): ${basePrice} - ${discountAmount} = ${finalPrice}`)
//         return finalPrice
//       }
//     }

//     // Check product-level discount
//     if (this.isDiscountActive()) {
//       const discountAmount = (basePrice * this.discountPercentage) / 100
//       const finalPrice = Math.round(basePrice - discountAmount)
//       console.log(`Variant ${variantId} current price (product discount): ${basePrice} - ${discountAmount} = ${finalPrice}`)
//       return finalPrice
//     }

//     console.log(`Variant ${variantId} current price (base): ${basePrice}`)
//     return basePrice
//   } else {
//     // Product-level price
//     if (this.isDiscountActive()) {
//       const discountAmount = (this.basePrice * this.discountPercentage) / 100
//       const finalPrice = Math.round(this.basePrice - discountAmount)
//       console.log(`Product current price (with discount): ${this.basePrice} - ${discountAmount} = ${finalPrice}`)
//       return finalPrice
//     }

//     console.log(`Product current price (base): ${this.basePrice}`)
//     return this.basePrice
//   }
// }

productSchema.methods.getCurrentPrice = function (variantId = null) {
  const nowUTC = new Date(); // use utc time in all time

  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) {
      throw new Error("Variant not found");
    }

    const basePrice = variant.basePrice || this.basePrice;

    // Check variant-specific discount first
    if (variant.discountPercentage > 0) {
      const isActive = variant.discountStartTime &&
        variant.discountEndTime &&
        nowUTC >= variant.discountStartTime &&
        nowUTC <= variant.discountEndTime;

      if (isActive) {
        const discountAmount = (basePrice * variant.discountPercentage) / 100;
        return Math.round(basePrice - discountAmount);
      }
    }

    // Check product-level discount
    if (this.discountPercentage > 0 &&
      this.discountStartTime &&
      this.discountEndTime &&
      nowUTC >= this.discountStartTime &&
      nowUTC <= this.discountEndTime) {
      const discountAmount = (basePrice * this.discountPercentage) / 100;
      return Math.round(basePrice - discountAmount);
    }

    return basePrice;
  } else {
    // Product-level price
    if (this.discountPercentage > 0 &&
      this.discountStartTime &&
      this.discountEndTime &&
      nowUTC >= this.discountStartTime &&
      nowUTC <= this.discountEndTime) {
      const discountAmount = (this.basePrice * this.discountPercentage) / 100;
      return Math.round(this.basePrice - discountAmount);
    }

    return this.basePrice;
  }
};

// ✅ Method to get images by color code
productSchema.methods.getImagesByColor = function (colorCode) {
  return this.images.filter((image) => image.colorCode === colorCode)
}

// ✅ Method to get variants by color
productSchema.methods.getVariantsByColor = function (colorCode) {
  return this.variants.filter((variant) => variant.colorCode === colorCode)
}

// ✅ Method to get available colors
productSchema.methods.getAvailableColors = function () {
  const colors = new Map()
  this.variants.forEach((variant) => {
    if (!colors.has(variant.colorCode)) {
      colors.set(variant.colorCode, {
        colorCode: variant.colorCode,
        colorName: variant.colorName,
        images: this.getImagesByColor(variant.colorCode),
      })
    }
  })
  return Array.from(colors.values())
}

// Auto-populate references
productSchema.pre(/^find/, function (next) {
  this.populate("parentCategoryId subCategoryId dressTypeId styleId")
  next()
})

productSchema.pre("validate", function (next) {
  // Ensure each variant has a unique combination of color and size
  const combinations = new Set()
  for (let i = 0; i < this.variants.length; i++) {
    const variant = this.variants[i]
    const combination = `${variant.colorCode}-${variant.size}`
    if (combinations.has(combination)) {
      this.invalidate(`variants.${i}`, `Duplicate variant combination: ${variant.colorName} - ${variant.size}`)
    }
    combinations.add(combination)
  }
  // Ensure all variant color codes exist in images
  const imageColorCodes = new Set(this.images.map((img) => img.colorCode))
  for (let i = 0; i < this.variants.length; i++) {
    const variant = this.variants[i]
    if (!imageColorCodes.has(variant.colorCode)) {
      this.invalidate(`variants.${i}.colorCode`, `Color code ${variant.colorCode} must have corresponding images`)
    }
  }
  next()
})

// updateDiscountPrices method replace
productSchema.statics.updateDiscountPrices = async function () {
  const nowUTC = new Date();
  console.log(`[CRON] Running discount update at UTC: ${nowUTC.toISOString()}`);

  try {
    // ✅ pull all products which is have discount
    const products = await this.find({
      $or: [
        { discountPercentage: { $gt: 0 } },
        { 'variants.discountPercentage': { $gt: 0 } }
      ]
    });

    console.log(`[CRON] Found ${products.length} products with discounts`);

    let updatedCount = 0;

    for (const product of products) {
      let needsUpdate = false;

      // ✅ checking main products
      const isMainDiscountActive = product.discountPercentage > 0 &&
        product.discountStartTime &&
        product.discountEndTime &&
        nowUTC >= product.discountStartTime &&
        nowUTC <= product.discountEndTime;

      console.log(`[DEBUG] Product: ${product.title}`);
      console.log(`[DEBUG] Discount: ${product.discountPercentage}%`);
      console.log(`[DEBUG] Start: ${product.discountStartTime}`);
      console.log(`[DEBUG] End: ${product.discountEndTime}`);
      console.log(`[DEBUG] Now: ${nowUTC.toISOString()}`);
      console.log(`[DEBUG] Is active: ${isMainDiscountActive}`);

      // ✅ logic for price calculation
      const shouldHaveDiscountedPrice = isMainDiscountActive;
      const currentlyHasDiscountedPrice = product.price !== product.basePrice;

      if (shouldHaveDiscountedPrice && !currentlyHasDiscountedPrice) {
        // active discount checking start time
        const discountAmount = (product.basePrice * product.discountPercentage) / 100;
        product.price = Math.round(product.basePrice - discountAmount);
        needsUpdate = true;
        console.log(`[ACTIVATE] Setting discounted price: ${product.price}`);
      } else if (!shouldHaveDiscountedPrice && currentlyHasDiscountedPrice) {
        // discount stop checking ending time
        product.price = product.basePrice;
        needsUpdate = true;
        console.log(`[DEACTIVATE] Resetting to base price: ${product.basePrice}`);
      } else if (shouldHaveDiscountedPrice) {
        // changing price calculate discoulnt and baseprice
        const discountAmount = (product.basePrice * product.discountPercentage) / 100;
        const newPrice = Math.round(product.basePrice - discountAmount);
        if (product.price !== newPrice) {
          product.price = newPrice;
          needsUpdate = true;
          console.log(`[UPDATE] Updating discounted price: ${newPrice}`);
        }
      }

      // Variant price update using same theory
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          let shouldHaveVariantDiscount = false;
          let effectiveDiscount = 0;
          let variantBasePrice = variant.basePrice || product.basePrice;

          // Variant own discount 
          if (variant.discountPercentage > 0) {
            shouldHaveVariantDiscount = variant.discountStartTime &&
              variant.discountEndTime &&
              nowUTC >= variant.discountStartTime &&
              nowUTC <= variant.discountEndTime;
            effectiveDiscount = variant.discountPercentage;
            console.log(`[DEBUG] Variant has own discount: ${effectiveDiscount}%, active: ${shouldHaveVariantDiscount}`);
          }
          // Product discount checking 
          else if (product.discountPercentage > 0) {
            shouldHaveVariantDiscount = isMainDiscountActive;
            effectiveDiscount = product.discountPercentage;
            console.log(`[DEBUG] Variant using product discount: ${effectiveDiscount}%, active: ${shouldHaveVariantDiscount}`);
          }

          const currentlyHasVariantDiscount = variant.price !== variantBasePrice;

          if (shouldHaveVariantDiscount && !currentlyHasVariantDiscount) {
            // Variant discount active 
            const discountAmount = (variantBasePrice * effectiveDiscount) / 100;
            variant.price = Math.round(variantBasePrice - discountAmount);
            needsUpdate = true;
            console.log(`[ACTIVATE] Variant discounted price: ${variant.price}`);
          } else if (!shouldHaveVariantDiscount && currentlyHasVariantDiscount) {
            // Variant discount deactive
            variant.price = variantBasePrice;
            needsUpdate = true;
            console.log(`[DEACTIVATE] Variant base price: ${variant.price}`);
          } else if (shouldHaveVariantDiscount) {
            // active price if discount is active
            const discountAmount = (variantBasePrice * effectiveDiscount) / 100;
            const newVariantPrice = Math.round(variantBasePrice - discountAmount);
            if (variant.price !== newVariantPrice) {
              variant.price = newVariantPrice;
              needsUpdate = true;
              console.log(`[UPDATE] Variant price updated: ${newVariantPrice}`);
            }
          }
        }
      }

      if (needsUpdate) {
        // ✅ IMPORTANT: pre-save hook skip direct update 
        await this.updateOne(
          { _id: product._id },
          {
            price: product.price,
            variants: product.variants,
            updatedAt: new Date()
          }
        );
        updatedCount++;
        console.log(`[SUCCESS] Product updated: ${product.title}`);
      }
    }

    console.log(`[CRON] Discount update completed. Updated ${updatedCount} products`);
  } catch (error) {
    console.error('[ERROR] Error in updateDiscountPrices:', error);
    throw error;
  }
};



// ✅ Updated indexes
productSchema.index({ slug: 1 })
productSchema.index({ parentCategoryId: 1, subCategoryId: 1 })
productSchema.index({ isFeatured: 1 })
productSchema.index({ isActive: 1 })
productSchema.index({ "variants.productCode": 1 })
productSchema.index({ "variants.colorCode": 1 })

const Product = mongoose.model("Product", productSchema)

export default Product
