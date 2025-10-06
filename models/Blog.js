// /backend/models/Blog.js

import mongoose from 'mongoose';

const FaqSchema = new mongoose.Schema({
    question: { 
        type: String, 
        required: true,
        trim: true 
    },
    answer: { 
        type: String, 
        required: true 
    }
}, { _id: false });

const BlogSchema = new mongoose.Schema({
    // Core Content
    blogTitle: { 
        type: String, 
        required: true, 
        trim: true 
    },
    content: { 
        type: String, 
        required: true 
    },

    // SEO Meta Fields
    metaTitle: { 
        type: String, 
        trim: true, 
        maxlength: 70 
    },
    metaDescription: { 
        type: String, 
        trim: true, 
        maxlength: 160 
    },
    
    // Structured Data for FAQ Schema
    faqJson: { 
        type: [FaqSchema],
        default: [],
    },
    
    // Timestamps
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: {
        type: Date, 
        default: Date.now 
    }
});

// সেভ করার আগে updatedAt আপডেট করা
BlogSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Blog = mongoose.model('Blog', BlogSchema);
export default Blog;