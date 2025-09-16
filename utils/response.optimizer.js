// Response optimization utilities
export const optimizeProductForList = (product) => {
  return {
    _id: product._id,
    title: product.title,
    slug: product.slug,
    brand: product.brand,
    price: product.price,
    discountPercentage: product.discountPercentage,
    images: product.images?.slice(0, 2) || [], // Only first 2 images
    colorVariants:
      product.colorVariants?.slice(0, 4).map((cv) => ({
        _id: cv._id,
        name: cv.name,
        code: cv.code,
        images: cv.images?.slice(0, 1) || [], // Only first image per color
      })) || [],
    variants:
      product.variants?.map((v) => ({
        _id: v._id,
        size: v.size,
        price: v.price,
        discountPercentage: v.discountPercentage,
        stock: v.stock,
      })) || [],
    stock: product.stock,
    isFeatured: product.isFeatured,
    hasColorVariants: product.hasColorVariants,
    parentCategory: product.parentCategory,
    subCategory: product.subCategory,
  }
}

export const optimizeProductForDetail = (product) => {
  return {
    ...product,
    // Keep all data but optimize images for initial load
    images: product.images || [],
    colorVariants:
      product.colorVariants?.map((cv) => ({
        ...cv,
        images: cv.images || [],
      })) || [],
  }
}
