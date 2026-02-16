// CryptoPriceFetcher - Fetches real crypto prices from CoinGecko API
// Singleton that all LiquorStore instances and Billboards share for their displays

class CryptoPriceFetcher {
    constructor() {
        this.prices = {};
        this.sparklines = {}; // coinId -> array of price points (7-day)
        this.lastFetch = 0;
        this.lastSparklineFetch = 0;
        this.fetchInterval = 60000; // Refresh every 60 seconds (CoinGecko free tier friendly)
        this.sparklineFetchInterval = 300000; // Refresh sparklines every 5 minutes
        this.fetching = false;
        this.fetchingSparklines = false;
        this.initialized = false;
        this.sparklinesInitialized = false;

        // Top 10 coins to track: id -> { symbol, name, color }
        this.allCoins = {
            bitcoin:       { symbol: 'BTC',  name: 'Bitcoin',   color: '#f7931a' },
            ethereum:      { symbol: 'ETH',  name: 'Ethereum',  color: '#627eea' },
            binancecoin:   { symbol: 'BNB',  name: 'BNB',       color: '#f3ba2f' },
            solana:        { symbol: 'SOL',  name: 'Solana',    color: '#9945ff' },
            ripple:        { symbol: 'XRP',  name: 'XRP',       color: '#00aae4' },
            dogecoin:      { symbol: 'DOGE', name: 'Dogecoin',  color: '#c2a633' },
            cardano:       { symbol: 'ADA',  name: 'Cardano',   color: '#0033ad' },
            avalanche_2:   { symbol: 'AVAX', name: 'Avalanche', color: '#e84142' },
            shiba_inu:     { symbol: 'SHIB', name: 'Shiba Inu', color: '#ffa409' },
            polkadot:      { symbol: 'DOT',  name: 'Polkadot',  color: '#e6007a' }
        };

        // Original 4 coins for liquor store ticker (backward compatible)
        this.coins = {
            bitcoin: 'BTC',
            ethereum: 'ETH',
            dogecoin: 'DOGE',
            solana: 'SOL'
        };

        // Fallback meme prices (used if API fails and no cached data)
        this.fallbackPrices = {
            bitcoin:      { usd: 69420,  usd_24h_change: 4.20 },
            ethereum:     { usd: 4200,   usd_24h_change: 2.10 },
            dogecoin:     { usd: 0.69,   usd_24h_change: 6.90 },
            solana:       { usd: 420,    usd_24h_change: 3.50 },
            binancecoin:  { usd: 580,    usd_24h_change: 1.50 },
            ripple:       { usd: 1.20,   usd_24h_change: -0.80 },
            cardano:      { usd: 0.85,   usd_24h_change: 3.20 },
            avalanche_2:  { usd: 42,     usd_24h_change: -2.10 },
            shiba_inu:    { usd: 0.000028, usd_24h_change: 8.50 },
            polkadot:     { usd: 9.50,   usd_24h_change: 1.80 }
        };

        // Fallback sparklines (generated sine waves for visual effect)
        this.fallbackSparklines = {};
        for (const coinId of Object.keys(this.allCoins)) {
            const basePrice = this.fallbackPrices[coinId] ? this.fallbackPrices[coinId].usd : 100;
            const points = [];
            for (let i = 0; i < 168; i++) { // 168 hours in 7 days
                const noise = Math.sin(i * 0.15 + Object.keys(this.allCoins).indexOf(coinId) * 2) * 0.08;
                const trend = Math.sin(i * 0.03) * 0.05;
                points.push(basePrice * (1 + noise + trend));
            }
            this.fallbackSparklines[coinId] = points;
        }
    }

    // Start fetching prices immediately and set up periodic refresh
    start() {
        this.fetchPrices();
        this.fetchSparklines();
        this._interval = setInterval(() => this.fetchPrices(), this.fetchInterval);
        this._sparklineInterval = setInterval(() => this.fetchSparklines(), this.sparklineFetchInterval);
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        if (this._sparklineInterval) {
            clearInterval(this._sparklineInterval);
            this._sparklineInterval = null;
        }
    }

    async fetchPrices() {
        if (this.fetching) return;
        this.fetching = true;

        const ids = Object.keys(this.allCoins).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            // Validate and store prices
            for (const coinId of Object.keys(this.allCoins)) {
                if (data[coinId] && typeof data[coinId].usd === 'number') {
                    this.prices[coinId] = {
                        usd: data[coinId].usd,
                        usd_24h_change: data[coinId].usd_24h_change || 0
                    };
                }
            }

            this.lastFetch = Date.now();
            this.initialized = true;
        } catch (e) {
            console.warn('[CryptoPrices] Fetch failed, using fallback:', e.message);
            // If we've never successfully fetched, use fallback prices
            if (!this.initialized) {
                this.prices = {};
                for (const coinId of Object.keys(this.allCoins)) {
                    if (this.fallbackPrices[coinId]) {
                        this.prices[coinId] = { ...this.fallbackPrices[coinId] };
                    }
                }
                this.initialized = true;
            }
            // Otherwise keep the last successfully fetched prices
        }

        this.fetching = false;
    }

    async fetchSparklines() {
        if (this.fetchingSparklines) return;
        this.fetchingSparklines = true;

        const ids = Object.keys(this.allCoins).join(',');
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=7d`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (Array.isArray(data)) {
                for (const coin of data) {
                    if (coin.id && coin.sparkline_in_7d && Array.isArray(coin.sparkline_in_7d.price)) {
                        this.sparklines[coin.id] = coin.sparkline_in_7d.price;
                    }
                }
            }

            this.lastSparklineFetch = Date.now();
            this.sparklinesInitialized = true;
        } catch (e) {
            console.warn('[CryptoPrices] Sparkline fetch failed, using fallback:', e.message);
            if (!this.sparklinesInitialized) {
                this.sparklines = {};
                for (const coinId of Object.keys(this.allCoins)) {
                    if (this.fallbackSparklines[coinId]) {
                        this.sparklines[coinId] = [...this.fallbackSparklines[coinId]];
                    }
                }
                this.sparklinesInitialized = true;
            }
        }

        this.fetchingSparklines = false;
    }

    // Format a USD price nicely
    formatPrice(usd) {
        if (usd >= 10000) {
            return '$' + Math.round(usd).toLocaleString('en-US');
        } else if (usd >= 100) {
            return '$' + usd.toFixed(1);
        } else if (usd >= 1) {
            return '$' + usd.toFixed(2);
        } else if (usd >= 0.01) {
            return '$' + usd.toFixed(4);
        } else {
            return '$' + usd.toFixed(6);
        }
    }

    // Get the ticker string for display on the liquor store canvas (original 4 coins)
    // Returns an array of segments: { text, color } for colored rendering
    getTickerSegments() {
        const segments = [];
        const priceData = this.initialized ? this.prices : this.fallbackPrices;

        for (const [coinId, symbol] of Object.entries(this.coins)) {
            const data = priceData[coinId];
            if (!data) continue;

            const price = this.formatPrice(data.usd);
            const change = data.usd_24h_change || 0;
            const arrow = change >= 0 ? '▲' : '▼';
            const changeStr = Math.abs(change).toFixed(1) + '%';
            const color = change >= 0 ? '#00ff44' : '#ff4444';

            segments.push({
                text: `  ${symbol} ${price} ${arrow}${changeStr}  `,
                color: color
            });
        }

        return segments;
    }

    // Get a simple combined ticker string (for fallback / simple rendering)
    getTickerString() {
        const segments = this.getTickerSegments();
        return segments.map(s => s.text).join('');
    }

    // Get ordered list of top 10 coins with full data for billboard display
    getTop10() {
        const result = [];
        const priceData = this.initialized ? this.prices : this.fallbackPrices;
        const sparklineData = this.sparklinesInitialized ? this.sparklines : this.fallbackSparklines;

        for (const [coinId, info] of Object.entries(this.allCoins)) {
            const data = priceData[coinId];
            if (!data) continue;

            result.push({
                id: coinId,
                symbol: info.symbol,
                name: info.name,
                color: info.color,
                price: data.usd,
                priceFormatted: this.formatPrice(data.usd),
                change24h: data.usd_24h_change || 0,
                sparkline: sparklineData[coinId] || null
            });
        }

        return result;
    }

    // Get data for a specific coin by index (0-9)
    getCoinByIndex(index) {
        const top10 = this.getTop10();
        if (index >= 0 && index < top10.length) {
            return top10[index];
        }
        return null;
    }

    // Get total number of tracked coins
    getCoinCount() {
        return Object.keys(this.allCoins).length;
    }

    // Check if prices are from the API (not fallback)
    isLive() {
        return this.initialized && this.lastFetch > 0 &&
               (Date.now() - this.lastFetch) < this.fetchInterval * 3;
    }
}

// Global singleton instance
window.cryptoPriceFetcher = new CryptoPriceFetcher();
