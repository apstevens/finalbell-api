import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import orderService from '../services/orderService';
import emailService from '../services/emailService';

/**
 * Get all orders with optional filters
 * GET /api/orders?status=PENDING&customerEmail=test@example.com&limit=50&offset=0
 */
export const getOrders = async (req: Request, res: Response) => {
    try {
        const { status, customerEmail, orderNumber, dateFrom, dateTo, limit, offset } = req.query;

        const filters: any = {};

        if (status && typeof status === 'string') {
            if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }
            filters.status = status as OrderStatus;
        }

        if (customerEmail && typeof customerEmail === 'string') {
            filters.customerEmail = customerEmail;
        }

        if (orderNumber && typeof orderNumber === 'string') {
            filters.orderNumber = orderNumber;
        }

        if (dateFrom && typeof dateFrom === 'string') {
            filters.dateFrom = new Date(dateFrom);
        }

        if (dateTo && typeof dateTo === 'string') {
            filters.dateTo = new Date(dateTo);
        }

        if (limit && typeof limit === 'string') {
            filters.limit = parseInt(limit);
        }

        if (offset && typeof offset === 'string') {
            filters.offset = parseInt(offset);
        }

        const orders = await orderService.getOrders(filters);

        res.json({
            success: true,
            count: orders.length,
            orders,
        });
    } catch (error) {
        console.error('[Order Controller] Error fetching orders:', error);
        res.status(500).json({
            error: 'Failed to fetch orders',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get pending orders (PENDING or PROCESSING status)
 * GET /api/orders/pending
 */
export const getPendingOrders = async (req: Request, res: Response) => {
    try {
        const orders = await orderService.getPendingOrders();

        res.json({
            success: true,
            count: orders.length,
            orders,
        });
    } catch (error) {
        console.error('[Order Controller] Error fetching pending orders:', error);
        res.status(500).json({
            error: 'Failed to fetch pending orders',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get a single order by ID
 * GET /api/orders/:id
 */
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const order = await orderService.getOrderById(id);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            success: true,
            order,
        });
    } catch (error) {
        console.error('[Order Controller] Error fetching order:', error);
        res.status(500).json({
            error: 'Failed to fetch order',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get order by order number
 * GET /api/orders/number/:orderNumber
 */
export const getOrderByNumber = async (req: Request, res: Response) => {
    try {
        const { orderNumber } = req.params;

        const order = await orderService.getOrderByNumber(orderNumber);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            success: true,
            order,
        });
    } catch (error) {
        console.error('[Order Controller] Error fetching order:', error);
        res.status(500).json({
            error: 'Failed to fetch order',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Search orders by query string (email, order number, customer name)
 * GET /api/orders/search?q=john
 */
export const searchOrders = async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const orders = await orderService.searchOrders(q);

        res.json({
            success: true,
            count: orders.length,
            orders,
        });
    } catch (error) {
        console.error('[Order Controller] Error searching orders:', error);
        res.status(500).json({
            error: 'Failed to search orders',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Update order status
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, supplierOrderId, trackingNumber, trackingUrl, carrier } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        if (!Object.values(OrderStatus).includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Get the user ID from the authenticated request (if available)
        const userId = (req as any).user?.id;

        const order = await orderService.updateOrderStatus(id, {
            status,
            notes,
            createdBy: userId,
            supplierOrderId,
            trackingNumber,
            trackingUrl,
            carrier,
        });

        // Send shipping notification email if status is SHIPPED
        if (status === OrderStatus.SHIPPED) {
            emailService.sendShippingNotification(order).catch(err => {
                console.error('[Order Controller] Failed to send shipping notification:', err);
            });
        }

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order,
        });
    } catch (error) {
        console.error('[Order Controller] Error updating order status:', error);
        res.status(500).json({
            error: 'Failed to update order status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Add internal notes to order
 * PATCH /api/orders/:id/notes
 */
export const addInternalNotes = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        if (!notes || typeof notes !== 'string') {
            return res.status(400).json({ error: 'Notes are required' });
        }

        const order = await orderService.addInternalNotes(id, notes);

        res.json({
            success: true,
            message: 'Notes added successfully',
            order,
        });
    } catch (error) {
        console.error('[Order Controller] Error adding notes:', error);
        res.status(500).json({
            error: 'Failed to add notes',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Cancel an order
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ error: 'Cancellation reason is required' });
        }

        // Get the user ID from the authenticated request (if available)
        const userId = (req as any).user?.id;

        const cancelledOrder = await orderService.cancelOrder(id, reason, userId);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order: cancelledOrder,
        });
    } catch (error) {
        console.error('[Order Controller] Error cancelling order:', error);
        res.status(500).json({
            error: 'Failed to cancel order',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get order statistics
 * GET /api/orders/stats?dateFrom=2025-01-01&dateTo=2025-12-31
 */
export const getOrderStats = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo } = req.query;

        let dateFromFilter: Date | undefined;
        let dateToFilter: Date | undefined;

        if (dateFrom && typeof dateFrom === 'string') {
            dateFromFilter = new Date(dateFrom);
        }

        if (dateTo && typeof dateTo === 'string') {
            dateToFilter = new Date(dateTo);
        }

        const stats = await orderService.getOrderStats(dateFromFilter, dateToFilter);

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('[Order Controller] Error fetching order stats:', error);
        res.status(500).json({
            error: 'Failed to fetch order statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
