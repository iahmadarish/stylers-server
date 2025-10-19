import mongoose from "mongoose"
import slugify from "slugify"

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sub category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentCategory",
      required: [true, "Parent category is required"],
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
    products: [{  // new fild
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

// Create slug from name before saving
subCategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    // Create a unique slug by combining name and a timestamp
    const timestamp = new Date().getTime().toString().slice(-4)
    this.slug = slugify(`${this.name}-${timestamp}`, { lower: true })
  }
  next()
})

// প্যারেন্ট ক্যাটেগরিতে অটো-আপডেট মিডলওয়্যার
subCategorySchema.post('save', async function(doc) {
  await mongoose.model("ParentCategory").findByIdAndUpdate(
    doc.parentCategoryId,
    { $addToSet: { subcategories: doc._id } }
  );
});

subCategorySchema.post('remove', async function(doc) {
  await mongoose.model("ParentCategory").findByIdAndUpdate(
    doc.parentCategoryId,
    { $pull: { subcategories: doc._id } }
  );
});




const SubCategory = mongoose.model("SubCategory", subCategorySchema)

export default SubCategory
