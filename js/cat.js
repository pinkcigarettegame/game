// Cat Enemy - Like creepers but cats! They meow and explode!
class CatEnemy {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.alive = true;
        this.exploding = false;
        this.explodeTimer = 0;
        this.explodeDuration = 2.0; // seconds before boom
        this.explodeRadius = 4;
        this.detectionRange = 10;
        this.explodeRange = 3;
        this.meowCooldown = 0;
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.speed = 2.0;
        this.gravity = -25.0;
        this.onGround = false;
        this.inWater = false;
        this.swimBobPhase = Math.random() * Math.PI * 2;
        this.flashRate = 0;

        // Create cat mesh
        this.mesh = this.createCatMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Audio context for meowing
        this.audioCtx = null;
        this.lastMeowTime = 0;
    }

    createCatMesh() {
        const group = new THREE.Group();

        // Body (pink-ish cat body)
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 0.9);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.45;
        group.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.45, 0.45);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.75, 0.5);
        group.add(head);

        // Ears (triangular-ish using small boxes)
        const earGeo = new THREE.BoxGeometry(0.12, 0.18, 0.08);
        const earMat = new THREE.MeshLambertMaterial({ color: 0xddaaaa });
        
        const leftEar = new THREE.Mesh(earGeo, earMat);
        leftEar.position.set(-0.15, 1.03, 0.5);
        leftEar.rotation.z = -0.2;
        group.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, earMat);
        rightEar.position.set(0.15, 1.03, 0.5);
        rightEar.rotation.z = 0.2;
        group.add(rightEar);

        // Eyes (green glowing eyes)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.8, 0.72);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.8, 0.72);
        group.add(rightEye);

        // Nose (tiny pink)
        const noseGeo = new THREE.BoxGeometry(0.06, 0.04, 0.05);
        const noseMat = new THREE.MeshLambertMaterial({ color: 0xff8899 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.72, 0.73);
        group.add(nose);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
        const tailMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 0.65, -0.6);
        tail.rotation.x = -0.5;
        group.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.25, 0.15);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
        
        const positions = [
            [-0.18, 0.12, 0.3],
            [0.18, 0.12, 0.3],
            [-0.18, 0.12, -0.3],
            [0.18, 0.12, -0.3]
        ];
        
        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(...pos);
            group.add(leg);
        });

        return group;
    }

    playMeow() {
        const now = Date.now();
        if (now - this.lastMeowTime < 2000) return; // Don't meow too often
        this.lastMeowTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            // Meow sound synthesis - two frequency sweeps
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            const gain2 = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';

            // First part: rising "me-"
            osc1.frequency.setValueAtTime(400 + Math.random() * 100, now);
            osc1.frequency.linearRampToValueAtTime(700 + Math.random() * 200, now + 0.15);
            
            // Second part: falling "-ow"
            osc1.frequency.linearRampToValueAtTime(500 + Math.random() * 100, now + 0.35);
            osc1.frequency.linearRampToValueAtTime(300 + Math.random() * 50, now + 0.5);

            osc2.frequency.setValueAtTime(800 + Math.random() * 200, now);
            osc2.frequency.linearRampToValueAtTime(1200 + Math.random() * 300, now + 0.15);
            osc2.frequency.linearRampToValueAtTime(600 + Math.random() * 100, now + 0.5);

            // Volume envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.35);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);

            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.05, now + 0.05);
            gain2.gain.linearRampToValueAtTime(0.08, now + 0.15);
            gain2.gain.linearRampToValueAtTime(0, now + 0.5);

            osc1.connect(gain);
            osc2.connect(gain2);
            gain.connect(ctx.destination);
            gain2.connect(ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.55);
            osc2.start(now);
            osc2.stop(now + 0.55);
        } catch(e) {
            // Audio not available, that's ok
        }
    }

    playExplosion() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            // Explosion sound - noise burst + low rumble
            const bufferSize = ctx.sampleRate * 0.5;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            // Low rumble
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(60, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.3, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);

            noise.start(now);
            osc.start(now);
            osc.stop(now + 0.6);
        } catch(e) {
            // Audio not available
        }
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);

        if (this.exploding) {
            this.explodeTimer += dt;
            this.flashRate += dt * 8;

            // Flash the cat white/red
            const flash = Math.sin(this.flashRate * 10) > 0;
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (flash) {
                        child.material.emissive = new THREE.Color(0xff0000);
                        child.material.emissiveIntensity = 0.8;
                    } else {
                        child.material.emissive = new THREE.Color(0xffffff);
                        child.material.emissiveIntensity = 0.5;
                    }
                }
            });

            // Scale up slightly as about to explode
            const scale = 1 + (this.explodeTimer / this.explodeDuration) * 0.3;
            this.mesh.scale.set(scale, scale, scale);

            if (this.explodeTimer >= this.explodeDuration) {
                this.explode();
                return;
            }

            return;
        }

        // Check if in water
        const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        const bodyBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
        this.inWater = (feetBlock === BlockType.WATER || bodyBlock === BlockType.WATER);

        // Gravity / Swimming
        if (this.inWater) {
            this.swimBobPhase += dt * 3;
            // Water buoyancy
            this.velocity.y += -5.0 * dt; // reduced gravity
            // Buoyancy force
            if (this.position.y < WATER_LEVEL) {
                const submersion = Math.min(1.0, (WATER_LEVEL - this.position.y) / 1.0);
                this.velocity.y += 25.0 * submersion * dt;
            }
            // Water drag
            this.velocity.y *= 0.92;
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
            // Clamp
            this.velocity.y = Math.max(-4, Math.min(4, this.velocity.y));
        } else {
            this.velocity.y += this.gravity * dt;
            if (this.velocity.y < -50) this.velocity.y = -50;
        }

        // AI behavior
        if (distToPlayer < this.explodeRange) {
            // Start exploding!
            this.exploding = true;
            this.explodeTimer = 0;
            this.playMeow(); // Angry meow before explosion
            this.velocity.x = 0;
            this.velocity.z = 0;
        } else if (distToPlayer < this.detectionRange) {
            // Chase player
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();
            this.velocity.x = dir.x * this.speed;
            this.velocity.z = dir.z * this.speed;

            // Face the player
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

            // Meow occasionally when chasing
            this.meowCooldown -= dt;
            if (this.meowCooldown <= 0) {
                this.playMeow();
                this.meowCooldown = 2 + Math.random() * 3;
            }
        } else {
            // Wander randomly
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 2 + Math.random() * 4;
            }
            this.velocity.x = this.wanderDir.x * this.speed * 0.3;
            this.velocity.z = this.wanderDir.z * this.speed * 0.3;
            this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
        }

        // Apply movement with simple collision
        const oldPos = this.position.clone();

        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            this.position.x = oldPos.x;
            // Try to jump over obstacle
            if (this.onGround) {
                this.velocity.y = 7;
                this.onGround = false;
            }
        }

        this.position.y += this.velocity.y * dt;
        if (this.checkCollision()) {
            if (this.velocity.y < 0) {
                this.position.y = Math.floor(this.position.y - 0.01) + 1.001;
                this.onGround = true;
            } else {
                this.position.y = oldPos.y;
            }
            this.velocity.y = 0;
        } else {
            this.onGround = false;
        }

        this.position.z += this.velocity.z * dt;
        if (this.checkCollision()) {
            this.position.z = oldPos.z;
            if (this.onGround) {
                this.velocity.y = 7;
                this.onGround = false;
            }
        }

        // Keep above void
        if (this.position.y < -10) {
            this.alive = false;
        }

        // Update mesh position
        this.mesh.position.copy(this.position);

        // Swimming animation or walking animation
        if (this.inWater) {
            // Swimming bob - gentle floating motion
            const swimBob = Math.sin(this.swimBobPhase) * 0.15;
            this.mesh.position.y += swimBob;
            // Slight tilt when swimming
            this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.7) * 0.1;
            this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.5) * 0.08;
        } else {
            // Animate legs (simple bob)
            const bobSpeed = distToPlayer < this.detectionRange ? 8 : 3;
            const bob = Math.sin(Date.now() * 0.01 * bobSpeed) * 0.03;
            this.mesh.position.y += bob;
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }
    }

    checkCollision() {
        const hw = 0.25;
        const feetY = this.position.y - 0.01;
        const headY = this.position.y + 0.9;

        for (let dy = feetY; dy <= headY; dy += 0.45) {
            for (let dx = -hw; dx <= hw; dx += hw * 2) {
                for (let dz = -hw; dz <= hw; dz += hw * 2) {
                    const bx = Math.floor(this.position.x + dx);
                    const by = Math.floor(dy);
                    const bz = Math.floor(this.position.z + dz);
                    const block = this.world.getBlock(bx, by, bz);
                    if (block !== BlockType.AIR && block !== BlockType.WATER && 
                        block !== BlockType.CIGARETTE_SMOKE && block !== BlockType.LEAVES) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    explode() {
        this.playExplosion();
        
        // Destroy blocks in radius
        const cx = Math.floor(this.position.x);
        const cy = Math.floor(this.position.y);
        const cz = Math.floor(this.position.z);
        const r = this.explodeRadius;

        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist <= r) {
                        const bx = cx + dx;
                        const by = cy + dy;
                        const bz = cz + dz;
                        // Don't destroy bedrock (y=0)
                        if (by > 0) {
                            const block = this.world.getBlock(bx, by, bz);
                            if (block !== BlockType.AIR) {
                                // Random chance to survive based on distance
                                if (Math.random() < 1 - (dist / r) * 0.5) {
                                    this.world.setBlock(bx, by, bz, BlockType.AIR);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Damage player based on distance
        if (this.player) {
            const distToPlayer = this.position.distanceTo(this.player.position);
            if (distToPlayer < this.explodeRadius + 1) {
                // Closer = more damage. Point blank = 20 (instant kill), edge = ~5
                const damage = Math.ceil(20 * (1 - distToPlayer / (this.explodeRadius + 2)));
                this.player.takeDamage(Math.max(1, damage));
            }
        }

        // Create explosion particle effect (simple expanding sphere)
        this.createExplosionEffect();

        // Remove cat
        this.alive = false;
        this.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }

    createExplosionEffect() {
        const scene = this.scene;
        const pos = this.position.clone();
        const radius = this.explodeRadius;
        const allObjects = []; // track everything for cleanup

        // === 1. BRIGHT CORE FLASH (white-hot center) ===
        const coreGeo = new THREE.SphereGeometry(radius * 0.5, 10, 10);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(pos);
        scene.add(core);
        allObjects.push({ mesh: core, geo: coreGeo, mat: coreMat });

        // === 2. MAIN FIREBALL (orange) ===
        const fireGeo = new THREE.SphereGeometry(radius * 0.8, 10, 10);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 });
        const fireball = new THREE.Mesh(fireGeo, fireMat);
        fireball.position.copy(pos);
        scene.add(fireball);
        allObjects.push({ mesh: fireball, geo: fireGeo, mat: fireMat });

        // === 3. OUTER FIREBALL (red) ===
        const outerGeo = new THREE.SphereGeometry(radius * 1.0, 10, 10);
        const outerMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.6 });
        const outerBall = new THREE.Mesh(outerGeo, outerMat);
        outerBall.position.copy(pos);
        scene.add(outerBall);
        allObjects.push({ mesh: outerBall, geo: outerGeo, mat: outerMat });

        // === 4. SHOCKWAVE RING ===
        const ringGeo = new THREE.RingGeometry(0.1, radius * 0.3, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        allObjects.push({ mesh: ring, geo: ringGeo, mat: ringMat });

        // === 5. FLYING DEBRIS PARTICLES ===
        const debrisParticles = [];
        const debrisColors = [0xff6600, 0xff3300, 0xffaa00, 0x884400, 0x666666, 0xff8800, 0xffcc00];
        for (let i = 0; i < 18; i++) {
            const size = 0.1 + Math.random() * 0.35;
            const dGeo = new THREE.BoxGeometry(size, size, size);
            const dMat = new THREE.MeshBasicMaterial({ 
                color: debrisColors[Math.floor(Math.random() * debrisColors.length)], 
                transparent: true, opacity: 1.0 
            });
            const debris = new THREE.Mesh(dGeo, dMat);
            debris.position.copy(pos);
            // Random velocity in all directions
            const angle = Math.random() * Math.PI * 2;
            const upAngle = Math.random() * Math.PI * 0.8 - 0.1;
            const speed = 4 + Math.random() * 12;
            debris.userData = {
                vx: Math.cos(angle) * Math.cos(upAngle) * speed,
                vy: Math.sin(upAngle) * speed + 3 + Math.random() * 5,
                vz: Math.sin(angle) * Math.cos(upAngle) * speed,
                rotSpeed: (Math.random() - 0.5) * 15,
                gravity: -15
            };
            scene.add(debris);
            debrisParticles.push(debris);
            allObjects.push({ mesh: debris, geo: dGeo, mat: dMat });
        }

        // === 6. SMOKE CLOUDS (spawn after initial flash) ===
        const smokeClouds = [];
        for (let i = 0; i < 8; i++) {
            const sSize = 0.5 + Math.random() * 1.5;
            const sGeo = new THREE.SphereGeometry(sSize, 6, 6);
            const shade = 0.3 + Math.random() * 0.3;
            const sMat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(shade, shade, shade), 
                transparent: true, opacity: 0 
            });
            const smoke = new THREE.Mesh(sGeo, sMat);
            const sAngle = Math.random() * Math.PI * 2;
            const sDist = Math.random() * radius * 0.5;
            smoke.position.set(
                pos.x + Math.cos(sAngle) * sDist,
                pos.y + Math.random() * 2,
                pos.z + Math.sin(sAngle) * sDist
            );
            smoke.userData = {
                delay: 4 + Math.floor(Math.random() * 8), // frames before appearing
                driftX: (Math.random() - 0.5) * 1.5,
                driftY: 0.5 + Math.random() * 2,
                driftZ: (Math.random() - 0.5) * 1.5
            };
            scene.add(smoke);
            smokeClouds.push(smoke);
            allObjects.push({ mesh: smoke, geo: sGeo, mat: sMat });
        }

        // === 7. EMBER SPARKS (tiny bright particles) ===
        const sparks = [];
        for (let i = 0; i < 12; i++) {
            const spGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
            const spMat = new THREE.MeshBasicMaterial({ 
                color: Math.random() > 0.5 ? 0xffff44 : 0xff8800, 
                transparent: true, opacity: 1.0 
            });
            const spark = new THREE.Mesh(spGeo, spMat);
            spark.position.copy(pos);
            const a = Math.random() * Math.PI * 2;
            const spd = 6 + Math.random() * 15;
            spark.userData = {
                vx: Math.cos(a) * spd,
                vy: 4 + Math.random() * 10,
                vz: Math.sin(a) * spd,
                gravity: -8
            };
            scene.add(spark);
            sparks.push(spark);
            allObjects.push({ mesh: spark, geo: spGeo, mat: spMat });
        }

        // === 8. SCREEN SHAKE ===
        const camera = this.player ? this.player.camera : null;
        const origCamPos = camera ? camera.position.clone() : null;

        // === ANIMATION LOOP ===
        let frame = 0;
        const totalFrames = 60;
        const dt = 1 / 60;

        const animate = () => {
            frame++;

            // -- Core flash: shrink and fade fast --
            if (frame < 8) {
                const s = 1 + frame * 0.4;
                core.scale.set(s, s, s);
                coreMat.opacity = Math.max(0, 1.0 - frame * 0.13);
            } else {
                coreMat.opacity = 0;
            }

            // -- Main fireball: expand and fade --
            const fireScale = 1 + frame * 0.2;
            fireball.scale.set(fireScale, fireScale, fireScale);
            fireMat.opacity = Math.max(0, 0.9 - frame * 0.04);

            // -- Outer fireball: expand slower, fade slower --
            const outerScale = 0.8 + frame * 0.12;
            outerBall.scale.set(outerScale, outerScale, outerScale);
            outerMat.opacity = Math.max(0, 0.6 - frame * 0.025);

            // -- Shockwave ring: expand fast, fade --
            const ringScale = 1 + frame * 0.6;
            ring.scale.set(ringScale, ringScale, ringScale);
            ringMat.opacity = Math.max(0, 0.7 - frame * 0.05);

            // -- Debris particles: fly outward with gravity --
            for (const d of debrisParticles) {
                d.userData.vy += d.userData.gravity * dt;
                d.position.x += d.userData.vx * dt;
                d.position.y += d.userData.vy * dt;
                d.position.z += d.userData.vz * dt;
                d.rotation.x += d.userData.rotSpeed * dt;
                d.rotation.y += d.userData.rotSpeed * dt * 0.7;
                d.material.opacity = Math.max(0, 1.0 - frame / 40);
            }

            // -- Smoke clouds: appear after delay, drift up, fade --
            for (const s of smokeClouds) {
                if (frame >= s.userData.delay) {
                    const smokeAge = frame - s.userData.delay;
                    s.material.opacity = Math.min(0.5, smokeAge * 0.06) * Math.max(0, 1 - smokeAge / 40);
                    s.position.x += s.userData.driftX * dt;
                    s.position.y += s.userData.driftY * dt;
                    s.position.z += s.userData.driftZ * dt;
                    const smokeScale = 1 + smokeAge * 0.04;
                    s.scale.set(smokeScale, smokeScale, smokeScale);
                }
            }

            // -- Sparks: fly fast, fade --
            for (const sp of sparks) {
                sp.userData.vy += sp.userData.gravity * dt;
                sp.position.x += sp.userData.vx * dt;
                sp.position.y += sp.userData.vy * dt;
                sp.position.z += sp.userData.vz * dt;
                sp.material.opacity = Math.max(0, 1.0 - frame / 25);
            }

            // -- Screen shake --
            if (camera && frame < 15) {
                const intensity = 0.3 * (1 - frame / 15);
                camera.position.x += (Math.random() - 0.5) * intensity;
                camera.position.y += (Math.random() - 0.5) * intensity;
                camera.position.z += (Math.random() - 0.5) * intensity;
            }

            if (frame < totalFrames) {
                requestAnimationFrame(animate);
            } else {
                // Cleanup everything
                for (const obj of allObjects) {
                    scene.remove(obj.mesh);
                    obj.geo.dispose();
                    obj.mat.dispose();
                }
            }
        };
        requestAnimationFrame(animate);
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

// Cat Spawner - manages spawning and updating cats
class CatSpawner {
    constructor(world, scene, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.cats = [];
        this.maxCats = 15;
        this.spawnCooldown = 0;
        this.spawnInterval = 5; // seconds between spawn attempts
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        // Try to spawn new cats
        if (this.spawnCooldown <= 0 && this.cats.length < this.maxCats) {
            this.trySpawnCat(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        // Update all cats
        for (let i = this.cats.length - 1; i >= 0; i--) {
            const cat = this.cats[i];
            cat.update(dt, playerPos);

            // Remove dead cats
            if (!cat.alive) {
                cat.dispose();
                this.cats.splice(i, 1);
            }

            // Remove cats that are too far away
            if (cat.position.distanceTo(playerPos) > 80) {
                cat.dispose();
                this.cats.splice(i, 1);
            }
        }
    }

    trySpawnCat(playerPos) {
        // Spawn at random position around player (but not too close)
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 30;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;

        // Find ground height
        const sy = this.world.getSpawnHeight(sx, sz);
        
        // Don't spawn in water or too low
        if (sy <= WATER_LEVEL + 1) return;
        
        // Don't spawn if block below isn't solid ground
        const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        const cat = new CatEnemy(this.world, this.scene, sx, sy + 0.5, sz, this.player);
        this.cats.push(cat);
    }

    getCatCount() {
        return this.cats.length;
    }
}

window.CatEnemy = CatEnemy;
window.CatSpawner = CatSpawner;
