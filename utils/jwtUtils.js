import jwt from "jsonwebtoken"

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  })
}

// Send JWT token as cookie
export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id)

  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  }

  res.cookie("jwt", token, cookieOptions)

  // Remove password from output
  user.password = undefined

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  })
}
