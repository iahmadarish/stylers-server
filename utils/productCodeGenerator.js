export const generateProductCode = (productName, color, size) => {
  // Generate a product code based on product name, color, and size
  const nameCode = productName.substring(0, 3).toUpperCase()
  const colorCode = color.substring(0, 2).toUpperCase()
  const sizeCode = size.toUpperCase()
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")

  return `${nameCode}-${colorCode}-${sizeCode}-${randomNum}`
}

export const generateUniqueProductCode = async (Product, productName, color, size) => {
  let productCode
  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  while (!isUnique && attempts < maxAttempts) {
    productCode = generateProductCode(productName, color, size)

    // Check if this code already exists in the database
    const existingProduct = await Product.findOne({
      "variants.productCode": productCode,
    })

    if (!existingProduct) {
      isUnique = true
    }
    attempts++
  }

  if (!isUnique) {
    // Fallback: add timestamp to ensure uniqueness
    productCode = `${generateProductCode(productName, color, size)}-${Date.now()}`
  }

  return productCode
}
