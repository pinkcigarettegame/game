// Visitor Counter - Tracks historic web users for Pink Cigarette Game
// Uses localStorage for local tracking + CountAPI for global persistent count
(function() {
    'use strict';

    const STORAGE_KEY = 'pinkcigarette_visitor_id';
    const VISIT_LOG_KEY = 'pinkcigarette_visit_log';
    const COUNTER_NAMESPACE = 'pinkcigarettegame';
    const COUNTER_KEY = 'visitors';

    // Generate a unique visitor ID if this is a new visitor
    function getOrCreateVisitorId() {
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    }

    // Log this visit locally
    function logVisit() {
        const log = JSON.parse(localStorage.getItem(VISIT_LOG_KEY) || '[]');
        log.push({
            time: new Date().toISOString(),
            id: getOrCreateVisitorId()
        });
        // Keep only last 100 entries to avoid bloating localStorage
        if (log.length > 100) log.splice(0, log.length - 100);
        localStorage.setItem(VISIT_LOG_KEY, JSON.stringify(log));
        return log.length;
    }

    // Check if this is a first-time visitor (never seen before)
    function isNewVisitor() {
        return !localStorage.getItem(STORAGE_KEY);
    }

    // Update the visitor counter display
    function updateDisplay(count, isGlobal) {
        const el = document.getElementById('visitor-counter');
        if (!el) return;

        const label = isGlobal ? 'historic players' : 'visits';
        el.innerHTML = `👥 <span style="color:#ffcc00; font-weight:bold;">${count.toLocaleString()}</span> ${label}`;
        
        // Add a subtle glow animation
        el.style.transition = 'text-shadow 0.5s ease';
        el.style.textShadow = '0 0 12px rgba(255,204,0,0.8)';
        setTimeout(() => {
            el.style.textShadow = '0 0 6px rgba(255,105,180,0.5)';
        }, 1000);
    }

    // Try to fetch and increment global counter using CountAPI
    function fetchGlobalCount() {
        const isNew = isNewVisitor();
        const localVisits = logVisit();

        // Use CountAPI.xyz to track global visitor count
        // This hits the API endpoint which increments and returns the count
        const apiUrl = `https://api.countapi.xyz/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`;
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) throw new Error('CountAPI unavailable');
                return response.json();
            })
            .then(data => {
                if (data && typeof data.value === 'number') {
                    updateDisplay(data.value, true);
                } else {
                    throw new Error('Invalid response');
                }
            })
            .catch(() => {
                // CountAPI failed - try alternative counter (hits.seeyoufarm.com badge API)
                tryAlternativeCounter(localVisits);
            });
    }

    // Alternative: Use a simple JSON bin or fall back to local count
    function tryAlternativeCounter(localVisits) {
        // Try hits.dwyl.io as alternative
        const altUrl = `https://hits.dwyl.io/pinkcigarettegame/game.json`;
        
        fetch(altUrl)
            .then(response => {
                if (!response.ok) throw new Error('Alt counter unavailable');
                return response.json();
            })
            .then(data => {
                if (data && (data.count || data.uniques)) {
                    updateDisplay(data.count || data.uniques, true);
                } else {
                    throw new Error('Invalid alt response');
                }
            })
            .catch(() => {
                // All external APIs failed - use localStorage count with estimate
                // Read from localStorage how many unique sessions we've seen
                const sessions = getLocalSessionCount();
                updateDisplay(sessions, false);
            });
    }

    // Count unique local sessions (fallback when APIs are unavailable)
    function getLocalSessionCount() {
        const log = JSON.parse(localStorage.getItem(VISIT_LOG_KEY) || '[]');
        // Count unique days visited as a rough "session" count
        const uniqueDays = new Set(log.map(entry => entry.time.split('T')[0]));
        return Math.max(uniqueDays.size, 1);
    }

    // Initialize on page load
    function init() {
        const el = document.getElementById('visitor-counter');
        if (!el) return;

        // Show loading state
        el.innerHTML = '👥 Counting players...';

        // Small delay to not block page load
        setTimeout(fetchGlobalCount, 500);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
