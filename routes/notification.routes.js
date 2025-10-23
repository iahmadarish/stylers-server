import express from 'express';
import { 
    getNotifications,  
    markAsRead         
} from '../controllers/notification.controller.js'; 

const router = express.Router();

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);


export default router;