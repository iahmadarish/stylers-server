import { v2 as cloudinary } from "cloudinary"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import multer from "multer"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Create storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "stylers-outfit",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 100000, height: 100000, crop: "limit" }],
  },
})

// Create category image storage
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "stylers-outfit/categories",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
})

// Create product image storage
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "stylers-outfit/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 100000, height: 100000, crop: "limit" }],
  },
})

// Create campaign image storage
const campaignStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "stylers-outfit/campaigns",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 600, crop: "limit" }],
  },
})

// Create upload middleware
export const upload = multer({ storage: storage })
export const categoryUpload = multer({ storage: categoryStorage })
export const productUpload = multer({ storage: productStorage })
export const campaignUpload = multer({ storage: campaignStorage })

// Function to delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    if (!publicId) return
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error)
  }
}

// Function to extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
  if (!url) return null
  try {
    // Extract the public ID from the URL
    const splitUrl = url.split("/")
    const filename = splitUrl[splitUrl.length - 1]
    // Remove any query parameters
    const filenameWithoutParams = filename.split("?")[0]
    // Remove file extension
    const publicId = filenameWithoutParams.split(".")[0]

    // Get the folder path
    const folderPath = splitUrl.slice(splitUrl.indexOf("stylers-outfit")).slice(0, -1).join("/")

    return `${folderPath}/${publicId}`
  } catch (error) {
    console.error("Error extracting public ID:", error)
    return null
  }
}

export default cloudinary
