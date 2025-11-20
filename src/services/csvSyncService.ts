/**
 * CSV Sync Service
 * Handles downloading and updating the product CSV from muaythai-boxing.com
 */

import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env';

export interface SyncResult {
  success: boolean;
  timestamp: Date;
  fileSize?: number;
  error?: string;
  changes?: {
    added: number;
    updated: number;
    removed: number;
  };
}

export class CSVSyncService {
  private csvUrl: string;
  private localFilePath: string;
  private backupDir: string;

  constructor() {
    this.csvUrl = env.MTB_CSV_URL || 'https://app.matrixify.app/files/hx1kg2-jn/a9c39b060fb5c913dcb623116952f087/mtb-product-export.csv';
    this.localFilePath = path.join(process.cwd(), 'data', 'mtb-product-export.csv');
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
  }

  /**
   * Download CSV from muaythai-boxing.com
   */
  async downloadFromURL(): Promise<{ success: boolean; error?: string; fileSize?: number }> {
    try {
      console.log(`[CSV Sync] Downloading CSV from: ${this.csvUrl}`);

      // Create data directory if it doesn't exist
      await fs.mkdir(path.dirname(this.localFilePath), { recursive: true });

      // Download file using fetch
      const response = await fetch(this.csvUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'FinalBellAPI/1.0',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await fs.writeFile(this.localFilePath, buffer);

      const stats = await fs.stat(this.localFilePath);
      console.log(`[CSV Sync] Downloaded CSV: ${stats.size} bytes`);

      return {
        success: true,
        fileSize: stats.size,
      };
    } catch (error) {
      console.error('[CSV Sync] CSV download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create backup of current CSV file
   */
  async createBackup(): Promise<void> {
    try {
      // Check if current file exists
      const fileExists = await fs.access(this.localFilePath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        console.log('[CSV Sync] No existing file to backup');
        return;
      }

      // Create backup directory
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `mtb-product-${timestamp}.csv`);

      await fs.copyFile(this.localFilePath, backupPath);
      console.log(`[CSV Sync] Backup created: ${backupPath}`);

      // Clean old backups (keep last 30 days)
      await this.cleanOldBackups(30);
    } catch (error) {
      console.error('[CSV Sync] Backup failed:', error);
      // Don't throw - backup failure shouldn't stop the sync
    }
  }

  /**
   * Clean old backup files
   */
  private async cleanOldBackups(daysToKeep: number): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('mtb-product-')) continue;

        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(filePath);
          console.log(`[CSV Sync] Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('[CSV Sync] Failed to clean old backups:', error);
    }
  }

  /**
   * Sync CSV from muaythai-boxing.com
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    console.log('[CSV Sync] Starting CSV sync...');

    try {
      // Create backup of current file
      await this.createBackup();

      // Download new file from URL
      const downloadResult = await this.downloadFromURL();

      if (!downloadResult.success) {
        return {
          success: false,
          timestamp: new Date(),
          error: downloadResult.error,
        };
      }

      const duration = Date.now() - startTime;
      console.log(`[CSV Sync] Sync completed in ${duration}ms`);

      return {
        success: true,
        timestamp: new Date(),
        fileSize: downloadResult.fileSize,
      };
    } catch (error) {
      console.error('[CSV Sync] Sync failed:', error);
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get sync status and file information
   */
  async getStatus(): Promise<{
    fileExists: boolean;
    lastModified?: Date;
    fileSize?: number;
  }> {
    try {
      const stats = await fs.stat(this.localFilePath);
      return {
        fileExists: true,
        lastModified: stats.mtime,
        fileSize: stats.size,
      };
    } catch (error) {
      return {
        fileExists: false,
      };
    }
  }
}

// Export singleton instance
export const csvSyncService = new CSVSyncService();
