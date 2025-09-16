import mongoose from "mongoose"

const variantSizeSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  dimension: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
})

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    color: {
      type: String,
      required: [true, "Color is required"],
    },
    images: {
      type: [String],
      required: [true, "At least one image is required"],
    },
    sizes: [variantSizeSchema],
  },
  { timestamps: true },
)

// Compound index to ensure unique color per product
productVariantSchema.index({ productId: 1, color: 1 }, { unique: true })

const ProductVariant = mongoose.model("ProductVariant", productVariantSchema)

export default ProductVariant
