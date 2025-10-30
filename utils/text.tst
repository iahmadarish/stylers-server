/ ----------------------------------------------------------------------
// A. Helper Functions
// ----------------------------------------------------------------------

// একটি একক প্রোডাক্টে ক্যাম্পেইন ডিসকাউন্ট প্রয়োগ
// const applyDiscountToProduct = async (product, campaign) => {
//   console.log(`[APPLY] Applying campaign to product: ${product.title}`)
  
//   // ১. শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
//   if (!product.campaignDiscountActive) {
//     product.originalDiscountType = product.discountType
//     product.originalDiscountPercentage = product.discountPercentage || 0
//     product.originalDiscountAmount = product.discountAmount || 0
//     product.originalDiscountStartTime = product.discountStartTime
//     product.originalDiscountEndTime = product.discountEndTime
//     console.log(`[APPLY] Original discount saved: ${product.originalDiscountPercentage}%`)
//   }

//   // ২. ক্যাম্পেইন ডিসকাউন্ট সেট করুন
//   product.campaignDiscountActive = true
//   product.campaignDiscountType = campaign.discountType
//   product.campaignDiscountPercentage = campaign.discountValue
//   product.campaignDiscountAmount = 0
//   product.campaignDiscountStartTime = campaign.startDate
//   product.campaignDiscountEndTime = campaign.endDate

//   // ৩. বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন
//   product.discountType = campaign.discountType
//   product.discountPercentage = campaign.discountValue
//   product.discountAmount = 0
//   product.discountStartTime = campaign.startDate
//   product.discountEndTime = campaign.endDate

//   // ৪. ভেরিয়েন্টগুলোর জন্য ক্যাম্পেইন ডিসকাউন্ট প্রয়োগ
//   if (product.variants && product.variants.length > 0) {
//     for (const variant of product.variants) {
//       // শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
//       if (!variant.campaignDiscountActive) {
//         variant.originalDiscountType = variant.discountType
//         variant.originalDiscountPercentage = variant.discountPercentage || 0
//         variant.originalDiscountAmount = variant.discountAmount || 0
//         variant.originalDiscountStartTime = variant.discountStartTime
//         variant.originalDiscountEndTime = variant.discountEndTime
//       }

//       // ক্যাম্পেইন ডিসকাউন্ট সেট করুন
//       variant.campaignDiscountActive = true
//       variant.campaignDiscountType = campaign.discountType
//       variant.campaignDiscountPercentage = campaign.discountValue
//       variant.campaignDiscountAmount = 0
//       variant.campaignDiscountStartTime = campaign.startDate
//       variant.campaignDiscountEndTime = campaign.endDate

//       // বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন
//       variant.discountType = campaign.discountType
//       variant.discountPercentage = campaign.discountValue
//       variant.discountAmount = 0
//       variant.discountStartTime = campaign.startDate
//       variant.discountEndTime = campaign.endDate
//     }
//   }

//   console.log(`[APPLY] Campaign discount applied: ${campaign.discountValue}%`)
  
//   return product
// }