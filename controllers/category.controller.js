import ParentCategory from "../models/ParentCategory.js"
import SubCategory from "../models/SubCategory.js"
import DressType from "../models/DressType.js"
import Style from "../models/Style.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import { deleteImage, getPublicIdFromUrl } from "../utils/cloudinary.js"

// PARENT CATEGORY CONTROLLERS
// @desc    Create a parent category
// @route   POST /api/categories/parent
// @access  Private/Admin
export const createParentCategory = catchAsync(async (req, res, next) => {
  const { name, description, isActive } = req.body

  // Handle image upload
  const image = req.file ? req.file.path : undefined

  console.log("Creating parent category with image:", image)

  const category = await ParentCategory.create({
    name,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
  })

  res.status(201).json({
    status: "success",
    data: {
      category,
    },
  })
})

// @desc    Get all parent categories
// @route   GET /api/categories/parent
// @access  Public
export const getParentCategories = catchAsync(async (req, res, next) => {
  const categories = await ParentCategory.find()

  res.status(200).json({
    status: "success",
    results: categories.length,
    data: {
      categories,
    },
  })
})

// @desc    Get parent category by ID
// @route   GET /api/categories/parent/:id
// @access  Public
export const getParentCategory = catchAsync(async (req, res, next) => {
  const category = await ParentCategory.findById(req.params.id)

  if (!category) {
    return next(new AppError("Category not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  })
})

// @desc    Update parent category
// @route   PATCH /api/categories/parent/:id
// @access  Private/Admin
export const updateParentCategory = catchAsync(async (req, res, next) => {
  const { name, description, isActive } = req.body

  // Get existing category
  const existingCategory = await ParentCategory.findById(req.params.id)
  if (!existingCategory) {
    return next(new AppError("Category not found", 404))
  }

  // Handle image upload
  let image = existingCategory.image
  if (req.file) {
    console.log("Updating with new image:", req.file.path)

    // Delete old image if exists
    if (existingCategory.image) {
      try {
        const publicId = getPublicIdFromUrl(existingCategory.image)
        console.log("Deleting old image with public ID:", publicId)
        await deleteImage(publicId)
      } catch (error) {
        console.error("Error deleting old image:", error)
      }
    }
    image = req.file.path
  }

  const category = await ParentCategory.findByIdAndUpdate(
    req.params.id,
    {
      name,
      description,
      isActive: isActive === "true" || isActive === true,
      image,
    },
    {
      new: true,
      runValidators: true,
    },
  )

  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  })
})

// @desc    Delete parent category
// @route   DELETE /api/categories/parent/:id
// @access  Private/Admin
export const deleteParentCategory = catchAsync(async (req, res, next) => {
  const category = await ParentCategory.findById(req.params.id)

  if (!category) {
    return next(new AppError("Category not found", 404))
  }

  // Delete image from cloudinary if exists
  if (category.image) {
    const publicId = getPublicIdFromUrl(category.image)
    await deleteImage(publicId)
  }

  await ParentCategory.findByIdAndDelete(req.params.id)

  // Delete all related subcategories
  const subCategories = await SubCategory.find({ parentCategoryId: req.params.id })

  // Delete subcategory images
  for (const subCategory of subCategories) {
    if (subCategory.image) {
      const publicId = getPublicIdFromUrl(subCategory.image)
      await deleteImage(publicId)
    }

    // Find and delete dress types
    const dressTypes = await DressType.find({ subCategoryId: subCategory._id })

    // Delete dress type images
    for (const dressType of dressTypes) {
      if (dressType.image) {
        const publicId = getPublicIdFromUrl(dressType.image)
        await deleteImage(publicId)
      }

      // Find and delete styles
      const styles = await Style.find({ dressTypeId: dressType._id })

      // Delete style images
      for (const style of styles) {
        if (style.image) {
          const publicId = getPublicIdFromUrl(style.image)
          await deleteImage(publicId)
        }
      }

      // Delete styles
      await Style.deleteMany({ dressTypeId: dressType._id })
    }

    // Delete dress types
    await DressType.deleteMany({ subCategoryId: subCategory._id })
  }

  // Delete subcategories
  await SubCategory.deleteMany({ parentCategoryId: req.params.id })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// SUB CATEGORY CONTROLLERS
// @desc    Create a sub category
// @route   POST /api/categories/sub
// @access  Private/Admin
export const createSubCategory = catchAsync(async (req, res, next) => {
  const { name, parentCategoryId, description, isActive } = req.body

  // Check if parent category exists
  const parentCategory = await ParentCategory.findById(parentCategoryId)
  if (!parentCategory) {
    return next(new AppError("Parent category not found", 404))
  }

  // Handle image upload
  const image = req.file ? req.file.path : undefined

  const subCategory = await SubCategory.create({
    name,
    parentCategoryId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
  })

  res.status(201).json({
    status: "success",
    data: {
      subCategory,
    },
  })
})

// @desc    Get all sub categories
// @route   GET /api/categories/sub
// @access  Public
export const getSubCategories = catchAsync(async (req, res, next) => {
  const filter = {}

  // Filter by parent category if provided
  if (req.query.parentCategoryId) {
    filter.parentCategoryId = req.query.parentCategoryId
  }

  const subCategories = await SubCategory.find(filter).populate("parentCategoryId")

  res.status(200).json({
    status: "success",
    results: subCategories.length,
    data: {
      subCategories,
    },
  })
})

// @desc    Get sub category by ID
// @route   GET /api/categories/sub/:id
// @access  Public
export const getSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findById(req.params.id).populate("parentCategoryId")

  if (!subCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      subCategory,
    },
  })
})

// @desc    Update sub category
// @route   PATCH /api/categories/sub/:id
// @access  Private/Admin
export const updateSubCategory = catchAsync(async (req, res, next) => {
  const { name, parentCategoryId, description, isActive } = req.body

  // Check if parent category exists if it's being updated
  if (parentCategoryId) {
    const parentCategory = await ParentCategory.findById(parentCategoryId)
    if (!parentCategory) {
      return next(new AppError("Parent category not found", 404))
    }
  }

  // Get existing subcategory
  const existingSubCategory = await SubCategory.findById(req.params.id)
  if (!existingSubCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  // Handle image upload
  let image = existingSubCategory.image
  if (req.file) {
    // Delete old image if exists
    if (existingSubCategory.image) {
      const publicId = getPublicIdFromUrl(existingSubCategory.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }

  const subCategory = await SubCategory.findByIdAndUpdate(
    req.params.id,
    {
      name,
      parentCategoryId,
      description,
      isActive: isActive === "true" || isActive === true,
      image,
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate("parentCategoryId")

  if (!subCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      subCategory,
    },
  })
})

// @desc    Delete sub category
// @route   DELETE /api/categories/sub/:id
// @access  Private/Admin
export const deleteSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findById(req.params.id)

  if (!subCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  // Delete image from cloudinary if exists
  if (subCategory.image) {
    const publicId = getPublicIdFromUrl(subCategory.image)
    await deleteImage(publicId)
  }

  await SubCategory.findByIdAndDelete(req.params.id)

  // Find and delete dress types
  const dressTypes = await DressType.find({ subCategoryId: req.params.id })

  // Delete dress type images
  for (const dressType of dressTypes) {
    if (dressType.image) {
      const publicId = getPublicIdFromUrl(dressType.image)
      await deleteImage(publicId)
    }

    // Find and delete styles
    const styles = await Style.find({ dressTypeId: dressType._id })

    // Delete style images
    for (const style of styles) {
      if (style.image) {
        const publicId = getPublicIdFromUrl(style.image)
        await deleteImage(publicId)
      }
    }

    // Delete styles
    await Style.deleteMany({ dressTypeId: dressType._id })
  }

  // Delete dress types
  await DressType.deleteMany({ subCategoryId: req.params.id })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// DRESS TYPE CONTROLLERS
// @desc    Create a dress type
// @route   POST /api/categories/dress-type
// @access  Private/Admin
export const createDressType = catchAsync(async (req, res, next) => {
  const { name, subCategoryId, description, isActive } = req.body

  // Check if sub category exists
  const subCategory = await SubCategory.findById(subCategoryId)
  if (!subCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  // Handle image upload
  const image = req.file ? req.file.path : undefined

  const dressType = await DressType.create({
    name,
    subCategoryId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
  })

  res.status(201).json({
    status: "success",
    data: {
      dressType,
    },
  })
})

// @desc    Get all dress types
// @route   GET /api/categories/dress-type
// @access  Public
export const getDressTypes = catchAsync(async (req, res, next) => {
  const filter = {}

  // Filter by sub category if provided
  if (req.query.subCategoryId) {
    filter.subCategoryId = req.query.subCategoryId
  }

  const dressTypes = await DressType.find(filter).populate({
    path: "subCategoryId",
    populate: {
      path: "parentCategoryId",
    },
  })

  res.status(200).json({
    status: "success",
    results: dressTypes.length,
    data: {
      dressTypes,
    },
  })
})

// @desc    Get dress type by ID
// @route   GET /api/categories/dress-type/:id
// @access  Public
export const getDressType = catchAsync(async (req, res, next) => {
  const dressType = await DressType.findById(req.params.id).populate({
    path: "subCategoryId",
    populate: {
      path: "parentCategoryId",
    },
  })

  if (!dressType) {
    return next(new AppError("Dress type not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      dressType,
    },
  })
})

// @desc    Update dress type
// @route   PATCH /api/categories/dress-type/:id
// @access  Private/Admin
export const updateDressType = catchAsync(async (req, res, next) => {
  const { name, subCategoryId, description, isActive } = req.body

  // Check if sub category exists if it's being updated
  if (subCategoryId) {
    const subCategory = await SubCategory.findById(subCategoryId)
    if (!subCategory) {
      return next(new AppError("Sub category not found", 404))
    }
  }

  // Get existing dress type
  const existingDressType = await DressType.findById(req.params.id)
  if (!existingDressType) {
    return next(new AppError("Dress type not found", 404))
  }

  // Handle image upload
  let image = existingDressType.image
  if (req.file) {
    // Delete old image if exists
    if (existingDressType.image) {
      const publicId = getPublicIdFromUrl(existingDressType.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }

  const dressType = await DressType.findByIdAndUpdate(
    req.params.id,
    {
      name,
      subCategoryId,
      description,
      isActive: isActive === "true" || isActive === true,
      image,
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate({
    path: "subCategoryId",
    populate: {
      path: "parentCategoryId",
    },
  })

  if (!dressType) {
    return next(new AppError("Dress type not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      dressType,
    },
  })
})

// @desc    Delete dress type
// @route   DELETE /api/categories/dress-type/:id
// @access  Private/Admin
export const deleteDressType = catchAsync(async (req, res, next) => {
  const dressType = await DressType.findById(req.params.id)

  if (!dressType) {
    return next(new AppError("Dress type not found", 404))
  }

  // Delete image from cloudinary if exists
  if (dressType.image) {
    const publicId = getPublicIdFromUrl(dressType.image)
    await deleteImage(publicId)
  }

  await DressType.findByIdAndDelete(req.params.id)

  // Find and delete styles
  const styles = await Style.find({ dressTypeId: req.params.id })

  // Delete style images
  for (const style of styles) {
    if (style.image) {
      const publicId = getPublicIdFromUrl(style.image)
      await deleteImage(publicId)
    }
  }

  // Delete styles
  await Style.deleteMany({ dressTypeId: req.params.id })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// STYLE CONTROLLERS
// @desc    Create a style
// @route   POST /api/categories/style
// @access  Private/Admin
export const createStyle = catchAsync(async (req, res, next) => {
  const { name, dressTypeId, description, isActive } = req.body

  // Check if dress type exists
  const dressType = await DressType.findById(dressTypeId)
  if (!dressType) {
    return next(new AppError("Dress type not found", 404))
  }

  // Handle image upload
  const image = req.file ? req.file.path : undefined

  const style = await Style.create({
    name,
    dressTypeId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
  })

  res.status(201).json({
    status: "success",
    data: {
      style,
    },
  })
})

// @desc    Get all styles
// @route   GET /api/categories/style
// @access  Public
export const getStyles = catchAsync(async (req, res, next) => {
  const filter = {}

  // Filter by dress type if provided
  if (req.query.dressTypeId) {
    filter.dressTypeId = req.query.dressTypeId
  }

  const styles = await Style.find(filter).populate({
    path: "dressTypeId",
    populate: {
      path: "subCategoryId",
      populate: {
        path: "parentCategoryId",
      },
    },
  })

  res.status(200).json({
    status: "success",
    results: styles.length,
    data: {
      styles,
    },
  })
})

// @desc    Get style by ID
// @route   GET /api/categories/style/:id
// @access  Public
export const getStyle = catchAsync(async (req, res, next) => {
  const style = await Style.findById(req.params.id).populate({
    path: "dressTypeId",
    populate: {
      path: "subCategoryId",
      populate: {
        path: "parentCategoryId",
      },
    },
  })

  if (!style) {
    return next(new AppError("Style not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      style,
    },
  })
})

// @desc    Update style
// @route   PATCH /api/categories/style/:id
// @access  Private/Admin
export const updateStyle = catchAsync(async (req, res, next) => {
  const { name, dressTypeId, description, isActive } = req.body

  // Check if dress type exists if it's being updated
  if (dressTypeId) {
    const dressType = await DressType.findById(dressTypeId)
    if (!dressType) {
      return next(new AppError("Dress type not found", 404))
    }
  }

  // Get existing style
  const existingStyle = await Style.findById(req.params.id)
  if (!existingStyle) {
    return next(new AppError("Style not found", 404))
  }

  // Handle image upload
  let image = existingStyle.image
  if (req.file) {
    // Delete old image if exists
    if (existingStyle.image) {
      const publicId = getPublicIdFromUrl(existingStyle.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }

  const style = await Style.findByIdAndUpdate(
    req.params.id,
    {
      name,
      dressTypeId,
      description,
      isActive: isActive === "true" || isActive === true,
      image,
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate({
    path: "dressTypeId",
    populate: {
      path: "subCategoryId",
      populate: {
        path: "parentCategoryId",
      },
    },
  })

  if (!style) {
    return next(new AppError("Style not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      style,
    },
  })
})

// @desc    Delete style
// @route   DELETE /api/categories/style/:id
// @access  Private/Admin
export const deleteStyle = catchAsync(async (req, res, next) => {
  const style = await Style.findById(req.params.id)

  if (!style) {
    return next(new AppError("Style not found", 404))
  }

  // Delete image from cloudinary if exists
  if (style.image) {
    const publicId = getPublicIdFromUrl(style.image)
    await deleteImage(publicId)
  }

  await Style.findByIdAndDelete(req.params.id)

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// @desc    Get full category hierarchy
// @route   GET /api/categories/hierarchy
// @access  Public
export const getCategoryHierarchy = catchAsync(async (req, res, next) => {
  const parentCategories = await ParentCategory.find()

  const hierarchy = await Promise.all(
    parentCategories.map(async (parentCategory) => {
      const subCategories = await SubCategory.find({
        parentCategoryId: parentCategory._id,
      })

      const subCategoriesWithChildren = await Promise.all(
        subCategories.map(async (subCategory) => {
          const dressTypes = await DressType.find({
            subCategoryId: subCategory._id,
          })

          const dressTypesWithStyles = await Promise.all(
            dressTypes.map(async (dressType) => {
              const styles = await Style.find({
                dressTypeId: dressType._id,
              })

              return {
                ...dressType.toObject(),
                styles,
              }
            }),
          )

          return {
            ...subCategory.toObject(),
            dressTypes: dressTypesWithStyles,
          }
        }),
      )

      return {
        ...parentCategory.toObject(),
        subCategories: subCategoriesWithChildren,
      }
    }),
  )

  res.status(200).json({
    status: "success",
    data: {
      hierarchy,
    },
  })
})
