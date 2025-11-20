import { Router } from 'express';
import {
    getOrders,
    getPendingOrders,
    getOrderById,
    getOrderByNumber,
    searchOrders,
    updateOrderStatus,
    addInternalNotes,
    cancelOrder,
    getOrderStats,
} from '../controllers/orderController';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();

/**
 * All order routes require admin authentication
 */

// Get order statistics
router.get('/stats', requireAdmin, getOrderStats);

// Get pending orders (must come before /:id to avoid route conflicts)
router.get('/pending', requireAdmin, getPendingOrders);

// Search orders
router.get('/search', requireAdmin, searchOrders);

// Get order by order number (must come before /:id to avoid route conflicts)
router.get('/number/:orderNumber', requireAdmin, getOrderByNumber);

// Get all orders with filters
router.get('/', requireAdmin, getOrders);

// Get single order by ID
router.get('/:id', requireAdmin, getOrderById);

// Update order status
router.patch('/:id/status', requireAdmin, updateOrderStatus);

// Add internal notes
router.patch('/:id/notes', requireAdmin, addInternalNotes);

// Cancel order
router.post('/:id/cancel', requireAdmin, cancelOrder);

export default router;
