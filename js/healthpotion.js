// Health Potion (Mango Cart Ale) - Pickup for health boosts + spawns strippers

// Create the Mango Cart Ale texture once and share it across all potions
let _mangoCartTexture = null;

function getMangoCartTexture() {
    if (_mangoCartTexture) return _mangoCartTexture;
    
    // Draw a detailed Mango Cart Ale can as a canvas texture
    // This works on file:// protocol without any image loading
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    
    // Can body - golden/amber gradient
    const bodyGrad = ctx.createLinearGradient(8, 0, 56, 0);
    bodyGrad.addColorStop(0, '#c87820');
    bodyGrad.addColorStop(0.15, '#f0a030');
    bodyGrad.addColorStop(0.5, '#ffcc44');
    bodyGrad.addColorStop(0.85, '#f0a030');
    bodyGrad.addColorStop(1, '#c87820');
    
    // Can shape (rounded rectangle)
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(52, 8);
    ctx.quadraticCurveTo(56, 8, 56, 12);
    ctx.lineTo(56, 88);
    ctx.quadraticCurveTo(56, 92, 52, 92);
    ctx.lineTo(12, 92);
    ctx.quadraticCurveTo(8, 92, 8, 88);
    ctx.lineTo(8, 12);
    ctx.quadraticCurveTo(8, 8, 12, 8);
    ctx.fill();
    
    // Can top rim
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(10, 6, 44, 6);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(10, 4, 44, 3);
    
    // Pull tab
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(24, 2, 16, 4);
    ctx.fillStyle = '#b0b0b0';
    ctx.fillRect(28, 0, 8, 3);
    
    // Can bottom rim
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(10, 88, 44, 4);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(10, 91, 44, 2);
    
    // White label area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 24, 40, 48);
    
    // Mango illustration (orange circle with green leaf)
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(32, 42, 12, 0, Math.PI * 2);
    ctx.fill();
    // Mango highlight
    ctx.fillStyle = '#ffaa33';
    ctx.beginPath();
    ctx.arc(28, 38, 7, 0, Math.PI * 2);
    ctx.fill();
    // Mango darker side
    ctx.fillStyle = '#dd6600';
    ctx.beginPath();
    ctx.arc(36, 46, 6, 0, Math.PI * 2);
    ctx.fill();
    // Leaf
    ctx.fillStyle = '#33aa33';
    ctx.beginPath();
    ctx.ellipse(26, 32, 6, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#228822';
    ctx.beginPath();
    ctx.ellipse(24, 30, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // "MANGO" text
    ctx.fillStyle = '#cc3300';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MANGO', 32, 62);
    
    // "CART" text
    ctx.fillStyle = '#cc3300';
    ctx.font = 'bold 8px Arial';
    ctx.fillText('CART', 32, 70);
    
    // "ALE" text smaller
    ctx.fillStyle = '#996600';
    ctx.font = '6px Arial';
    ctx.fillText('ALE', 32, 56);
    
    // Can highlight (left side shine)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(10, 10, 8, 78);
    
    // Can shadow (right side)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(48, 10, 6, 78);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    _mangoCartTexture = texture;
    
    return texture;
}

class HealthPotion {
    constructor(world, scene, x, y, z) {
        this.world = world;
        this.scene = scene;
        this.position = new THREE.Vector3(x, y, z);
        this.alive = true;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.pickupRange = 2.2;
        this.healAmount = 5;
        this.baseY = y;

        this.audioCtx = null;

        // All objects added directly to scene for proper rendering
        this.sceneObjects = [];
        this.mainSprite = null;
        this.glowSprite = null;
        this.sparkles = [];
        
        this.createVisuals();
    }

    createVisuals() {
        // Create the main Mango Cart sprite - synchronous canvas texture
        const texture = getMangoCartTexture();
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0
        });
        this.mainSprite = new THREE.Sprite(spriteMat);
        this.mainSprite.scale.set(1.2, 1.8, 1.0); // Taller than wide (can shape)
        this.mainSprite.position.set(this.position.x, this.position.y + 0.8, this.position.z);
        this.scene.add(this.mainSprite);
        this.sceneObjects.push(this.mainSprite);

        // Golden glow effect underneath
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 32;
        glowCanvas.height = 32;
        const ctx = glowCanvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 170, 30, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);

        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        this.glowSprite = new THREE.Sprite(glowMat);
        this.glowSprite.scale.set(2.0, 2.0, 2.0);
        this.glowSprite.position.set(this.position.x, this.position.y + 0.3, this.position.z);
        this.scene.add(this.glowSprite);
        this.sceneObjects.push(this.glowSprite);

        // Sparkle particles (small bright dots orbiting)
        for (let i = 0; i < 6; i++) {
            const sparkleCanvas = document.createElement('canvas');
            sparkleCanvas.width = 8;
            sparkleCanvas.height = 8;
            const sCtx = sparkleCanvas.getContext('2d');
            sCtx.fillStyle = '#ffffaa';
            sCtx.beginPath();
            sCtx.arc(4, 4, 3, 0, Math.PI * 2);
            sCtx.fill();

            const sparkleTexture = new THREE.CanvasTexture(sparkleCanvas);
            const sparkleMat = new THREE.SpriteMaterial({
                map: sparkleTexture,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            const sparkle = new THREE.Sprite(sparkleMat);
            sparkle.scale.set(0.15, 0.15, 0.15);
            sparkle.userData = {
                angle: (i / 6) * Math.PI * 2,
                speed: 1.5 + Math.random() * 1.0,
                radius: 0.6 + Math.random() * 0.3,
                yOffset: 0.4 + Math.random() * 0.8
            };
            sparkle.position.set(this.position.x, this.position.y + 0.5, this.position.z);
            this.scene.add(sparkle);
            this.sceneObjects.push(sparkle);
            this.sparkles.push(sparkle);
        }
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        // Bobbing animation
        this.bobPhase += dt * 2.5;
        this.glowPhase += dt * 3.0;
        const bobY = Math.sin(this.bobPhase) * 0.2;
        const currentY = this.baseY + bobY;

        // Update main sprite position
        if (this.mainSprite) {
            this.mainSprite.position.set(this.position.x, currentY + 0.8, this.position.z);
        }

        // Update glow position and pulsing
        if (this.glowSprite) {
            this.glowSprite.position.set(this.position.x, currentY + 0.3, this.position.z);
            const glowScale = 1.8 + Math.sin(this.glowPhase) * 0.4;
            this.glowSprite.scale.set(glowScale, glowScale, glowScale);
            this.glowSprite.material.opacity = 0.4 + Math.sin(this.glowPhase * 1.3) * 0.2;
        }

        // Sparkle orbit animation
        for (const sparkle of this.sparkles) {
            const ud = sparkle.userData;
            ud.angle += dt * ud.speed;
            sparkle.position.set(
                this.position.x + Math.cos(ud.angle) * ud.radius,
                currentY + ud.yOffset + Math.sin(ud.angle * 0.7) * 0.15,
                this.position.z + Math.sin(ud.angle) * ud.radius
            );
            sparkle.material.opacity = 0.4 + Math.sin(ud.angle * 2) * 0.3;
        }

        // Check pickup distance
        const dist = this.position.distanceTo(playerPos);
        if (dist < this.pickupRange) {
            return true; // Signal pickup
        }
        return false;
    }

    playPickupSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Bright ascending chime - power up sound
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t + i * 0.08);
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, t + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.35);
            });

            // Sparkle shimmer overlay
            const bufSize = ctx.sampleRate * 0.3;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08)) * 0.3;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.08, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(3000, t);
            noise.connect(hp);
            hp.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);
        } catch(e) {}
    }

    spawnPickupEffect() {
        // Green healing particles burst
        for (let i = 0; i < 15; i++) {
            const size = 0.06 + Math.random() * 0.1;
            const geo = new THREE.BoxGeometry(size, size, size);
            const green = 0.5 + Math.random() * 0.5;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0.2, green, 0.1),
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(this.position);
            particle.position.y += 0.8;

            const vx = (Math.random() - 0.5) * 4;
            const vy = 1 + Math.random() * 3;
            const vz = (Math.random() - 0.5) * 4;
            this.scene.add(particle);

            let frame = 0;
            const animate = () => {
                frame++;
                particle.position.x += vx * 0.016;
                particle.position.y += (vy - frame * 0.15) * 0.016;
                particle.position.z += vz * 0.016;
                particle.rotation.x += 0.1;
                particle.rotation.z += 0.15;
                mat.opacity = Math.max(0, 0.9 - frame / 25);
                if (frame < 30) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animate);
        }

        // Golden sparkle burst
        for (let i = 0; i < 10; i++) {
            const size = 0.04 + Math.random() * 0.06;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(1, 0.85, 0.2),
                transparent: true,
                opacity: 0.8
            });
            const sparkle = new THREE.Mesh(geo, mat);
            sparkle.position.copy(this.position);
            sparkle.position.y += 0.8;

            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vy = 2 + Math.random() * 2;
            const vz = Math.sin(angle) * speed;
            this.scene.add(sparkle);

            let frame = 0;
            const animate = () => {
                frame++;
                sparkle.position.x += vx * 0.016;
                sparkle.position.y += (vy - frame * 0.12) * 0.016;
                sparkle.position.z += vz * 0.016;
                mat.opacity = Math.max(0, 0.8 - frame / 20);
                if (frame < 25) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(sparkle);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animate);
        }

        // Floating "+5 HP" text using a canvas sprite
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#44ff44';
        ctx.strokeStyle = '#004400';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.strokeText('+5 HP', 64, 40);
        ctx.fillText('+5 HP', 64, 40);

        const textTexture = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.SpriteMaterial({
            map: textTexture,
            transparent: true,
            opacity: 1.0
        });
        const textSprite = new THREE.Sprite(textMat);
        textSprite.scale.set(2, 1, 1);
        textSprite.position.copy(this.position);
        textSprite.position.y += 1.5;
        this.scene.add(textSprite);

        let textFrame = 0;
        const animateText = () => {
            textFrame++;
            textSprite.position.y += 0.03;
            textMat.opacity = Math.max(0, 1 - textFrame / 40);
            if (textFrame < 45) {
                requestAnimationFrame(animateText);
            } else {
                this.scene.remove(textSprite);
                textTexture.dispose();
                textMat.dispose();
            }
        };
        requestAnimationFrame(animateText);
    }

    dispose() {
        this.alive = false;
        // Remove all scene-level objects
        for (const obj of this.sceneObjects) {
            this.scene.remove(obj);
            if (obj.material) {
                // Don't dispose the shared mango cart texture
                if (obj.material.map && obj.material.map !== _mangoCartTexture) {
                    obj.material.map.dispose();
                }
                obj.material.dispose();
            }
            if (obj.geometry) obj.geometry.dispose();
        }
        this.sceneObjects = [];
        this.mainSprite = null;
        this.glowSprite = null;
        this.sparkles = [];
    }
}

// Health Potion Spawner
class HealthPotionSpawner {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.potions = [];
        this.maxPotions = 5;
        this.spawnCooldown = 3; // Start with a short cooldown so first one spawns quickly
        this.spawnInterval = 10; // Seconds between spawn attempts
        this.stripperSpawner = null; // Set by main.js
        this.player = null; // Set by main.js
        
        // Pre-create the texture immediately so it's ready when first potion spawns
        getMangoCartTexture();
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        // Try to spawn new potions
        if (this.spawnCooldown <= 0 && this.potions.length < this.maxPotions) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval + Math.random() * 4;
        }

        // Update existing potions
        for (let i = this.potions.length - 1; i >= 0; i--) {
            const potion = this.potions[i];

            // Check for pickup
            const pickedUp = potion.update(dt, playerPos);
            if (pickedUp) {
                this.onPickup(potion);
                potion.dispose();
                this.potions.splice(i, 1);
                continue;
            }

            // Despawn if too far
            if (potion.position.distanceTo(playerPos) > 80) {
                potion.dispose();
                this.potions.splice(i, 1);
            }
        }
    }

    onPickup(potion) {
        // Play pickup sound and effects
        potion.playPickupSound();
        potion.spawnPickupEffect();

        // Heal the player
        if (this.player) {
            const oldHealth = this.player.health;
            this.player.health = Math.min(this.player.maxHealth, this.player.health + potion.healAmount);
            const healed = this.player.health - oldHealth;

            // Green flash instead of red damage flash
            if (healed > 0) {
                this.player.damageFlash = 0.3; // Reuse the flash timer for visual feedback
            }
        }

        // Spawn 2-3 extra strippers near the player
        if (this.stripperSpawner && this.player) {
            const extraStrippers = 2 + Math.floor(Math.random() * 2); // 2 or 3
            for (let s = 0; s < extraStrippers; s++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 5 + Math.random() * 8;
                const sx = this.player.position.x + Math.cos(angle) * dist;
                const sz = this.player.position.z + Math.sin(angle) * dist;
                const sy = this.world.getSpawnHeight(sx, sz);

                // Only spawn above water
                if (sy > WATER_LEVEL + 1) {
                    const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
                    if (groundBlock !== BlockType.AIR && groundBlock !== BlockType.WATER) {
                        const stripper = new Stripper(this.world, this.scene, sx, sy + 0.5, sz);
                        this.stripperSpawner.strippers.push(stripper);
                    }
                }
            }
        }
    }

    trySpawn(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 20;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;
        const sy = this.world.getSpawnHeight(sx, sz);

        // Don't spawn in water or too low
        if (sy <= WATER_LEVEL + 1) return;

        // Check ground is solid
        const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        const potion = new HealthPotion(this.world, this.scene, sx, sy + 0.5, sz);
        this.potions.push(potion);
    }

    getCount() {
        return this.potions.length;
    }
}

window.HealthPotion = HealthPotion;
window.HealthPotionSpawner = HealthPotionSpawner;
