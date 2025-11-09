import fs from 'fs/promises';
import path from 'path';
import https from 'https';

/**
 * Service to manage IP blacklist fetching, parsing, and storage
 */
export class IPBlacklistService {
    private blacklistedIPs: Set<string> = new Set();
    private blacklistFilePath: string;
    private lastUpdateTime: Date | null = null;

    // Configuration for external IP sources
    private readonly SOURCES = {
        // IPsum - Most dangerous IPs (Level 1)
        ipsum: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/1.txt',
        // You can add more sources here
        // blocklist_de: 'https://lists.blocklist.de/lists/all.txt',
    };

    constructor(blacklistFilePath: string = path.join(process.cwd(), 'blacklist.txt')) {
        this.blacklistFilePath = blacklistFilePath;
    }

    /**
     * Fetches IP list from a URL
     */
    private async fetchIPList(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`Failed to fetch: ${res.statusCode}`));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Parses raw text into IP addresses (string literals)
     * Filters out comments, empty lines, and validates IP format
     */
    private parseIPList(rawText: string): string[] {
        const lines = rawText.split('\n');
        const ips: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments (lines starting with #)
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Extract IP (some lists have format: "IP\tscore" or "IP # comment")
            const ipMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);

            if (ipMatch) {
                const ip = ipMatch[1];

                // Basic IP validation
                if (this.isValidIP(ip)) {
                    ips.push(ip);
                }
            }
        }

        return ips;
    }

    /**
     * Validates IP address format
     */
    private isValidIP(ip: string): boolean {
        const parts = ip.split('.');

        if (parts.length !== 4) {
            return false;
        }

        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    /**
     * Fetches IPs from all configured sources and merges them
     */
    public async fetchFromSources(): Promise<string[]> {
        const allIPs: Set<string> = new Set();

        console.log('Fetching IP blacklists from external sources...');

        for (const [sourceName, url] of Object.entries(this.SOURCES)) {
            try {
                console.log(`  Fetching from ${sourceName}...`);
                const rawData = await this.fetchIPList(url);
                const ips = this.parseIPList(rawData);

                // Add to set (automatically deduplicates)
                ips.forEach(ip => allIPs.add(ip));

                console.log(`  ✓ Fetched ${ips.length} IPs from ${sourceName}`);
            } catch (error) {
                console.error(`  ✗ Failed to fetch from ${sourceName}:`, error);
            }
        }

        console.log(`Total unique IPs collected: ${allIPs.size}`);

        return Array.from(allIPs);
    }

    /**
     * Saves IPs to a local file (one IP per line)
     */
    public async saveToFile(ips: string[]): Promise<void> {
        const content = ips.join('\n');
        await fs.writeFile(this.blacklistFilePath, content, 'utf-8');
        console.log(`✓ Saved ${ips.length} IPs to ${this.blacklistFilePath}`);
    }

    /**
     * Loads IPs from local file
     */
    public async loadFromFile(): Promise<void> {
        try {
            const content = await fs.readFile(this.blacklistFilePath, 'utf-8');
            const ips = this.parseIPList(content);

            this.blacklistedIPs = new Set(ips);
            this.lastUpdateTime = new Date();

            console.log(`✓ Loaded ${this.blacklistedIPs.size} IPs from local blacklist`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log('No local blacklist file found. Will fetch from sources.');
                this.blacklistedIPs = new Set();
            } else {
                throw error;
            }
        }
    }

    /**
     * Updates the blacklist by fetching from sources and saving locally
     */
    public async updateBlacklist(): Promise<void> {
        try {
            const ips = await this.fetchFromSources();
            await this.saveToFile(ips);

            this.blacklistedIPs = new Set(ips);
            this.lastUpdateTime = new Date();

            console.log('✓ Blacklist updated successfully');
        } catch (error) {
            console.error('Failed to update blacklist:', error);
            throw error;
        }
    }

    /**
     * Checks if an IP is blacklisted
     */
    public isBlacklisted(ip: string): boolean {
        return this.blacklistedIPs.has(ip);
    }

    /**
     * Gets all blacklisted IPs as an array
     */
    public getBlacklistedIPs(): string[] {
        return Array.from(this.blacklistedIPs);
    }

    /**
     * Gets blacklist statistics
     */
    public getStats() {
        return {
            count: this.blacklistedIPs.size,
            lastUpdate: this.lastUpdateTime,
            filePath: this.blacklistFilePath
        };
    }

    /**
     * Manually add an IP to the blacklist
     */
    public addIP(ip: string): void {
        if (this.isValidIP(ip)) {
            this.blacklistedIPs.add(ip);
            console.log(`Added ${ip} to blacklist`);
        } else {
            console.warn(`Invalid IP format: ${ip}`);
        }
    }

    /**
     * Manually remove an IP from the blacklist
     */
    public removeIP(ip: string): void {
        if (this.blacklistedIPs.delete(ip)) {
            console.log(`Removed ${ip} from blacklist`);
        }
    }
}

// Singleton instance
export const ipBlacklistService = new IPBlacklistService();
