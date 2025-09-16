// import jwt from "jsonwebtoken"
// import User from "../models/User.js"
// import catchAsync from "../utils/catchAsync.js"
// import AppError from "../utils/appError.js"

// // Protect routes - require authentication
// export const protect = catchAsync(async (req, res, next) => {
//   console.log("🔐 Auth middleware - protect")

//   // 1) Getting token and check if it's there
//   let token
//   if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
//     token = req.headers.authorization.split(" ")[1]
//   } else if (req.cookies.jwt) {
//     token = req.cookies.jwt
//   }

//   console.log("🎫 Token received:", !!token)

//   if (!token) {
//     console.log("❌ No token provided")
//     return next(new AppError("You are not logged in! Please log in to get access.", 401))
//   }

//   try {
//     // 2) Verification token
//     console.log("🔍 Verifying token...")
//     const decoded = jwt.verify(token, process.env.JWT_SECRET)
//     console.log("✅ Token decoded, user ID:", decoded.id)

//     // 3) Check if user still exists
//     const currentUser = await User.findById(decoded.id)
//     if (!currentUser) {
//       console.log("❌ User not found for ID:", decoded.id)
//       return next(new AppError("The user belonging to this token does no longer exist.", 401))
//     }

//     console.log("👤 User found:", currentUser.email, "Role:", currentUser.role)

//     // 4) Grant access to protected route
//     req.user = currentUser
//     next()
//   } catch (error) {
//     console.error("🚨 Token verification error:", error.message)
//     return next(new AppError("Invalid token. Please log in again!", 401))
//   }
// })

// // Optional authentication - don't require authentication but set user if available
// export const optionalAuth = catchAsync(async (req, res, next) => {
//   console.log("🔐 Auth middleware - optionalAuth")

//   // 1) Getting token and check if it's there
//   let token
//   if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
//     token = req.headers.authorization.split(" ")[1]
//   }

//   // If no token, continue without setting user
//   if (!token) {
//     console.log("ℹ️ No token provided, continuing as guest")
//     return next()
//   }

//   try {
//     // 2) Verification token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET)

//     // 3) Check if user still exists
//     const currentUser = await User.findById(decoded.id)
//     if (!currentUser) {
//       console.log("⚠️ User not found, continuing as guest")
//       return next()
//     }

//     // Set user if authentication is valid
//     req.user = currentUser
//     console.log("✅ Optional auth successful for:", currentUser.email)
//   } catch (error) {
//     // If token is invalid, continue without setting user
//     console.log("⚠️ Invalid token in optional auth, continuing as guest")
//   }

//   next()
// })

// // Restrict to certain roles
// export const restrictTo = (...roles) => {
//   return (req, res, next) => {
//     console.log("🛡️ Role restriction check")
//     console.log("Required roles:", roles)
//     console.log("User role:", req.user?.role)

//     if (!roles.includes(req.user.role)) {
//       console.log("❌ Access denied - insufficient role")
//       return next(new AppError("You do not have permission to perform this action", 403))
//     }

//     console.log("✅ Role check passed")
//     next()
//   }
// }


import jwt from "jsonwebtoken"
import User from "../models/User.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"

// Protect routes - require authentication
export const protect = catchAsync(async (req, res, next) => {
  console.log("🔐 Auth middleware - protect")

  // 1) Getting token and check if it's there
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt
  }

  console.log("🎫 Token received:", !!token)

  if (!token) {
    console.log("❌ No token provided")
    return next(new AppError("You are not logged in! Please log in to get access.", 401))
  }

  try {
    // 2) Verification token
    console.log("🔍 Verifying token...")
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("✅ Token decoded, user ID:", decoded.id)

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id)
    if (!currentUser) {
      console.log("❌ User not found for ID:", decoded.id)
      return next(new AppError("The user belonging to this token does no longer exist.", 401))
    }

    console.log("👤 User found:", currentUser.email, "Role:", currentUser.role)

    // 4) Grant access to protected route
    req.user = currentUser
    next()
  } catch (error) {
    console.error("🚨 Token verification error:", error.message)
    return next(new AppError("Invalid token. Please log in again!", 401))
  }
})

// Optional authentication - don't require authentication but set user if available
export const optionalAuth = catchAsync(async (req, res, next) => {
  console.log("🔐 Auth middleware - optionalAuth")

  // 1) Getting token and check if it's there
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  // If no token, continue without setting user
  if (!token) {
    console.log("ℹ️ No token provided, continuing as guest")
    return next()
  }

  try {
    // 2) Verification token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id)
    if (!currentUser) {
      console.log("⚠️ User not found, continuing as guest")
      return next()
    }

    // Set user if authentication is valid
    req.user = currentUser
    console.log("✅ Optional auth successful for:", currentUser.email)
  } catch (error) {
    // If token is invalid, continue without setting user
    console.log("⚠️ Invalid token in optional auth, continuing as guest")
  }

  next()
})

// Restrict to certain roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log("🛡️ Role restriction check")
    console.log("Required roles:", roles)
    console.log("User role:", req.user?.role)

    if (!roles.includes(req.user.role)) {
      console.log("❌ Access denied - insufficient role")
      return next(new AppError("You do not have permission to perform this action", 403))
    }

    console.log("✅ Role check passed")
    next()
  }
}

// ✅ Admin middleware - check if user is admin
export const admin = (req, res, next) => {
  console.log("👑 Admin check")
  console.log("User role:", req.user?.role)

  if (!req.user || req.user.role !== "admin") {
    console.log("❌ Access denied - admin required")
    return next(new AppError("You do not have permission to perform this action. Admin access required.", 403))
  }

  console.log("✅ Admin check passed")
  next()
}