import mongoose from "mongoose"

const reviewSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      default: "Anonymous",
    },
    productSlug: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const Review = mongoose.model("Review", reviewSchema)
export default Review