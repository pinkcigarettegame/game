// Happy Bong Man - Friendly red-eyed hippie NPC
class BongMan {
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
        this.speed = 1.2;
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3(0, 0, 0);
        this.swayPhase = Math.random() * Math.PI * 2;
        this.bongTimer = 0;
        this.bongInterval = 8 + Math.random() * 10;
        this.isSmokingBong = false;
        this.smokeTimer = 0;
        this.greetCooldown = 0;
        this.fleeing = false;
        this.fleeDir = new THREE.Vector3(0, 0, 0);
        this.fleeTimer = 0;
        this.smokePuff = null;
        this.smokeCloud = []; // Persistent smoke cloud around the bongman
        this.smokeCloudTimer = 0;

        this.audioCtx = null;
        this.lastSoundTime = 0;

        this.mesh = this.createMesh();
        this.mesh.scale.set(2.5, 2.5, 2.5); // BIG rastas!
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        // Legs (tan sandals)
        const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
        const sandalMat = new THREE.MeshLambertMaterial({ color: 0xc4a882 });
        const leftLeg = new THREE.Mesh(legGeo, sandalMat);
        leftLeg.position.set(-0.12, 0.2, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, sandalMat);
        rightLeg.position.set(0.12, 0.2, 0);
        group.add(rightLeg);

        // Body - tie-dye shirt (rainbow stripes)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.6, 0.3);
        const tieDyeCanvas = document.createElement('canvas');
        tieDyeCanvas.width = 16;
        tieDyeCanvas.height = 16;
        const tdCtx = tieDyeCanvas.getContext('2d');
        const colors = ['#ff4444', '#ff8800', '#ffff00', '#44ff44', '#4488ff', '#8844ff'];
        for (let y = 0; y < 16; y++) {
            tdCtx.fillStyle = colors[y % colors.length];
            tdCtx.fillRect(0, y, 16, 1);
        }
        // Add some swirl
        for (let i = 0; i < 20; i++) {
            tdCtx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            tdCtx.fillRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 3, 2);
        }
        const tieDyeTex = new THREE.CanvasTexture(tieDyeCanvas);
        tieDyeTex.magFilter = THREE.NearestFilter;
        const bodyMat = new THREE.MeshLambertMaterial({ map: tieDyeTex });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.7;
        group.add(body);

        // Peace symbol on chest (small white circle)
        const peaceGeo = new THREE.BoxGeometry(0.12, 0.12, 0.01);
        const peaceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const peace = new THREE.Mesh(peaceGeo, peaceMat);
        peace.position.set(0, 0.75, 0.16);
        group.add(peace);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xdeb887 });
        const leftArm = new THREE.Mesh(armGeo, skinMat);
        leftArm.position.set(-0.35, 0.65, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, skinMat);
        rightArm.position.set(0.35, 0.65, 0);
        group.add(rightArm);

        // Bong in right hand (green glass cylinder) - BIG BONG!
        const bongGroup = new THREE.Group();
        // Bong tube (big!)
        const bongTubeGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
        const bongGlassMat = new THREE.MeshLambertMaterial({ color: 0x22aa44, transparent: true, opacity: 0.7 });
        const bongTube = new THREE.Mesh(bongTubeGeo, bongGlassMat);
        bongTube.position.set(0, 0.25, 0);
        bongGroup.add(bongTube);
        // Bong base (wider)
        const bongBaseGeo = new THREE.BoxGeometry(0.25, 0.18, 0.25);
        const bongBase = new THREE.Mesh(bongBaseGeo, bongGlassMat);
        bongBase.position.set(0, -0.05, 0);
        bongGroup.add(bongBase);
        // Bong bowl (brown piece)
        const bongBowlGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
        const bongBowlMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
        const bongBowl = new THREE.Mesh(bongBowlGeo, bongBowlMat);
        bongBowl.position.set(0.14, 0.35, 0);
        bongGroup.add(bongBowl);
        // Water line (blue)
        const waterGeo = new THREE.BoxGeometry(0.14, 0.1, 0.14);
        const waterMat = new THREE.MeshLambertMaterial({ color: 0x4488cc, transparent: true, opacity: 0.6 });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(0, 0.05, 0);
        bongGroup.add(water);

        bongGroup.position.set(0.42, 0.45, 0.1);
        group.add(bongGroup);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.35);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.2, 0);
        group.add(head);

        // Headband (colorful strip)
        const headbandGeo = new THREE.BoxGeometry(0.42, 0.06, 0.37);
        const headbandMat = new THREE.MeshLambertMaterial({ color: 0xff4488 });
        const headband = new THREE.Mesh(headbandGeo, headbandMat);
        headband.position.set(0, 1.32, 0);
        group.add(headband);

        // Long hair (brown blocks hanging down)
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
        // Back hair
        const backHairGeo = new THREE.BoxGeometry(0.4, 0.5, 0.08);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, 1.05, -0.2);
        group.add(backHair);
        // Side hair left
        const sideHairGeo = new THREE.BoxGeometry(0.08, 0.45, 0.3);
        const leftHair = new THREE.Mesh(sideHairGeo, hairMat);
        leftHair.position.set(-0.22, 1.08, 0);
        group.add(leftHair);
        // Side hair right
        const rightHair = new THREE.Mesh(sideHairGeo, hairMat);
        rightHair.position.set(0.22, 1.08, 0);
        group.add(rightHair);

        // RED BLOODSHOT EYES (glowing red!)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.22, 0.18);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.22, 0.18);
        group.add(rightEye);

        // Big dopey smile
        const smileGeo = new THREE.BoxGeometry(0.18, 0.04, 0.05);
        const smileMat = new THREE.MeshBasicMaterial({ color: 0xcc6644 });
        const smile = new THREE.Mesh(smileGeo, smileMat);
        smile.position.set(0, 1.12, 0.18);
        group.add(smile);
        // Smile corners (upturned)
        const cornerGeo = new THREE.BoxGeometry(0.04, 0.04, 0.05);
        const leftCorner = new THREE.Mesh(cornerGeo, smileMat);
        leftCorner.position.set(-0.1, 1.14, 0.18);
        group.add(leftCorner);
        const rightCorner = new THREE.Mesh(cornerGeo, smileMat);
        rightCorner.position.set(0.1, 1.14, 0.18);
        group.add(rightCorner);

        return group;
    }

    playGreeting() {
        const now = Date.now();
        if (now - this.lastSoundTime < 4000) return;
        this.lastSoundTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Chill "heh heh" laugh
            for (let i = 0; i < 2; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const offset = i * 0.2;
                osc.frequency.setValueAtTime(180 + Math.random() * 30, t + offset);
                osc.frequency.linearRampToValueAtTime(140 + Math.random() * 20, t + offset + 0.12);
                gain.gain.setValueAtTime(0, t + offset);
                gain.gain.linearRampToValueAtTime(0.12, t + offset + 0.03);
                gain.gain.linearRampToValueAtTime(0, t + offset + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + offset);
                osc.stop(t + offset + 0.18);
            }

            // "Peace" - higher pitched hum after laugh
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(250, t + 0.5);
            osc2.frequency.linearRampToValueAtTime(200, t + 0.9);
            gain2.gain.setValueAtTime(0, t + 0.5);
            gain2.gain.linearRampToValueAtTime(0.08, t + 0.55);
            gain2.gain.linearRampToValueAtTime(0, t + 0.9);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t + 0.5);
            osc2.stop(t + 1.0);
        } catch(e) {}
    }

    playBongBubble() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Bubbling water sound
            for (let i = 0; i < 6; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const offset = i * 0.08;
                const freq = 300 + Math.random() * 400;
                osc.frequency.setValueAtTime(freq, t + offset);
                osc.frequency.linearRampToValueAtTime(freq * 0.7, t + offset + 0.06);
                gain.gain.setValueAtTime(0, t + offset);
                gain.gain.linearRampToValueAtTime(0.06, t + offset + 0.02);
                gain.gain.linearRampToValueAtTime(0, t + offset + 0.07);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + offset);
                osc.stop(t + offset + 0.1);
            }
        } catch(e) {}
    }

    update(dt, playerPos, cats) {
        if (!this.alive) return;

        const distToPlayer = this.position.distanceTo(playerPos);
        this.greetCooldown = Math.max(0, this.greetCooldown - dt);
        this.swayPhase += dt * 2;

        // Check for nearby exploding cats - flee!
        this.fleeing = false;
        if (cats) {
            for (const cat of cats) {
                if (cat.alive && cat.exploding) {
                    const distToCat = this.position.distanceTo(cat.position);
                    if (distToCat < 8) {
                        this.fleeing = true;
                        this.fleeDir.subVectors(this.position, cat.position);
                        this.fleeDir.y = 0;
                        this.fleeDir.normalize();
                        break;
                    }
                }
            }
        }

        // Check if in water
        const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        const bodyBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.7), Math.floor(this.position.z));
        this.inWater = (feetBlock === BlockType.WATER || bodyBlock === BlockType.WATER);

        // Gravity / Swimming
        if (this.inWater) {
            this.swimBobPhase += dt * 2.5;
            this.velocity.y += -5.0 * dt;
            if (this.position.y < WATER_LEVEL) {
                const submersion = Math.min(1.0, (WATER_LEVEL - this.position.y) / 1.5);
                this.velocity.y += 22.0 * submersion * dt;
            }
            this.velocity.y *= 0.92;
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
            this.velocity.y = Math.max(-4, Math.min(4, this.velocity.y));
        } else {
            this.velocity.y += this.gravity * dt;
            if (this.velocity.y < -50) this.velocity.y = -50;
        }

        // Movement
        if (this.fleeing) {
            this.velocity.x = this.fleeDir.x * this.speed * 1.5;
            this.velocity.z = this.fleeDir.z * this.speed * 1.5;
        } else if (this.isSmokingBong) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.smokeTimer -= dt;
            if (this.smokeTimer <= 0) {
                this.isSmokingBong = false;
                this.removeSmokeEffect();
            }
        } else {
            // Greet player when close
            if (distToPlayer < 6 && this.greetCooldown <= 0) {
                this.playGreeting();
                this.greetCooldown = 6;
            }

            // Bong time!
            this.bongTimer -= dt;
            if (this.bongTimer <= 0) {
                this.isSmokingBong = true;
                this.smokeTimer = 3;
                this.bongTimer = this.bongInterval;
                this.playBongBubble();
                this.createSmokeEffect();
            }

            // Wander
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                this.wanderTimer = 3 + Math.random() * 5;
            }
            this.velocity.x = this.wanderDir.x * this.speed * 0.3;
            this.velocity.z = this.wanderDir.z * this.speed * 0.3;
        }

        // Apply movement
        const oldPos = this.position.clone();
        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            this.position.x = oldPos.x;
            // Pick a new wander direction instead of jumping
            const angle = Math.random() * Math.PI * 2;
            this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
            this.wanderTimer = 2 + Math.random() * 3;
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
            // Pick a new wander direction instead of jumping
            const angle = Math.random() * Math.PI * 2;
            this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
            this.wanderTimer = 2 + Math.random() * 3;
        }

        if (this.position.y < -10) this.position.y = 50;

        // Update mesh position
        this.mesh.position.copy(this.position);
        if (this.inWater) {
            // Swimming bob animation
            const swimBob = Math.sin(this.swimBobPhase) * 0.2;
            this.mesh.position.y += swimBob;
            this.mesh.rotation.x = Math.sin(this.swimBobPhase * 0.6) * 0.08;
            this.mesh.rotation.z = Math.sin(this.swimBobPhase * 0.4) * 0.06;
        } else {
            this.mesh.position.y += Math.sin(this.swayPhase * 0.7) * 0.02;
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }

        // Update persistent smoke cloud
        this.smokeCloudTimer -= dt;
        if (this.smokeCloudTimer <= 0) {
            this.spawnSmokeParticle();
            this.smokeCloudTimer = 0.15; // Spawn smoke frequently
        }
        this.updateSmokeCloud(dt);

        // Update smoke puff position (from bong hits)
        if (this.smokePuff) {
            this.smokePuff.position.set(this.position.x, this.position.y + 1.6, this.position.z);
            this.smokePuff.material.opacity = 0.3 + Math.sin(Date.now() * 0.005) * 0.15;
        }
    }

    checkCollision() {
        const hw = 0.2;
        for (let dy = this.position.y - 0.01; dy <= this.position.y + 1.4; dy += 0.7) {
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

    spawnSmokeParticle() {
        const size = 0.4 + Math.random() * 0.8;
        const geo = new THREE.SphereGeometry(size, 5, 5);
        const shade = 0.6 + Math.random() * 0.3;
        const color = new THREE.Color(shade, shade, shade);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.25 + Math.random() * 0.2 });
        const puff = new THREE.Mesh(geo, mat);
        // Spawn around the bongman in a cloud
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 2.5;
        puff.position.set(
            this.position.x + Math.cos(angle) * dist,
            this.position.y + 0.5 + Math.random() * 3.5,
            this.position.z + Math.sin(angle) * dist
        );
        this.scene.add(puff);
        this.smokeCloud.push({
            mesh: puff,
            life: 3 + Math.random() * 3,
            maxLife: 3 + Math.random() * 3,
            driftX: (Math.random() - 0.5) * 0.3,
            driftY: 0.2 + Math.random() * 0.4,
            driftZ: (Math.random() - 0.5) * 0.3
        });
    }

    updateSmokeCloud(dt) {
        for (let i = this.smokeCloud.length - 1; i >= 0; i--) {
            const p = this.smokeCloud[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.smokeCloud.splice(i, 1);
                continue;
            }
            // Drift upward and outward
            p.mesh.position.x += p.driftX * dt;
            p.mesh.position.y += p.driftY * dt;
            p.mesh.position.z += p.driftZ * dt;
            // Fade out as life decreases
            const lifeRatio = p.life / p.maxLife;
            p.mesh.material.opacity = lifeRatio * 0.35;
            // Grow slightly as it rises
            const scale = 1 + (1 - lifeRatio) * 0.8;
            p.mesh.scale.set(scale, scale, scale);
        }
    }

    createSmokeEffect() {
        const geo = new THREE.SphereGeometry(0.6, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 });
        this.smokePuff = new THREE.Mesh(geo, mat);
        this.smokePuff.position.set(this.position.x, this.position.y + 1.6, this.position.z);
        this.scene.add(this.smokePuff);
        // Extra burst of smoke when hitting the bong
        for (let i = 0; i < 8; i++) {
            this.spawnSmokeParticle();
        }
    }

    removeSmokeEffect() {
        if (this.smokePuff) {
            this.scene.remove(this.smokePuff);
            this.smokePuff.geometry.dispose();
            this.smokePuff.material.dispose();
            this.smokePuff = null;
        }
    }

    clearSmokeCloud() {
        for (const p of this.smokeCloud) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.smokeCloud = [];
    }

    dispose() {
        this.removeSmokeEffect();
        this.clearSmokeCloud();
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

// Bong Man Spawner
class BongManSpawner {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.bongMen = [];
        this.maxBongMen = 15;
        this.spawnCooldown = 0;
        this.spawnInterval = 3;
    }

    update(dt, playerPos, cats) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0 && this.bongMen.length < this.maxBongMen) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        const catList = cats ? cats.cats || [] : [];
        for (let i = this.bongMen.length - 1; i >= 0; i--) {
            const bm = this.bongMen[i];
            bm.update(dt, playerPos, catList);
            if (bm.position.distanceTo(playerPos) > 120) {
                bm.dispose();
                this.bongMen.splice(i, 1);
            }
        }
    }

    trySpawn(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 25;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;
        const sy = this.world.getSpawnHeight(sx, sz);
        if (sy <= WATER_LEVEL + 1) return;
        const groundBlock = this.world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz));
        if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) return;

        const bm = new BongMan(this.world, this.scene, sx, sy + 0.5, sz);
        this.bongMen.push(bm);
    }

    getCount() {
        return this.bongMen.length;
    }
}

window.BongMan = BongMan;
window.BongManSpawner = BongManSpawner;
