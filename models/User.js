import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      trim: true,
      match: [/^(\+88)?01[3-9]\d{8}$/, "Please provide a valid phone number"],
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "email"
      },
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "executive"],
      default: "user",
    },

    permissions: {
      type: Map,
      of: [String],
      default: function () {
        const defaultPermissions = {
          user: {},
          executive: {
            dashboard: ['view', 'create', 'update', 'delete'],
            products: ['view', 'create', 'update', 'delete'],
            orders: ['view', 'create', 'update', 'delete'],
            customers: ['view', 'create', 'update', 'delete'],
             categories: ['view', 'create', 'update', 'delete'],
             coupons: ['view', 'create', 'update', 'delete'],
             'coupons-management': ['view', 'create', 'update', 'delete'],
             campaigns: ['view', 'create', 'update', 'delete'],
             settings: ['view', 'create', 'update', 'delete'],
             blogs: ['view', 'create', 'update', 'delete'],
             'store-management': ['view']
          },
          admin: {
            products: ['view', 'create', 'update', 'delete'],
            orders: ['view', 'create', 'update', 'delete'],
            customers: ['view', 'create', 'update', 'delete'],
            users: ['view', 'create', 'update', 'delete'],
            campaigns: ['view', 'create', 'update', 'delete'],
            blogs: ['view', 'create', 'update', 'delete'],
            categories: ['view', 'create', 'update', 'delete'],
            coupons: ['view', 'create', 'update', 'delete'],
            'coupons-management': ['view', 'create', 'update', 'delete'],
            dashboard: ['view'],
            settings: ['view', 'update'],
            'store-management': ['view', 'create', 'update', 'delete']
          }
        };
        return defaultPermissions[this.role] || {};
      }
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ["email", "google", "facebook"],
      default: "email",
    },
    // Email verification with OTP
    emailOTP: String,
    emailOTPExpires: Date,
    emailOTPToken: String,

    // Phone verification with OTP
    phoneOTP: String,
    phoneOTPExpires: Date,
    phoneOTPToken: String,

    // Password reset
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // OAuth IDs
    googleId: String,
    facebookId: String,
  },
  { timestamps: true },
)

// Ensure at least one contact method exists
userSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    return next(new Error("Either email or phone number is required"))
  }
  next()
})

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false
  try {
    return await bcrypt.compare(candidatePassword, this.password)
  } catch (error) {
    console.error("Password comparison error:", error)
    return false
  }
}

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex")

  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

  return resetToken
}

userSchema.methods.hasPermission = function(module, action) {
  // Admin has all permissions
  if (this.role === 'admin') {
    return true
  }
  
  const userPermissions = this.permissions || {}
  const modulePermissions = userPermissions.get ? userPermissions.get(module) : userPermissions[module]
  
  return modulePermissions && modulePermissions.includes(action)
}

// ✅ NEW: Method to get all permissions as object
userSchema.methods.getPermissions = function() {
  const permissions = this.permissions || {}
  
  // Convert Map to object if needed
  if (permissions instanceof Map) {
    const result = {}
    for (const [key, value] of permissions.entries()) {
      result[key] = value
    }
    return result
  }
  
  return permissions
}


userSchema.methods.toJSON = function() {
  const userObject = this.toObject()
  
  // Convert Map to plain object for JSON response
  if (userObject.permissions instanceof Map) {
    userObject.permissions = Object.fromEntries(userObject.permissions.entries())
  }
  
  return userObject
}

// ✅ NEW: Method to get permissions as object
userSchema.methods.getPermissions = function() {
  if (this.permissions instanceof Map) {
    return Object.fromEntries(this.permissions.entries())
  }
  return this.permissions || {}
}

const User = mongoose.model("User", userSchema)

export default User
