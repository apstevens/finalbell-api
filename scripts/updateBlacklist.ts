/**
 * Script to manually update the IP blacklist
 * Run with: npx ts-node scripts/updateBlacklist.ts
 */

import { ipBlacklistService } from '../src/services/ipBlacklistService';

async function main() {
    console.log('Starting IP blacklist update...\n');

    try {
        // Fetch and save the blacklist
        await ipBlacklistService.updateBlacklist();

        // Show stats
        const stats = ipBlacklistService.getStats();
        console.log('\n=== Blacklist Stats ===');
        console.log(`Total IPs: ${stats.count}`);
        console.log(`Last Updated: ${stats.lastUpdate}`);
        console.log(`File Path: ${stats.filePath}`);
        console.log('=======================\n');

        console.log('Blacklist update completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Failed to update blacklist:', error);
        process.exit(1);
    }
}

main();
