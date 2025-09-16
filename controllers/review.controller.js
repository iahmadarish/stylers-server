import Review from "../models/Review.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"

// Create a new review
export const createReview = async (req, res, next) => {
  try {
    const { productSlug, rating, comment, userName } = req.body

    if (!productSlug || !rating || !comment) {
      return res.status(400).json({ message: "Required fields missing" })
    }

    const review = await Review.create({
      userName: userName || "Anonymous",
      productSlug,
      rating: Number(rating),
      comment: comment.trim(),
    })

    res.status(201).json({
      status: "success",
      message: "Review created successfully",
      data: { review },
    })
  } catch (err) {
    console.error("Review create error:", err)
    res.status(500).json({ status: "error", message: "Something went wrong" })
  }
}

// Get all reviews for a product
export const getProductReviews = catchAsync(async (req, res, next) => {
  const { slug } = req.params

  const reviews = await Review.find({ productSlug: slug }).sort("-createdAt")

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  })
})

// Get all reviews by a user
export const getUserReviews = catchAsync(async (req, res, next) => {
  const { userId } = req.params

  const reviews = await Review.find({ userId })
    .populate("userId", "name")
    .sort("-createdAt")

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: {
      reviews,
    },
  })
})

// Get all reviews
export const getReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find().populate("userId", "name").sort("-createdAt")

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  })
})

// Get a single review
export const getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate("userId", "name")

  if (!review) {
    return next(new AppError("Review not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: { review },
  })
})

// Update a review
export const updateReview = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { rating, comment } = req.body
  const userId = req.user.id

  const review = await Review.findById(id)

  if (!review) {
    return next(new AppError("Review not found", 404))
  }

  // Only owner can update
  if (review.userId.toString() !== userId) {
    return next(new AppError("Not authorized to update this review", 403))
  }

  const updatedReview = await Review.findByIdAndUpdate(
    id,
    { rating, comment },
    {
      new: true,
      runValidators: true,
    },
  ).populate("userId", "name")

  res.status(200).json({
    status: "success",
    data: { review: updatedReview },
  })
})

// Delete a review
export const deleteReview = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const userId = req.user.id

  const review = await Review.findById(id)

  if (!review) {
    return next(new AppError("Review not found", 404))
  }

  // Only owner can delete
  if (review.userId.toString() !== userId) {
    return next(new AppError("You are not authorized to delete this review", 403))
  }

  await Review.findByIdAndDelete(id)

  res.status(204).json({
    status: "success",
    data: null,
  })
})