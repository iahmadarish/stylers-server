import mongoose from "mongoose"
import slugify from "slugify"

const styleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Style name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    dressTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DressType",
      required: [true, "Dress type is required"],
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
styleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    // Create a unique slug by combining name and a timestamp
    const timestamp = new Date().getTime().toString().slice(-4)
    this.slug = slugify(`${this.name}-${timestamp}`, { lower: true })
  }
  next()
})

// Remove the unique compound index to allow same name in different dress types
// styleSchema.index({ name: 1, dressTypeId: 1 }, { unique: true })

const Style = mongoose.model("Style", styleSchema)

export default Style
