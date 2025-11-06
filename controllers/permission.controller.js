import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import User from "../models/User.js"

// Available modules and actions
export const AVAILABLE_MODULES = {
  PRODUCTS: 'products',
  ORDERS: 'orders', 
  CUSTOMERS: 'customers',
  USERS: 'users',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  CATEGORIES: 'categories',
  INVENTORY: 'inventory',
  CAMPAIGNS: 'campaigns',
  BLOGS: 'blogs'
}

export const AVAILABLE_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
}

// Get all available permissions (for admin dashboard)
export const getAvailablePermissions = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    data: {
      modules: AVAILABLE_MODULES,
      actions: AVAILABLE_ACTIONS
    }
  })
})

// Update user permissions
export const updateUserPermissions = catchAsync(async (req, res, next) => {
  const { userId } = req.params
  const { permissions } = req.body

  console.log("🔄 Updating permissions for user:", userId)
  console.log("New permissions:", permissions)

  // Only admin can update permissions
  if (req.user.role !== 'admin') {
    return next(new AppError("Only admin can update permissions", 403))
  }

  const user = await User.findById(userId)
  if (!user) {
    return next(new AppError("User not found", 404))
  }

  // Cannot modify admin permissions
  if (user.role === 'admin') {
    return next(new AppError("Cannot modify admin permissions", 400))
  }

  // Validate permissions structure
  for (const [module, actions] of Object.entries(permissions)) {
    if (!Object.values(AVAILABLE_MODULES).includes(module)) {
      return next(new AppError(`Invalid module: ${module}`, 400))
    }
    
    if (!Array.isArray(actions)) {
      return next(new AppError(`Actions for ${module} must be an array`, 400))
    }
    
    for (const action of actions) {
      if (!Object.values(AVAILABLE_ACTIONS).includes(action)) {
        return next(new AppError(`Invalid action: ${action} for module ${module}`, 400))
      }
    }
  }

  // ✅ FIXED: Use Mongoose's set method for Map type
  user.permissions = permissions
  await user.save({ validateBeforeSave: false })

  console.log("✅ Permissions updated successfully")

  // ✅ FIXED: Send proper response
  res.status(200).json({
    status: "success",
    message: "Permissions updated successfully",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    }
  })
})

// Get user permissions
export const getUserPermissions = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
  
  if (!user) {
    return next(new AppError("User not found", 404))
  }

  // ✅ FIXED: Convert Map to Object if needed
  const userPermissions = user.permissions instanceof Map 
    ? Object.fromEntries(user.permissions.entries())
    : user.permissions

  res.status(200).json({
    status: "success",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: userPermissions || {}
      }
    }
  })
})

// Get current user permissions
export const getMyPermissions = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id)
  
  if (!user) {
    return next(new AppError("User not found", 404))
  }

  // ✅ FIXED: Convert Map to Object if needed
  const userPermissions = user.permissions instanceof Map 
    ? Object.fromEntries(user.permissions.entries())
    : user.permissions

  res.status(200).json({
    status: "success",
    data: {
      permissions: userPermissions || {},
      role: user.role
    }
  })
})

// Reset permissions to role default
export const resetPermissions = catchAsync(async (req, res, next) => {
  const { userId } = req.params

  if (req.user.role !== 'admin') {
    return next(new AppError("Only admin can reset permissions", 403))
  }

  const user = await User.findById(userId)
  if (!user) {
    return next(new AppError("User not found", 404))
  }

  // ✅ FIXED: Set permissions to undefined to trigger default function
  user.permissions = undefined
  await user.save({ validateBeforeSave: false })

  // ✅ FIXED: Convert Map to Object if needed
  const userPermissions = user.permissions instanceof Map 
    ? Object.fromEntries(user.permissions.entries())
    : user.permissions

  res.status(200).json({
    status: "success",
    message: "Permissions reset to default",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: userPermissions || {}
      }
    }
  })
})