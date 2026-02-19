// Crocodile - Lurks in water, attacks swimmers!
class Crocodile {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.alive = true;
        this.health = 15;
        this.speed = 2.5;
        this.chaseSpeed = 5.0;
        this.detectionRange = 20;
        this.biteRange = 2.5;
        this.biteCooldown = 0;
        this.biteInterval = 1.8;
        this.biteDamage = 4;
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.swimBobPhase = Math.random() * Math.PI * 2;
        this.tailPhase = Math.random() * Math.PI * 2;
        this.jawOpen = 0;
        this.submerged = true;
        this.surfaceTimer = 0;
        this.growlCooldown = 0;
        this.audioCtx = null;
        this.lastSoundTime = 0;
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const g = new THREE.Group();
        const darkGreen = 0x2d4a1e;
        const belly = 0x8a9a5a;
        const bodyMat = new THREE.MeshLambertMaterial({ color: darkGreen });
        const bellyMat = new THREE.MeshLambertMaterial({ color: belly });

        // Main body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.35, 1.8);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.18, 0);
        g.add(body);
        // Belly
        const bellyGeo = new THREE.BoxGeometry(0.55, 0.1, 1.6);
        const bellyM = new THREE.Mesh(bellyGeo, bellyMat);
        bellyM.position.set(0, 0.03, 0);
        g.add(bellyM);

        // Snout (upper jaw)
        const snoutGeo = new THREE.BoxGeometry(0.4, 0.18, 0.9);
        const snout = new THREE.Mesh(snoutGeo, bodyMat);
        snout.position.set(0, 0.22, 1.2);
        g.add(snout);
        this._upperJaw = snout;

        // Lower jaw (animated)
        const lowerGeo = new THREE.BoxGeometry(0.35, 0.1, 0.85);
        const lower = new THREE.Mesh(lowerGeo, bellyMat);
        lower.position.set(0, 0.08, 1.2);
        g.add(lower);
        this._lowerJaw = lower;

        // Teeth (upper)
        const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        const toothGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);
        for (let i = 0; i < 6; i++) {
            const t = new THREE.Mesh(toothGeo, toothMat);
            t.position.set((i % 2 === 0 ? -0.15 : 0.15), 0.12, 0.85 + i * 0.12);
            g.add(t);
        }
        // Teeth (lower)
        for (let i = 0; i < 4; i++) {
            const t = new THREE.Mesh(toothGeo, toothMat);
            t.position.set((i % 2 === 0 ? -0.12 : 0.12), 0.04, 0.95 + i * 0.12);
            g.add(t);
        }

        // Nostrils
        const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const nostrilGeo = new THREE.BoxGeometry(0.05, 0.04, 0.05);
        const ln = new THREE.Mesh(nostrilGeo, nostrilMat);
        ln.position.set(-0.08, 0.33, 1.6);
        g.add(ln);
        const rn = new THREE.Mesh(nostrilGeo, nostrilMat);
        rn.position.set(0.08, 0.33, 1.6);
        g.add(rn);

        // Eyes (yellow, menacing, on top of head)
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xccaa00 });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        const le = new THREE.Mesh(eyeGeo, eyeMat);
        le.position.set(-0.22, 0.38, 0.7);
        g.add(le);
        const re = new THREE.Mesh(eyeGeo, eyeMat);
        re.position.set(0.22, 0.38, 0.7);
        g.add(re);
        // Slit pupils
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111100 });
        const pupilGeo = new THREE.BoxGeometry(0.03, 0.07, 0.04);
        const lp = new THREE.Mesh(pupilGeo, pupilMat);
        lp.position.set(-0.22, 0.39, 0.74);
        g.add(lp);
        const rp = new THREE.Mesh(pupilGeo, pupilMat);
        rp.position.set(0.22, 0.39, 0.74);
        g.add(rp);

        // Bumpy ridges along back
        const ridgeMat = new THREE.MeshLambertMaterial({ color: 0x1e3a12 });
        const ridgeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
        for (let i = 0; i < 7; i++) {
            const r = new THREE.Mesh(ridgeGeo, ridgeMat);
            r.position.set(0, 0.4, -0.5 + i * 0.25);
            g.add(r);
        }

        // Tail (segmented, gets thinner)
        this._tailSegs = [];
        for (let i = 0; i < 4; i++) {
            const tw = 0.35 - i * 0.07;
            const th = 0.2 - i * 0.03;
            const tGeo = new THREE.BoxGeometry(tw, th, 0.5);
            const tMesh = new THREE.Mesh(tGeo, bodyMat);
            tMesh.position.set(0, 0.15 - i * 0.02, -0.9 - i * 0.45);
            g.add(tMesh);
            this._tailSegs.push(tMesh);
        }

        // Legs (stubby, splayed out)
        const legMat = new THREE.MeshLambertMaterial({ color: 0x2a4418 });
        const legGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
        const legPositions = [
            [-0.35, 0.05, 0.5], [0.35, 0.05, 0.5],
            [-0.35, 0.05, -0.4], [0.35, 0.05, -0.4]
        ];
        legPositions.forEach(p => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(...p);
            g.add(leg);
        });

        return g;
    }

    playGrowl() {
        const now = Date.now();
        if (now - this.lastSoundTime < 2000) return;
        this.lastSoundTime = now;
        try {
            if (!this.audioCtx) this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this.audioCtx;
            const t = ctx.currentTime;
            // Deep rumbling growl
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50 + Math.random() * 20, t);
            osc.frequency.linearRampToValueAtTime(35, t + 0.4);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0.08, t + 0.2);
            gain.gain.linearRampToValueAtTime(0, t + 0.5);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(200, t);
            osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.55);
            // Hiss overlay
            const bufSize = ctx.sampleRate * 0.3;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0.06, t);
            ng.gain.linearRampToValueAtTime(0, t + 0.3);
            noise.connect(ng); ng.connect(ctx.destination);
            noise.start(t);
        } catch(e) {}
    }

    playBiteSnap() {
        try {
            if (!this.audioCtx) this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this.audioCtx;
            const t = ctx.currentTime;
            // Sharp snap/clap sound
            const bufSize = ctx.sampleRate * 0.06;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
            src.connect(gain); gain.connect(ctx.destination);
            src.start(t);
            // Low thud for jaw impact
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            const og = ctx.createGain();
            og.gain.setValueAtTime(0.2, t);
            og.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.connect(og); og.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.15);
        } catch(e) {}
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);
        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.growlCooldown = Math.max(0, this.growlCooldown - dt);
        this.tailPhase += dt * 4;
        this.swimBobPhase += dt * 2.5;

        // Always in water - buoyancy physics to stay near surface
        this.velocity.y += -5.0 * dt;
        if (this.position.y < WATER_LEVEL) {
            const submersion = Math.min(1.0, (WATER_LEVEL - this.position.y) / 1.0);
            this.velocity.y += 22.0 * submersion * dt;
        }
        // Stay near water surface (target just below surface)
        const targetY = WATER_LEVEL - 0.3;
        if (this.position.y > targetY + 0.5) this.velocity.y -= 3 * dt;
        if (this.position.y < targetY - 0.5) this.velocity.y += 3 * dt;
        this.velocity.y *= 0.9;
        this.velocity.x *= 0.92;
        this.velocity.z *= 0.92;
        this.velocity.y = Math.max(-3, Math.min(3, this.velocity.y));

        // Check if player is in or near water
        const playerInWater = this.player && this.player.inWater;
        const playerNearWater = playerPos.y < WATER_LEVEL + 2;

        // AI behavior
        if (distToPlayer < this.biteRange && playerNearWater) {
            // BITE!
            this.velocity.x *= 0.5;
            this.velocity.z *= 0.5;
            const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
            toPlayer.y = 0;
            if (toPlayer.length() > 0.1) this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

            // Jaw snap animation
            this.jawOpen = Math.max(0, this.jawOpen - dt * 8);

            if (this.biteCooldown <= 0 && this.player) {
                this.jawOpen = 1;
                this.playBiteSnap();
                this.player.takeDamage(this.biteDamage);
                this.biteCooldown = this.biteInterval;
            }
        } else if (distToPlayer < this.detectionRange && playerNearWater) {
            // Chase player through water
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();
            const spd = playerInWater ? this.chaseSpeed : this.speed;
            this.velocity.x = dir.x * spd;
            this.velocity.z = dir.z * spd;
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

            // Growl when chasing
            if (this.growlCooldown <= 0) {
                this.playGrowl();
                this.growlCooldown = 3 + Math.random() * 4;
            }
            this.jawOpen = Math.max(0, this.jawOpen - dt * 3);
        } else {
            // Patrol/wander in water
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 3 + Math.random() * 5;
            }
            this.velocity.x = this.wanderDir.x * this.speed * 0.3;
            this.velocity.z = this.wanderDir.z * this.speed * 0.3;
            this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
            this.jawOpen = Math.max(0, this.jawOpen - dt * 2);
        }

        // Move
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Keep above void
        if (this.position.y < -10) this.alive = false;

        // Update mesh
        this.mesh.position.copy(this.position);

        // Swimming bob
        const bob = Math.sin(this.swimBobPhase) * 0.08;
        this.mesh.position.y += bob;
        this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.6) * 0.04;
        this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.4) * 0.03;

        // Tail sway animation
        if (this._tailSegs) {
            for (let i = 0; i < this._tailSegs.length; i++) {
                const sway = Math.sin(this.tailPhase + i * 0.8) * (0.15 + i * 0.08);
                this._tailSegs[i].position.x = sway;
            }
        }

        // Jaw animation
        if (this._lowerJaw) {
            this._lowerJaw.rotation.x = this.jawOpen * 0.4;
            this._lowerJaw.position.y = 0.08 - this.jawOpen * 0.08;
        }
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

// Crocodile Spawner - spawns crocs IN water
class CrocodileSpawner {
    constructor(world, scene, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.crocodiles = [];
        this.maxCrocs = 8;
        this.spawnCooldown = 0;
        this.spawnInterval = 8;
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        if (this.spawnCooldown <= 0 && this.crocodiles.length < this.maxCrocs) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        for (let i = this.crocodiles.length - 1; i >= 0; i--) {
            const croc = this.crocodiles[i];
            croc.update(dt, playerPos);

            if (!croc.alive) {
                croc.dispose();
                this.crocodiles.splice(i, 1);
                continue;
            }
            if (croc.position.distanceTo(playerPos) > 90) {
                croc.dispose();
                this.crocodiles.splice(i, 1);
            }
        }
    }

    trySpawn(playerPos) {
        // Spawn in water near the player
        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 35;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;

        // Check that this position is actually water
        const blockAtWater = this.world.getBlock(Math.floor(sx), WATER_LEVEL - 1, Math.floor(sz));
        if (blockAtWater !== BlockType.WATER) return;

        // Make sure there's water depth (not just surface)
        const blockBelow = this.world.getBlock(Math.floor(sx), WATER_LEVEL - 3, Math.floor(sz));
        const isDeepEnough = (blockBelow === BlockType.WATER || blockBelow === BlockType.SAND || blockBelow === BlockType.DIRT || blockBelow === BlockType.STONE);
        if (!isDeepEnough) return;

        const sy = WATER_LEVEL - 0.3;
        const croc = new Crocodile(this.world, this.scene, sx, sy, sz, this.player);
        this.crocodiles.push(croc);
    }

    getCount() {
        return this.crocodiles.length;
    }
}

window.Crocodile = Crocodile;
window.CrocodileSpawner = CrocodileSpawner;
