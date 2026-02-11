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

        // Handle scroll wheel for hotbar
        const scroll = this.player.world ? 0 : 0; // scroll handled in main

        // Update debug info
        const pos = this.player.position;
        const chunkX = Math.floor(pos.x / CHUNK_SIZE);
        const chunkZ = Math.floor(pos.z / CHUNK_SIZE);
        const blockName = BlockNames[HotbarBlocks[this.player.selectedSlot]] || 'Unknown';
        
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

        const catCount = catSpawner ? catSpawner.getCatCount() : 0;
        const bongCount = bongManSpawner ? bongManSpawner.getCount() : 0;
        const stripperCount = stripperSpawner ? stripperSpawner.getCount() : 0;
        const crackheadCount = crackheadSpawner ? crackheadSpawner.getCount() : 0;
        const glockStatus = glock && glock.equipped ? '🔫 GLOCK EQUIPPED' : '🔫 Press G for Glock';
        const moneyDisplay = glock ? `💵 $${glock.money}${glock.money > 0 ? ' (M to flex)' : ''}` : '';
        const swimStatus = this.player.inWater ? (this.player.headUnderwater ? '🏊 UNDERWATER' : '🌊 Swimming') : '';
        this.debugInfo.innerHTML = 
            `FPS: ${this.lastFps}<br>` +
            `XYZ: ${pos.x.toFixed(1)} / ${pos.y.toFixed(1)} / ${pos.z.toFixed(1)}<br>` +
            `Chunk: ${chunkX}, ${chunkZ}<br>` +
            `Block: ${blockName}<br>` +
            `❤️ HP: ${this.player.health}/${this.player.maxHealth}<br>` +
            (swimStatus ? `${swimStatus}<br>` : '') +
            `🐱 Cats: ${catCount}<br>` +
            `✌️ Hippies: ${bongCount}<br>` +
            `💃 Strippers: ${stripperCount}<br>` +
            `🤪 Crackheads: ${crackheadCount}<br>` +
            `${glockStatus}<br>` +
            `${moneyDisplay}<br>` +
            `Seed: ${this.world.seed}`;
    }
}

window.UI = UI;
