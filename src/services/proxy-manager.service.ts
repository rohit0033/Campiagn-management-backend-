import { Browser } from "puppeteer";
import fs from 'fs';
import path from 'path';

export interface Proxy {
    ip: string;
    port: string;
    protocols: string[];
    anonymityLevel: string;
    country: string;
    latency: number;
    upTime: number;
    lastChecked?: number;
}

export class ProxyManager {
    private proxies: Proxy[] = [];
    private currentIndex: number = 0;
    private proxyFile: string;

    constructor(proxyFile?: string) {
        this.proxyFile = proxyFile || path.join(__dirname, '../../../data/proxies.json');
        this.loadProxies();
    }

    private loadProxies(): void {
        try {
            if (fs.existsSync(this.proxyFile)) {
                console.log(`Found proxy file at: ${this.proxyFile}`);
                const data = fs.readFileSync(this.proxyFile, 'utf8');
                console.log(`Proxy data length: ${data.length} bytes`);
                
                try {
                    const parsedProxies = JSON.parse(data);
                    console.log(`Successfully parsed JSON with ${parsedProxies.length} proxies`);
                    
                    // Filter to include only HTTP proxies
                    this.proxies = parsedProxies
                        .filter((proxy: any) => {
                            // Check if protocols exists and includes http
                            const hasHttp = proxy.protocols && 
                                          Array.isArray(proxy.protocols) && 
                                          proxy.protocols.includes('http');
                            return hasHttp;
                        })
                        .map((proxy: any) => ({
                            ip: proxy.ip,
                            port: proxy.port,
                            protocols: proxy.protocols,
                            anonymityLevel: proxy.anonymityLevel || 'unknown',
                            country: proxy.country || 'unknown',
                            latency: proxy.latency || 0,
                            upTime: proxy.upTime || 0,
                            lastChecked: proxy.lastChecked || Date.now()
                        }));
                    
                    console.log(`Loaded ${this.proxies.length} valid HTTP proxies from file`);
                } catch (jsonError) {
                    console.error('Error parsing JSON:', jsonError);
                }
            } else {
                console.warn(`Proxy file not found: ${this.proxyFile}`);
            }
        } catch (error) {
            console.error('Error loading proxies:', error);
        }
    }

    public getNextProxy(): Proxy | null {
        if (this.proxies.length === 0) {
            return null;
        }
        
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return this.proxies[this.currentIndex];
    }

    public getRandom(count: number = 1): Proxy[] {
        if (this.proxies.length === 0) {
            return [];
        }
        
        const shuffled = [...this.proxies].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}

// Singleton instance
// Singleton instance
export const proxyManager = new ProxyManager(
    'C:/Users/HP/Desktop/assignement/campaing-management/backend/data/proxies.json'
);