import express from 'express';
import * as blogController from '../controllers/blogController.js'; 

const router = express.Router();

// --- /api/blogs ---
router.post('/', blogController.createBlog); 
router.get('/', blogController.getAllBlogs); 

// --- /api/blogs/:id ---
router.get('/:id', blogController.getBlogById); 
router.put('/:id', blogController.updateBlog); 
router.delete('/:id', blogController.deleteBlog); 

export default router;