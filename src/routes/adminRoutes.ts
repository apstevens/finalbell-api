/**
 * Admin Routes
 * Routes for admin-only operations
 */

import { Router } from 'express';
import { requireAdmin, requireAPIKey } from '../middleware/adminAuth';
import { csvSyncLimiter } from '../middleware/rateLimiter';
import {
  triggerCSVSync,
  getCSVStatus,
  getSystemStatus,
} from '../controllers/adminController';

const router = Router();

/**
 * @route   POST /admin/csv/sync
 * @desc    Trigger manual CSV sync
 * @access  Admin only
 */
router.post('/csv/sync', requireAdmin, csvSyncLimiter, triggerCSVSync);

/**
 * @route   GET /admin/csv/status
 * @desc    Get CSV file status
 * @access  Admin only
 */
router.get('/csv/status', requireAdmin, getCSVStatus);

/**
 * @route   GET /admin/system/status
 * @desc    Get system status
 * @access  Admin only
 */
router.get('/system/status', requireAdmin, getSystemStatus);

/**
 * @route   POST /admin/csv/sync-cron
 * @desc    Trigger CSV sync via cron job (API key auth)
 * @access  API key required
 */
router.post('/csv/sync-cron', requireAPIKey, csvSyncLimiter, triggerCSVSync);

export default router;
