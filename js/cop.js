// Cop NPC - Chases the player when they commit crimes (shooting, killing, speeding)
class Cop {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.alive = true;
        this.health = 25;
        this.gravity = -25.0;
        this.onGround = false;
        this.inWater = false;
        this.swimBobPhase = Math.random() * Math.PI * 2;
        this.speed = 5.0; // Faster than player!
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.chasing = false;
        this.chaseRange = 40;
        this.attackRange = 2.5;
        this.attackCooldown = 0;
        this.attackInterval = 1.0;
        this.sirenPhase = 0;
        this.runPhase = 0;
        this.shoutCooldown = 0;

        this.audioCtx = null;
        this.lastSoundTime = 0;
        this.lastSirenTime = 0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        const darkBlueMat = new THREE.MeshLambertMaterial({ color: 0x1a1a4e });
        const blueMat = new THREE.MeshLambertMaterial({ color: 0x2a2a6e });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8c8a0 });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const goldMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Black boots
        const bootGeo = new THREE.BoxGeometry(0.16, 0.15, 0.22);
        const leftBoot = new THREE.Mesh(bootGeo, blackMat);
        leftBoot.position.set(-0.1, 0.075, 0);
        group.add(leftBoot);
        const rightBoot = new THREE.Mesh(bootGeo, blackMat);
        rightBoot.position.set(0.1, 0.075, 0);
        group.add(rightBoot);

        // Dark blue uniform pants
        const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const leftLeg = new THREE.Mesh(legGeo, darkBlueMat);
        leftLeg.position.set(-0.1, 0.4, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, darkBlueMat);
        rightLeg.position.set(0.1, 0.4, 0);
        group.add(rightLeg);

        // Belt (black with gold buckle)
        const beltGeo = new THREE.BoxGeometry(0.38, 0.06, 0.22);
        const belt = new THREE.Mesh(beltGeo, blackMat);
        belt.position.set(0, 0.65, 0);
        group.add(belt);
        const buckleGeo = new THREE.BoxGeometry(0.08, 0.05, 0.02);
        const buckle = new THREE.Mesh(buckleGeo, goldMat);
        buckle.position.set(0, 0.65, 0.12);
        group.add(buckle);

        // Holster on belt
        const holsterGeo = new THREE.BoxGeometry(0.06, 0.1, 0.08);
        const holster = new THREE.Mesh(holsterGeo, blackMat);
        holster.position.set(0.18, 0.6, 0);
        group.add(holster);

        // Blue uniform shirt
        const torsoGeo = new THREE.BoxGeometry(0.38, 0.4, 0.22);
        const torso = new THREE.Mesh(torsoGeo, blueMat);
        torso.position.set(0, 0.9, 0);
        group.add(torso);

        // Badge (gold star on chest)
        const badgeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const badge = new THREE.Mesh(badgeGeo, goldMat);
        badge.position.set(-0.08, 0.95, 0.12);
        group.add(badge);
        // Badge star detail
        const starGeo = new THREE.BoxGeometry(0.04, 0.04, 0.025);
        const star = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xFFFF00 }));
        star.position.set(-0.08, 0.95, 0.125);
        star.rotation.z = Math.PI / 4;
        group.add(star);

        // Radio on shoulder
        const radioGeo = new THREE.BoxGeometry(0.04, 0.08, 0.04);
        const radio = new THREE.Mesh(radioGeo, blackMat);
        radio.position.set(-0.2, 1.05, 0);
        group.add(radio);

        // Arms (blue sleeves)
        const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.12);
        const leftArm = new THREE.Mesh(armGeo, blueMat);
        leftArm.position.set(-0.27, 0.85, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, blueMat);
        rightArm.position.set(0.27, 0.85, 0);
        group.add(rightArm);

        // Hands (skin)
        const handGeo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.set(-0.27, 0.6, 0);
        group.add(leftHand);
        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.set(0.27, 0.6, 0);
        group.add(rightHand);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.28);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.28, 0);
        group.add(head);

        // Cop hat (dark blue with black brim)
        const hatTopGeo = new THREE.BoxGeometry(0.32, 0.12, 0.3);
        const hatTop = new THREE.Mesh(hatTopGeo, darkBlueMat);
        hatTop.position.set(0, 1.49, 0);
        group.add(hatTop);
        const brimGeo = new THREE.BoxGeometry(0.36, 0.03, 0.15);
        const brim = new THREE.Mesh(brimGeo, blackMat);
        brim.position.set(0, 1.43, 0.1);
        group.add(brim);
        // Hat badge
        const hatBadgeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
        const hatBadge = new THREE.Mesh(hatBadgeGeo, goldMat);
        hatBadge.position.set(0, 1.5, 0.16);
        group.add(hatBadge);

        // Stern eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x334455 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.06, 1.3, 0.14);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.06, 1.3, 0.14);
        group.add(rightEye);

        // Furrowed brows
        const browGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
        const browMat = new THREE.MeshBasicMaterial({ color: 0x3a2a1a });
        const leftBrow = new THREE.Mesh(browGeo, browMat);
        leftBrow.position.set(-0.06, 1.34, 0.15);
        leftBrow.rotation.z = 0.15;
        group.add(leftBrow);
        const rightBrow = new THREE.Mesh(browGeo, browMat);
        rightBrow.position.set(0.06, 1.34, 0.15);
        rightBrow.rotation.z = -0.15;
        group.add(rightBrow);

        // Frowning mouth
        const mouthGeo = new THREE.BoxGeometry(0.1, 0.02, 0.04);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x884444 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 1.2, 0.14);
        group.add(mouth);

        // Mustache
        const stacheGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
        const stacheMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
        const stache = new THREE.Mesh(stacheGeo, stacheMat);
        stache.position.set(0, 1.22, 0.14);
        group.add(stache);

        return group;
    }

    playSiren() {
        const now = Date.now();
        if (now - this.lastSirenTime < 1500) return;
        this.lastSirenTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Police siren - wee-woo
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(600, t);
            osc1.frequency.linearRampToValueAtTime(900, t + 0.25);
            osc1.frequency.linearRampToValueAtTime(600, t + 0.5);
            osc1.frequency.linearRampToValueAtTime(900, t + 0.75);
            osc1.frequency.linearRampToValueAtTime(600, t + 1.0);
            gain1.gain.setValueAtTime(0.12, t);
            gain1.gain.linearRampToValueAtTime(0.08, t + 0.5);
            gain1.gain.linearRampToValueAtTime(0.12, t + 0.75);
            gain1.gain.linearRampToValueAtTime(0, t + 1.2);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 1.3);

            // Harmonic for richer siren
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1200, t);
            osc2.frequency.linearRampToValueAtTime(1800, t + 0.25);
            osc2.frequency.linearRampToValueAtTime(1200, t + 0.5);
            osc2.frequency.linearRampToValueAtTime(1800, t + 0.75);
            osc2.frequency.linearRampToValueAtTime(1200, t + 1.0);
            gain2.gain.setValueAtTime(0.04, t);
            gain2.gain.linearRampToValueAtTime(0.02, t + 0.5);
            gain2.gain.linearRampToValueAtTime(0.04, t + 0.75);
            gain2.gain.linearRampToValueAtTime(0, t + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t);
            osc2.stop(t + 1.3);
        } catch(e) {}
    }

    playShout() {
        const now = Date.now();
        if (now - this.lastSoundTime < 3000) return;
        this.lastSoundTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Authoritative shout - "STOP!"
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, t);
            osc.frequency.linearRampToValueAtTime(250, t + 0.05);
            osc.frequency.linearRampToValueAtTime(200, t + 0.15);
            osc.frequency.linearRampToValueAtTime(150, t + 0.3);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.15);
            gain.gain.linearRampToValueAtTime(0, t + 0.35);
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(600, t);
            filter.Q.setValueAtTime(2, t);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);

            // Whistle blast
            const whistle = ctx.createOscillator();
            const wGain = ctx.createGain();
            whistle.type = 'sine';
            whistle.frequency.setValueAtTime(2800, t + 0.4);
            whistle.frequency.linearRampToValueAtTime(3200, t + 0.5);
            whistle.frequency.linearRampToValueAtTime(2800, t + 0.7);
            wGain.gain.setValueAtTime(0, t + 0.4);
            wGain.gain.linearRampToValueAtTime(0.1, t + 0.42);
            wGain.gain.linearRampToValueAtTime(0.08, t + 0.6);
            wGain.gain.linearRampToValueAtTime(0, t + 0.75);
            whistle.connect(wGain);
            wGain.connect(ctx.destination);
            whistle.start(t + 0.4);
            whistle.stop(t + 0.8);
        } catch(e) {}
    }

    playBatonHit() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Baton whack - thud
            const bufSize = ctx.sampleRate * 0.1;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(800, t);
            src.connect(lp);
            lp.connect(gain);
            gain.connect(ctx.destination);
            src.start(t);

            // Impact thump
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            const oGain = ctx.createGain();
            oGain.gain.setValueAtTime(0.25, t);
            oGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.connect(oGain);
            oGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        } catch(e) {}
    }

    update(dt, playerPos, wantedLevel) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);
        this.sirenPhase += dt * 4;
        this.runPhase += dt * 8;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.shoutCooldown = Math.max(0, this.shoutCooldown - dt);

        // Check if in water
        const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        const bodyBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.7), Math.floor(this.position.z));
        this.inWater = (feetBlock === BlockType.WATER || bodyBlock === BlockType.WATER);

        // Gravity / Swimming
        if (this.inWater) {
            this.swimBobPhase += dt * 3;
            this.velocity.y += -5.0 * dt;
            if (this.position.y < WATER_LEVEL) {
                const submersion = Math.min(1.0, (WATER_LEVEL - this.position.y) / 1.5);
                this.velocity.y += 24.0 * submersion * dt;
            }
            this.velocity.y *= 0.92;
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
            this.velocity.y = Math.max(-4, Math.min(4, this.velocity.y));
        } else {
            this.velocity.y += this.gravity * dt;
            if (this.velocity.y < -50) this.velocity.y = -50;
        }

        // Chasing behavior based on wanted level
        this.chasing = wantedLevel > 0 && distToPlayer < this.chaseRange;

        if (this.chasing) {
            // Play siren periodically
            if (distToPlayer < 30) {
                this.playSiren();
            }

            if (distToPlayer <= this.attackRange) {
                // Close enough to attack - baton strike!
                this.velocity.x = 0;
                this.velocity.z = 0;

                // Face the player
                const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
                toPlayer.y = 0;
                if (toPlayer.length() > 0.1) {
                    this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
                }

                // Attack!
                if (this.attackCooldown <= 0 && this.player) {
                    this.player.takeDamage(2);
                    this.playBatonHit();
                    this.attackCooldown = this.attackInterval;
                }
            } else {
                // Chase the player
                const dir = new THREE.Vector3().subVectors(playerPos, this.position);
                dir.y = 0;
                dir.normalize();

                // Cops are fast and determined
                const chaseSpeed = this.speed * (wantedLevel >= 3 ? 1.4 : wantedLevel >= 2 ? 1.2 : 1.0);
                this.velocity.x = dir.x * chaseSpeed;
                this.velocity.z = dir.z * chaseSpeed;
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

                // Shout while chasing
                if (this.shoutCooldown <= 0) {
                    this.playShout();
                    this.shoutCooldown = 3 + Math.random() * 4;
                }
            }
        } else {
            // Patrol / wander
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 3 + Math.random() * 5;
            }
            this.velocity.x = this.wanderDir.x * this.speed * 0.25;
            this.velocity.z = this.wanderDir.z * this.speed * 0.25;
            this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
        }

        // Apply movement with collision
        const oldPos = this.position.clone();

        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            this.position.x = oldPos.x;
            if (this.onGround && this.chasing) {
                this.velocity.y = 8; // Cops jump higher when chasing
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
            if (this.onGround && this.chasing) {
                this.velocity.y = 8;
                this.onGround = false;
            }
        }

        if (this.position.y < -10) this.alive = false;

        // Update mesh
        this.mesh.position.copy(this.position);

        if (this.inWater) {
            const swimBob = Math.sin(this.swimBobPhase) * 0.18;
            this.mesh.position.y += swimBob;
            this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.7) * 0.1;
            this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.5) * 0.08;
        } else if (this.chasing) {
            // Running animation
            const runBob = Math.sin(this.runPhase) * 0.06;
            this.mesh.position.y += Math.abs(runBob);
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = Math.sin(this.runPhase * 0.5) * 0.03;
        } else {
            // Patrol stance
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }
    }

    checkCollision() {
        const hw = 0.18;
        const feetY = this.position.y - 0.01;
        const headY = this.position.y + 1.5;

        for (let dy = feetY; dy <= headY; dy += 0.7) {
            for (let dx = -hw; dx <= hw; dx += hw * 2) {
                for (let dz = -hw; dz <= hw; dz += hw * 2) {
                    const block = this.world.getBlock(
                        Math.floor(this.position.x + dx),
                        Math.floor(dy),
                        Math.floor(this.position.z + dz)
                    );
                    if (block !== BlockType.AIR && block !== BlockType.WATER &&
                        block !== BlockType.CIGARETTE_SMOKE && block !== BlockType.CRACK_PIPE_GLASS) {
                        return true;
                    }
                }
            }
        }
        return false;
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

// Cop Spawner - spawns cops based on wanted level
class CopSpawner {
    constructor(world, scene, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.cops = [];
        this.spawnCooldown = 0;
        this.spawnInterval = 8; // Slower spawning
        this.wantedLevel = 0; // 0-5 stars
        this.wantedDecayTimer = 0;
        this.wantedDecayInterval = 12; // seconds to lose 1 star
    }

    // Increase wanted level (called when player commits crimes)
    addWanted(amount) {
        this.wantedLevel = Math.min(5, this.wantedLevel + amount);
        this.wantedDecayTimer = this.wantedDecayInterval;
    }

    getMaxCops() {
        // More cops at higher wanted levels - capped low for performance
        if (this.wantedLevel <= 0) return 0;
        if (this.wantedLevel === 1) return 1;
        if (this.wantedLevel === 2) return 2;
        if (this.wantedLevel === 3) return 3;
        if (this.wantedLevel === 4) return 4;
        return 5; // 5 stars = 5 cops max
    }

    update(dt, playerPos) {
        // Decay wanted level over time
        if (this.wantedLevel > 0) {
            this.wantedDecayTimer -= dt;
            if (this.wantedDecayTimer <= 0) {
                this.wantedLevel = Math.max(0, this.wantedLevel - 1);
                this.wantedDecayTimer = this.wantedDecayInterval;
            }
        }

        // Spawn cops based on wanted level - slow and controlled
        this.spawnCooldown -= dt;
        const maxCops = this.getMaxCops();

        if (this.spawnCooldown <= 0 && this.cops.length < maxCops && this.wantedLevel > 0) {
            this.trySpawn(playerPos);
            this.spawnCooldown = Math.max(5, this.spawnInterval - this.wantedLevel * 0.5);
        }

        // Update all cops
        for (let i = this.cops.length - 1; i >= 0; i--) {
            const cop = this.cops[i];
            cop.update(dt, playerPos, this.wantedLevel);

            if (!cop.alive) {
                cop.dispose();
                this.cops.splice(i, 1);
                // Wanted level already added by glock when killing
                continue;
            }

            // Despawn if too far and not chasing
            if (!cop.chasing && cop.position.distanceTo(playerPos) > 80) {
                cop.dispose();
                this.cops.splice(i, 1);
            }
        }

        // If wanted level drops to 0, despawn all cops gradually
        if (this.wantedLevel <= 0) {
            for (let i = this.cops.length - 1; i >= 0; i--) {
                if (this.cops[i].position.distanceTo(playerPos) > 30) {
                    this.cops[i].dispose();
                    this.cops.splice(i, 1);
                }
            }
        }
    }

    trySpawn(playerPos) {
        // Spawn cops from behind/sides, not right in front
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 15;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;
        const sy = this.world.getSpawnHeight(sx, sz);

        if (sy <= WATER_LEVEL + 1) return;
        const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        const cop = new Cop(this.world, this.scene, sx, sy + 0.5, sz, this.player);
        this.cops.push(cop);
    }

    getCount() {
        return this.cops.length;
    }

    getWantedLevel() {
        return this.wantedLevel;
    }
}

window.Cop = Cop;
window.CopSpawner = CopSpawner;
