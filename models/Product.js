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
    
    // ✅ UPDATED: Discount system with both percentage and fixed amount
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, "Discount percentage cannot be negative"],
      max: [100, "Discount percentage cannot exceed 100"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount cannot be negative"],
    },
    discountStartTime: {
      type: Date,
      validate: {
        validator: function (value) {
          // If any discount is set, start time should be provided
          if ((this.discountPercentage > 0 || this.discountAmount > 0) && !value) {
            return false
          }
          return true
        },
        message: "Discount start time is required when discount is set",
      },
    },
    discountEndTime: {
      type: Date,
      validate: {
        validator: function (value) {
          // If any discount is set, end time should be provided
          if ((this.discountPercentage > 0 || this.discountAmount > 0) && !value) {
            return false
          }
          // End time should be after start time
          if (value && this.discountStartTime && value <= this.discountStartTime) {
            return false
          }
          return true
        },
        message: "Discount end time is required and must be after start time when discount is set",
      },
    },
    
    // ✅ Campaign discount fields (for temporary campaign discounts)
    campaignDiscountType: {
      type: String,
      enum: ["percentage", "fixed"],
    },
    campaignDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    campaignDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    campaignDiscountStartTime: Date,
    campaignDiscountEndTime: Date,
    campaignDiscountActive: {
      type: Boolean,
      default: false,
    },
    
    // ✅ Store original discount for restoration after campaign
    originalDiscountType: String,
    originalDiscountPercentage: Number,
    originalDiscountAmount: Number,
    originalDiscountStartTime: Date,
    originalDiscountEndTime: Date,

    images: [
      {
        url: {
          type: String,
          required: [true, "Image URL is required"],
        },
        colorCode: {
          type: String,
          required: false,
          default: "#0c5469ff",
        },
        colorName: {
          type: String,
          required: false,
          trim: true,
        },
      },
    ],
    // ✅ UPDATED: Variants with both percentage and fixed amount discounts
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
        
        // ✅ UPDATED: Variant discount system
        discountType: {
          type: String,
          enum: ["percentage", "fixed"],
          default: "percentage"
        },
        discountPercentage: {
          type: Number,
          min: [0, "Variant discount percentage cannot be negative"],
          max: [100, "Variant discount percentage cannot exceed 100"],
        },
        discountAmount: {
          type: Number,
          min: [0, "Variant discount amount cannot be negative"],
        },
        discountStartTime: {
          type: Date,
          validate: {
            validator: function (value) {
              if ((this.discountPercentage > 0 || this.discountAmount > 0) && !value) {
                return false
              }
              return true
            },
            message: "Variant discount start time is required when discount is set",
          },
        },
        discountEndTime: {
          type: Date,
          validate: {
            validator: function (value) {
              if ((this.discountPercentage > 0 || this.discountAmount > 0) && !value) {
                return false
              }
              if (value && this.discountStartTime && value <= this.discountStartTime) {
                return false
              }
              return true
            },
            message: "Variant discount end time is required and must be after start time when discount is set",
          },
        },
        
        // ✅ Campaign discount fields for variants
        campaignDiscountType: String,
        campaignDiscountPercentage: Number,
        campaignDiscountAmount: Number,
        campaignDiscountStartTime: Date,
        campaignDiscountEndTime: Date,
        campaignDiscountActive: {
          type: Boolean,
          default: false,
        },
        
        originalDiscountType: String,
        originalDiscountPercentage: Number,
        originalDiscountAmount: Number,
        originalDiscountStartTime: Date,
        originalDiscountEndTime: Date,
        
        price: {
          type: Number,
          min: [0, "Variant price cannot be negative"],
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
  // Product level stock status 
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



productSchema.pre("save", function (next) {
  console.log("=== ORIGINAL DISCOUNT UPDATE HOOK TRIGGERED ===")
  
  // শুধুমাত্র যদি regular discount fields modify হয়
  if (this.isModified("discountType") || 
      this.isModified("discountPercentage") || 
      this.isModified("discountAmount") ||
      this.isModified("discountStartTime") || 
      this.isModified("discountEndTime")) {
    
    console.log("🔄 Discount fields modified - checking original discount update")
    console.log(`Current campaign status: ${this.campaignDiscountActive}`)
    console.log(`Discount change - Type: ${this.discountType}, Percentage: ${this.discountPercentage}, Amount: ${this.discountAmount}`)
    
    // ✅ শুধুমাত্র যদি campaign currently active না হয় তাহলে original discount update করুন
    if (!this.campaignDiscountActive) {
      console.log("🔄 Campaign not active - updating original discount fields")
      
      this.originalDiscountType = this.discountType
      
      // ✅ CRITICAL FIX: Discount type অনুযায়ী correct field update করুন
      if (this.discountType === "percentage") {
        this.originalDiscountPercentage = this.discountPercentage || 0
        this.originalDiscountAmount = 0  // Percentage হলে amount reset করুন
      } else if (this.discountType === "fixed") {
        this.originalDiscountPercentage = 0  // Fixed হলে percentage reset করুন
        this.originalDiscountAmount = this.discountAmount || 0
      }
      
      this.originalDiscountStartTime = this.discountStartTime
      this.originalDiscountEndTime = this.discountEndTime
      
      console.log("✅ Original discount updated:", {
        type: this.originalDiscountType,
        percentage: this.originalDiscountPercentage,
        amount: this.originalDiscountAmount,
        startTime: this.originalDiscountStartTime,
        endTime: this.originalDiscountEndTime
      })
    } else {
      console.log("⚠️ Campaign is active - skipping original discount update")
      console.log("ℹ️ Original discount remains:", {
        type: this.originalDiscountType,
        percentage: this.originalDiscountPercentage, 
        amount: this.originalDiscountAmount
      })
    }
  }
  
  next()
})

productSchema.pre("save", function (next) {
  console.log("=== VARIANT ORIGINAL DISCOUNT UPDATE HOOK ===")
  
  if (this.variants && this.variants.length > 0) {
    let variantsUpdated = false
    
    this.variants.forEach((variant, index) => {
      // Always update original data when campaign is not active
      if (!variant.campaignDiscountActive) {
        const newOriginalType = variant.discountType || "percentage"
        
        // ✅ CRITICAL FIX: Discount type অনুযায়ী correct field update
        let newOriginalPercentage = 0
        let newOriginalAmount = 0
        
        if (newOriginalType === "percentage") {
          newOriginalPercentage = variant.discountPercentage !== undefined ? variant.discountPercentage : 0
          newOriginalAmount = 0
        } else if (newOriginalType === "fixed") {
          newOriginalPercentage = 0
          newOriginalAmount = variant.discountAmount !== undefined ? variant.discountAmount : 0
        }
        
        // Check if original data needs update
        if (variant.originalDiscountPercentage !== newOriginalPercentage ||
            variant.originalDiscountAmount !== newOriginalAmount ||
            variant.originalDiscountType !== newOriginalType) {
          
          console.log(`🔄 Updating variant ${index} original data`)
          variant.originalDiscountType = newOriginalType
          variant.originalDiscountPercentage = newOriginalPercentage
          variant.originalDiscountAmount = newOriginalAmount
          variant.originalDiscountStartTime = variant.discountStartTime
          variant.originalDiscountEndTime = variant.discountEndTime
          
          console.log(`✅ Variant ${index} original updated: Type: ${newOriginalType}, Percentage: ${newOriginalPercentage}, Amount: ${newOriginalAmount}`)
          variantsUpdated = true
        }
      }
    })
    
    if (variantsUpdated) {
      this.markModified('variants')
      console.log("✅ Variants marked as modified")
    }
  }
  
  next()
})

// ✅ UPDATED: Enhanced pre-save hook with dual discount system
productSchema.pre("save", async function (next) {
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

  // ✅ UPDATED: Calculate main product price with campaign priority
  if (
    this.isModified("basePrice") ||
    this.isModified("discountType") ||
    this.isModified("discountPercentage") ||
    this.isModified("discountAmount") ||
    this.isModified("discountStartTime") ||
    this.isModified("discountEndTime") ||
    this.isModified("campaignDiscountActive") ||
    this.isModified("campaignDiscountPercentage") ||
    this.isModified("campaignDiscountAmount") ||
    this.isNew
  ) {
    console.log("Calculating main product price...")
    console.log(`Campaign Active: ${this.campaignDiscountActive}, Regular Discount: ${this.discountPercentage}%`)
    
    const now = new Date()
    let finalPrice = this.basePrice
    
    // ✅ Priority 1: Check if campaign discount is active and valid
    if (this.campaignDiscountActive && 
        this.campaignDiscountStartTime && 
        this.campaignDiscountEndTime &&
        now >= this.campaignDiscountStartTime && 
        now <= this.campaignDiscountEndTime) {
      
      if (this.campaignDiscountType === "percentage" && this.campaignDiscountPercentage > 0) {
        const discountAmount = (this.basePrice * this.campaignDiscountPercentage) / 100
        finalPrice = Math.max(0, this.basePrice - discountAmount)
        console.log(`Applied campaign percentage discount: ${this.basePrice} - ${discountAmount} = ${finalPrice}`)
      } else if (this.campaignDiscountType === "fixed" && this.campaignDiscountAmount > 0) {
        finalPrice = Math.max(0, this.basePrice - this.campaignDiscountAmount)
        console.log(`Applied campaign fixed discount: ${this.basePrice} - ${this.campaignDiscountAmount} = ${finalPrice}`)
      }
    }
    // ✅ Priority 2: Check if regular discount is active and valid (ONLY when campaign is not active)
    else if (
      (this.discountPercentage > 0 || this.discountAmount > 0) &&
      this.discountStartTime &&
      this.discountEndTime &&
      now >= this.discountStartTime &&
      now <= this.discountEndTime
    ) {
      if (this.discountType === "percentage" && this.discountPercentage > 0) {
        const discountAmount = (this.basePrice * this.discountPercentage) / 100
        finalPrice = Math.max(0, this.basePrice - discountAmount)
        console.log(`Applied regular percentage discount: ${this.basePrice} - ${discountAmount} = ${finalPrice}`)
      } else if (this.discountType === "fixed" && this.discountAmount > 0) {
        finalPrice = Math.max(0, this.basePrice - this.discountAmount)
        console.log(`Applied regular fixed discount: ${this.basePrice} - ${this.discountAmount} = ${finalPrice}`)
      }
    } else {
      finalPrice = this.basePrice
      console.log(`No active discount, using base price: ${finalPrice}`)
    }
    
    this.price = finalPrice
  }

  // ✅ UPDATED: Calculate variant prices with campaign priority
  if (this.variants && this.variants.length > 0 && (this.isModified("variants") || this.isNew)) {
    console.log("Calculating variant prices...")

    this.variants.forEach((variant, index) => {
      // Generate product code if not provided
      if (!variant.productCode) {
        variant.productCode = generateProductCode()
      }

      // Determine base price for variant
      const variantBasePrice = variant.basePrice !== undefined ? variant.basePrice : this.basePrice
      let variantFinalPrice = variantBasePrice
      const now = new Date()

      // ✅ Priority 1: Check if variant campaign discount is active
      if (variant.campaignDiscountActive && 
          variant.campaignDiscountStartTime && 
          variant.campaignDiscountEndTime &&
          now >= variant.campaignDiscountStartTime && 
          now <= variant.campaignDiscountEndTime) {
        
        if (variant.campaignDiscountType === "percentage" && variant.campaignDiscountPercentage > 0) {
          const discountAmount = (variantBasePrice * variant.campaignDiscountPercentage) / 100
          variantFinalPrice = variantBasePrice - discountAmount
        } else if (variant.campaignDiscountType === "fixed" && variant.campaignDiscountAmount > 0) {
          variantFinalPrice = Math.max(0, variantBasePrice - variant.campaignDiscountAmount)
        }
      }
      // ✅ Priority 2: Check variant-specific discount
      else if (variant.discountPercentage > 0 || variant.discountAmount > 0) {
        if (variant.discountType === "percentage" && variant.discountPercentage > 0 &&
            variant.discountStartTime && variant.discountEndTime &&
            now >= variant.discountStartTime && now <= variant.discountEndTime) {
          const discountAmount = (variantBasePrice * variant.discountPercentage) / 100
          variantFinalPrice = variantBasePrice - discountAmount
        } else if (variant.discountType === "fixed" && variant.discountAmount > 0 &&
                  variant.discountStartTime && variant.discountEndTime &&
                  now >= variant.discountStartTime && now <= variant.discountEndTime) {
          variantFinalPrice = Math.max(0, variantBasePrice - variant.discountAmount)
        }
      }
      // ✅ Priority 3: Fall back to product-level campaign discount
      else if (this.campaignDiscountActive && 
               this.campaignDiscountStartTime && 
               this.campaignDiscountEndTime &&
               now >= this.campaignDiscountStartTime && 
               now <= this.campaignDiscountEndTime &&
               variant.basePrice === undefined) {
        
        if (this.campaignDiscountType === "percentage" && this.campaignDiscountPercentage > 0) {
          const discountAmount = (variantBasePrice * this.campaignDiscountPercentage) / 100
          variantFinalPrice = variantBasePrice - discountAmount
        } else if (this.campaignDiscountType === "fixed" && this.campaignDiscountAmount > 0) {
          variantFinalPrice = Math.max(0, variantBasePrice - this.campaignDiscountAmount)
        }
      }
      // ✅ Priority 4: Fall back to product-level regular discount
      else if ((this.discountPercentage > 0 || this.discountAmount > 0) &&
               this.discountStartTime && this.discountEndTime &&
               now >= this.discountStartTime && now <= this.discountEndTime &&
               variant.basePrice === undefined) {
        
        if (this.discountType === "percentage" && this.discountPercentage > 0) {
          const discountAmount = (variantBasePrice * this.discountPercentage) / 100
          variantFinalPrice = variantBasePrice - discountAmount
        } else if (this.discountType === "fixed" && this.discountAmount > 0) {
          variantFinalPrice = Math.max(0, variantBasePrice - this.discountAmount)
        }
      }

      variant.price = variantFinalPrice
      console.log(`Variant ${index} final price: ${variant.price}`)
    })

    // Calculate total stock from variants
    this.stock = this.variants.reduce((total, variant) => total + (variant.stock || 0), 0)
    console.log(`Total stock calculated: ${this.stock}`)
  }

  // Update stock status
  this.updateStockStatus()
  console.log("=== PRE-SAVE HOOK COMPLETED ===")
  next()
})

// ✅ UPDATED: Method to check if discount is currently active
productSchema.methods.isDiscountActive = function () {
  const now = new Date()
  
  // Check campaign discount first
  if (this.campaignDiscountActive && 
      this.campaignDiscountStartTime && 
      this.campaignDiscountEndTime &&
      now >= this.campaignDiscountStartTime && 
      now <= this.campaignDiscountEndTime) {
    return true
  }
  
  // Check regular discount
  const isActive = (
    (this.discountPercentage > 0 || this.discountAmount > 0) &&
    this.discountStartTime &&
    this.discountEndTime &&
    now >= this.discountStartTime &&
    now <= this.discountEndTime
  )

  console.log("Product discount active check:", {
    discountType: this.discountType,
    discountPercentage: this.discountPercentage,
    discountAmount: this.discountAmount,
    campaignDiscountActive: this.campaignDiscountActive,
    startTime: this.discountStartTime,
    endTime: this.discountEndTime,
    currentTime: now,
    isActive
  })

  return isActive
}

// ✅ UPDATED: Method to get current effective price
productSchema.methods.getCurrentPrice = function (variantId = null) {
  const nowUTC = new Date();

  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) {
      throw new Error("Variant not found");
    }

    // Determine base price
    const basePrice = variant.basePrice !== undefined ? variant.basePrice : this.basePrice;

    // 1. Check variant campaign discount
    if (variant.campaignDiscountActive && 
        variant.campaignDiscountStartTime && 
        variant.campaignDiscountEndTime &&
        nowUTC >= variant.campaignDiscountStartTime && 
        nowUTC <= variant.campaignDiscountEndTime) {
      
      if (variant.campaignDiscountType === "percentage" && variant.campaignDiscountPercentage > 0) {
        const discountAmount = (basePrice * variant.campaignDiscountPercentage) / 100;
        return basePrice - discountAmount;
      } else if (variant.campaignDiscountType === "fixed" && variant.campaignDiscountAmount > 0) {
        return Math.max(0, basePrice - variant.campaignDiscountAmount);
      }
    }
    
    // 2. Check variant-specific discount
    if (variant.discountPercentage > 0 || variant.discountAmount > 0) {
      if (variant.discountType === "percentage" && variant.discountPercentage > 0 &&
          variant.discountStartTime && variant.discountEndTime &&
          nowUTC >= variant.discountStartTime && nowUTC <= variant.discountEndTime) {
        const discountAmount = (basePrice * variant.discountPercentage) / 100;
        return basePrice - discountAmount;
      } else if (variant.discountType === "fixed" && variant.discountAmount > 0 &&
                variant.discountStartTime && variant.discountEndTime &&
                nowUTC >= variant.discountStartTime && nowUTC <= variant.discountEndTime) {
        return Math.max(0, basePrice - variant.discountAmount);
      }
    }
    
    // 3. Check product campaign discount
    if (this.campaignDiscountActive && 
        this.campaignDiscountStartTime && 
        this.campaignDiscountEndTime &&
        nowUTC >= this.campaignDiscountStartTime && 
        nowUTC <= this.campaignDiscountEndTime &&
        variant.basePrice === undefined) {
      
      if (this.campaignDiscountType === "percentage" && this.campaignDiscountPercentage > 0) {
        const discountAmount = (basePrice * this.campaignDiscountPercentage) / 100;
        return basePrice - discountAmount;
      } else if (this.campaignDiscountType === "fixed" && this.campaignDiscountAmount > 0) {
        return Math.max(0, basePrice - this.campaignDiscountAmount);
      }
    }
    
    // 4. Check product regular discount
    if ((this.discountPercentage > 0 || this.discountAmount > 0) &&
        this.discountStartTime && this.discountEndTime &&
        nowUTC >= this.discountStartTime && nowUTC <= this.discountEndTime &&
        variant.basePrice === undefined) {
      
      if (this.discountType === "percentage" && this.discountPercentage > 0) {
        const discountAmount = (basePrice * this.discountPercentage) / 100;
        return basePrice - discountAmount;
      } else if (this.discountType === "fixed" && this.discountAmount > 0) {
        return Math.max(0, basePrice - this.discountAmount);
      }
    }

    return basePrice;
  } else {
    // Product-level price
    
    // 1. Check campaign discount
    if (this.campaignDiscountActive && 
        this.campaignDiscountStartTime && 
        this.campaignDiscountEndTime &&
        nowUTC >= this.campaignDiscountStartTime && 
        nowUTC <= this.campaignDiscountEndTime) {
      
      if (this.campaignDiscountType === "percentage" && this.campaignDiscountPercentage > 0) {
        const discountAmount = (this.basePrice * this.campaignDiscountPercentage) / 100;
        return this.basePrice - discountAmount;
      } else if (this.campaignDiscountType === "fixed" && this.campaignDiscountAmount > 0) {
        return Math.max(0, this.basePrice - this.campaignDiscountAmount);
      }
    }
    
    // 2. Check regular discount
    if ((this.discountPercentage > 0 || this.discountAmount > 0) &&
        this.discountStartTime && this.discountEndTime &&
        nowUTC >= this.discountStartTime && nowUTC <= this.discountEndTime) {
      
      if (this.discountType === "percentage" && this.discountPercentage > 0) {
        const discountAmount = (this.basePrice * this.discountPercentage) / 100;
        return this.basePrice - discountAmount;
      } else if (this.discountType === "fixed" && this.discountAmount > 0) {
        return Math.max(0, this.basePrice - this.discountAmount);
      }
    }

    return this.basePrice;
  }
};

// ✅ UPDATED: Enhanced discount update method for both regular and campaign discounts
productSchema.statics.updateDiscountPrices = async function () {
  const nowUTC = new Date();
  console.log(`[CRON] Running discount update at UTC: ${nowUTC.toISOString()}`);

  try {
    // Find all products that have any type of discount
    const products = await this.find({
      $or: [
        { discountPercentage: { $gt: 0 } },
        { discountAmount: { $gt: 0 } },
        { campaignDiscountPercentage: { $gt: 0 } },
        { campaignDiscountAmount: { $gt: 0 } },
        { 'variants.discountPercentage': { $gt: 0 } },
        { 'variants.discountAmount': { $gt: 0 } },
        { 'variants.campaignDiscountPercentage': { $gt: 0 } },
        { 'variants.campaignDiscountAmount': { $gt: 0 } }
      ]
    });

    console.log(`[CRON] Found ${products.length} products with discounts`);

    let updatedCount = 0;

    for (const product of products) {
      let needsUpdate = false;
      const now = new Date();

      // Check campaign discount status
      const isCampaignActive = product.campaignDiscountActive &&
        product.campaignDiscountStartTime &&
        product.campaignDiscountEndTime &&
        now >= product.campaignDiscountStartTime &&
        now <= product.campaignDiscountEndTime;

      // Check regular discount status
      const isRegularDiscountActive = (product.discountPercentage > 0 || product.discountAmount > 0) &&
        product.discountStartTime &&
        product.discountEndTime &&
        now >= product.discountStartTime &&
        now <= product.discountEndTime;

      // Calculate product price based on priority
      let newProductPrice = product.basePrice;

      if (isCampaignActive) {
        // Campaign has priority
        if (product.campaignDiscountType === "percentage" && product.campaignDiscountPercentage > 0) {
          const discountAmount = (product.basePrice * product.campaignDiscountPercentage) / 100;
          newProductPrice = product.basePrice - discountAmount;
        } else if (product.campaignDiscountType === "fixed" && product.campaignDiscountAmount > 0) {
          newProductPrice = Math.max(0, product.basePrice - product.campaignDiscountAmount);
        }
      } else if (isRegularDiscountActive) {
        // Regular discount
        if (product.discountType === "percentage" && product.discountPercentage > 0) {
          const discountAmount = (product.basePrice * product.discountPercentage) / 100;
          newProductPrice = product.basePrice - discountAmount;
        } else if (product.discountType === "fixed" && product.discountAmount > 0) {
          newProductPrice = Math.max(0, product.basePrice - product.discountAmount);
        }
      }

      // Update if price changed
      if (product.price !== newProductPrice) {
        product.price = newProductPrice;
        needsUpdate = true;
        console.log(`[PRICE UPDATE] Product: ${product.title}, New Price: ${newProductPrice}`);
      }

      // Update variant prices
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const variantBasePrice = variant.basePrice !== undefined ? variant.basePrice : product.basePrice;
          let newVariantPrice = variantBasePrice;

          // Check variant campaign discount
          const isVariantCampaignActive = variant.campaignDiscountActive &&
            variant.campaignDiscountStartTime &&
            variant.campaignDiscountEndTime &&
            now >= variant.campaignDiscountStartTime &&
            now <= variant.campaignDiscountEndTime;

          // Check variant regular discount
          const isVariantDiscountActive = (variant.discountPercentage > 0 || variant.discountAmount > 0) &&
            variant.discountStartTime &&
            variant.discountEndTime &&
            now >= variant.discountStartTime &&
            now <= variant.discountEndTime;

          // Calculate variant price with priority
          if (isVariantCampaignActive) {
            if (variant.campaignDiscountType === "percentage" && variant.campaignDiscountPercentage > 0) {
              const discountAmount = (variantBasePrice * variant.campaignDiscountPercentage) / 100;
              newVariantPrice = variantBasePrice - discountAmount;
            } else if (variant.campaignDiscountType === "fixed" && variant.campaignDiscountAmount > 0) {
              newVariantPrice = Math.max(0, variantBasePrice - variant.campaignDiscountAmount);
            }
          } else if (isVariantDiscountActive) {
            if (variant.discountType === "percentage" && variant.discountPercentage > 0) {
              const discountAmount = (variantBasePrice * variant.discountPercentage) / 100;
              newVariantPrice = variantBasePrice - discountAmount;
            } else if (variant.discountType === "fixed" && variant.discountAmount > 0) {
              newVariantPrice = Math.max(0, variantBasePrice - variant.discountAmount);
            }
          } else if (isCampaignActive && variant.basePrice === undefined) {
            // Fall back to product campaign discount
            if (product.campaignDiscountType === "percentage" && product.campaignDiscountPercentage > 0) {
              const discountAmount = (variantBasePrice * product.campaignDiscountPercentage) / 100;
              newVariantPrice = variantBasePrice - discountAmount;
            } else if (product.campaignDiscountType === "fixed" && product.campaignDiscountAmount > 0) {
              newVariantPrice = Math.max(0, variantBasePrice - product.campaignDiscountAmount);
            }
          } else if (isRegularDiscountActive && variant.basePrice === undefined) {
            // Fall back to product regular discount
            if (product.discountType === "percentage" && product.discountPercentage > 0) {
              const discountAmount = (variantBasePrice * product.discountPercentage) / 100;
              newVariantPrice = variantBasePrice - discountAmount;
            } else if (product.discountType === "fixed" && product.discountAmount > 0) {
              newVariantPrice = Math.max(0, variantBasePrice - product.discountAmount);
            }
          }

          // Update variant price if changed
          if (variant.price !== newVariantPrice) {
            variant.price = newVariantPrice;
            needsUpdate = true;
            console.log(`[VARIANT UPDATE] ${variant.colorName} - ${variant.size}, New Price: ${newVariantPrice}`);
          }
        }
      }

      // Save updates if any
      if (needsUpdate) {
        await product.save();
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

// Other methods remain the same...
productSchema.methods.getImagesByColor = function (colorCode) {
  return this.images.filter((image) => image.colorCode === colorCode)
}

productSchema.methods.getVariantsByColor = function (colorCode) {
  return this.variants.filter((variant) => variant.colorCode === colorCode)
}

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
  const combinations = new Set()
  for (let i = 0; i < this.variants.length; i++) {
    const variant = this.variants[i]
    const combination = `${variant.colorCode}-${variant.size}`
    if (combinations.has(combination)) {
      this.invalidate(`variants.${i}`, `Duplicate variant combination: ${variant.colorName} - ${variant.size}`)
    }
    combinations.add(combination)
  }
  const imageColorCodes = new Set(this.images.map((img) => img.colorCode))
  for (let i = 0; i < this.variants.length; i++) {
    const variant = this.variants[i]
    if (!imageColorCodes.has(variant.colorCode)) {
      this.invalidate(`variants.${i}.colorCode`, `Color code ${variant.colorCode} must have corresponding images`)
    }
  }
  next()
})


productSchema.pre("save", async function (next) {
  if (this.isModified("variants") || this.isNew) {
    console.log("=== PRODUCT CODE GLOBAL UNIQUE CHECK HOOK TRIGGERED ===");
    const productCodesInThisDoc = new Set();
    this.variants.forEach((v) => {
      if (v.productCode) {
        productCodesInThisDoc.add(v.productCode);
      }
    });

    const codesToCheck = Array.from(productCodesInThisDoc);

    if (codesToCheck.length > 0) {
      const query = {
        "variants.productCode": { $in: codesToCheck },
        ...(this._id && { _id: { $ne: this._id } }), 
      };
      const existingProduct = await mongoose.models.Product.findOne(query);

      if (existingProduct) {
        const conflictingCode = existingProduct.variants.find(v => codesToCheck.includes(v.productCode)).productCode;
        
        console.error(`[CONFLICT] Product code "${conflictingCode}" is already in use by another product: ${existingProduct.title}`);

        const error = new Error(`Product code "${conflictingCode}" is already in use by another product. Please ensure the code is unique across all products.`);
        error.name = 'ProductCodeConflict';
        return next(error);
      }
      console.log("Global product code uniqueness confirmed.");
    }
  }
  next();
});

// Indexes
productSchema.index({ parentCategoryId: 1, subCategoryId: 1 })
productSchema.index({ isFeatured: 1 })
productSchema.index({ isActive: 1 })
productSchema.index({ "variants.productCode": 1 })
productSchema.index({ "variants.colorCode": 1 })

const Product = mongoose.model("Product", productSchema)

export default Product