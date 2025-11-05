/**
 * Admin Controller
 * Handles admin-only operations like manual CSV sync
 */

import { Request, Response } from 'express';
import { csvSyncService } from '../services/csvSyncService';
import { schedulerService } from '../services/schedulerService';

/**
 * Trigger manual CSV sync
 */
export const triggerCSVSync = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[Admin] Manual CSV sync triggered');

    // Trigger sync
    const result = await csvSyncService.sync();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'CSV sync completed successfully',
        timestamp: result.timestamp,
        fileSize: result.fileSize,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'CSV sync failed',
        error: result.error,
        timestamp: result.timestamp,
      });
    }
  } catch (error) {
    console.error('[Admin] CSV sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get CSV sync status
 */
export const getCSVStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await csvSyncService.getStatus();

    res.status(200).json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[Admin] Failed to get CSV status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get CSV status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get system health and status
 */
export const getSystemStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const csvStatus = await csvSyncService.getStatus();

    res.status(200).json({
      success: true,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      csv: csvStatus,
    });
  } catch (error) {
    console.error('[Admin] Failed to get system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
