// UI management - HUD, hotbar, debug info
class UI {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.hotbarSlots = document.querySelectorAll('.hotbar-slot');
        this.debugInfo = document.getElementById('debug-info');
        this.hud = document.getElementById('hud');
        this.startScreen = document.getElementById('start-screen');
        this.healthBarInner = document.getElementById('health-bar-inner');
        this.healthText = document.getElementById('health-text');
        this.damageFlash = document.getElementById('damage-flash');
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;
        this.lastFps = 60;

        // Expose player globally for respawn button
        window.gamePlayer = player;

        this.initHotbar();
    }

    initHotbar() {
        // Draw block previews in hotbar
        this.hotbarSlots.forEach((slot, index) => {
            if (index < HotbarBlocks.length) {
                const blockType = HotbarBlocks[index];
                const previewCanvas = this.world.blockTextures.getPreviewCanvas(blockType);
                const slotCanvas = slot.querySelector('canvas');
                const ctx = slotCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(previewCanvas, 0, 0, 32, 32);
            }
        });
    }

    show() {
        this.hud.style.display = 'block';
        this.startScreen.style.display = 'none';
    }

    hide() {
        this.hud.style.display = 'none';
        this.startScreen.style.display = 'flex';
    }

    update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock) {
        // FPS counter
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1.0) {
            this.lastFps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // Update hotbar selection
        this.hotbarSlots.forEach((slot, index) => {
            if (index === this.player.selectedSlot) {
                slot.classList.add('selected');
            } else {
                slot.classList.remove('selected');
            }
        });

        // Update health bar
        const healthPct = (this.player.health / this.player.maxHealth) * 100;
        if (this.healthBarInner) {
            this.healthBarInner.style.width = healthPct + '%';
        }
        if (this.healthText) {
            this.healthText.textContent = `${this.player.health}/${this.player.maxHealth}`;
        }

        // Damage flash
        if (this.damageFlash) {
            if (this.player.damageFlash > 0) {
                this.damageFlash.classList.add('active');
            } else {
                this.damageFlash.classList.remove('active');
            }
        }

        // Track previous money for flash effect
        const currentMoney = glock ? glock.money : 0;
        if (this._prevMoney === undefined) this._prevMoney = currentMoney;
        const moneyChanged = currentMoney !== this._prevMoney;
        this._prevMoney = currentMoney;

        const catCount = catSpawner ? catSpawner.getCatCount() : 0;
        const bongCount = bongManSpawner ? bongManSpawner.getCount() : 0;
        const stripperCount = stripperSpawner ? stripperSpawner.getCount() : 0;
        const crackheadCount = crackheadSpawner ? crackheadSpawner.getCount() : 0;
        const hp = this.player.health;
        const maxHp = this.player.maxHealth;
        const glockEquipped = glock && glock.equipped;
        const isSwimming = this.player.inWater;
        const isUnderwater = this.player.headUnderwater;

        // Count collected strippers
        let collectedCount = 0;
        if (stripperSpawner) {
            for (const s of stripperSpawner.strippers) {
                if (s.alive && (s.collected || s.inCar)) collectedCount++;
            }
        }

        // Build graphic HUD rows
        let rows = '';

        // 💰 Money (always first, most important)
        const moneyFlash = moneyChanged ? ' flash' : '';
        rows += `<div class="hud-row${moneyFlash}"><span class="hud-emoji">💵</span><span class="hud-val money">$${currentMoney}</span></div>`;

        // ❤️ HP
        const hpDanger = hp <= maxHp * 0.3 ? ' danger' : '';
        rows += `<div class="hud-row${hpDanger}"><span class="hud-emoji">❤️</span><span class="hud-val hp">${hp}</span></div>`;

        // 🔫 Glock
        const glockClass = glockEquipped ? ' equipped' : '';
        const glockText = glockEquipped ? '🔥' : 'G';
        rows += `<div class="hud-row${glockClass}"><span class="hud-emoji">🔫</span><span class="hud-val glock">${glockText}</span></div>`;

        // 🐱 Cats
        if (catCount > 0) {
            rows += `<div class="hud-row"><span class="hud-emoji">🐱</span><span class="hud-val cats">${catCount}</span></div>`;
        }

        // 🌿 Hippies
        if (bongCount > 0) {
            rows += `<div class="hud-row"><span class="hud-emoji">🌿</span><span class="hud-val hippies">${bongCount}</span></div>`;
        }

        // 💃 Strippers
        if (stripperCount > 0) {
            rows += `<div class="hud-row"><span class="hud-emoji">💃</span><span class="hud-val strippers">${stripperCount}</span></div>`;
        }

        // 💀 Crackheads
        if (crackheadCount > 0) {
            rows += `<div class="hud-row"><span class="hud-emoji">💀</span><span class="hud-val crackheads">${crackheadCount}</span></div>`;
        }

        // 👑 Collection
        if (collectedCount > 0) {
            rows += `<div class="hud-row"><span class="hud-emoji">👑</span><span class="hud-val collection">${collectedCount}💃</span></div>`;
        }

        // 🌊 Swimming
        if (isSwimming) {
            const swimEmoji = isUnderwater ? '🫧' : '🌊';
            rows += `<div class="hud-row"><span class="hud-emoji">${swimEmoji}</span><span class="hud-val swim">${isUnderwater ? '!!!' : '~'}</span></div>`;
        }

        this.debugInfo.innerHTML = rows;
    }
}

window.UI = UI;
