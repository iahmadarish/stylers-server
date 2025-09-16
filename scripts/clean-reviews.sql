-- ✅ Database থেকে invalid reviews clean করুন
-- MongoDB shell এ এই commands চালান:

-- 1. Remove reviews with null productId
db.reviews.deleteMany({ productId: null })

-- 2. Remove isApproved field from all reviews
db.reviews.updateMany({}, { $unset: { isApproved: "" } })

-- 3. Verify the cleanup
db.reviews.find().limit(5)
