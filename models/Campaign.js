import mongoose from "mongoose"

const campaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Campaign title is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["product", "category"],
      required: [true, "Campaign type is required"],
    },
    targetIds: {
      type: [mongoose.Schema.Types.ObjectId],
      required: [true, "Target IDs are required"],
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: 0,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    bannerImage: String,
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

// Validate that end date is after start date
campaignSchema.pre("validate", function (next) {
  if (this.endDate <= this.startDate) {
    this.invalidate("endDate", "End date must be after start date")
  }
  next()
})

// Validate discount value based on discount type
campaignSchema.pre("validate", function (next) {
  if (this.discountType === "percentage" && (this.discountValue <= 0 || this.discountValue > 100)) {
    this.invalidate("discountValue", "Percentage discount must be between 1 and 100")
  }
  next()
})

const Campaign = mongoose.model("Campaign", campaignSchema)

export default Campaign
