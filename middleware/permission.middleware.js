import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"

// ✅ Permission-based middleware
export const hasPermission = (module, action) => {
  return (req, res, next) => {
    console.log(`🛡️ Permission check: ${module}.${action}`)
    console.log("User role:", req.user?.role)
    console.log("User permissions:", req.user?.getPermissions ? req.user.getPermissions() : req.user?.permissions)

    if (!req.user) {
      console.log("❌ No user found for permission check")
      return next(new AppError("Authentication required", 401))
    }

    // Check if user has permission
    const hasAccess = req.user.hasPermission ? req.user.hasPermission(module, action) : false

    if (!hasAccess) {
      console.log(`❌ Permission denied: ${module}.${action}`)
      return next(new AppError(`You don't have permission to ${action} ${module}`, 403))
    }

    console.log(`✅ Permission granted: ${module}.${action}`)
    next()
  }
}

// ✅ Advanced permission check with custom logic
export const checkPermission = (permissionCheck) => {
  return (req, res, next) => {
    if (!permissionCheck(req.user, req)) {
      console.log("❌ Custom permission check failed")
      return next(new AppError("Access denied", 403))
    }
    next()
  }
}

// ✅ Multiple permissions check (any of the permissions)
export const hasAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401))
    }

    for (const { module, action } of permissions) {
      if (req.user.hasPermission(module, action)) {
        console.log(`✅ Granted via ${module}.${action}`)
        return next()
      }
    }

    console.log("❌ No matching permissions found")
    return next(new AppError("Insufficient permissions", 403))
  }
}

// ✅ All permissions check (must have all permissions)
export const hasAllPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401))
    }

    for (const { module, action } of permissions) {
      if (!req.user.hasPermission(module, action)) {
        console.log(`❌ Missing permission: ${module}.${action}`)
        return next(new AppError(`Missing permission: ${action} ${module}`, 403))
      }
    }

    console.log("✅ All permissions granted")
    next()
  }
}