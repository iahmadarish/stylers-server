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
  const { name, description, isActive, metaTitle, metaDescription, aPlusContent } = req.body

  // Handle image upload
  const image = req.file ? req.file.path : undefined

  console.log("Creating parent category with image:", image)

  const category = await ParentCategory.create({
    name,
    description,
    isActive: isActive === "true" || isActive === true,
    metaTitle,
    metaDescription,
    aPlusContent,
    image,
  })

  res.status(201).json({
    status: "success",
    data: {
      category,
    },
  })
})

// @desc    Get all parent categories (Public - only active)
// @route   GET /api/categories/parent
// @access  Public
export const getParentCategories = catchAsync(async (req, res, next) => {
  const categories = await ParentCategory.find({ isActive: true })

  res.status(200).json({
    status: "success",
    results: categories.length,
    data: {
      categories,
    },
  })
})

// @desc    Get all parent categories (Admin - all categories)
// @route   GET /api/categories/parent/admin
// @access  Private/Admin
export const getParentCategoriesForAdmin = catchAsync(async (req, res, next) => {
  const categories = await ParentCategory.find()

  res.status(200).json({
    status: "success",
    results: categories.length,
    data: {
      categories,
    },
  })
})

export const getParentCategoriesForCampaign = async (req, res) => {
  try {
    const categories = await ParentCategory.find({ isActive: true }).select('_id name'); 
    
    res.status(200).json({ 
      success: true, 
      // AddCampaign.tsx এই structureটি আশা করে (যদি `data.parentcategories` বা সরাসরি অ্যারে না থাকে)
      data: { parentcategories: categories }, 
      message: "Parent categories fetched for campaign successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}


// @desc    Get parent category by ID (Public - only if active)
// @route   GET /api/categories/parent/:id
// @access  Public
export const getParentCategory = catchAsync(async (req, res, next) => {
  const category = await ParentCategory.findOne({ 
    _id: req.params.id, 
    isActive: true 
  })

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

// @desc    Get parent category by ID (Admin - any category)
// @route   GET /api/categories/parent/:id/admin
// @access  Private/Admin
export const getParentCategoryForAdmin = catchAsync(async (req, res, next) => {
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
  const { name, description, isActive, metaTitle, metaDescription, aPlusContent } = req.body

  const existingCategory = await ParentCategory.findById(req.params.id)
  if (!existingCategory) {
    return next(new AppError("Category not found", 404))
  }

  const updateFields = {
    name,
    description,
    isActive: isActive === "true" || isActive === true,
    metaTitle, 
    metaDescription,
    aPlusContent
  }

  if (req.file) {
    console.log("Updating with new image:", req.file.path)
    if (existingCategory.image) {
      await deleteImage(getPublicIdFromUrl(existingCategory.image))
    }
    updateFields.image = req.file.path
  } else if (req.body.removeImage === "true" && existingCategory.image) {
    await deleteImage(getPublicIdFromUrl(existingCategory.image))
    updateFields.image = null
  }

  const category = await ParentCategory.findByIdAndUpdate(
    req.params.id,
    updateFields,
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

  if (category.image) {
    const publicId = getPublicIdFromUrl(category.image)
    await deleteImage(publicId)
  }

  await ParentCategory.findByIdAndDelete(req.params.id)

  const subCategories = await SubCategory.find({ parentCategoryId: req.params.id })

  for (const subCategory of subCategories) {
    if (subCategory.image) {
      const publicId = getPublicIdFromUrl(subCategory.image)
      await deleteImage(publicId)
    }

    const dressTypes = await DressType.find({ subCategoryId: subCategory._id })

    for (const dressType of dressTypes) {
      if (dressType.image) {
        const publicId = getPublicIdFromUrl(dressType.image)
        await deleteImage(publicId)
      }

      const styles = await Style.find({ dressTypeId: dressType._id })

      for (const style of styles) {
        if (style.image) {
          const publicId = getPublicIdFromUrl(style.image)
          await deleteImage(publicId)
        }
      }

      await Style.deleteMany({ dressTypeId: dressType._id })
    }

    await DressType.deleteMany({ subCategoryId: subCategory._id })
  }

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
  const { name, parentCategoryId, description, isActive, metaTitle, metaDescription, aPlusContent } = req.body

  const parentCategory = await ParentCategory.findById(parentCategoryId)
  if (!parentCategory) {
    return next(new AppError("Parent category not found", 404))
  }

  const image = req.file ? req.file.path : undefined

  const subCategory = await SubCategory.create({
    name,
    parentCategoryId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
     metaTitle, 
     metaDescription ,
     aPlusContent
  })

  res.status(201).json({
    status: "success",
    data: {
      subCategory,
    },
  })
})

// @desc    Get all sub categories (Public - only active with active parent)
// @route   GET /api/categories/sub
// @access  Public
export const getSubCategories = catchAsync(async (req, res, next) => {
  const filter = { isActive: true }

  if (req.query.parentCategoryId) {
    filter.parentCategoryId = req.query.parentCategoryId
  }

  const subCategories = await SubCategory.find(filter).populate({
    path: "parentCategoryId",
    match: { isActive: true }
  })

  const filteredSubCategories = subCategories.filter(subCat => subCat.parentCategoryId !== null)

  res.status(200).json({
    status: "success",
    results: filteredSubCategories.length,
    data: {
      subCategories: filteredSubCategories,
    },
  })
})

export const getSubCategoriesForCampaign = async (req, res) => {
  try {
    const subCategories = await SubCategory.find({ isActive: true })
      .select('_id name parentCategoryId')
      .populate('parentCategoryId', 'name'); 

    // নামকে Parent Category এর সাথে জুড়ে ফ্রন্টএন্ডের জন্য সাজানো
    const formattedSubCategories = subCategories.map(sub => ({
        _id: sub._id,
        // ফ্রন্টএন্ডে দেখতে সুবিধা হবে: T-Shirt (Men's Fashion)
        name: `${sub.name} (${sub.parentCategoryId ? sub.parentCategoryId.name : 'No Parent'})`, 
        parentCategoryId: sub.parentCategoryId ? sub.parentCategoryId._id : null
    }));
    
    res.status(200).json({ 
      success: true, 
      data: { subcategories: formattedSubCategories }, // ফ্রন্টএন্ডের প্রত্যাশিত structure
      message: "Sub categories fetched for campaign successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
// @desc    Get all sub categories (Admin - all categories)
// @route   GET /api/categories/sub/admin
// @access  Private/Admin
export const getSubCategoriesForAdmin = catchAsync(async (req, res, next) => {
  const filter = {}

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

// @desc    Get sub category by ID (Public - only if active with active parent)
// @route   GET /api/categories/sub/:id
// @access  Public
export const getSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findOne({
    _id: req.params.id,
    isActive: true
  }).populate({
    path: "parentCategoryId",
    match: { isActive: true }
  })

  if (!subCategory || !subCategory.parentCategoryId) {
    return next(new AppError("Sub category not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      subCategory,
    },
  })
})

// @desc    Get sub category by ID (Admin - any category)
// @route   GET /api/categories/sub/:id/admin
// @access  Private/Admin
export const getSubCategoryForAdmin = catchAsync(async (req, res, next) => {
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
  const { name, parentCategoryId, description, isActive, metaTitle, metaDescription, aPlusContent } = req.body

  if (parentCategoryId) {
    const parentCategory = await ParentCategory.findById(parentCategoryId)
    if (!parentCategory) {
      return next(new AppError("Parent category not found", 404))
    }
  }

  const existingSubCategory = await SubCategory.findById(req.params.id)
  if (!existingSubCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  let image = existingSubCategory.image
  if (req.file) {
    if (existingSubCategory.image) {
      const publicId = getPublicIdFromUrl(existingSubCategory.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }

const updateFields = { 
    name,
    parentCategoryId,
    description,
    isActive: isActive === "true" || isActive === true,
    metaTitle, 
    metaDescription,
    aPlusContent
}


if (req.file) {
    if (existingSubCategory.image) {
        const publicId = getPublicIdFromUrl(existingSubCategory.image)
        await deleteImage(publicId)
    }
    updateFields.image = req.file.path
} else if (req.body.removeImage === "true" && existingSubCategory.image) { // <-- নতুন: রিমুভ করার লজিক যোগ করা হলো
    await deleteImage(getPublicIdFromUrl(existingSubCategory.image))
    updateFields.image = null // <-- ডেটাবেসে ইমেজ ফিল্ড null করা হলো
}


  const subCategory = await SubCategory.findByIdAndUpdate(
    req.params.id,
    updateFields, // <-- পরিবর্তন: updateFields অবজেক্ট ব্যবহার করা হলো
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

  if (subCategory.image) {
    const publicId = getPublicIdFromUrl(subCategory.image)
    await deleteImage(publicId)
  }

  await SubCategory.findByIdAndDelete(req.params.id)

  const dressTypes = await DressType.find({ subCategoryId: req.params.id })

  for (const dressType of dressTypes) {
    if (dressType.image) {
      const publicId = getPublicIdFromUrl(dressType.image)
      await deleteImage(publicId)
    }

    const styles = await Style.find({ dressTypeId: dressType._id })

    for (const style of styles) {
      if (style.image) {
        const publicId = getPublicIdFromUrl(style.image)
        await deleteImage(publicId)
      }
    }

    await Style.deleteMany({ dressTypeId: dressType._id })
  }

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
  const { name, subCategoryId, description, isActive,  metaTitle, metaDescription, aPlusContent  } = req.body

  const subCategory = await SubCategory.findById(subCategoryId)
  if (!subCategory) {
    return next(new AppError("Sub category not found", 404))
  }

  const image = req.file ? req.file.path : undefined

  const dressType = await DressType.create({
    name,
    subCategoryId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
     metaTitle, 
     metaDescription,
     aPlusContent 
  })

  res.status(201).json({
    status: "success",
    data: {
      dressType,
    },
  })
})

// @desc    Get all dress types (Public - only active with active parent hierarchy)
// @route   GET /api/categories/dress-type
// @access  Public
export const getDressTypes = catchAsync(async (req, res, next) => {
  const filter = { isActive: true }

  if (req.query.subCategoryId) {
    filter.subCategoryId = req.query.subCategoryId
  }

  const dressTypes = await DressType.find(filter).populate({
    path: "subCategoryId",
    match: { isActive: true },
    populate: {
      path: "parentCategoryId",
      match: { isActive: true }
    }
  })

  const filteredDressTypes = dressTypes.filter(dressType => 
    dressType.subCategoryId && dressType.subCategoryId.parentCategoryId
  )

  res.status(200).json({
    status: "success",
    results: filteredDressTypes.length,
    data: {
      dressTypes: filteredDressTypes,
    },
  })
})

// @desc    Get all dress types (Admin - all categories)
// @route   GET /api/categories/dress-type/admin
// @access  Private/Admin
export const getDressTypesForAdmin = catchAsync(async (req, res, next) => {
  const filter = {}

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

// @desc    Get dress type by ID (Public - only if active with active parent hierarchy)
// @route   GET /api/categories/dress-type/:id
// @access  Public
export const getDressType = catchAsync(async (req, res, next) => {
  const dressType = await DressType.findOne({
    _id: req.params.id,
    isActive: true
  }).populate({
    path: "subCategoryId",
    match: { isActive: true },
    populate: {
      path: "parentCategoryId",
      match: { isActive: true }
    }
  })

  if (!dressType || !dressType.subCategoryId || !dressType.subCategoryId.parentCategoryId) {
    return next(new AppError("Dress type not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      dressType,
    },
  })
})

// @desc    Get dress type by ID (Admin - any category)
// @route   GET /api/categories/dress-type/:id/admin
// @access  Private/Admin
export const getDressTypeForAdmin = catchAsync(async (req, res, next) => {
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
  const { name, subCategoryId, description, isActive,  metaTitle, metaDescription, aPlusContent  } = req.body

  if (subCategoryId) {
    const subCategory = await SubCategory.findById(subCategoryId)
    if (!subCategory) {
      return next(new AppError("Sub category not found", 404))
    }
  }

  const existingDressType = await DressType.findById(req.params.id)
  if (!existingDressType) {
    return next(new AppError("Dress type not found", 404))
  }

  let image = existingDressType.image
  if (req.file) {
    if (existingDressType.image) {
      const publicId = getPublicIdFromUrl(existingDressType.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }




  const updateFields = { 
    name,
    subCategoryId, 
    description,
    isActive: isActive === "true" || isActive === true,
     metaTitle, 
     metaDescription,
     aPlusContent 
}

  if (req.file) {
    if (existingDressType.image) {
        const publicId = getPublicIdFromUrl(existingDressType.image)
        await deleteImage(publicId)
    }
    updateFields.image = req.file.path
} else if (req.body.removeImage === "true" && existingDressType.image) { 
    await deleteImage(getPublicIdFromUrl(existingDressType.image))
    updateFields.image = null
}

 const dressType = await DressType.findByIdAndUpdate(
    req.params.id,
    updateFields,
    {
        new: true,
        runValidators: true,
    },
).populate("subCategoryId")

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

  if (dressType.image) {
    const publicId = getPublicIdFromUrl(dressType.image)
    await deleteImage(publicId)
  }

  await DressType.findByIdAndDelete(req.params.id)

  const styles = await Style.find({ dressTypeId: req.params.id })

  for (const style of styles) {
    if (style.image) {
      const publicId = getPublicIdFromUrl(style.image)
      await deleteImage(publicId)
    }
  }

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
  const { name, dressTypeId, description, isActive,  metaTitle, metaDescription, aPlusContent  } = req.body

  const dressType = await DressType.findById(dressTypeId)
  if (!dressType) {
    return next(new AppError("Dress type not found", 404))
  }

  const image = req.file ? req.file.path : undefined

  const style = await Style.create({
    name,
    dressTypeId,
    description,
    isActive: isActive === "true" || isActive === true,
    image,
    metaTitle, 
    metaDescription,
    aPlusContent 
  })

  res.status(201).json({
    status: "success",
    data: {
      style,
    },
  })
})

// @desc    Get all styles (Public - only active with active parent hierarchy)
// @route   GET /api/categories/style
// @access  Public
export const getStyles = catchAsync(async (req, res, next) => {
  const filter = { isActive: true }

  if (req.query.dressTypeId) {
    filter.dressTypeId = req.query.dressTypeId
  }

  const styles = await Style.find(filter).populate({
    path: "dressTypeId",
    match: { isActive: true },
    populate: {
      path: "subCategoryId",
      match: { isActive: true },
      populate: {
        path: "parentCategoryId",
        match: { isActive: true }
      }
    }
  })

  const filteredStyles = styles.filter(style => 
    style.dressTypeId && 
    style.dressTypeId.subCategoryId && 
    style.dressTypeId.subCategoryId.parentCategoryId
  )

  res.status(200).json({
    status: "success",
    results: filteredStyles.length,
    data: {
      styles: filteredStyles,
    },
  })
})

// @desc    Get all styles (Admin - all categories)
// @route   GET /api/categories/style/admin
// @access  Private/Admin
export const getStylesForAdmin = catchAsync(async (req, res, next) => {
  const filter = {}

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

// @desc    Get style by ID (Public - only if active with active parent hierarchy)
// @route   GET /api/categories/style/:id
// @access  Public
export const getStyle = catchAsync(async (req, res, next) => {
  const style = await Style.findOne({
    _id: req.params.id,
    isActive: true
  }).populate({
    path: "dressTypeId",
    match: { isActive: true },
    populate: {
      path: "subCategoryId",
      match: { isActive: true },
      populate: {
        path: "parentCategoryId",
        match: { isActive: true }
      }
    }
  })

  if (!style || !style.dressTypeId || !style.dressTypeId.subCategoryId || !style.dressTypeId.subCategoryId.parentCategoryId) {
    return next(new AppError("Style not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      style,
    },
  })
})

// @desc    Get style by ID (Admin - any category)
// @route   GET /api/categories/style/:id/admin
// @access  Private/Admin
export const getStyleForAdmin = catchAsync(async (req, res, next) => {
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
  const { name, dressTypeId, description, isActive,  metaTitle, metaDescription, aPlusContent  } = req.body

  if (dressTypeId) {
    const dressType = await DressType.findById(dressTypeId)
    if (!dressType) {
      return next(new AppError("Dress type not found", 404))
    }
  }

  const existingStyle = await Style.findById(req.params.id)
  if (!existingStyle) {
    return next(new AppError("Style not found", 404))
  }

  let image = existingStyle.image
  if (req.file) {
    if (existingStyle.image) {
      const publicId = getPublicIdFromUrl(existingStyle.image)
      await deleteImage(publicId)
    }
    image = req.file.path
  }



 const updateFields = { 
    name,
    dressTypeId, // Style-এর ক্ষেত্রে এটি dressTypeId হবে
    description,
    isActive: isActive === "true" || isActive === true,
    metaTitle, 
    metaDescription, 
    aPlusContent 
}

if (req.file) {
    if (existingStyle.image) {
        const publicId = getPublicIdFromUrl(existingStyle.image)
        await deleteImage(publicId)
    }
    updateFields.image = req.file.path
} else if (req.body.removeImage === "true" && existingStyle.image) {
    await deleteImage(getPublicIdFromUrl(existingStyle.image))
    updateFields.image = null 
}
const style = await Style.findByIdAndUpdate(
    req.params.id,
    updateFields, 
    {
        new: true,
        runValidators: true,
    },
).populate("dressTypeId")

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

// @desc    Get full active category hierarchy
// @route   GET /api/categories/hierarchy
// @access  Public
export const getCategoryHierarchy = catchAsync(async (req, res, next) => {
  const parentCategories = await ParentCategory.find({ isActive: true })

  const hierarchy = await Promise.all(
    parentCategories.map(async (parentCategory) => {
      const subCategories = await SubCategory.find({
        parentCategoryId: parentCategory._id,
        isActive: true
      })

      const subCategoriesWithChildren = await Promise.all(
        subCategories.map(async (subCategory) => {
          const dressTypes = await DressType.find({
            subCategoryId: subCategory._id,
            isActive: true
          })

          const dressTypesWithStyles = await Promise.all(
            dressTypes.map(async (dressType) => {
              const styles = await Style.find({
                dressTypeId: dressType._id,
                isActive: true
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

// @desc    Get full category hierarchy (Admin - all categories)
// @route   GET /api/categories/hierarchy/admin
// @access  Private/Admin
export const getCategoryHierarchyForAdmin = catchAsync(async (req, res, next) => {
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