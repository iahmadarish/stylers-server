db.reviews.updateMany({}, { $unset: { isApproved: "" } })

-- Verify the change
db.reviews.find().limit(5)
