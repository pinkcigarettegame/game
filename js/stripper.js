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
        this.inCar = false; // Whether this stripper is riding in the car
        this.hired = false; // Whether this stripper has been paid for (stays with player)
        this.collected = false; // Whether this stripper is in the player's collection (hidden)
        this.carRef = null; // Reference to the car when riding in it

        // Armed combat system
        this.armed = false; // Whether this stripper has a glock
        this.upgraded = false; // Whether her glock has been upgraded (dual glocks!)
        this.shootCooldown = 0;
        this.shootInterval = 1.5; // seconds between shots
        this.shootRange = 15; // how far she can shoot
        this.shootDamage = 3;
        this.currentTarget = null; // NPC she's shooting at
        this.muzzleFlashTimer = 0;
        this.gunMesh = null; // Added when armed
        this.muzzleFlashMesh = null;

        // References set by main.js for combat
        this.crackheadSpawner = null;
        this.copSpawner = null;
        this.glockRef = null; // Reference to player's glock for combat coordination
        this.playerRef = null; // Reference to player object
        this.cameraRef = null; // Reference to camera for line-of-fire avoidance

        this.audioCtx = null;
        this.lastSoundTime = 0;
        this.lastGunShotTime = 0;

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

    // Equip this stripper with a glock
    equipGlock() {
        if (this.armed) return;
        this.armed = true;

        // Add a small glock model to her right hand
        const gunGroup = new THREE.Group();
        const slideMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const slideGeo = new THREE.BoxGeometry(0.03, 0.04, 0.16);
        const slide = new THREE.Mesh(slideGeo, slideMat);
        gunGroup.add(slide);
        const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const gripGeo = new THREE.BoxGeometry(0.03, 0.08, 0.04);
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.05, 0.04);
        grip.rotation.x = 0.2;
        gunGroup.add(grip);
        gunGroup.position.set(0.3, 0.7, 0.12);
        gunGroup.rotation.x = -0.3;
        this.mesh.add(gunGroup);
        this.gunMesh = gunGroup;

        // Add muzzle flash (hidden by default)
        const flashGeo = new THREE.BoxGeometry(0.06, 0.06, 0.03);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlashMesh.position.set(0, 0, -0.1);
        this.muzzleFlashMesh.visible = false;
        gunGroup.add(this.muzzleFlashMesh);
    }

    // Upgrade to dual glocks - more damage, faster fire rate, second gun on left hand
    upgradeGlock() {
        if (!this.armed || this.upgraded) return;
        this.upgraded = true;

        // Boost stats: 2x damage, 40% faster fire rate, more range
        this.shootDamage = 6;
        this.shootInterval = 0.9;
        this.shootRange = 22;

        // Add a second glock to her left hand (gold-plated!)
        const gunGroup2 = new THREE.Group();
        const slideMat = new THREE.MeshLambertMaterial({ color: 0xCCA020 }); // Gold slide
        const slideGeo = new THREE.BoxGeometry(0.03, 0.04, 0.16);
        const slide = new THREE.Mesh(slideGeo, slideMat);
        gunGroup2.add(slide);
        const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const gripGeo = new THREE.BoxGeometry(0.03, 0.08, 0.04);
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.05, 0.04);
        grip.rotation.x = 0.2;
        gunGroup2.add(grip);
        gunGroup2.position.set(-0.3, 0.7, 0.12);
        gunGroup2.rotation.x = -0.3;
        this.mesh.add(gunGroup2);

        // Add muzzle flash to second gun
        const flashGeo2 = new THREE.BoxGeometry(0.06, 0.06, 0.03);
        const flashMat2 = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        const flash2 = new THREE.Mesh(flashGeo2, flashMat2);
        flash2.position.set(0, 0, -0.1);
        flash2.visible = false;
        gunGroup2.add(flash2);
        this.muzzleFlashMesh2 = flash2;
    }

    // Play a smaller gunshot sound (from NPC position, quieter)
    playStripperGunshot() {
        const now = Date.now();
        if (now - this.lastGunShotTime < 200) return;
        this.lastGunShotTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Lighter crack (smaller gun sound, higher pitch)
            const bufferSize = ctx.sampleRate * 0.1;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.2, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            const hpFilter = ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.setValueAtTime(1200, t);
            noise.connect(hpFilter);
            hpFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);

            // Higher pitched thump
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.15, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.1);
        } catch(e) {}
    }

    // Shoot at a target NPC - creates tracer and deals damage
    shootAtTarget(target, targetType) {
        if (!target || !target.alive) return;

        // Faster shooting from car (drive-by!)
        this.shootCooldown = this.inCar ? this.shootInterval * 0.6 : this.shootInterval;

        // Play gunshot sound
        this.playStripperGunshot();

        // Muzzle flash (both guns if upgraded)
        if (this.muzzleFlashMesh) {
            this.muzzleFlashMesh.visible = true;
            this.muzzleFlashTimer = 0.06;
        }
        if (this.upgraded && this.muzzleFlashMesh2) {
            this.muzzleFlashMesh2.visible = true;
        }

        // Face the target
        const toTarget = new THREE.Vector3().subVectors(target.position, this.position);
        toTarget.y = 0;
        if (toTarget.length() > 0.1) {
            this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        }

        // Create bullet tracer - offset from car window when in car
        const start = this.position.clone();
        if (this.inCar && this.carRef) {
            // Shoot from the side window of the car
            const sideOffset = Math.cos(this.carRef.rotation) * 1.5;
            const sideOffsetZ = -Math.sin(this.carRef.rotation) * 1.5;
            start.x += sideOffset;
            start.z += sideOffsetZ;
            start.y = this.carRef.position.y + 1.4; // Window height
        } else {
            start.y += 0.9; // gun height
        }
        const end = target.position.clone();
        end.y += 0.7; // center mass

        const tracerGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const tracerMat = new THREE.LineBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7 });
        const tracer = new THREE.Line(tracerGeo, tracerMat);
        this.scene.add(tracer);

        let frame = 0;
        const fadeTracer = () => {
            frame++;
            tracerMat.opacity = Math.max(0, 0.7 - frame * 0.15);
            if (frame < 6) {
                requestAnimationFrame(fadeTracer);
            } else {
                this.scene.remove(tracer);
                tracerGeo.dispose();
                tracerMat.dispose();
            }
        };
        requestAnimationFrame(fadeTracer);

        // Deal damage to target
        target.health -= this.shootDamage;

        // Blood effect at target
        this.createSmallBloodEffect(end);

        if (target.health <= 0) {
            target.alive = false;
            target.dispose();
            // Remove from spawner array
            if (targetType === 'crackhead' && this.crackheadSpawner) {
                const idx = this.crackheadSpawner.crackheads.indexOf(target);
                if (idx >= 0) this.crackheadSpawner.crackheads.splice(idx, 1);
                // Stripper kills earn money for the player!
                if (this.glockRef) {
                    this.glockRef.money += 2;
                    this.glockRef.spawnDollarBill();
                }
            } else if (targetType === 'cop' && this.copSpawner) {
                const idx = this.copSpawner.cops.indexOf(target);
                if (idx >= 0) this.copSpawner.cops.splice(idx, 1);
                if (this.glockRef) {
                    this.glockRef.money += 10;
                    for (let d = 0; d < 5; d++) {
                        setTimeout(() => this.glockRef.spawnDollarBill(), d * 80);
                    }
                }
            }
        } else {
            // Make target flee from the stripper
            if (targetType === 'crackhead') {
                target.fleeing = true;
                target.fleeDir.subVectors(target.position, this.position);
                target.fleeDir.y = 0;
                target.fleeDir.normalize();
                target.fleeTimer = 3;
            }
        }
    }

    createSmallBloodEffect(hitPos) {
        for (let i = 0; i < 6; i++) {
            const size = 0.03 + Math.random() * 0.05;
            const geo = new THREE.BoxGeometry(size, size, size);
            const shade = 0.5 + Math.random() * 0.5;
            const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(shade, 0, 0), transparent: true, opacity: 0.8 });
            const blood = new THREE.Mesh(geo, mat);
            blood.position.copy(hitPos);
            const vx = (Math.random() - 0.5) * 3;
            const vy = Math.random() * 2;
            const vz = (Math.random() - 0.5) * 3;
            this.scene.add(blood);
            let frame = 0;
            const animate = () => {
                frame++;
                blood.position.x += vx * 0.016;
                blood.position.y += (vy - frame * 0.2) * 0.016;
                blood.position.z += vz * 0.016;
                mat.opacity = Math.max(0, 0.8 - frame / 20);
                if (frame < 20) { requestAnimationFrame(animate); }
                else { this.scene.remove(blood); geo.dispose(); mat.dispose(); }
            };
            requestAnimationFrame(animate);
        }
    }

    // Combat AI - find and shoot enemies autonomously and when player is fighting
    updateCombat(dt) {
        if (!this.armed || !this.hired) return;

        this.shootCooldown = Math.max(0, this.shootCooldown - dt);

        // Update muzzle flash
        if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer -= dt;
            if (this.muzzleFlashTimer <= 0) {
                if (this.muzzleFlashMesh) this.muzzleFlashMesh.visible = false;
                if (this.muzzleFlashMesh2) this.muzzleFlashMesh2.visible = false;
            }
        }

        // Ready to shoot?
        if (this.shootCooldown > 0) return;

        // Extended range and faster shooting when in car (drive-by!)
        const effectiveRange = this.inCar ? this.shootRange * 2 : this.shootRange;

        let bestTarget = null;
        let bestDist = Infinity;
        let bestTargetType = null;

        // Priority 1: Assist player's current combat target (whatever they're shooting at)
        if (this.glockRef) {
            const now = Date.now() / 1000;
            const timeSincePlayerShot = now - this.glockRef.lastTargetTime;
            if (timeSincePlayerShot <= this.glockRef.combatTimeout && this.glockRef.lastTargetType) {
                const targetType = this.glockRef.lastTargetType;
                if (targetType === 'crackhead' && this.crackheadSpawner) {
                    for (const ch of this.crackheadSpawner.crackheads) {
                        if (!ch.alive) continue;
                        const dist = ch.position.distanceTo(this.position);
                        if (dist < effectiveRange && dist < bestDist) {
                            bestDist = dist;
                            bestTarget = ch;
                            bestTargetType = 'crackhead';
                        }
                    }
                } else if (targetType === 'cop' && this.copSpawner) {
                    for (const cop of this.copSpawner.cops) {
                        if (!cop.alive) continue;
                        const dist = cop.position.distanceTo(this.position);
                        if (dist < effectiveRange && dist < bestDist) {
                            bestDist = dist;
                            bestTarget = cop;
                            bestTargetType = 'cop';
                        }
                    }
                }
            }
        }

        // Priority 2: Auto-target cops when player has 2+ wanted stars
        if (!bestTarget && this.copSpawner && this.copSpawner.wantedLevel >= 2) {
            for (const cop of this.copSpawner.cops) {
                if (!cop.alive) continue;
                const dist = cop.position.distanceTo(this.position);
                if (dist < effectiveRange && dist < bestDist) {
                    bestDist = dist;
                    bestTarget = cop;
                    bestTargetType = 'cop';
                }
            }
        }

        // Priority 3: Always auto-target crackheads (they're hostile muggers)
        if (!bestTarget && this.crackheadSpawner) {
            for (const ch of this.crackheadSpawner.crackheads) {
                if (!ch.alive) continue;
                const dist = ch.position.distanceTo(this.position);
                if (dist < effectiveRange && dist < bestDist) {
                    bestDist = dist;
                    bestTarget = ch;
                    bestTargetType = 'crackhead';
                }
            }
        }

        if (bestTarget && bestTargetType) {
            this.currentTarget = bestTarget;
            this.shootAtTarget(bestTarget, bestTargetType);
        } else {
            this.currentTarget = null;
        }
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
        if (this.inCar) {
            // While in the car, sync position to car for combat range checks
            // and run combat AI so armed strippers can do drive-by shooting
            if (this.carRef) {
                this.position.copy(this.carRef.position);
                this.position.y += 1.3; // Window height
            }
            this.updateCombat(dt);
            return;
        }
        // Collected strippers are hidden - skip all physics/movement
        if (this.collected) {
            // Just keep position near player so they don't despawn
            this.position.copy(playerPos);
            return;
        }

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

        // Hired strippers always follow the player (no range limit)
        const effectiveAttractRange = this.hired ? Infinity : this.attractRange;
        const effectiveCloseRange = this.hired ? 2.0 : this.closeRange;
        const effectiveSpeed = this.hired ? this.speed * 1.5 : this.speed;

        // Attracted to player when close enough
        if (distToPlayer < effectiveAttractRange && distToPlayer > effectiveCloseRange) {
            if (!this.attracted) {
                // Just noticed the player - squeal excitedly!
                this.playSqueal();
            }
            this.attracted = true;
            // Move TOWARD the player
            this.approachDir.subVectors(playerPos, this.position);
            this.approachDir.y = 0;
            this.approachDir.normalize();
            const approachSpeed = effectiveSpeed * (distToPlayer < 6 ? 1.2 : 0.8);
            // Hired strippers sprint faster when far away to keep up
            const hiredBoost = (this.hired && distToPlayer > 10) ? 2.0 : 1.0;
            this.velocity.x = this.approachDir.x * approachSpeed * hiredBoost;
            this.velocity.z = this.approachDir.z * approachSpeed * hiredBoost;
            this.mesh.rotation.y = Math.atan2(this.approachDir.x, this.approachDir.z);
        } else if (distToPlayer <= effectiveCloseRange) {
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

            // Line-of-fire avoidance: hired strippers move out of the player's aim
            if (this.hired && this.cameraRef && !this.inWater) {
                // Get player's look direction (horizontal only)
                const lookDir = new THREE.Vector3(0, 0, -1);
                lookDir.applyQuaternion(this.cameraRef.getWorldQuaternion(new THREE.Quaternion()));
                lookDir.y = 0;
                lookDir.normalize();

                // Vector from player to this stripper (horizontal)
                const playerToMe = new THREE.Vector3().subVectors(this.position, playerPos);
                playerToMe.y = 0;
                const distHoriz = playerToMe.length();

                if (distHoriz > 0.1) {
                    playerToMe.normalize();
                    // Dot product: how much the stripper is in front of the player
                    const dot = lookDir.dot(playerToMe);
                    // Cross product Y: which side the stripper is on
                    const cross = lookDir.x * playerToMe.z - lookDir.z * playerToMe.x;

                    // If stripper is in a narrow cone in front of the player (dot > 0.7 means ~45 degree cone)
                    if (dot > 0.7 && distHoriz < 4.0) {
                        // Move perpendicular to the look direction (to the side)
                        // Choose the side the stripper is already leaning toward
                        const sideSign = cross >= 0 ? 1 : -1;
                        const perpX = -lookDir.z * sideSign;
                        const perpZ = lookDir.x * sideSign;
                        const dodgeSpeed = effectiveSpeed * 1.5;
                        this.velocity.x = perpX * dodgeSpeed;
                        this.velocity.z = perpZ * dodgeSpeed;
                    }
                }
            }
        } else {
            this.attracted = false;
            // Wander casually (hired strippers don't wander - they stay put)
            if (this.hired) {
                this.velocity.x = 0;
                this.velocity.z = 0;
            } else {
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

        // Armed combat AI - shoot enemies when player is fighting
        this.updateCombat(dt);

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
            // Don't despawn strippers that are riding in the car, hired, or collected
            if (!s.inCar && !s.hired && !s.collected && s.position.distanceTo(playerPos) > 100) {
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
