/**
 * CSV Sync Service
 * Handles downloading and updating the Playwell CSV from FTP server
 */

import { promises as fs } from 'fs';
import path from 'path';
import * as ftp from 'basic-ftp';
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
  private ftpHost: string;
  private ftpUser: string;
  private ftpPassword: string;
  private remoteFilePath: string;
  private localFilePath: string;
  private backupDir: string;

  constructor() {
    this.ftpHost = env.PLAYWELL_FTP_HOST || 'ftp://161.35.45.163';
    this.ftpUser = env.PLAYWELL_FTP_USER || '';
    this.ftpPassword = env.PLAYWELL_FTP_PASSWORD || '';
    this.remoteFilePath = '/playwell-stock-shopify-b.csv';
    this.localFilePath = path.join(process.cwd(), 'data', 'playwell-stock-shopify-b.csv');
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
  }

  /**
   * Download CSV from FTP server
   */
  async downloadFromFTP(): Promise<{ success: boolean; error?: string; fileSize?: number }> {
    const client = new ftp.Client();
    client.ftp.verbose = env.NODE_ENV === 'development';

    try {
      console.log(`[CSV Sync] Connecting to FTP server: ${this.ftpHost}`);

      // Parse FTP host to remove protocol
      const host = this.ftpHost.replace(/^ftp:\/\//, '');

      await client.access({
        host,
        user: this.ftpUser,
        password: this.ftpPassword,
        secure: false,
      });

      console.log('[CSV Sync] Connected to FTP server');

      // Create data directory if it doesn't exist
      await fs.mkdir(path.dirname(this.localFilePath), { recursive: true });

      // Download file
      await client.downloadTo(this.localFilePath, this.remoteFilePath);

      const stats = await fs.stat(this.localFilePath);
      console.log(`[CSV Sync] Downloaded CSV: ${stats.size} bytes`);

      return {
        success: true,
        fileSize: stats.size,
      };
    } catch (error) {
      console.error('[CSV Sync] FTP download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      client.close();
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
      const backupPath = path.join(this.backupDir, `playwell-stock-${timestamp}.csv`);

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
        if (!file.startsWith('playwell-stock-')) continue;

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
   * Sync CSV from FTP server
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    console.log('[CSV Sync] Starting CSV sync...');

    try {
      // Create backup of current file
      await this.createBackup();

      // Download new file from FTP
      const downloadResult = await this.downloadFromFTP();

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
