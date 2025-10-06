import Blog from '../models/Blog.js'; 
import mongoose from 'mongoose'; // নতুন: ID Validation এর জন্য Mongoose ইম্পোর্ট করা হলো

// POST: /api/blogs
export const createBlog = async (req, res) => {
    try {
        const newBlog = new Blog(req.body);
        const savedBlog = await newBlog.save();
        res.status(201).json(savedBlog);
    } catch (err) {
        res.status(400).json({ 
            message: 'Failed to create blog post. Check data validity.', 
            error: err.message 
        });
    }
};

// GET: /api/blogs
export const getAllBlogs = async (req, res) => {
    try {
        // শুধুমাত্র প্রয়োজনীয় ফিল্ডগুলি আনা হচ্ছে (যেমন: BlogSection-এর জন্য)
        const blogs = await Blog.find().select('blogTitle _id category readTime image author date').sort({ createdAt: -1 });
        res.status(200).json(blogs);
    } catch (err) {
        res.status(500).json({ 
            message: 'Error fetching blog posts list.', 
            error: err.message 
        });
    }
};

// GET: /api/blogs/:id
export const getBlogById = async (req, res) => {
    try {
        const id = req.params.id;

        // FIX: Invalid ID ফরম্যাট চেক করে 500 এর পরিবর্তে 404/400 রিটার্ন করা
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: `Blog post not found. ID: ${id} is invalid.` });
        }

        const blog = await Blog.findById(id);
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog post not found.' });
        }
        res.status(200).json(blog);
    } catch (err) {
        // এখন এটি শুধুমাত্র অন্যান্য unexpected server error হ্যান্ডেল করবে
        res.status(500).json({ 
            message: 'Error fetching single blog post.', 
            error: err.message 
        });
    }
};

// PUT: /api/blogs/:id
export const updateBlog = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Invalid Blog ID format for update.' });
        }
        
        const updatedBlog = await Blog.findByIdAndUpdate(
            id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        if (!updatedBlog) {
            return res.status(404).json({ message: 'Blog post not found for update.' });
        }
        res.status(200).json(updatedBlog);
    } catch (err) {
        res.status(400).json({ 
            message: 'Failed to update blog post.', 
            error: err.message 
        });
    }
};

// DELETE: /api/blogs/:id
export const deleteBlog = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Invalid Blog ID format for deletion.' });
        }

        const deletedBlog = await Blog.findByIdAndDelete(id);
        if (!deletedBlog) {
            return res.status(404).json({ message: 'Blog post not found for deletion.' });
        }
        res.status(200).json({ message: 'Blog post deleted successfully.' });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error deleting blog post.', 
            error: err.message 
        });
    }
};
