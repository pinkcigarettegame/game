// Glock weapon system - Press G to equip/unequip
class Glock {
    constructor(scene, camera, player) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.equipped = false;
        this.fireCooldown = 0;
        this.fireRate = 0.15; // seconds between shots
        this.damage = 5;
        this.range = 80;
        this.recoilTimer = 0;
        this.muzzleFlashTimer = 0;

        // Magazine / Reload system
        this.magazineSize = 17;
        this.currentAmmo = 17;
        this.reloading = false;
        this.reloadTime = 1.5; // seconds
        this.reloadTimer = 0;
        this.slideBackTimer = 0; // visual slide-back on last round

        this.audioCtx = null;
        this.lastShotTime = 0;

        // Create the gun model (attached to camera)
        this.gunGroup = this.createGunModel();
        this.gunGroup.visible = false;
        this.camera.add(this.gunGroup);

        // Muzzle flash
        this.muzzleFlash = this.createMuzzleFlash();
        this.muzzleFlash.visible = false;
        this.gunGroup.add(this.muzzleFlash);

        // Hit markers
        this.hitMarkers = [];

        // Ammo (infinite but track for display)
        this.ammo = 999;

        // Money from shooting strippers
        this.money = 0;
        this.dollarBills = []; // floating dollar bill DOM elements

        // Combat coordination - armed strippers react to what player shoots
        this.lastTargetType = null; // 'crackhead', 'cop', or null
        this.lastTargetTime = 0; // timestamp of last hostile shot
        this.combatTimeout = 5; // seconds before strippers stop fighting

        // Targets registry
        this.catSpawner = null;
        this.bongManSpawner = null;
        this.stripperSpawner = null;
        this.copSpawner = null;
    }

    setTargets(catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, copSpawner) {
        this.catSpawner = catSpawner;
        this.bongManSpawner = bongManSpawner;
        this.stripperSpawner = stripperSpawner;
        this.crackheadSpawner = crackheadSpawner;
        this.copSpawner = copSpawner;
    }

    createGunModel() {
        const group = new THREE.Group();

        // Gun body (dark metal slide)
        const slideMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const slideGeo = new THREE.BoxGeometry(0.06, 0.08, 0.28);
        const slide = new THREE.Mesh(slideGeo, slideMat);
        slide.position.set(0, 0, -0.05);
        group.add(slide);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
        const barrel = new THREE.Mesh(barrelGeo, slideMat);
        barrel.position.set(0, -0.01, -0.24);
        group.add(barrel);

        // Grip (dark brown/black)
        const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const gripGeo = new THREE.BoxGeometry(0.055, 0.14, 0.08);
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.1, 0.04);
        grip.rotation.x = 0.2;
        group.add(grip);

        // Grip texture lines
        const linesMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        for (let i = 0; i < 4; i++) {
            const lineGeo = new THREE.BoxGeometry(0.057, 0.008, 0.06);
            const line = new THREE.Mesh(lineGeo, linesMat);
            line.position.set(0, -0.06 + i * 0.02, 0.04);
            line.rotation.x = 0.2;
            group.add(line);
        }

        // Trigger guard
        const guardGeo = new THREE.BoxGeometry(0.02, 0.04, 0.06);
        const guard = new THREE.Mesh(guardGeo, slideMat);
        guard.position.set(0, -0.06, -0.02);
        group.add(guard);

        // Trigger
        const triggerMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const triggerGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
        const trigger = new THREE.Mesh(triggerGeo, triggerMat);
        trigger.position.set(0, -0.05, -0.01);
        group.add(trigger);

        // Front sight
        const sightGeo = new THREE.BoxGeometry(0.015, 0.02, 0.015);
        const sightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const frontSight = new THREE.Mesh(sightGeo, sightMat);
        frontSight.position.set(0, 0.05, -0.18);
        group.add(frontSight);

        // Rear sight
        const rearSightL = new THREE.Mesh(sightGeo, slideMat);
        rearSightL.position.set(-0.015, 0.05, 0.06);
        group.add(rearSightL);
        const rearSightR = new THREE.Mesh(sightGeo, slideMat);
        rearSightR.position.set(0.015, 0.05, 0.06);
        group.add(rearSightR);

        // Position the gun in first-person view (bottom right) - BIGGER
        group.position.set(0.35, -0.3, -0.55);
        group.scale.set(1.8, 1.8, 1.8);
        group.rotation.set(0, 0, 0);

        return group;
    }

    createMuzzleFlash() {
        const group = new THREE.Group();

        // Flash core (bright yellow)
        const flashGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        group.add(flash);

        // Flash outer (orange)
        const outerGeo = new THREE.BoxGeometry(0.14, 0.14, 0.03);
        const outerMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        group.add(outer);

        // Flash streaks
        const streakMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 4; i++) {
            const streakGeo = new THREE.BoxGeometry(0.02, 0.02, 0.08);
            const streak = new THREE.Mesh(streakGeo, streakMat);
            const angle = (i / 4) * Math.PI * 2;
            streak.position.set(Math.cos(angle) * 0.06, Math.sin(angle) * 0.06, -0.03);
            streak.rotation.z = angle;
            group.add(streak);
        }

        group.position.set(0, 0.0, -0.32);
        return group;
    }

    toggle() {
        this.equipped = !this.equipped;
        this.gunGroup.visible = this.equipped;
        if (!this.equipped) {
            this.muzzleFlash.visible = false;
        }
    }

    playGunshot() {
        const now = Date.now();
        if (now - this.lastShotTime < 80) return;
        this.lastShotTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Sharp crack (noise burst)
            const bufferSize = ctx.sampleRate * 0.15;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            const hpFilter = ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.setValueAtTime(800, t);
            noise.connect(hpFilter);
            hpFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);

            // Low thump
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.4, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);

            // Metallic ping (slide action)
            const ping = ctx.createOscillator();
            ping.type = 'square';
            ping.frequency.setValueAtTime(3000, t + 0.02);
            ping.frequency.exponentialRampToValueAtTime(1500, t + 0.06);
            const pingGain = ctx.createGain();
            pingGain.gain.setValueAtTime(0.08, t + 0.02);
            pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            ping.connect(pingGain);
            pingGain.connect(ctx.destination);
            ping.start(t + 0.02);
            ping.stop(t + 0.08);
        } catch(e) {}
    }

    shoot() {
        if (this.fireCooldown > 0) return;
        if (this.reloading) return;

        // Check ammo
        if (this.currentAmmo <= 0) {
            // Click! Empty - auto reload
            this.playEmptyClick();
            this.startReload();
            return;
        }

        this.currentAmmo--;
        this.fireCooldown = this.fireRate;

        // Play sound
        this.playGunshot();

        // Muzzle flash
        this.muzzleFlash.visible = true;
        this.muzzleFlashTimer = 0.05;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;

        // Recoil
        this.recoilTimer = 0.1;

        // Broadcast shot to other players
        if (window.mp && window.mp.connected) {
            window.mp.broadcastShoot();
        }

        // Shell ejection!
        this.ejectShell();

        // Bullet tracer
        this.createBulletTracer();

        // Update ammo display
        this.updateAmmoDisplay();

        // Auto-reload on last round
        if (this.currentAmmo <= 0) {
            this.slideBackTimer = 0.3;
        }

        // Wanted level is now only added when hitting certain NPCs (not crackheads or cats)

        // Raycast from camera center
        const origin = this.camera.getWorldPosition(new THREE.Vector3());
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));

        // Check hits against all NPCs
        let hitSomething = false;

        // Check cats
        if (this.catSpawner && this.catSpawner.cats) {
            for (const cat of this.catSpawner.cats) {
                if (!cat.alive) continue;
                const hit = this.checkRayHit(origin, direction, cat.position, 0.6, 1.0);
                if (hit) {
                    // Cat dies immediately - call explode directly
                    this.createHitEffect(hit);
                    cat.explode();
                    hitSomething = true;
                    break;
                }
            }
        }

        // Check bongmen
        if (!hitSomething && this.bongManSpawner && this.bongManSpawner.bongMen) {
            for (let i = this.bongManSpawner.bongMen.length - 1; i >= 0; i--) {
                const bm = this.bongManSpawner.bongMen[i];
                if (!bm.alive) continue;
                // Bongmen are 2.5x scaled, so bigger hitbox
                const hit = this.checkRayHit(origin, direction, bm.position, 1.2, 3.5);
                if (hit) {
                    if (!bm.health) bm.health = 15;
                    bm.health -= this.damage;
                    this.createHitEffect(hit);
                    this.createBloodEffect(hit);
                    // Shooting bongmen attracts police
                    if (this.copSpawner) this.copSpawner.addWanted(0.1);
                    if (bm.health <= 0) {
                        bm.alive = false;
                        bm.dispose();
                        this.bongManSpawner.bongMen.splice(i, 1);
                    } else {
                        // Flee when shot!
                        bm.fleeing = true;
                        bm.fleeDir.subVectors(bm.position, this.player.position);
                        bm.fleeDir.y = 0;
                        bm.fleeDir.normalize();
                        bm.fleeTimer = 5;
                    }
                    hitSomething = true;
                    break;
                }
            }
        }

        // Check strippers
        if (!hitSomething && this.stripperSpawner && this.stripperSpawner.strippers) {
            for (let i = this.stripperSpawner.strippers.length - 1; i >= 0; i--) {
                const s = this.stripperSpawner.strippers[i];
                if (!s.alive) continue;
                if (s.hired) continue; // Can't kill hired strippers
                const hit = this.checkRayHit(origin, direction, s.position, 0.4, 1.6);
                if (hit) {
                    if (!s.health) s.health = 8;
                    s.health -= this.damage;
                    this.createHitEffect(hit);
                    this.createBloodEffect(hit);
                    // Shooting strippers attracts police
                    if (this.copSpawner) this.copSpawner.addWanted(0.1);
                    // Dollar bill every time a stripper is shot!
                    this.spawnDollarBill();
                    this.money++;
                    if (s.health <= 0) {
                        s.alive = false;
                        // Play death squeal
                        s.playSqueal();
                        // Bonus dollars on kill
                        for (let d = 0; d < 5; d++) {
                            setTimeout(() => this.spawnDollarBill(), d * 100);
                        }
                        this.money += 5;
                        s.dispose();
                        this.stripperSpawner.strippers.splice(i, 1);
                    } else {
                        // Squeal and run away when shot
                        s.playSqueal();
                        s.attracted = false;
                        // Temporarily flee
                        s.velocity.x = (s.position.x - this.player.position.x) * 2;
                        s.velocity.z = (s.position.z - this.player.position.z) * 2;
                    }
                    hitSomething = true;
                    break;
                }
            }
        }

        // Check crackheads
        if (!hitSomething && this.crackheadSpawner && this.crackheadSpawner.crackheads) {
            for (let i = this.crackheadSpawner.crackheads.length - 1; i >= 0; i--) {
                const ch = this.crackheadSpawner.crackheads[i];
                if (!ch.alive) continue;
                const hit = this.checkRayHit(origin, direction, ch.position, 0.4, 1.5);
                if (hit) {
                    // Signal armed strippers to fight crackheads
                    this.lastTargetType = 'crackhead';
                    this.lastTargetTime = Date.now() / 1000;
                    ch.health -= this.damage;
                    this.createHitEffect(hit);
                    this.createBloodEffect(hit);
                    if (ch.health <= 0) {
                        ch.alive = false;
                        // Drop a couple dollars when they die
                        for (let d = 0; d < 3; d++) {
                            setTimeout(() => this.spawnDollarBill(), d * 80);
                        }
                        this.money += 3;
                        ch.dispose();
                        this.crackheadSpawner.crackheads.splice(i, 1);
                    } else {
                        // Flee when shot!
                        ch.fleeing = true;
                        ch.fleeDir.subVectors(ch.position, this.player.position);
                        ch.fleeDir.y = 0;
                        ch.fleeDir.normalize();
                        ch.fleeTimer = 4;
                        ch.playMumble();
                    }
                    hitSomething = true;
                    break;
                }
            }
        }

        // Check cops - they drop BIG money!
        if (!hitSomething && this.copSpawner && this.copSpawner.cops) {
            for (let i = this.copSpawner.cops.length - 1; i >= 0; i--) {
                const cop = this.copSpawner.cops[i];
                if (!cop.alive) continue;
                const hit = this.checkRayHit(origin, direction, cop.position, 0.4, 1.6);
                if (hit) {
                    // Signal armed strippers to fight cops
                    this.lastTargetType = 'cop';
                    this.lastTargetTime = Date.now() / 1000;
                    cop.health -= this.damage;
                    this.createHitEffect(hit);
                    this.createBloodEffect(hit);
                    if (cop.health <= 0) {
                        cop.alive = false;
                        // Cops drop BIG money! $20-50 per cop
                        const copMoney = 20 + Math.floor(Math.random() * 31);
                        for (let d = 0; d < 10; d++) {
                            setTimeout(() => this.spawnDollarBill(), d * 60);
                        }
                        this.money += copMoney;
                        // Killing a cop adds wanted stars (handled in spawner update)
                        cop.dispose();
                        this.copSpawner.cops.splice(i, 1);
                        this.copSpawner.addWanted(1);
                    } else {
                        // Cop shouts when hit
                        cop.playShout();
                    }
                    hitSomething = true;
                    break;
                }
            }
        }

        // If nothing hit, check for block hit (bullet hole effect)
        if (!hitSomething) {
            const blockHit = this.player.world.raycast(origin, direction, this.range);
            if (blockHit) {
                this.createBulletHole(blockHit);
            }
        }
    }

    checkRayHit(origin, direction, targetPos, halfWidth, height) {
        // Simple AABB ray intersection
        const minX = targetPos.x - halfWidth;
        const maxX = targetPos.x + halfWidth;
        const minY = targetPos.y - 0.1;
        const maxY = targetPos.y + height;
        const minZ = targetPos.z - halfWidth;
        const maxZ = targetPos.z + halfWidth;

        let tmin = -Infinity, tmax = Infinity;

        // X slab
        if (direction.x !== 0) {
            let t1 = (minX - origin.x) / direction.x;
            let t2 = (maxX - origin.x) / direction.x;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
        } else if (origin.x < minX || origin.x > maxX) return null;

        // Y slab
        if (direction.y !== 0) {
            let t1 = (minY - origin.y) / direction.y;
            let t2 = (maxY - origin.y) / direction.y;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
        } else if (origin.y < minY || origin.y > maxY) return null;

        // Z slab
        if (direction.z !== 0) {
            let t1 = (minZ - origin.z) / direction.z;
            let t2 = (maxZ - origin.z) / direction.z;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
        } else if (origin.z < minZ || origin.z > maxZ) return null;

        if (tmin > tmax || tmax < 0) return null;
        const t = tmin > 0 ? tmin : tmax;
        if (t > this.range) return null;

        return new THREE.Vector3(
            origin.x + direction.x * t,
            origin.y + direction.y * t,
            origin.z + direction.z * t
        );
    }

    createBulletTracer() {
        // Visible bullet tracer line from gun barrel into the distance
        const origin = this.camera.getWorldPosition(new THREE.Vector3());
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));

        const start = origin.clone().add(direction.clone().multiplyScalar(1));
        const end = origin.clone().add(direction.clone().multiplyScalar(60));

        const tracerGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const tracerMat = new THREE.LineBasicMaterial({ 
            color: 0xffff88, 
            transparent: true, 
            opacity: 0.8,
            linewidth: 2
        });
        const tracer = new THREE.Line(tracerGeo, tracerMat);
        this.scene.add(tracer);

        // Also add a bright thin box along the path for more visibility
        const tracerLen = 3;
        const boxGeo = new THREE.BoxGeometry(0.02, 0.02, tracerLen);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        const tracerBox = new THREE.Mesh(boxGeo, boxMat);
        const midPoint = origin.clone().add(direction.clone().multiplyScalar(5));
        tracerBox.position.copy(midPoint);
        tracerBox.lookAt(end);
        this.scene.add(tracerBox);

        // Animate: move tracer forward and fade
        let frame = 0;
        const speed = 3;
        const animate = () => {
            frame++;
            tracerBox.position.add(direction.clone().multiplyScalar(speed));
            tracerMat.opacity = Math.max(0, 0.8 - frame * 0.15);
            boxMat.opacity = Math.max(0, 0.9 - frame * 0.12);
            if (frame < 10) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(tracer);
                this.scene.remove(tracerBox);
                tracerGeo.dispose();
                tracerMat.dispose();
                boxGeo.dispose();
                boxMat.dispose();
            }
        };
        requestAnimationFrame(animate);
    }

    createHitEffect(hitPos) {
        // Spark/impact particles
        for (let i = 0; i < 8; i++) {
            const size = 0.03 + Math.random() * 0.05;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ 
                color: Math.random() > 0.5 ? 0xffff44 : 0xffaa00, 
                transparent: true, opacity: 1.0 
            });
            const spark = new THREE.Mesh(geo, mat);
            spark.position.copy(hitPos);
            const vx = (Math.random() - 0.5) * 5;
            const vy = Math.random() * 4;
            const vz = (Math.random() - 0.5) * 5;
            this.scene.add(spark);

            let frame = 0;
            const animate = () => {
                frame++;
                spark.position.x += vx * 0.016;
                spark.position.y += (vy - frame * 0.3) * 0.016;
                spark.position.z += vz * 0.016;
                mat.opacity = Math.max(0, 1 - frame / 15);
                if (frame < 15) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(spark);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animate);
        }
    }

    createBloodEffect(hitPos) {
        // Red blood particles
        for (let i = 0; i < 12; i++) {
            const size = 0.04 + Math.random() * 0.08;
            const geo = new THREE.BoxGeometry(size, size, size);
            const shade = 0.5 + Math.random() * 0.5;
            const mat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(shade, 0, 0), 
                transparent: true, opacity: 0.9 
            });
            const blood = new THREE.Mesh(geo, mat);
            blood.position.copy(hitPos);
            const vx = (Math.random() - 0.5) * 4;
            const vy = Math.random() * 3 - 0.5;
            const vz = (Math.random() - 0.5) * 4;
            this.scene.add(blood);

            let frame = 0;
            const animate = () => {
                frame++;
                blood.position.x += vx * 0.016;
                blood.position.y += (vy - frame * 0.2) * 0.016;
                blood.position.z += vz * 0.016;
                mat.opacity = Math.max(0, 0.9 - frame / 25);
                if (frame < 25) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(blood);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animate);
        }
    }

    createBulletHole(blockHit) {
        // Small dark mark on the block face
        const pos = blockHit.position;
        const normal = blockHit.normal || { x: 0, y: 0, z: 0 };
        const holeGeo = new THREE.PlaneGeometry(0.15, 0.15);
        const holeMat = new THREE.MeshBasicMaterial({ 
            color: 0x111111, 
            transparent: true, 
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
        // Offset slightly from block face
        if (normal) {
            hole.position.x += normal.x * 0.51;
            hole.position.y += normal.y * 0.51;
            hole.position.z += normal.z * 0.51;
            if (normal.y !== 0) {
                hole.rotation.x = -Math.PI / 2;
            } else if (normal.x !== 0) {
                hole.rotation.y = Math.PI / 2;
            }
        }
        this.scene.add(hole);

        // Spark effect at impact point
        this.createHitEffect(hole.position.clone());

        // Fade and remove after a while
        setTimeout(() => {
            let frame = 0;
            const fade = () => {
                frame++;
                holeMat.opacity = Math.max(0, 0.7 - frame * 0.07);
                if (frame < 10) {
                    requestAnimationFrame(fade);
                } else {
                    this.scene.remove(hole);
                    holeGeo.dispose();
                    holeMat.dispose();
                }
            };
            requestAnimationFrame(fade);
        }, 5000);
    }

    moneySpread() {
        // Show off your money gangsta style - fanned out like a stack! Doesn't spend it.
        if (this.money <= 0) return;
        
        const billCount = this.money;
        
        // Play the money flash sound
        this.playMoneyFlashSound();

        // If on foot (not driving), trigger third-person cinematic mode
        if (!this.player.driving) {
            this.player.startMoneySpread();
            // Hide glock during money spread
            if (this.equipped) {
                this.gunGroup.visible = false;
            }
        }
        
        // Create the fanned money display (DOM overlay - gangsta hand fan)
        this.showMoneyFan(billCount);
        
        // Show big money flex text on screen
        const moneyText = document.createElement('div');
        moneyText.textContent = `💸 $${billCount} 💸`;
        moneyText.style.cssText = `
            position: fixed;
            top: 22%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            font-size: 58px;
            font-weight: bold;
            color: #00ff00;
            text-shadow: 0 0 10px #00ff00, 0 0 20px #008800, 0 0 40px #00ff00, 3px 3px 6px rgba(0,0,0,0.9);
            z-index: 500;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
            letter-spacing: 6px;
            opacity: 0;
            transition: all 0.3s ease-out;
        `;
        document.body.appendChild(moneyText);
        
        // Animate in
        requestAnimationFrame(() => {
            moneyText.style.opacity = '1';
            moneyText.style.transform = 'translate(-50%, -50%) scale(1.1)';
        });
        
        // Fade out after 2.5 seconds
        setTimeout(() => {
            moneyText.style.opacity = '0';
            moneyText.style.transform = 'translate(-50%, -80%) scale(1.3)';
            setTimeout(() => moneyText.remove(), 500);
        }, 2500);
    }

    showMoneyFan(billCount) {
        // Create a container for the fanned money display
        const fanContainer = document.createElement('div');
        fanContainer.style.cssText = `
            position: fixed;
            bottom: 10%;
            left: 50%;
            transform: translateX(-50%);
            z-index: 450;
            pointer-events: none;
            width: 500px;
            height: 300px;
        `;
        document.body.appendChild(fanContainer);
        
        // Number of visual bills in the fan (cap for performance)
        const fanBills = Math.min(billCount, 20);
        
        // Fan spread angle range
        const totalSpread = 60; // degrees total spread
        const startAngle = -totalSpread / 2;
        const angleStep = fanBills > 1 ? totalSpread / (fanBills - 1) : 0;
        
        const bills = [];
        
        for (let i = 0; i < fanBills; i++) {
            const bill = document.createElement('div');
            const angle = startAngle + (i * angleStep);
            
            // Dollar bill styling - green rectangle with $ sign
            bill.innerHTML = `<div style="
                width: 120px;
                height: 52px;
                background: linear-gradient(135deg, #1a6b1a 0%, #2d8f2d 30%, #1a6b1a 50%, #228b22 70%, #1a6b1a 100%);
                border: 2px solid #0d4f0d;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
                color: #90ee90;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                font-family: 'Georgia', serif;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 0 15px rgba(255,255,255,0.1);
                position: relative;
                overflow: hidden;
            "><span style="font-size: 16px; position: absolute; top: 2px; left: 5px;">$</span><span style="font-size: 28px;">$${billCount > 99 ? '100' : billCount}</span><span style="font-size: 16px; position: absolute; bottom: 2px; right: 5px;">$</span>
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 4px solid transparent; border-image: repeating-linear-gradient(90deg, rgba(144,238,144,0.2) 0px, rgba(144,238,144,0.2) 2px, transparent 2px, transparent 6px) 4;"></div>
            </div>`;
            
            bill.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 50%;
                transform-origin: bottom center;
                transform: translateX(-50%) rotate(${angle}deg) translateY(0px) scale(0);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                opacity: 0;
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
            `;
            
            fanContainer.appendChild(bill);
            bills.push({ el: bill, angle: angle });
        }
        
        // Animate bills fanning out with stagger
        bills.forEach((b, i) => {
            setTimeout(() => {
                b.el.style.opacity = '1';
                b.el.style.transform = `translateX(-50%) rotate(${b.angle}deg) translateY(-40px) scale(1)`;
            }, i * 30);
        });
        
        // Hold the fan for 2 seconds, then retract
        setTimeout(() => {
            bills.forEach((b, i) => {
                setTimeout(() => {
                    b.el.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
                    b.el.style.transform = `translateX(-50%) rotate(0deg) translateY(60px) scale(0.5)`;
                    b.el.style.opacity = '0';
                }, i * 20);
            });
            
            // Remove container after animation
            setTimeout(() => fanContainer.remove(), 800);
        }, 2200);
    }

    playMoneyFlashSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Paper fanning/shuffling sound (rapid filtered noise bursts)
            for (let i = 0; i < 6; i++) {
                const delay = i * 0.04;
                const bufSize = ctx.sampleRate * 0.06;
                const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let j = 0; j < bufSize; j++) {
                    d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.015));
                }
                const src = ctx.createBufferSource();
                src.buffer = buf;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.12, t + delay);
                gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);
                const bp = ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.setValueAtTime(3000 + i * 500, t + delay);
                bp.Q.setValueAtTime(3, t + delay);
                src.connect(bp);
                bp.connect(gain);
                gain.connect(ctx.destination);
                src.start(t + delay);
            }

            // Cha-ching bell hit
            const bell = ctx.createOscillator();
            bell.type = 'sine';
            bell.frequency.setValueAtTime(2200, t + 0.25);
            bell.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
            const bellGain = ctx.createGain();
            bellGain.gain.setValueAtTime(0.35, t + 0.25);
            bellGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
            bell.connect(bellGain);
            bellGain.connect(ctx.destination);
            bell.start(t + 0.25);
            bell.stop(t + 0.7);

            // Second higher bell (the "ching")
            const bell2 = ctx.createOscillator();
            bell2.type = 'sine';
            bell2.frequency.setValueAtTime(3500, t + 0.3);
            bell2.frequency.setValueAtTime(4000, t + 0.35);
            const bell2Gain = ctx.createGain();
            bell2Gain.gain.setValueAtTime(0.25, t + 0.3);
            bell2Gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
            bell2.connect(bell2Gain);
            bell2Gain.connect(ctx.destination);
            bell2.start(t + 0.3);
            bell2.stop(t + 0.8);

            // Deep bass hit for impact
            const bass = ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(80, t + 0.25);
            bass.frequency.exponentialRampToValueAtTime(40, t + 0.5);
            const bassGain = ctx.createGain();
            bassGain.gain.setValueAtTime(0.4, t + 0.25);
            bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            bass.connect(bassGain);
            bassGain.connect(ctx.destination);
            bass.start(t + 0.25);
            bass.stop(t + 0.55);

            // Sparkle/shimmer (high frequency sweep)
            const shimmer = ctx.createOscillator();
            shimmer.type = 'triangle';
            shimmer.frequency.setValueAtTime(5000, t + 0.35);
            shimmer.frequency.exponentialRampToValueAtTime(8000, t + 0.5);
            shimmer.frequency.exponentialRampToValueAtTime(4000, t + 0.7);
            const shimmerGain = ctx.createGain();
            shimmerGain.gain.setValueAtTime(0.06, t + 0.35);
            shimmerGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
            shimmer.connect(shimmerGain);
            shimmerGain.connect(ctx.destination);
            shimmer.start(t + 0.35);
            shimmer.stop(t + 0.75);
        } catch(e) {}
    }

    spawnDollarBill() {
        // Create a floating dollar bill on the player's screen (DOM element)
        const bill = document.createElement('div');
        bill.textContent = '💵';
        bill.style.cssText = `
            position: fixed;
            font-size: ${28 + Math.random() * 20}px;
            z-index: 300;
            pointer-events: none;
            left: ${30 + Math.random() * 40}%;
            top: ${20 + Math.random() * 40}%;
            transform: rotate(${(Math.random() - 0.5) * 60}deg);
            opacity: 1;
            transition: none;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            filter: drop-shadow(0 0 4px rgba(0,255,0,0.3));
        `;
        document.body.appendChild(bill);

        // Animate: float upward and fade, with slight sway
        const startX = parseFloat(bill.style.left);
        const startTop = parseFloat(bill.style.top);
        const swaySpeed = 2 + Math.random() * 3;
        const swayAmount = 3 + Math.random() * 5;
        let elapsed = 0;

        const animateBill = () => {
            elapsed += 0.016;
            const progress = elapsed / 3; // 3 seconds total
            bill.style.top = (startTop - elapsed * 8) + '%';
            bill.style.left = (startX + Math.sin(elapsed * swaySpeed) * swayAmount) + '%';
            bill.style.opacity = Math.max(0, 1 - progress);
            bill.style.transform = `rotate(${(Math.random() - 0.5) * 10 + Math.sin(elapsed * 2) * 15}deg) scale(${1 + progress * 0.3})`;

            if (progress < 1) {
                requestAnimationFrame(animateBill);
            } else {
                bill.remove();
            }
        };
        requestAnimationFrame(animateBill);
    }

    // === RELOAD SYSTEM ===
    startReload() {
        if (this.reloading || this.currentAmmo >= this.magazineSize) return;
        this.reloading = true;
        this.reloadTimer = this.reloadTime;
        this.playReloadSound();
        this.updateAmmoDisplay();
    }

    playEmptyClick() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;
            // Dry click sound
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1800, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.02);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.04);
        } catch(e) {}
    }

    playReloadSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Magazine release click
            const click1 = ctx.createOscillator();
            click1.type = 'square';
            click1.frequency.setValueAtTime(2500, t + 0.1);
            click1.frequency.exponentialRampToValueAtTime(1000, t + 0.13);
            const cGain1 = ctx.createGain();
            cGain1.gain.setValueAtTime(0.12, t + 0.1);
            cGain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            click1.connect(cGain1);
            cGain1.connect(ctx.destination);
            click1.start(t + 0.1);
            click1.stop(t + 0.16);

            // Magazine sliding out (noise)
            const bufSize1 = ctx.sampleRate * 0.15;
            const buf1 = ctx.createBuffer(1, bufSize1, ctx.sampleRate);
            const d1 = buf1.getChannelData(0);
            for (let i = 0; i < bufSize1; i++) d1[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
            const src1 = ctx.createBufferSource();
            src1.buffer = buf1;
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0.08, t + 0.15);
            g1.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            const lp1 = ctx.createBiquadFilter();
            lp1.type = 'lowpass';
            lp1.frequency.setValueAtTime(2000, t + 0.15);
            src1.connect(lp1);
            lp1.connect(g1);
            g1.connect(ctx.destination);
            src1.start(t + 0.15);

            // Magazine insert (thunk)
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(200, t + 0.8);
            osc2.frequency.exponentialRampToValueAtTime(80, t + 0.85);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.2, t + 0.8);
            g2.gain.exponentialRampToValueAtTime(0.01, t + 0.9);
            osc2.connect(g2);
            g2.connect(ctx.destination);
            osc2.start(t + 0.8);
            osc2.stop(t + 0.95);

            // Magazine click in
            const click2 = ctx.createOscillator();
            click2.type = 'square';
            click2.frequency.setValueAtTime(3000, t + 0.85);
            click2.frequency.exponentialRampToValueAtTime(1500, t + 0.88);
            const cGain2 = ctx.createGain();
            cGain2.gain.setValueAtTime(0.15, t + 0.85);
            cGain2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
            click2.connect(cGain2);
            cGain2.connect(ctx.destination);
            click2.start(t + 0.85);
            click2.stop(t + 0.92);

            // Slide rack (metallic)
            const bufSize2 = ctx.sampleRate * 0.1;
            const buf2 = ctx.createBuffer(1, bufSize2, ctx.sampleRate);
            const d2 = buf2.getChannelData(0);
            for (let i = 0; i < bufSize2; i++) d2[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
            const src2 = ctx.createBufferSource();
            src2.buffer = buf2;
            const g3 = ctx.createGain();
            g3.gain.setValueAtTime(0.15, t + 1.2);
            g3.gain.exponentialRampToValueAtTime(0.01, t + 1.35);
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(1500, t + 1.2);
            src2.connect(hp);
            hp.connect(g3);
            g3.connect(ctx.destination);
            src2.start(t + 1.2);

            // Slide forward snap
            const snap = ctx.createOscillator();
            snap.type = 'sawtooth';
            snap.frequency.setValueAtTime(4000, t + 1.35);
            snap.frequency.exponentialRampToValueAtTime(2000, t + 1.38);
            const sGain = ctx.createGain();
            sGain.gain.setValueAtTime(0.1, t + 1.35);
            sGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
            snap.connect(sGain);
            sGain.connect(ctx.destination);
            snap.start(t + 1.35);
            snap.stop(t + 1.42);
        } catch(e) {}
    }

    // === SHELL EJECTION ===
    ejectShell() {
        // Get gun world position and right direction
        const gunWorldPos = new THREE.Vector3();
        this.gunGroup.getWorldPosition(gunWorldPos);
        
        const camRight = new THREE.Vector3(1, 0, 0);
        camRight.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
        const camUp = new THREE.Vector3(0, 1, 0);
        camUp.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));

        // Create brass shell casing
        const shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.04);
        const shellMat = new THREE.MeshBasicMaterial({ color: 0xCCA020 }); // Brass color
        const shell = new THREE.Mesh(shellGeo, shellMat);
        
        // Start position near the gun ejection port (right side)
        shell.position.copy(gunWorldPos);
        shell.position.add(camRight.clone().multiplyScalar(0.3));
        shell.position.add(camUp.clone().multiplyScalar(0.1));
        
        this.scene.add(shell);

        // Shell velocity - eject to the right and up with spin
        const vx = camRight.x * (3 + Math.random() * 2) + (Math.random() - 0.5) * 1;
        const vy = camRight.y * 3 + camUp.y * (2 + Math.random() * 2) + 2;
        const vz = camRight.z * (3 + Math.random() * 2) + (Math.random() - 0.5) * 1;
        const spinX = (Math.random() - 0.5) * 20;
        const spinY = (Math.random() - 0.5) * 20;
        const spinZ = (Math.random() - 0.5) * 20;

        let frame = 0;
        const gravity = -15;
        let velY = vy;

        const animateShell = () => {
            frame++;
            const dt = 0.016;
            shell.position.x += vx * dt;
            velY += gravity * dt;
            shell.position.y += velY * dt;
            shell.position.z += vz * dt;
            shell.rotation.x += spinX * dt;
            shell.rotation.y += spinY * dt;
            shell.rotation.z += spinZ * dt;

            // Shell casing tink sound when it hits ground level
            if (velY < 0 && shell.position.y < gunWorldPos.y - 1.5 && frame > 5) {
                this.playShellTink();
                // Bounce once
                velY = Math.abs(velY) * 0.3;
                if (frame > 20) {
                    // Fade out
                    shellMat.transparent = true;
                    shellMat.opacity = Math.max(0, 1 - (frame - 20) / 30);
                }
            }

            if (frame < 60) {
                requestAnimationFrame(animateShell);
            } else {
                this.scene.remove(shell);
                shellGeo.dispose();
                shellMat.dispose();
            }
        };
        requestAnimationFrame(animateShell);
    }

    playShellTink() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;
            // Tiny metallic tink
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(4000 + Math.random() * 2000, t);
            osc.frequency.exponentialRampToValueAtTime(2000, t + 0.03);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.06);
        } catch(e) {}
    }

    // === AMMO DISPLAY ===
    updateAmmoDisplay() {
        const ammoDisplay = document.getElementById('ammo-display');
        const ammoCount = document.getElementById('ammo-count');
        const reloadText = document.getElementById('reload-text');
        if (!ammoDisplay || !ammoCount) return;

        if (this.equipped) {
            ammoDisplay.style.display = 'flex';
            
            if (this.reloading) {
                ammoCount.style.display = 'none';
                if (reloadText) reloadText.style.display = 'inline';
            } else {
                ammoCount.style.display = 'inline';
                if (reloadText) reloadText.style.display = 'none';
                ammoCount.textContent = `${this.currentAmmo}/${this.magazineSize}`;
                
                // Color based on ammo level
                ammoCount.className = '';
                if (this.currentAmmo <= 0) {
                    ammoCount.classList.add('empty');
                } else if (this.currentAmmo <= 4) {
                    ammoCount.classList.add('low');
                }
            }
        } else {
            ammoDisplay.style.display = 'none';
        }
    }

    // === WANTED STARS DISPLAY ===
    updateWantedDisplay() {
        const wantedEl = document.getElementById('wanted-stars');
        if (!wantedEl || !this.copSpawner) return;

        const level = Math.floor(this.copSpawner.wantedLevel);
        if (level > 0) {
            wantedEl.style.display = 'block';
            wantedEl.classList.add('wanted');
            let stars = '';
            for (let i = 0; i < 5; i++) {
                stars += i < level ? '⭐' : '☆';
            }
            wantedEl.textContent = stars;
        } else {
            wantedEl.style.display = 'none';
            wantedEl.classList.remove('wanted');
        }
    }

    update(dt) {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);

        // Muzzle flash timer
        if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer -= dt;
            if (this.muzzleFlashTimer <= 0) {
                this.muzzleFlash.visible = false;
            }
        }

        // Reload timer
        if (this.reloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.reloading = false;
                this.currentAmmo = this.magazineSize;
                this.updateAmmoDisplay();
            }
        }

        // Slide back timer (visual on empty)
        if (this.slideBackTimer > 0) {
            this.slideBackTimer -= dt;
        }

        // Update wanted stars display
        this.updateWantedDisplay();

        // Update ammo display visibility
        this.updateAmmoDisplay();

        // Recoil animation
        if (this.reloading) {
            // Reload animation - gun tilts down and back
            const reloadProgress = 1 - (this.reloadTimer / this.reloadTime);
            let tiltX = 0, posY = -0.25, posZ = -0.5;
            
            if (reloadProgress < 0.3) {
                // Magazine out - tilt down
                const p = reloadProgress / 0.3;
                tiltX = p * 0.4;
                posY = -0.25 - p * 0.1;
            } else if (reloadProgress < 0.6) {
                // Magazine in - hold tilted
                tiltX = 0.4;
                posY = -0.35;
            } else if (reloadProgress < 0.85) {
                // Slide rack - tilt back up
                const p = (reloadProgress - 0.6) / 0.25;
                tiltX = 0.4 * (1 - p);
                posY = -0.35 + p * 0.1;
                posZ = -0.5 + Math.sin(p * Math.PI) * 0.04;
            } else {
                // Snap forward
                const p = (reloadProgress - 0.85) / 0.15;
                tiltX = 0;
                posY = -0.25;
                posZ = -0.5 - (1 - p) * 0.03;
            }
            
            this.gunGroup.position.set(0.3, posY, posZ);
            this.gunGroup.rotation.x = -tiltX;
        } else if (this.recoilTimer > 0) {
            this.recoilTimer -= dt;
            const recoilAmount = this.recoilTimer / 0.1;
            this.gunGroup.position.set(
                0.3,
                -0.25 + recoilAmount * 0.04,
                -0.5 + recoilAmount * 0.06
            );
            this.gunGroup.rotation.x = -recoilAmount * 0.15;
        } else {
            // Idle bob (subtle sway)
            const time = Date.now() * 0.001;
            this.gunGroup.position.set(
                0.3 + Math.sin(time * 1.5) * 0.003,
                -0.25 + Math.sin(time * 2) * 0.002,
                -0.5
            );
            this.gunGroup.rotation.x = 0;
        }
    }

    dispose() {
        if (this.gunGroup) {
            this.camera.remove(this.gunGroup);
            this.gunGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

window.Glock = Glock;
