"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyManager = exports.ProxyManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ProxyManager {
    constructor(proxyFile) {
        this.proxies = [];
        this.currentIndex = 0;
        this.proxyFile = proxyFile || path_1.default.join(__dirname, '../../../data/proxies.json');
        this.loadProxies();
    }
    loadProxies() {
        try {
            if (fs_1.default.existsSync(this.proxyFile)) {
                console.log(`Found proxy file at: ${this.proxyFile}`);
                const data = fs_1.default.readFileSync(this.proxyFile, 'utf8');
                console.log(`Proxy data length: ${data.length} bytes`);
                try {
                    const parsedProxies = JSON.parse(data);
                    console.log(`Successfully parsed JSON with ${parsedProxies.length} proxies`);
                    // Filter to include only HTTP proxies
                    this.proxies = parsedProxies
                        .filter((proxy) => {
                        // Check if protocols exists and includes http
                        const hasHttp = proxy.protocols &&
                            Array.isArray(proxy.protocols) &&
                            proxy.protocols.includes('http');
                        return hasHttp;
                    })
                        .map((proxy) => ({
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
                }
                catch (jsonError) {
                    console.error('Error parsing JSON:', jsonError);
                }
            }
            else {
                console.warn(`Proxy file not found: ${this.proxyFile}`);
            }
        }
        catch (error) {
            console.error('Error loading proxies:', error);
        }
    }
    getNextProxy() {
        if (this.proxies.length === 0) {
            return null;
        }
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return this.proxies[this.currentIndex];
    }
    getRandom(count = 1) {
        if (this.proxies.length === 0) {
            return [];
        }
        const shuffled = [...this.proxies].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}
exports.ProxyManager = ProxyManager;
// Singleton instance
// Singleton instance
exports.proxyManager = new ProxyManager('C:/Users/HP/Desktop/assignement/campaing-management/backend/data/proxies.json');
