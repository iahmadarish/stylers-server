import mongoose from "mongoose"

const stockNotificationSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productTitle: {
    type: String,
    required: true,
  },
  variantId: {
    type: String,
    required: false,
  },
  variantInfo: {
    colorCode: String,
    colorName: String,
    size: String
  },
  type: {
    type: String,
    enum: ["low_stock", "out_of_stock", "back_in_stock", "pre_order"],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  notifiedAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model("StockNotification", stockNotificationSchema)