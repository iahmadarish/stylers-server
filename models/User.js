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

const User = mongoose.model("User", userSchema)

export default User
