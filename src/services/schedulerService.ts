/**
 * Scheduler Service
 * Handles scheduled tasks like CSV sync
 */

import { csvSyncService } from './csvSyncService';

export class SchedulerService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start the scheduler
   */
  start(): void {
    console.log('[Scheduler] Starting scheduled tasks...');

    // Run initial sync on startup (after 1 minute delay to allow server to fully start)
    setTimeout(() => {
      this.runCSVSync();
    }, 60 * 1000);

    // Schedule daily sync (every 24 hours)
    this.syncInterval = setInterval(() => {
      this.runCSVSync();
    }, this.SYNC_INTERVAL_MS);

    console.log('[Scheduler] Scheduled CSV sync to run every 24 hours');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[Scheduler] Stopped scheduled tasks');
    }
  }

  /**
   * Run CSV sync task
   */
  private async runCSVSync(): Promise<void> {
    try {
      console.log('[Scheduler] Running scheduled CSV sync...');
      const result = await csvSyncService.sync();

      if (result.success) {
        console.log('[Scheduler] CSV sync completed successfully');
        console.log(`[Scheduler] File size: ${result.fileSize} bytes`);
      } else {
        console.error('[Scheduler] CSV sync failed:', result.error);
      }
    } catch (error) {
      console.error('[Scheduler] CSV sync error:', error);
    }
  }

  /**
   * Trigger manual sync (for admin endpoint)
   */
  async triggerManualSync(): Promise<void> {
    await this.runCSVSync();
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
