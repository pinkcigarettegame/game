// Visitor Counter - Tracks players worldwide for Pink Cigarette Game
// Powered by GoatCounter (https://pinkcig7.goatcounter.com)
// Tracks page views, referral sources, and displays player count on start screen
(function() {
    'use strict';

    const GOATCOUNTER_SITE = 'pinkcig7';
    const GOATCOUNTER_API = `https://${GOATCOUNTER_SITE}.goatcounter.com`;

    let historicCount = null;
    let onlineCount = null;

    // Update the visitor counter display on the start screen
    function updateDisplay(historic, online) {
        const el = document.getElementById('visitor-counter');
        if (!el) return;

        let html = '';
        if (historic !== null && historic > 0) {
            html += `🌍 <span style="color:#ffcc00; font-weight:bold;">${historic.toLocaleString()}</span> historic players`;
        }
        if (online !== null && online > 0) {
            if (html) html += ' &nbsp;|&nbsp; ';
            html += `🟢 <span style="color:#44ff88; font-weight:bold;">${online}</span> online now`;
        }
        if (!html) {
            html = '🌍 Counting players...';
        }
        el.innerHTML = html;

        // Subtle glow animation
        el.style.transition = 'text-shadow 0.5s ease';
        el.style.textShadow = '0 0 12px rgba(255,204,0,0.8)';
        setTimeout(() => {
            el.style.textShadow = '0 0 6px rgba(255,105,180,0.5)';
        }, 1000);
    }

    // Fetch total visitor count from GoatCounter's public counter API
    // Uses the no-auth JSON endpoint: /counter/TOTAL.json
    async function fetchGoatCounterTotal() {
        try {
            const response = await fetch(`${GOATCOUNTER_API}/counter/TOTAL.json`);
            if (!response.ok) throw new Error(`GoatCounter API returned ${response.status}`);
            const data = await response.json();
            // GoatCounter returns { count: "1,234" } with formatted string
            if (data && data.count) {
                // Parse the formatted count string (e.g., "1,234" -> 1234)
                const count = parseInt(data.count.replace(/,/g, ''), 10);
                if (!isNaN(count)) {
                    console.log(`[Visitor Counter] GoatCounter total: ${count}`);
                    return count;
                }
            }
            throw new Error('Invalid GoatCounter response');
        } catch (e) {
            console.warn('[Visitor Counter] GoatCounter API error:', e.message);
            return null;
        }
    }

    // Get real-time online player count from the multiplayer system
    function getOnlinePlayerCount() {
        if (window.mp && typeof window.mp.getPlayerCount === 'function') {
            return window.mp.getPlayerCount();
        }
        return 0;
    }

    // Poll the multiplayer system for online player count
    function startOnlineTracking() {
        setInterval(() => {
            const online = getOnlinePlayerCount();
            if (online > 0) {
                onlineCount = online;
                updateDisplay(historicCount, onlineCount);
            }
        }, 3000);
    }

    // Initialize on page load
    async function init() {
        const el = document.getElementById('visitor-counter');
        if (!el) return;

        // Show loading state
        el.innerHTML = '🌍 Counting players worldwide...';

        // Small delay to not block page load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch the total visitor count from GoatCounter
        historicCount = await fetchGoatCounterTotal();

        if (historicCount !== null) {
            updateDisplay(historicCount, null);
        } else {
            // If GoatCounter API is unavailable, show a generic message (no links to avoid blocking start screen clicks)
            el.innerHTML = '🌍 Players worldwide';
        }

        // Start tracking online players from multiplayer system
        startOnlineTracking();
    }

    // Expose for external use (e.g., multiplayer system can trigger updates)
    window.visitorCounter = {
        refresh: function() {
            onlineCount = getOnlinePlayerCount();
            updateDisplay(historicCount, onlineCount);
        },
        getHistoricCount: function() { return historicCount; },
        getOnlineCount: function() { return onlineCount; },
        // Allow manual refresh of GoatCounter data
        refreshTotal: async function() {
            historicCount = await fetchGoatCounterTotal();
            updateDisplay(historicCount, onlineCount);
        }
    };

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
