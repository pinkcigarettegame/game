// Stripper NPC - Attracted to the player when they get close
class Stripper {
    constructor(world, scene, x, y, z) {
        this.world = world;
        this.scene = scene;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.alive = true;
        this.gravity = -25.0;
        this.onGround = false;
        this.inWater = false;
        this.swimBobPhase = Math.random() * Math.PI * 2;
        this.speed = 3.0;
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.attractRange = 20;
        this.closeRange = 2.5;
        this.attracted = false;
        this.approachDir = new THREE.Vector3(0, 0, 0);
        this.dancePhase = Math.random() * Math.PI * 2;
        this.squealed = false;

        this.audioCtx = null;
        this.lastSoundTime = 0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        // High heels (red)
        const heelMat = new THREE.MeshLambertMaterial({ color: 0xff2266 });
        const heelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
        const leftHeel = new THREE.Mesh(heelGeo, heelMat);
        leftHeel.position.set(-0.1, 0.075, 0);
        group.add(leftHeel);
        const rightHeel = new THREE.Mesh(heelGeo, heelMat);
        rightHeel.position.set(0.1, 0.075, 0);
        group.add(rightHeel);
        // Heel stilettos
        const stilettoGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
        const leftStiletto = new THREE.Mesh(stilettoGeo, heelMat);
        leftStiletto.position.set(-0.1, 0.06, -0.07);
        group.add(leftStiletto);
        const rightStiletto = new THREE.Mesh(stilettoGeo, heelMat);
        rightStiletto.position.set(0.1, 0.06, -0.07);
        group.add(rightStiletto);

        // Legs (skin tone, long)
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
        const legGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
        const leftLeg = new THREE.Mesh(legGeo, skinMat);
        leftLeg.position.set(-0.1, 0.4, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, skinMat);
        rightLeg.position.set(0.1, 0.4, 0);
        group.add(rightLeg);

        // Body - sparkly purple bikini bottom
        const bikiniMat = new THREE.MeshLambertMaterial({ color: 0xcc44ff });
        const bottomGeo = new THREE.BoxGeometry(0.35, 0.12, 0.22);
        const bottom = new THREE.Mesh(bottomGeo, bikiniMat);
        bottom.position.set(0, 0.7, 0);
        group.add(bottom);

        // Midriff (exposed skin)
        const midriffGeo = new THREE.BoxGeometry(0.32, 0.2, 0.2);
        const midriff = new THREE.Mesh(midriffGeo, skinMat);
        midriff.position.set(0, 0.86, 0);
        group.add(midriff);

        // Bikini top (sparkly purple)
        const topGeo = new THREE.BoxGeometry(0.38, 0.14, 0.22);
        const top = new THREE.Mesh(topGeo, bikiniMat);
        top.position.set(0, 1.03, 0);
        group.add(top);

        // Sparkle details on bikini (small glitter blocks)
        const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffddff });
        for (let i = 0; i < 6; i++) {
            const sparkleGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);
            const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
            sparkle.position.set(
                -0.12 + Math.random() * 0.24,
                0.97 + Math.random() * 0.12,
                0.12
            );
            group.add(sparkle);
        }

        // Arms (skin)
        const armGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
        const leftArm = new THREE.Mesh(armGeo, skinMat);
        leftArm.position.set(-0.27, 0.88, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, skinMat);
        rightArm.position.set(0.27, 0.88, 0);
        group.add(rightArm);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.28);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.3, 0);
        group.add(head);

        // Long blonde hair
        const hairMat = new THREE.MeshLambertMaterial({ color: 0xffdd44 });
        // Back hair (long, flowing)
        const backHairGeo = new THREE.BoxGeometry(0.32, 0.65, 0.08);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, 1.1, -0.16);
        group.add(backHair);
        // Top hair
        const topHairGeo = new THREE.BoxGeometry(0.32, 0.08, 0.3);
        const topHair = new THREE.Mesh(topHairGeo, hairMat);
        topHair.position.set(0, 1.48, 0);
        group.add(topHair);
        // Side hair left
        const sideHairGeo = new THREE.BoxGeometry(0.06, 0.5, 0.25);
        const leftHair = new THREE.Mesh(sideHairGeo, hairMat);
        leftHair.position.set(-0.17, 1.15, 0);
        group.add(leftHair);
        // Side hair right
        const rightHair = new THREE.Mesh(sideHairGeo, hairMat);
        rightHair.position.set(0.17, 1.15, 0);
        group.add(rightHair);

        // Eyes (big, blue with lashes)
        const eyeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.04);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.06, 1.33, 0.14);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.06, 1.33, 0.14);
        group.add(rightEye);
        // Eyelashes
        const lashMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const lashGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
        const leftLash = new THREE.Mesh(lashGeo, lashMat);
        leftLash.position.set(-0.06, 1.365, 0.15);
        group.add(leftLash);
        const rightLash = new THREE.Mesh(lashGeo, lashMat);
        rightLash.position.set(0.06, 1.365, 0.15);
        group.add(rightLash);

        // Lips (pink)
        const lipGeo = new THREE.BoxGeometry(0.1, 0.03, 0.04);
        const lipMat = new THREE.MeshBasicMaterial({ color: 0xff6688 });
        const lips = new THREE.Mesh(lipGeo, lipMat);
        lips.position.set(0, 1.24, 0.14);
        group.add(lips);

        return group;
    }

    playSqueal() {
        const now = Date.now();
        if (now - this.lastSoundTime < 3000) return;
        this.lastSoundTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // "Eek!" squeal - high pitched rising then falling
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(600, t);
            osc1.frequency.linearRampToValueAtTime(1200, t + 0.08);
            osc1.frequency.linearRampToValueAtTime(900, t + 0.2);
            osc1.frequency.linearRampToValueAtTime(600, t + 0.35);
            gain1.gain.setValueAtTime(0, t);
            gain1.gain.linearRampToValueAtTime(0.15, t + 0.03);
            gain1.gain.linearRampToValueAtTime(0.12, t + 0.15);
            gain1.gain.linearRampToValueAtTime(0, t + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.4);

            // Harmonic overtone for "eek" quality
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1200, t);
            osc2.frequency.linearRampToValueAtTime(2000, t + 0.08);
            osc2.frequency.linearRampToValueAtTime(1500, t + 0.2);
            gain2.gain.setValueAtTime(0, t);
            gain2.gain.linearRampToValueAtTime(0.06, t + 0.03);
            gain2.gain.linearRampToValueAtTime(0, t + 0.25);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t);
            osc2.stop(t + 0.3);
        } catch(e) {}
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);
        this.dancePhase += dt * 3;

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

        // Attracted to player when close enough
        if (distToPlayer < this.attractRange && distToPlayer > this.closeRange) {
            if (!this.attracted) {
                // Just noticed the player - squeal excitedly!
                this.playSqueal();
            }
            this.attracted = true;
            // Move TOWARD the player
            this.approachDir.subVectors(playerPos, this.position);
            this.approachDir.y = 0;
            this.approachDir.normalize();
            const approachSpeed = this.speed * (distToPlayer < 6 ? 1.2 : 0.8);
            this.velocity.x = this.approachDir.x * approachSpeed;
            this.velocity.z = this.approachDir.z * approachSpeed;
            this.mesh.rotation.y = Math.atan2(this.approachDir.x, this.approachDir.z);
        } else if (distToPlayer <= this.closeRange) {
            // Very close to player - stop and dance!
            this.attracted = true;
            this.velocity.x = 0;
            this.velocity.z = 0;
            // Face the player
            const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
            toPlayer.y = 0;
            if (toPlayer.length() > 0.1) {
                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
            }
        } else {
            this.attracted = false;
            // Wander casually
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 3 + Math.random() * 5;
            }
            this.velocity.x = this.wanderDir.x * this.speed * 0.2;
            this.velocity.z = this.wanderDir.z * this.speed * 0.2;
            this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
        }

        // Apply movement with collision
        const oldPos = this.position.clone();
        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            this.position.x = oldPos.x;
            // Jump over obstacles when attracted
            if (this.onGround && this.attracted) {
                this.velocity.y = 7;
                this.onGround = false;
            } else {
                // Pick new direction
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 1 + Math.random() * 2;
            }
        }
        this.position.y += this.velocity.y * dt;
        if (this.checkCollision()) {
            if (this.velocity.y < 0) {
                this.position.y = Math.floor(this.position.y - 0.01) + 1.001;
                this.onGround = true;
            } else { this.position.y = oldPos.y; }
            this.velocity.y = 0;
        } else { this.onGround = false; }
        this.position.z += this.velocity.z * dt;
        if (this.checkCollision()) {
            this.position.z = oldPos.z;
            if (this.onGround && this.attracted) {
                this.velocity.y = 7;
                this.onGround = false;
            } else {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 1 + Math.random() * 2;
            }
        }

        if (this.position.y < -10) this.position.y = 50;

        // Update mesh position with dance sway or swim animation
        this.mesh.position.copy(this.position);
        if (this.inWater) {
            // Swimming bob animation
            const swimBob = Math.sin(this.swimBobPhase) * 0.18;
            this.mesh.position.y += swimBob;
            this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.7) * 0.1;
            this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.5) * 0.08;
        } else if (!this.attracted || distToPlayer <= this.closeRange) {
            // Idle dance sway
            const sway = Math.sin(this.dancePhase) * 0.04;
            this.mesh.rotation.z = sway;
            this.mesh.rotation.x = 0;
            this.mesh.position.y += Math.abs(Math.sin(this.dancePhase * 1.5)) * 0.03;
        } else {
            // Running toward player animation - excited bob
            const runBob = Math.sin(this.dancePhase * 3) * 0.05;
            this.mesh.position.y += Math.abs(runBob);
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }
    }

    checkCollision() {
        const hw = 0.15;
        for (let dy = this.position.y - 0.01; dy <= this.position.y + 1.5; dy += 0.7) {
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

// Stripper Spawner
class StripperSpawner {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.strippers = [];
        this.maxStrippers = 8;
        this.spawnCooldown = 0;
        this.spawnInterval = 5;
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0 && this.strippers.length < this.maxStrippers) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        for (let i = this.strippers.length - 1; i >= 0; i--) {
            const s = this.strippers[i];
            s.update(dt, playerPos);
            if (s.position.distanceTo(playerPos) > 100) {
                s.dispose();
                this.strippers.splice(i, 1);
            }
        }
    }

    trySpawn(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 25;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;
        const sy = this.world.getSpawnHeight(sx, sz);
        if (sy <= WATER_LEVEL + 1) return;
        const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        const s = new Stripper(this.world, this.scene, sx, sy + 0.5, sz);
        this.strippers.push(s);
    }

    getCount() {
        return this.strippers.length;
    }
}

window.Stripper = Stripper;
window.StripperSpawner = StripperSpawner;
