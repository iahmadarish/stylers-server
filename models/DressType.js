import mongoose from "mongoose"
import slugify from "slugify"

const dressTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Dress type name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: [true, "Sub category is required"],
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

// Create slug from name before saving
dressTypeSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    // Create a unique slug by combining name and a timestamp
    const timestamp = new Date().getTime().toString().slice(-4)
    this.slug = slugify(`${this.name}-${timestamp}`, { lower: true })
  }
  next()
})

// Remove the unique compound index to allow same name in different sub categories
// dressTypeSchema.index({ name: 1, subCategoryId: 1 }, { unique: true })

const DressType = mongoose.model("DressType", dressTypeSchema)

export default DressType
