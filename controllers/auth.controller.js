
import crypto from "crypto"
import User from "../models/User.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import { sendTokenResponse } from "../utils/jwtUtils.js"
import sendEmail from "../utils/emailService.js"
import sendSMS from "../utils/smsService.js"

// Helper function to detect input type
const detectInputType = (input) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneRegex = /^(\+88)?01[3-9]\d{8}$/

  if (emailRegex.test(input)) return "email"
  if (phoneRegex.test(input)) return "phone"
  return "email" // default
}

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Helper function to validate Bangladeshi phone number
const isValidBangladeshiPhone = (phone) => {
  const phoneRegex = /^(\+88)?01[3-9]\d{8}$/
  return phoneRegex.test(phone)
}

// Helper function to validate name (no numbers allowed)
const isValidName = (name) => {
  const nameRegex = /^[a-zA-Z\s]{2,}$/
  return nameRegex.test(name) && !/\d/.test(name)
}

export const register = catchAsync(async (req, res, next) => {


  const { name, email, phone, password, verificationType } = req.body


  if (!isValidName(name)) {
    return next(new AppError("Name should contain only letters and be at least 2 characters long", 400))
  }

  if (phone && !isValidBangladeshiPhone(phone)) {
    return next(new AppError("Please provide a valid Bangladeshi phone number", 400))
  }

  // Determine the contact method
  let contactField, contactValue
  if (email) {
    contactField = "email"
    contactValue = email
  } else if (phone) {
    contactField = "phone"
    contactValue = phone
  } else {
    return next(new AppError("Please provide email or phone number", 400))
  }

  const detectedType = verificationType || detectInputType(contactValue)
  let existingUser;
  if (detectedType === "email") {
    existingUser = await User.findOne({ email });
  } else {
    existingUser = await User.findOne({ phone });
  }
  if (existingUser) {
    return res.status(400).json({
      status: "error",
      message: "User already exists with this email or phone",
      code: "USER_EXISTS"
    })
  }

  const userData = {
    name,
    password,
    authProvider: "email",
  }
  if (detectedType === "email") {
    userData.email = contactValue
  } else {
    userData.phone = contactValue
  }
  const user = await User.create(userData)

  if (detectedType === "email") {
    const otp = generateOTP()
    const otpToken = crypto.randomBytes(32).toString("hex")
    user.emailOTP = otp
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000
    user.emailOTPToken = crypto.createHash("sha256").update(otpToken).digest("hex")
    await user.save({ validateBeforeSave: false })
    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification - OTP Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Verify Your Email</h1>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <h2 style="color: #28a745; margin-bottom: 10px;">Your Verification Code</h2>
              <div style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px; background-color: white; padding: 15px; border-radius: 5px; display: inline-block; border: 2px dashed #28a745;">
                ${otp}
              </div>
            </div>
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Enter this code in the verification form to complete your registration.
            </p>
            <p style="color: #666; text-align: center; font-size: 14px;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #999; text-align: center; font-size: 12px; margin-top: 30px;">
              If you did not create an account, please ignore this email.
            </p>
          </div>
        `,
      })

      res.status(201).json({
        status: "success",
        message: "User registered successfully. Please check your email for the verification code.",
        token: otpToken,
      })
    } catch (error) {
      user.emailOTP = undefined
      user.emailOTPExpires = undefined
      user.emailOTPToken = undefined
      await user.save({ validateBeforeSave: false })

      return next(new AppError("There was an error sending the verification email. Please try again.", 500))
    }
  } else {
    // Generate OTP for phone
    const otp = generateOTP()
    const otpToken = crypto.randomBytes(32).toString("hex")

    user.phoneOTP = otp
    user.phoneOTPExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
    user.phoneOTPToken = crypto.createHash("sha256").update(otpToken).digest("hex")
    await user.save({ validateBeforeSave: false })

    // Send SMS OTP
    try {
      await sendSMS({
        phone: user.phone,
        message: `Dear Customer, Your One-Time Password (OTP) for PAARÉL is: ${otp}. The OTP will be valid for the next 10 minutes. Enjoy Shopping.`,
      })

      res.status(201).json({
        status: "success",
        message: "User registered successfully. Please check your phone for the verification code.",
        token: otpToken,
      })
    } catch (error) {
      user.phoneOTP = undefined
      user.phoneOTPExpires = undefined
      user.phoneOTPToken = undefined
      await user.save({ validateBeforeSave: false })

      return next(new AppError("There was an error sending the SMS. Please try again.", 500))
    }
  }
})

// @desc    Verify email OTP
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, otp, token } = req.body
  if (!email || !otp || !token) {
    return res.status(400).json({
      status: "error",
      message: "Please provide email, OTP, and token"
    })
  }
  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
  // Find user by email and token
  const user = await User.findOne({
    email,
    emailOTPToken: hashedToken,
    emailOTP: otp,
    emailOTPExpires: { $gt: Date.now() },
  })
  if (!user) {
    // --- CHANGE: Send a direct JSON response ---
    return res.status(400).json({
      status: "error",
      message: "Invalid or expired OTP"
    })
  }
  // Update user
  user.isVerified = true
  user.emailOTP = undefined
  user.emailOTPExpires = undefined
  user.emailOTPToken = undefined
  await user.save()
  // Send token
  sendTokenResponse(user, 200, res)
})

// @desc    Verify phone OTP
// @route   POST /api/auth/verify-phone
// @access  Public
export const verifyPhone = catchAsync(async (req, res, next) => {
  const { phone, otp, token } = req.body
  if (!phone || !otp || !token) {
    return next(new AppError("Please provide phone, OTP, and token", 400))
  }
  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
  // Find user by phone and token
  const user = await User.findOne({
    phone,
    phoneOTPToken: hashedToken,
    phoneOTP: otp,
    phoneOTPExpires: { $gt: Date.now() },
  })
  if (!user) {
    return next(new AppError("Invalid or expired OTP", 400))
  }
  // Update user
  user.isVerified = true
  user.phoneOTP = undefined
  user.phoneOTPExpires = undefined
  user.phoneOTPToken = undefined
  await user.save()
  // Send token
  sendTokenResponse(user, 200, res)
})

// @desc    Login user - FIXED VERSION
// @route   POST /api/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
  console.log("Login request received:", req.body)
  const { email, phone, password } = req.body
  // Check if credential and password exist
  if (!password || (!email && !phone)) {
    return res.status(400).json({
      status: "error",
      message: "Please provide email/phone and password"
    })
  }
  const loginCredential = email || phone
  console.log("Looking for user with credential:", loginCredential)
  // Check if user exists
  const user = await User.findOne({
    $or: [{ email: loginCredential }, { phone: loginCredential }],
  }).select("+password")
  console.log("User found:", user ? (user.email || user.phone) : "No user found")
  // If user not found
  if (!user) {
    return res.status(401).json({
      status: "error",
      message: "User not found! Please register first then log in. Thank you!"
    })
  }
  // If user dont have password 
  if (!user.password) {
    return res.status(401).json({
      status: "error",
      message: "Please login using your social account"
    })
  }
  // checking password
  const isPasswordCorrect = await user.comparePassword(password)
  if (!isPasswordCorrect) {
    console.log("Incorrect password for user:", user.email || user.phone)
    return res.status(401).json({
      status: "error",
      message: "Incorrect email/phone or password"
    })
  }
  // Checking varified users
  if (!user.isVerified) {
    return res.status(401).json({
      status: "error",
      message: "Please verify your account first"
    })
  }
  console.log("Login successful for:", user.name)
  // Send token
  sendTokenResponse(user, 200, res)
})

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = catchAsync(async (req, res, next) => {
  const { email, phone, verificationType } = req.body

  const contactValue = email || phone
  const detectedType = verificationType || detectInputType(contactValue)

  // Find user
  const user = await User.findOne({
    $or: [{ email: contactValue }, { phone: contactValue }],
  })

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  if (user.isVerified) {
    return next(new AppError("User is already verified", 400))
  }

  if (detectedType === "email") {
    // Generate new OTP for email
    const otp = generateOTP()
    const otpToken = crypto.randomBytes(32).toString("hex")

    user.emailOTP = otp
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
    user.emailOTPToken = crypto.createHash("sha256").update(otpToken).digest("hex")
    await user.save({ validateBeforeSave: false })

    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification - OTP Code (Resent)",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Verify Your Email</h1>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <h2 style="color: #28a745; margin-bottom: 10px;">Your Verification Code</h2>
              <div style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px; background-color: white; padding: 15px; border-radius: 5px; display: inline-block; border: 2px dashed #28a745;">
                ${otp}
              </div>
            </div>
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Enter this code in the verification form to complete your registration.
            </p>
            <p style="color: #666; text-align: center; font-size: 14px;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #999; text-align: center; font-size: 12px; margin-top: 30px;">
              If you did not create an account, please ignore this email.
            </p>
          </div>
        `,
      })

      res.status(200).json({
        status: "success",
        message: "OTP resent successfully to your email",
        token: otpToken,
      })
    } catch (error) {
      return next(new AppError("There was an error sending the email. Please try again.", 500))
    }
  } else {
    // Generate new OTP for phone
    const otp = generateOTP()
    const otpToken = crypto.randomBytes(32).toString("hex")

    user.phoneOTP = otp
    user.phoneOTPExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
    user.phoneOTPToken = crypto.createHash("sha256").update(otpToken).digest("hex")
    await user.save({ validateBeforeSave: false })

    try {
      await sendSMS({
        phone: user.phone,
        message: `Your verification code is: ${otp}. This code will expire in 10 minutes.`,
      })

      res.status(200).json({
        status: "success",
        message: "OTP resent successfully to your phone",
        token: otpToken,
      })
    } catch (error) {
      return next(new AppError("There was an error sending the SMS. Please try again.", 500))
    }
  }
})

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
export const logout = (req, res) => {
  res.cookie("jwt", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  })

  res.status(200).json({
    status: "success",
    message: "User logged out successfully",
  })
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id)

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  })
})



export const forgotPassword = catchAsync(async (req, res, next) => {
  const { emailOrPhone } = req.body

  console.log("🔐 Forgot password request for:", emailOrPhone)

  if (!emailOrPhone) {
    return next(new AppError("Please provide email or phone number", 400))
  }

  // Detect input type
  const inputType = detectInputType(emailOrPhone)
  console.log("🔍 Detected input type:", inputType)

  // Get user based on email or phone
  const user = await User.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
  })

  if (!user) {
    return next(new AppError("There is no user with that email or phone number", 404))
  }

  console.log("👤 User found:", user.name, user.email || user.phone)

  if (inputType === "email" && user.email) {
    // Email for  reset link send 
    const resetToken = user.generatePasswordResetToken()
    await user.save({ validateBeforeSave: false })

    const resetURL = `${process.env.FRONTEND_URL || "https://paarel.com"}/reset-password/${resetToken}`

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Request",
        html: `Your password reset link: ${resetURL}. This link will expire in 10 minutes.`,
      })

      res.status(200).json({
        status: "success",
        message: "Password reset link has been sent to your email address",
        method: "email" // Frontend message that confirmed reset link has been sent
      })
    } catch (error) {
      // Error handling
    }
  } else if (inputType === "phone" && user.phone) {
    // send otp in phone
    const otp = generateOTP()
    const otpToken = crypto.randomBytes(32).toString("hex")

    user.phoneOTP = otp
    user.phoneOTPExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
    user.phoneOTPToken = crypto.createHash("sha256").update(otpToken).digest("hex")
    await user.save({ validateBeforeSave: false })

    try {
      await sendSMS({
        phone: user.phone,
        message: `Wellcome to Paarel! Your password reset OTP is: ${otp}. This OTP will expire in 10 minutes.`,
      })

      res.status(200).json({
        status: "success",
        message: "Password reset OTP has been sent to your phone number",
        method: "phone", // 
        token: otpToken, // 
        phone: user.phone // Masked phone number (optional)
      })
    } catch (error) {
      // Error handling
    }
  }
})


// @desc    Reset password
// @route   PATCH /api/auth/reset-password/:token
// @access  Public
export const resetPassword = catchAsync(async (req, res, next) => {
  console.log("Reset password request with token:", req.params.token)
  console.log("New password provided:", !!req.body.password)

  // Get token from params
  const { token } = req.params

  if (!token) {
    return next(new AppError("Reset token is required", 400))
  }

  if (!req.body.password) {
    return next(new AppError("New password is required", 400))
  }

  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

  console.log("Looking for user with hashed token...")

  // Find user by token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  })

  if (!user) {
    console.log("Invalid or expired token")
    return next(new AppError("Invalid or expired reset token", 400))
  }

  console.log("User found for password reset:", user.name, user.email || user.phone)

  // Set new password
  user.password = req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined
  await user.save()

  console.log("Password reset successful")

  // Send success response (don't auto-login for security)
  res.status(200).json({
    status: "success",
    message: "Password has been reset successfully. You can now login with your new password.",
  })
})

// @desc    Update password
// @route   PATCH /api/auth/update-password
// @access  Private
export const updatePassword = catchAsync(async (req, res, next) => {
  // Get user from collection
  const user = await User.findById(req.user.id).select("+password")

  // Check current password
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return next(new AppError("Your current password is incorrect", 401))
  }

  // Update password
  user.password = req.body.newPassword
  await user.save()

  // Send token
  sendTokenResponse(user, 200, res)
})

// @desc    Google OAuth login/register
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = catchAsync(async (req, res, next) => {
  const { name, email, googleId } = req.body

  if (!email || !googleId) {
    return next(new AppError("Please provide email and googleId", 400))
  }

  // Check if user exists
  let user = await User.findOne({ email })

  if (user) {
    // Update googleId if not already set
    if (!user.googleId) {
      user.googleId = googleId
      user.authProvider = "google"
      await user.save({ validateBeforeSave: false })
    }
  } else {
    // Create new user
    user = await User.create({
      name,
      email,
      googleId,
      authProvider: "google",
      isVerified: true, // Google accounts are pre-verified
    })
  }

  // Send token
  sendTokenResponse(user, 200, res)
})

// @desc    Facebook OAuth login/register
// @route   POST /api/auth/facebook
// @access  Public
export const facebookAuth = catchAsync(async (req, res, next) => {
  const { name, email, facebookId } = req.body

  if (!email || !facebookId) {
    return next(new AppError("Please provide email and facebookId", 400))
  }

  // Check if user exists
  let user = await User.findOne({ email })

  if (user) {
    // Update facebookId if not already set
    if (!user.facebookId) {
      user.facebookId = facebookId
      user.authProvider = "facebook"
      await user.save({ validateBeforeSave: false })
    }
  } else {
    // Create new user
    user = await User.create({
      name,
      email,
      facebookId,
      authProvider: "facebook",
      isVerified: true, // Facebook accounts are pre-verified
    })
  }

  // Send token
  sendTokenResponse(user, 200, res)
})


export const verifyPasswordResetOTP = catchAsync(async (req, res, next) => {
  const { phone, otp, token } = req.body

  if (!phone || !otp || !token) {
    return next(new AppError("Please provide phone, OTP, and token", 400))
  }

  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

  // Find user by phone and token
  const user = await User.findOne({
    phone,
    phoneOTPToken: hashedToken,
    phoneOTP: otp,
    phoneOTPExpires: { $gt: Date.now() },
  })

  if (!user) {
    return next(new AppError("Invalid or expired OTP", 400))
  }

  // Generate password reset token
  const resetToken = user.generatePasswordResetToken()
  await user.save({ validateBeforeSave: false })

  res.status(200).json({
    status: "success",
    message: "OTP verified successfully",
    resetToken, // Frontend এ redirect করার জন্য
  })
})

// @desc    Create user directly (Admin only)
// @route   POST /api/auth/create-user
// @access  Private/Admin
export const createUser = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, role } = req.body;

  // Validation
  if (!isValidName(name)) {
    return next(new AppError("Name should contain only letters and be at least 2 characters long", 400));
  }

  if (phone && !isValidBangladeshiPhone(phone)) {
    return next(new AppError("Please provide a valid Bangladeshi phone number", 400));
  }

  if (!email && !phone) {
    return next(new AppError("Please provide email or phone number", 400));
  }

  // Check if user already exists
  let existingUser;
  if (email) {
    existingUser = await User.findOne({ email });
  } else {
    existingUser = await User.findOne({ phone });
  }
  
  if (existingUser) {
    return res.status(400).json({
      status: "error",
      message: "User already exists with this email or phone",
      code: "USER_EXISTS"
    });
  }

  // Create user with admin privileges
  const userData = {
    name,
    password,
    role: role || "user",
    isVerified: true, // Skip verification for admin-created accounts
    authProvider: "email",
    createdBy: req.user.id // Track which admin created this user
  };

  if (email) userData.email = email;
  if (phone) userData.phone = phone;

  const user = await User.create(userData);

  // Send welcome email (optional)
  try {
    if (email) {
      await sendEmail({
        email: user.email,
        subject: "Welcome to Our Platform",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Welcome to Paarel</h1>
            <p style="color: #666;">Hello ${name},</p>
            <p style="color: #666;">An administrator has created an account for you with the role of <strong>${role}</strong>.</p>
            <p style="color: #666;">You can login using:</p>
            <p style="color: #666;">Email: ${email || "Not provided"}</p>
            <p style="color: #666;">Phone: ${phone || "Not provided"}</p>
            <p style="color: #666;">Password: ${password}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || "https://paarel.com"}/login" 
                 style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Login Now
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              For security reasons, we recommend changing your password after first login.
            </p>
          </div>
        `,
      });
    }
  } catch (error) {
    // Don't fail the request if email sending fails
    console.error("Failed to send welcome email:", error);
  }

  res.status(201).json({
    status: "success",
    message: "User created successfully",
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    }
  });
});