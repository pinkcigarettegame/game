// Crackhead NPC - Twitchy, erratic, steals your health!
class Crackhead {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.alive = true;
        this.health = 10;
        this.gravity = -25.0;
        this.onGround = false;
        this.inWater = false;
        this.swimBobPhase = Math.random() * Math.PI * 2;
        this.speed = 3.5;
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.twitchPhase = Math.random() * Math.PI * 2;
        this.detectionRange = 15;
        this.stealRange = 2.0;
        this.stealCooldown = 0;
        this.stealInterval = 1.5;
        this.mumbleCooldown = 0;
        this.agitated = false;
        this.scratchTimer = 0;
        this.jerkTimer = 0;
        this.jerkDir = new THREE.Vector3(0, 0, 0);
        this.fleeing = false;
        this.fleeTimer = 0;
        this.fleeDir = new THREE.Vector3(0, 0, 0);

        this.audioCtx = null;
        this.lastSoundTime = 0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        // Dirty bare feet
        const footMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
        const footGeo = new THREE.BoxGeometry(0.14, 0.08, 0.2);
        const leftFoot = new THREE.Mesh(footGeo, footMat);
        leftFoot.position.set(-0.1, 0.04, 0);
        group.add(leftFoot);
        const rightFoot = new THREE.Mesh(footGeo, footMat);
        rightFoot.position.set(0.1, 0.04, 0);
        group.add(rightFoot);

        // Skinny legs (dirty jeans, torn)
        const legMat = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
        const legGeo = new THREE.BoxGeometry(0.13, 0.45, 0.13);
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.1, 0.31, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.1, 0.31, 0);
        group.add(rightLeg);

        // Torn patches on legs
        const patchMat = new THREE.MeshLambertMaterial({ color: 0x6a6a7a });
        const patchGeo = new THREE.BoxGeometry(0.04, 0.06, 0.14);
        const patch1 = new THREE.Mesh(patchGeo, patchMat);
        patch1.position.set(-0.1, 0.35, 0);
        group.add(patch1);

        // Skinny torso (dirty stained shirt)
        const torsoMat = new THREE.MeshLambertMaterial({ color: 0x7a6a50 });
        const torsoGeo = new THREE.BoxGeometry(0.35, 0.45, 0.2);
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.set(0, 0.76, 0);
        group.add(torso);

        // Stains on shirt
        const stainMat = new THREE.MeshLambertMaterial({ color: 0x5a4a30 });
        const stainGeo = new THREE.BoxGeometry(0.08, 0.08, 0.01);
        const stain1 = new THREE.Mesh(stainGeo, stainMat);
        stain1.position.set(0.05, 0.8, 0.11);
        group.add(stain1);
        const stain2 = new THREE.Mesh(stainGeo, stainMat);
        stain2.position.set(-0.08, 0.7, 0.11);
        group.add(stain2);

        // Skinny arms
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xb89878 });
        const armGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
        const leftArm = new THREE.Mesh(armGeo, skinMat);
        leftArm.position.set(-0.25, 0.7, 0);
        leftArm.rotation.z = 0.15;
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, skinMat);
        rightArm.position.set(0.25, 0.7, 0);
        rightArm.rotation.z = -0.15;
        group.add(rightArm);

        // Bony hands
        const handGeo = new THREE.BoxGeometry(0.08, 0.08, 0.06);
        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.set(-0.28, 0.45, 0);
        group.add(leftHand);
        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.set(0.28, 0.45, 0);
        group.add(rightHand);

        // Head (gaunt face)
        const headGeo = new THREE.BoxGeometry(0.32, 0.35, 0.3);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.16, 0);
        group.add(head);

        // Sunken cheeks (darker indents)
        const cheekMat = new THREE.MeshLambertMaterial({ color: 0x9a7858 });
        const cheekGeo = new THREE.BoxGeometry(0.06, 0.1, 0.02);
        const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
        leftCheek.position.set(-0.1, 1.12, 0.15);
        group.add(leftCheek);
        const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
        rightCheek.position.set(0.1, 1.12, 0.15);
        group.add(rightCheek);

        // Wild crazy eyes (wide, bloodshot)
        const eyeWhiteGeo = new THREE.BoxGeometry(0.09, 0.07, 0.04);
        const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const leftEyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        leftEyeW.position.set(-0.07, 1.2, 0.15);
        group.add(leftEyeW);
        const rightEyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        rightEyeW.position.set(0.07, 1.2, 0.15);
        group.add(rightEyeW);

        // Bloodshot veins in eyes (tiny red lines)
        const veinMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const veinGeo = new THREE.BoxGeometry(0.02, 0.01, 0.045);
        for (let i = 0; i < 3; i++) {
            const lv = new THREE.Mesh(veinGeo, veinMat);
            lv.position.set(-0.07 + (i - 1) * 0.03, 1.2 + (i - 1) * 0.01, 0.155);
            group.add(lv);
            const rv = new THREE.Mesh(veinGeo, veinMat);
            rv.position.set(0.07 + (i - 1) * 0.03, 1.2 + (i - 1) * 0.01, 0.155);
            group.add(rv);
        }

        // Dilated pupils (big black dots)
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.07, 1.2, 0.17);
        group.add(leftPupil);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.07, 1.2, 0.17);
        group.add(rightPupil);

        // Missing teeth mouth (open, dark)
        const mouthGeo = new THREE.BoxGeometry(0.14, 0.06, 0.04);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x331111 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 1.06, 0.15);
        group.add(mouth);

        // Remaining teeth (yellow, sparse)
        const toothMat = new THREE.MeshBasicMaterial({ color: 0xccaa44 });
        const toothGeo = new THREE.BoxGeometry(0.025, 0.03, 0.02);
        const tooth1 = new THREE.Mesh(toothGeo, toothMat);
        tooth1.position.set(-0.03, 1.07, 0.16);
        group.add(tooth1);
        const tooth2 = new THREE.Mesh(toothGeo, toothMat);
        tooth2.position.set(0.04, 1.07, 0.16);
        group.add(tooth2);

        // Messy scraggly hair
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
        const hairGeo1 = new THREE.BoxGeometry(0.34, 0.12, 0.32);
        const topHair = new THREE.Mesh(hairGeo1, hairMat);
        topHair.position.set(0, 1.38, 0);
        group.add(topHair);

        // Wild sticking out hair tufts
        const tuftGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
        const tuft1 = new THREE.Mesh(tuftGeo, hairMat);
        tuft1.position.set(-0.15, 1.42, 0.05);
        tuft1.rotation.z = -0.4;
        group.add(tuft1);
        const tuft2 = new THREE.Mesh(tuftGeo, hairMat);
        tuft2.position.set(0.12, 1.44, -0.05);
        tuft2.rotation.z = 0.5;
        group.add(tuft2);
        const tuft3 = new THREE.Mesh(tuftGeo, hairMat);
        tuft3.position.set(0, 1.45, -0.1);
        tuft3.rotation.x = 0.3;
        group.add(tuft3);

        // Crack pipe in hand (small glass tube)
        const pipeGroup = new THREE.Group();
        const pipeMat = new THREE.MeshLambertMaterial({ color: 0xccddee, transparent: true, opacity: 0.6 });
        const pipeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.2);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipeGroup.add(pipe);
        // Bowl end (charred)
        const bowlMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const bowlGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
        const bowl = new THREE.Mesh(bowlGeo, bowlMat);
        bowl.position.set(0, 0, -0.12);
        pipeGroup.add(bowl);
        pipeGroup.position.set(0.3, 0.5, 0.08);
        pipeGroup.rotation.x = -0.3;
        group.add(pipeGroup);

        return group;
    }

    playMumble() {
        const now = Date.now();
        if (now - this.lastSoundTime < 2500) return;
        this.lastSoundTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Erratic mumbling - random pitch jumps
            const syllables = 2 + Math.floor(Math.random() * 4);
            for (let i = 0; i < syllables; i++) {
                const offset = i * (0.08 + Math.random() * 0.12);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = Math.random() > 0.5 ? 'sawtooth' : 'square';
                const baseFreq = 80 + Math.random() * 120;
                osc.frequency.setValueAtTime(baseFreq, t + offset);
                osc.frequency.linearRampToValueAtTime(baseFreq + (Math.random() - 0.5) * 80, t + offset + 0.06);
                osc.frequency.linearRampToValueAtTime(baseFreq * 0.8, t + offset + 0.1);
                gain.gain.setValueAtTime(0, t + offset);
                gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, t + offset + 0.02);
                gain.gain.linearRampToValueAtTime(0, t + offset + 0.1 + Math.random() * 0.05);

                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(400 + Math.random() * 600, t + offset);
                filter.Q.setValueAtTime(2 + Math.random() * 3, t + offset);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + offset);
                osc.stop(t + offset + 0.15);
            }

            // Occasional high-pitched yelp
            if (Math.random() > 0.6) {
                const yelp = ctx.createOscillator();
                const yGain = ctx.createGain();
                yelp.type = 'sine';
                const yOffset = syllables * 0.12 + 0.05;
                yelp.frequency.setValueAtTime(300, t + yOffset);
                yelp.frequency.linearRampToValueAtTime(600 + Math.random() * 200, t + yOffset + 0.05);
                yelp.frequency.linearRampToValueAtTime(200, t + yOffset + 0.15);
                yGain.gain.setValueAtTime(0, t + yOffset);
                yGain.gain.linearRampToValueAtTime(0.1, t + yOffset + 0.02);
                yGain.gain.linearRampToValueAtTime(0, t + yOffset + 0.15);
                yelp.connect(yGain);
                yGain.connect(ctx.destination);
                yelp.start(t + yOffset);
                yelp.stop(t + yOffset + 0.2);
            }
        } catch(e) {}
    }

    playStealSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Quick snatch sound - sharp noise burst
            const bufSize = ctx.sampleRate * 0.08;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(1500, t);
            src.connect(hp);
            hp.connect(gain);
            gain.connect(ctx.destination);
            src.start(t);

            // Cackle after stealing
            const osc = ctx.createOscillator();
            const oGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, t + 0.1);
            osc.frequency.linearRampToValueAtTime(350, t + 0.15);
            osc.frequency.linearRampToValueAtTime(150, t + 0.25);
            oGain.gain.setValueAtTime(0, t + 0.1);
            oGain.gain.linearRampToValueAtTime(0.08, t + 0.12);
            oGain.gain.linearRampToValueAtTime(0, t + 0.25);
            const filt = ctx.createBiquadFilter();
            filt.type = 'bandpass';
            filt.frequency.setValueAtTime(500, t + 0.1);
            filt.Q.setValueAtTime(3, t + 0.1);
            osc.connect(filt);
            filt.connect(oGain);
            oGain.connect(ctx.destination);
            osc.start(t + 0.1);
            osc.stop(t + 0.3);
        } catch(e) {}
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);
        this.twitchPhase += dt * (5 + Math.random() * 3);
        this.stealCooldown = Math.max(0, this.stealCooldown - dt);
        this.mumbleCooldown = Math.max(0, this.mumbleCooldown - dt);
        this.scratchTimer -= dt;
        this.jerkTimer -= dt;

        // Check if in water
        const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        const bodyBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.7), Math.floor(this.position.z));
        this.inWater = (feetBlock === BlockType.WATER || bodyBlock === BlockType.WATER);

        // Gravity / Swimming
        if (this.inWater) {
            this.swimBobPhase += dt * 3.5;
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

        // Fleeing (after being shot)
        if (this.fleeing) {
            this.fleeTimer -= dt;
            if (this.fleeTimer <= 0) {
                this.fleeing = false;
            } else {
                this.velocity.x = this.fleeDir.x * this.speed * 2;
                this.velocity.z = this.fleeDir.z * this.speed * 2;
                this.mesh.rotation.y = Math.atan2(this.fleeDir.x, this.fleeDir.z);
            }
        }
        // Close enough to steal
        else if (distToPlayer < this.stealRange) {
            this.velocity.x = 0;
            this.velocity.z = 0;

            // Face the player
            const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
            toPlayer.y = 0;
            if (toPlayer.length() > 0.1) {
                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
            }

            // Steal health!
            if (this.stealCooldown <= 0 && this.player) {
                this.player.takeDamage(1);
                this.playStealSound();
                this.stealCooldown = this.stealInterval;
            }
        }
        // Detected player - rush toward them
        else if (distToPlayer < this.detectionRange) {
            this.agitated = true;
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();

            // Erratic zigzag movement toward player
            if (this.jerkTimer <= 0) {
                this.jerkDir.set(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                );
                this.jerkTimer = 0.2 + Math.random() * 0.3;
            }

            const moveDir = dir.clone().add(this.jerkDir.clone().multiplyScalar(0.4)).normalize();
            this.velocity.x = moveDir.x * this.speed;
            this.velocity.z = moveDir.z * this.speed;
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

            // Mumble when chasing
            if (this.mumbleCooldown <= 0) {
                this.playMumble();
                this.mumbleCooldown = 2 + Math.random() * 3;
            }
        }
        // Wander erratically
        else {
            this.agitated = false;
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 0.5 + Math.random() * 2; // Short bursts of movement
            }

            // Random sudden direction changes (twitchy)
            if (Math.random() < 0.02) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
            }

            this.velocity.x = this.wanderDir.x * this.speed * 0.4;
            this.velocity.z = this.wanderDir.z * this.speed * 0.4;
            this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);

            // Random mumbling
            if (this.mumbleCooldown <= 0 && Math.random() < 0.01) {
                this.playMumble();
                this.mumbleCooldown = 4 + Math.random() * 5;
            }
        }

        // Apply movement with collision
        const oldPos = this.position.clone();

        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            this.position.x = oldPos.x;
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

        // Update mesh position with twitchy or swim animation
        this.mesh.position.copy(this.position);

        if (this.inWater) {
            // Swimming bob animation
            const swimBob = Math.sin(this.swimBobPhase) * 0.18;
            this.mesh.position.y += swimBob;
            this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.7) * 0.12;
            this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.5) * 0.1;
        } else {
            // Twitchy head/body movements
            const twitch = Math.sin(this.twitchPhase * 3) * 0.08;
            const headTwitch = Math.sin(this.twitchPhase * 5 + 1.3) * 0.06;
            this.mesh.rotation.z = twitch;
            this.mesh.rotation.x = 0;
            this.mesh.position.y += Math.abs(Math.sin(this.twitchPhase * 4)) * 0.02;

            // Random sudden jerks
            if (Math.random() < 0.03) {
                this.mesh.position.x += (Math.random() - 0.5) * 0.05;
                this.mesh.position.z += (Math.random() - 0.5) * 0.05;
            }
        }

        // Scratching animation (periodic)
        if (this.scratchTimer <= 0) {
            this.scratchTimer = 3 + Math.random() * 5;
        }
    }

    checkCollision() {
        const hw = 0.2;
        const feetY = this.position.y - 0.01;
        const headY = this.position.y + 1.4;

        for (let dy = feetY; dy <= headY; dy += 0.7) {
            for (let dx = -hw; dx <= hw; dx += hw * 2) {
                for (let dz = -hw; dz <= hw; dz += hw * 2) {
                    const bx = Math.floor(this.position.x + dx);
                    const by = Math.floor(dy);
                    const bz = Math.floor(this.position.z + dz);
                    const block = this.world.getBlock(bx, by, bz);
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
            this.mesh.traverse(function(child) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

// Crackhead Spawner
class CrackheadSpawner {
    constructor(world, scene, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.crackheads = [];
        this.maxCrackheads = 10;
        this.spawnCooldown = 0;
        this.spawnInterval = 6;
        this.copSpawner = null; // Set by main.js for wanted-level scaling
        this.stripperSpawner = null; // Set by main.js for stripper-count scaling
        this.carRef = null; // Set by main.js - reference to the car
    }

    // Count how many strippers are hired/collected/in-car (the player's "stable")
    getStripperPower() {
        if (!this.stripperSpawner) return 0;
        let count = 0;
        for (const s of this.stripperSpawner.strippers) {
            if (s.alive && (s.hired || s.collected || s.inCar || s.guardingCar)) count++;
        }
        return count;
    }

    getEffectiveMax() {
        // Base: wanted level scaling
        const wanted = this.copSpawner ? this.copSpawner.getWantedLevel() : 0;
        let base = this.maxCrackheads; // 10
        if (wanted >= 1) base += 2;
        if (wanted >= 2) base += 2;
        if (wanted >= 3) base += 2;
        if (wanted >= 4) base += 2;
        if (wanted >= 5) base += 2;

        // Stripper power scaling: more prostitutes = WAY more crackheads (hordes!)
        // 0 strippers = +0, 5 = +5, 10 = +15, 15 = +30
        const strippers = this.getStripperPower();
        const stripperBonus = Math.floor(strippers * strippers * 0.13); // quadratic scaling
        base += stripperBonus;

        // Hard cap at 50 to prevent performance death
        return Math.min(50, base);
    }

    getEffectiveInterval() {
        // Base: wanted level scaling
        const wanted = this.copSpawner ? this.copSpawner.getWantedLevel() : 0;
        let interval = this.spawnInterval; // 6s
        if (wanted >= 1) interval *= 0.85;
        if (wanted >= 3) interval *= 0.75;
        if (wanted >= 5) interval *= 0.7;

        // Stripper power scaling: more strippers = much faster spawning
        // At 15 strippers, spawn every ~0.5 seconds (HORDE MODE)
        const strippers = this.getStripperPower();
        if (strippers >= 1) interval *= 0.85;
        if (strippers >= 3) interval *= 0.75;
        if (strippers >= 5) interval *= 0.7;
        if (strippers >= 8) interval *= 0.6;
        if (strippers >= 10) interval *= 0.5;
        if (strippers >= 13) interval *= 0.5;
        if (strippers >= 15) interval *= 0.4;

        // Floor at 0.4 seconds
        return Math.max(0.4, interval);
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        const effectiveMax = this.getEffectiveMax();
        const effectiveInterval = this.getEffectiveInterval();

        // Spawn multiple crackheads per tick when in horde mode (lots of strippers)
        const strippers = this.getStripperPower();
        const spawnsPerTick = strippers >= 10 ? 3 : (strippers >= 5 ? 2 : 1);

        if (this.spawnCooldown <= 0 && this.crackheads.length < effectiveMax) {
            for (let s = 0; s < spawnsPerTick && this.crackheads.length < effectiveMax; s++) {
                this.trySpawn(playerPos);
            }
            this.spawnCooldown = effectiveInterval;
        }

        for (var i = this.crackheads.length - 1; i >= 0; i--) {
            var ch = this.crackheads[i];
            ch.update(dt, playerPos);

            if (!ch.alive) {
                ch.dispose();
                this.crackheads.splice(i, 1);
                continue;
            }

            if (ch.position.distanceTo(playerPos) > 100) {
                ch.dispose();
                this.crackheads.splice(i, 1);
            }
        }
    }

    trySpawn(playerPos) {
        var angle = Math.random() * Math.PI * 2;
        var dist = 18 + Math.random() * 30;
        var sx = playerPos.x + Math.cos(angle) * dist;
        var sz = playerPos.z + Math.sin(angle) * dist;
        var sy = this.world.getSpawnHeight(sx, sz);

        if (sy <= WATER_LEVEL + 1) return;

        var groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        var ch = new Crackhead(this.world, this.scene, sx, sy + 0.5, sz, this.player);
        this.crackheads.push(ch);
    }

    getCount() {
        return this.crackheads.length;
    }
}

window.Crackhead = Crackhead;
window.CrackheadSpawner = CrackheadSpawner;
