// Mission System - Progressive GTA-style missions for Pink Cigarette World
class MissionSystem {
    constructor() {
        // Mission definitions - expanded progressive mission chain
        this.missions = [
            // === CHAPTER 1: STREET BASICS ===
            {
                id: 'first_strippers',
                title: 'Fresh Meat',
                description: 'Hire 3 strippers using M key near your car ($50 each)',
                emoji: '💃',
                type: 'strippers_collected',
                target: 3,
                reward: 150,
                rewardText: '+$150 💰'
            },
            {
                id: 'first_roadkills',
                title: 'Road Rage',
                description: 'Get 5 roadkills while driving your Challenger',
                emoji: '🚗',
                type: 'roadkills',
                target: 5,
                reward: 200,
                rewardText: '+$200 💰'
            },
            {
                id: 'crackhead_cleanup',
                title: 'Crackhead Cleanup',
                description: 'Take out 10 crackheads (shoot or run over)',
                emoji: '💀',
                type: 'crackheads_killed',
                target: 10,
                reward: 250,
                rewardText: '+$250 💰'
            },
            {
                id: 'shop_visit',
                title: 'Crypto Connoisseur',
                description: 'Buy 3 drinks from the Crypto Liquor Store',
                emoji: '🍺',
                type: 'shop_purchases',
                target: 3,
                reward: 100,
                rewardText: '+$100 💰'
            },
            // === CHAPTER 2: BUILDING HEAT ===
            {
                id: 'first_cops',
                title: 'Cop Killer',
                description: 'Eliminate 5 police officers',
                emoji: '👮',
                type: 'cops_killed',
                target: 5,
                reward: 500,
                rewardText: '+$500 💰'
            },
            {
                id: 'speed_demon',
                title: 'Speed Demon',
                description: 'Reach 60 mph in the Challenger',
                emoji: '🏎️',
                type: 'top_speed',
                target: 60,
                reward: 300,
                rewardText: '+$300 💰'
            },
            {
                id: 'kill_streak_3',
                title: 'Triple Threat',
                description: 'Get a 3x kill streak with the Glock',
                emoji: '🔥',
                type: 'best_kill_streak',
                target: 3,
                reward: 400,
                rewardText: '+$400 💰'
            },
            {
                id: 'collect_10_strippers',
                title: 'Pimp Starter Kit',
                description: 'Hire 10 total strippers',
                emoji: '💃',
                type: 'strippers_collected_total',
                target: 10,
                reward: 500,
                rewardText: '+$500 💰'
            },
            // === CHAPTER 3: EMPIRE BUILDING ===
            {
                id: 'earn_1000',
                title: 'Stacking Paper',
                description: 'Accumulate $1000 total earnings',
                emoji: '💵',
                type: 'total_money_earned',
                target: 1000,
                reward: 300,
                rewardText: '+$300 💰'
            },
            {
                id: 'roadkill_25',
                title: 'Highway Menace',
                description: 'Get 25 total roadkills',
                emoji: '🚗',
                type: 'roadkills',
                target: 25,
                reward: 500,
                rewardText: '+$500 💰'
            },
            {
                id: 'destroy_motorcycles',
                title: 'Bike Wrecker',
                description: 'Destroy 3 police motorcycles',
                emoji: '🏍️',
                type: 'motorcycles_destroyed',
                target: 3,
                reward: 600,
                rewardText: '+$600 💰'
            },
            {
                id: 'buy_strip_club',
                title: 'Business Owner',
                description: 'Purchase a strip club from the liquor store ($1500)',
                emoji: '🏪',
                type: 'strip_clubs_bought',
                target: 1,
                reward: 2000,
                rewardText: '+$2000 💰'
            },
            // === CHAPTER 4: CRIME LORD ===
            {
                id: 'kill_streak_6',
                title: 'Killamanjaro',
                description: 'Get a 6x kill streak',
                emoji: '🏔️',
                type: 'best_kill_streak',
                target: 6,
                reward: 800,
                rewardText: '+$800 💰'
            },
            {
                id: 'deposit_strippers',
                title: 'Staffing Up',
                description: 'Deposit 15 strippers into strip clubs',
                emoji: '💃',
                type: 'strippers_deposited',
                target: 15,
                reward: 1000,
                rewardText: '+$1000 💰'
            },
            {
                id: 'cops_killed_15',
                title: 'Most Wanted',
                description: 'Eliminate 15 total cops',
                emoji: '🚨',
                type: 'cops_killed',
                target: 15,
                reward: 1000,
                rewardText: '+$1000 💰'
            },
            {
                id: 'earn_5000',
                title: 'Big Baller',
                description: 'Accumulate $5000 total earnings',
                emoji: '💎',
                type: 'total_money_earned',
                target: 5000,
                reward: 1000,
                rewardText: '+$1000 💰'
            },
            // === CHAPTER 5: KINGPIN ===
            {
                id: 'collect_50_strippers',
                title: 'Pimp Army',
                description: 'Hire 50 total strippers',
                emoji: '👑',
                type: 'strippers_collected_total',
                target: 50,
                reward: 2000,
                rewardText: '+$2000 💰'
            },
            {
                id: 'roadkill_100',
                title: 'Mass Destruction',
                description: 'Get 100 total roadkills',
                emoji: '💥',
                type: 'roadkills',
                target: 100,
                reward: 2000,
                rewardText: '+$2000 💰'
            },
            {
                id: 'buy_3_clubs',
                title: 'Strip Club Mogul',
                description: 'Own 3 strip clubs',
                emoji: '🏢',
                type: 'strip_clubs_bought',
                target: 3,
                reward: 3000,
                rewardText: '+$3000 💰'
            },
            {
                id: 'kill_streak_10',
                title: 'KILLGASM',
                description: 'Get a 10x kill streak',
                emoji: '☠️',
                type: 'best_kill_streak',
                target: 10,
                reward: 2000,
                rewardText: '+$2000 💰'
            },
            {
                id: 'earn_20000',
                title: 'PIMP KING',
                description: 'Accumulate $20,000 total earnings',
                emoji: '👑',
                type: 'total_money_earned',
                target: 20000,
                reward: 5000,
                rewardText: '+$5000 💰 PIMP KING 👑'
            }
        ];

        // Progress tracking
        this.currentMissionIndex = 0;
        this.progress = {
            strippers_collected: 0,
            strippers_collected_total: 0,
            roadkills: 0,
            cops_killed: 0,
            strip_clubs_bought: 0,
            crackheads_killed: 0,
            shop_purchases: 0,
            top_speed: 0,
            best_kill_streak: 0,
            total_money_earned: 0,
            motorcycles_destroyed: 0,
            strippers_deposited: 0
        };
        this.allComplete = false;

        // Animation state
        this.bannerTimer = 0;
        this.bannerActive = false;
        this.newMissionTimer = 0;
        this.newMissionActive = false;
        this.trackerVisible = false;
        this.progressFlashTimer = 0;

        // Audio
        this.audioCtx = null;

        // Reference to glock for money rewards
        this.glockRef = null;

        // Debounced save (avoid localStorage writes every event)
        this._savePending = false;
        this._saveTimer = 0;
        this._saveInterval = 3; // Save at most every 3 seconds

        // Load saved progress
        this.loadProgress();

        // Cached DOM refs
        this._trackerEl = null;
        this._titleEl = null;
        this._countEl = null;
        this._fillEl = null;
        this._labelEl = null;
        this._domCached = false;

        // Create UI elements
        this.createUI();
    }

    _cacheDom() {
        this._trackerEl = document.getElementById('mission-tracker');
        this._titleEl = document.getElementById('mission-tracker-title');
        this._countEl = document.getElementById('mission-tracker-count');
        this._fillEl = document.getElementById('mission-tracker-progress-fill');
        this._labelEl = document.getElementById('mission-tracker-label');
        this._domCached = true;
    }

    createUI() {
        // Mission tracker (top center HUD)
        const tracker = document.createElement('div');
        tracker.id = 'mission-tracker';
        tracker.innerHTML = `
            <div id="mission-tracker-inner">
                <div id="mission-tracker-label">📋 MISSION</div>
                <div id="mission-tracker-title"></div>
                <div id="mission-tracker-progress-bar">
                    <div id="mission-tracker-progress-fill"></div>
                </div>
                <div id="mission-tracker-count"></div>
            </div>
        `;
        document.body.appendChild(tracker);

        // Mission complete banner
        const banner = document.createElement('div');
        banner.id = 'mission-complete-banner';
        banner.innerHTML = `
            <div id="mission-complete-emoji"></div>
            <div id="mission-complete-text">MISSION COMPLETE!</div>
            <div id="mission-complete-reward"></div>
        `;
        document.body.appendChild(banner);

        // New mission banner
        const newBanner = document.createElement('div');
        newBanner.id = 'mission-new-banner';
        newBanner.innerHTML = `
            <div id="mission-new-label">📋 NEW MISSION</div>
            <div id="mission-new-title"></div>
            <div id="mission-new-desc"></div>
        `;
        document.body.appendChild(newBanner);

        // All missions complete banner
        const finalBanner = document.createElement('div');
        finalBanner.id = 'mission-final-banner';
        finalBanner.innerHTML = `
            <div id="mission-final-crown">👑</div>
            <div id="mission-final-text">PIMP KING</div>
            <div id="mission-final-sub">All missions complete!</div>
        `;
        document.body.appendChild(finalBanner);
    }

    show() {
        this.trackerVisible = true;
        this.updateTrackerUI();
    }

    hide() {
        this.trackerVisible = false;
        const tracker = document.getElementById('mission-tracker');
        if (tracker) tracker.style.display = 'none';
    }

    getCurrentMission() {
        if (this.currentMissionIndex >= this.missions.length) return null;
        return this.missions[this.currentMissionIndex];
    }

    getCurrentProgress() {
        const mission = this.getCurrentMission();
        if (!mission) return 0;
        return this.progress[mission.type] || 0;
    }

    // === EVENT HANDLERS (called from main.js) ===

    onStripperCollected() {
        this.progress.strippers_collected++;
        this.progress.strippers_collected_total++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onRoadkill(count) {
        this.progress.roadkills += (count || 1);
        this.checkMissionProgress();
        this.saveProgress();
    }

    onCopKilled() {
        this.progress.cops_killed++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onStripClubPurchased() {
        this.progress.strip_clubs_bought++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onCrackheadKilled() {
        this.progress.crackheads_killed++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onShopPurchase() {
        this.progress.shop_purchases++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onSpeedReached(mph) {
        if (mph > this.progress.top_speed) {
            this.progress.top_speed = mph;
            this.checkMissionProgress();
            this.saveProgress();
        }
    }

    onKillStreak(streak) {
        if (streak > this.progress.best_kill_streak) {
            this.progress.best_kill_streak = streak;
            this.checkMissionProgress();
            this.saveProgress();
        }
    }

    onMoneyEarned(amount) {
        this.progress.total_money_earned += amount;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onMotorcycleDestroyed() {
        this.progress.motorcycles_destroyed++;
        this.checkMissionProgress();
        this.saveProgress();
    }

    onStrippersDeposited(count) {
        this.progress.strippers_deposited += count;
        this.checkMissionProgress();
        this.saveProgress();
    }

    checkMissionProgress() {
        if (this.allComplete) return;
        const mission = this.getCurrentMission();
        if (!mission) return;

        const current = this.progress[mission.type] || 0;
        this.progressFlashTimer = 0.5;

        if (current >= mission.target) {
            this.completeMission();
        }

        this.updateTrackerUI();
    }

    completeMission() {
        const mission = this.getCurrentMission();
        if (!mission) return;

        // Give reward
        if (this.glockRef && mission.reward > 0) {
            this.glockRef.money += mission.reward;
            // Spawn some dollar bills
            if (this.glockRef.spawnDollarBill) {
                const billCount = Math.min(10, Math.floor(mission.reward / 50));
                for (let i = 0; i < billCount; i++) {
                    setTimeout(() => this.glockRef.spawnDollarBill(), i * 100);
                }
            }
        }

        // Play completion sound
        this.playCompletionSound();

        // Show completion banner
        this.showCompletionBanner(mission);

        // Advance to next mission
        this.currentMissionIndex++;

        if (this.currentMissionIndex >= this.missions.length) {
            // All missions complete!
            this.allComplete = true;
            setTimeout(() => this.showFinalBanner(), 4500);
        } else {
            // Show new mission after delay
            setTimeout(() => {
                this.showNewMissionBanner(this.getCurrentMission());
                this.updateTrackerUI();
            }, 4000);
        }

        this.saveProgress();
    }

    // === UI UPDATES ===

    updateTrackerUI() {
        if (!this._domCached) this._cacheDom();
        const tracker = this._trackerEl;
        if (!tracker) return;

        if (!this.trackerVisible || this.allComplete) {
            tracker.style.display = 'none';
            return;
        }

        const mission = this.getCurrentMission();
        if (!mission) {
            tracker.style.display = 'none';
            return;
        }

        tracker.style.display = 'block';

        if (this._labelEl) this._labelEl.textContent = `📋 MISSION ${this.currentMissionIndex + 1}`;
        if (this._titleEl) this._titleEl.textContent = `${mission.emoji} ${mission.title}`;

        const current = Math.min(this.progress[mission.type] || 0, mission.target);
        if (this._countEl) this._countEl.textContent = `${current} / ${mission.target}`;

        const pct = Math.min(100, (current / mission.target) * 100);
        if (this._fillEl) this._fillEl.style.width = pct + '%';

        // Flash effect on progress
        if (this.progressFlashTimer > 0) {
            tracker.classList.add('flash');
        } else {
            tracker.classList.remove('flash');
        }
    }

    showCompletionBanner(mission) {
        const banner = document.getElementById('mission-complete-banner');
        if (!banner) return;

        const emojiEl = document.getElementById('mission-complete-emoji');
        const rewardEl = document.getElementById('mission-complete-reward');

        if (emojiEl) emojiEl.textContent = mission.emoji;
        if (rewardEl) rewardEl.textContent = mission.rewardText;

        banner.classList.remove('active');
        banner.style.display = 'none';
        void banner.offsetWidth; // Force reflow
        banner.style.display = 'flex';
        banner.classList.add('active');

        this.bannerActive = true;
        this.bannerTimer = 3.5;

        setTimeout(() => {
            banner.classList.remove('active');
            banner.style.display = 'none';
            this.bannerActive = false;
        }, 3500);
    }

    showNewMissionBanner(mission) {
        if (!mission) return;
        const banner = document.getElementById('mission-new-banner');
        if (!banner) return;

        const titleEl = document.getElementById('mission-new-title');
        const descEl = document.getElementById('mission-new-desc');

        if (titleEl) titleEl.textContent = `${mission.emoji} ${mission.title}`;
        if (descEl) descEl.textContent = mission.description;

        banner.classList.remove('active');
        banner.style.display = 'none';
        void banner.offsetWidth;
        banner.style.display = 'flex';
        banner.classList.add('active');

        this.newMissionActive = true;
        this.newMissionTimer = 3.5;

        // Play new mission sound
        this.playNewMissionSound();

        setTimeout(() => {
            banner.classList.remove('active');
            banner.style.display = 'none';
            this.newMissionActive = false;
        }, 3500);
    }

    showFinalBanner() {
        const banner = document.getElementById('mission-final-banner');
        if (!banner) return;

        banner.classList.remove('active');
        banner.style.display = 'none';
        void banner.offsetWidth;
        banner.style.display = 'flex';
        banner.classList.add('active');

        this.playFinalSound();

        setTimeout(() => {
            banner.classList.remove('active');
            banner.style.display = 'none';
        }, 6000);
    }

    // === SOUNDS ===

    _getAudioCtx() {
        if (!this.audioCtx) {
            this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    playCompletionSound() {
        try {
            const ctx = this._getAudioCtx();
            const t = ctx.currentTime;

            // Triumphant ascending chord
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t + i * 0.12);
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.25, t + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.12);
                osc.stop(t + i * 0.12 + 1.0);
            });

            // Sparkle chimes
            for (let i = 0; i < 6; i++) {
                const chime = ctx.createOscillator();
                chime.type = 'sine';
                const chimeFreq = 2000 + i * 300 + Math.random() * 500;
                const delay = 0.5 + i * 0.08;
                chime.frequency.setValueAtTime(chimeFreq, t + delay);
                const cGain = ctx.createGain();
                cGain.gain.setValueAtTime(0.08, t + delay);
                cGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
                chime.connect(cGain);
                cGain.connect(ctx.destination);
                chime.start(t + delay);
                chime.stop(t + delay + 0.4);
            }

            // Bass boom
            const bass = ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(80, t);
            bass.frequency.exponentialRampToValueAtTime(40, t + 0.3);
            const bassGain = ctx.createGain();
            bassGain.gain.setValueAtTime(0.4, t);
            bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            bass.connect(bassGain);
            bassGain.connect(ctx.destination);
            bass.start(t);
            bass.stop(t + 0.5);
        } catch(e) {}
    }

    playNewMissionSound() {
        try {
            const ctx = this._getAudioCtx();
            const t = ctx.currentTime;

            // Two-tone notification
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, t);
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0.2, t);
            g1.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc1.connect(g1);
            g1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.25);

            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1320, t + 0.15);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.2, t + 0.15);
            g2.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc2.connect(g2);
            g2.connect(ctx.destination);
            osc2.start(t + 0.15);
            osc2.stop(t + 0.45);
        } catch(e) {}
    }

    playFinalSound() {
        try {
            const ctx = this._getAudioCtx();
            const t = ctx.currentTime;

            // Epic fanfare
            const fanfare = [
                { freq: 523, time: 0 },
                { freq: 659, time: 0.15 },
                { freq: 784, time: 0.3 },
                { freq: 1047, time: 0.45 },
                { freq: 1319, time: 0.6 },
                { freq: 1568, time: 0.75 },
                { freq: 2093, time: 0.9 }
            ];

            fanfare.forEach(note => {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.freq, t + note.time);
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.15, t + note.time);
                gain.gain.exponentialRampToValueAtTime(0.01, t + note.time + 1.2);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3000, t + note.time);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + note.time);
                osc.stop(t + note.time + 1.5);
            });

            // Deep bass rumble
            const bass = ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(60, t);
            bass.frequency.exponentialRampToValueAtTime(30, t + 1.5);
            const bassGain = ctx.createGain();
            bassGain.gain.setValueAtTime(0.5, t);
            bassGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
            bass.connect(bassGain);
            bassGain.connect(ctx.destination);
            bass.start(t);
            bass.stop(t + 2.0);

            // Shimmer
            for (let i = 0; i < 10; i++) {
                const shimmer = ctx.createOscillator();
                shimmer.type = 'sine';
                const sFreq = 3000 + Math.random() * 4000;
                const sDelay = 1.0 + i * 0.1;
                shimmer.frequency.setValueAtTime(sFreq, t + sDelay);
                const sGain = ctx.createGain();
                sGain.gain.setValueAtTime(0.05, t + sDelay);
                sGain.gain.exponentialRampToValueAtTime(0.001, t + sDelay + 0.4);
                shimmer.connect(sGain);
                sGain.connect(ctx.destination);
                shimmer.start(t + sDelay);
                shimmer.stop(t + sDelay + 0.5);
            }
        } catch(e) {}
    }

    // === UPDATE (called each frame) ===

    update(dt) {
        if (this.progressFlashTimer > 0) {
            this.progressFlashTimer -= dt;
            if (this.progressFlashTimer <= 0) {
                this.progressFlashTimer = 0;
                if (!this._domCached) this._cacheDom();
                if (this._trackerEl) this._trackerEl.classList.remove('flash');
            }
        }

        if (this.bannerTimer > 0) {
            this.bannerTimer -= dt;
        }
        if (this.newMissionTimer > 0) {
            this.newMissionTimer -= dt;
        }

        // Debounced localStorage save
        if (this._savePending) {
            this._saveTimer += dt;
            if (this._saveTimer >= this._saveInterval) {
                this._flushSave();
                this._saveTimer = 0;
            }
        }
    }

    // === SAVE / LOAD ===

    saveProgress() {
        // Debounce: mark as pending, actual write happens in update()
        this._savePending = true;
    }

    _flushSave() {
        try {
            const data = {
                currentMissionIndex: this.currentMissionIndex,
                progress: this.progress,
                allComplete: this.allComplete
            };
            localStorage.setItem('pinkCigMissions', JSON.stringify(data));
            this._savePending = false;
        } catch(e) {}
    }

    reset() {
        // Reset all progress on death
        this.currentMissionIndex = 0;
        this.allComplete = false;
        for (const key in this.progress) {
            this.progress[key] = 0;
        }

        // Clear saved progress
        try {
            localStorage.removeItem('pinkCigMissions');
        } catch(e) {}

        // Update UI to show first mission again
        this.updateTrackerUI();

        // Show the first mission banner after a short delay
        setTimeout(() => {
            this.showNewMissionBanner(this.getCurrentMission());
        }, 1500);
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('pinkCigMissions');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentMissionIndex = data.currentMissionIndex || 0;
                this.allComplete = data.allComplete || false;
                if (data.progress) {
                    for (const key in data.progress) {
                        if (this.progress.hasOwnProperty(key)) {
                            this.progress[key] = data.progress[key];
                        }
                    }
                }
            }
        } catch(e) {}
    }
}

window.MissionSystem = MissionSystem;
