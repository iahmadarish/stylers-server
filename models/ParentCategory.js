import mongoose from "mongoose"
import slugify from "slugify"

const parentCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Parent category name is required"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    image: {
      type: String,
    },
    description: {
      type: String,
    },
    metaTitle: {
      type: String,
    },
    metaDescription: {
      type: String,
    },
    aPlusContent: {
      type: String, // HTML content will be stored as a string
      default: "",
    },
    subcategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory"
    }],

    products: [{  // New field added after search filter
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }],

    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true },
)

// Create slug from name before saving
parentCategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true })
  }
  next()
})

parentCategorySchema.post('findOneAndDelete', async function(doc) {
  await SubCategory.deleteMany({ parentCategoryId: doc._id });
  await Product.deleteMany({ parentCategoryId: doc._id });
});

const ParentCategory = mongoose.model("ParentCategory", parentCategorySchema)

export default ParentCategory
