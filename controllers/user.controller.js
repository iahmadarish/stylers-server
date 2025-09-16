import User from "../models/User.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = catchAsync(async (req, res, next) => {
  const users = await User.find()

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  })
})

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  })
})

// @desc    Update user
// @route   PATCH /api/users/:id
// @access  Private/Admin
export const updateUser = catchAsync(async (req, res, next) => {

  
  // Prevent password update through this route
  if (req.body.password) {
    return next(new AppError("This route is not for password updates. Please use /update-password.", 400))
  }

  // Filter out unwanted fields
  const filteredBody = filterObj(req.body, "name", "email", "role")

  const user = await User.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true,
  })

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  })
})

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id)

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// @desc    Update current user profile
// @route   PATCH /api/users/update-profile
// @access  Private
export const updateProfile = catchAsync(async (req, res, next) => {
  // Prevent password update through this route
  if (req.body.password) {
    return next(new AppError("This route is not for password updates. Please use /update-password.", 400))
  }

  // Filter out unwanted fields
  const filteredBody = filterObj(req.body, "name", "email")

  const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  })
})

// Helper function to filter object
const filterObj = (obj, ...allowedFields) => {
  const newObj = {}
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el]
  })
  return newObj
}
