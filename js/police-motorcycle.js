// Police Motorcycle - Fast pursuit vehicle that spawns at 3+ wanted stars
// Rides toward the player at high speed, rider shoots when close

class PoliceMotorcycle {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.alive = true;
        this.health = 18;
        this.speed = 0;
        this.maxSpeed = 22;
        this.acceleration = 14;
        this.friction = 2;
        this.steerRate = 3.0;
        this.onGround = true;
        this.verticalVelocity = 0;
        this.gravity = -25;
        this.stuckTimer = 0;
        this.stuckCheckPos = new THREE.Vector3(x, y, z);
        this.wanderTimer = 0;
        this.wanderDir = 0;

        this.chasing = false;
        this.chaseRange = 150;
        this.attackRange = 12;
        this.attackCooldown = 0;
        this.attackInterval = 1.8;
        this.damage = 2;

        this.sirenPhase = 0;
        this.sirenLightPhase = 0;
        this.audioCtx = null;
        this.lastSirenTime = 0;
        this.lastShotTime = 0;

        this.wheelSpinPhase = 0;
        this.leanAngle = 0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        var group = new THREE.Group();

        var whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
        var blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        var darkBlueMat = new THREE.MeshLambertMaterial({ color: 0x1a1a4e });
        var blueMat = new THREE.MeshLambertMaterial({ color: 0x2a2a6e });
        var chromeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        var skinMat = new THREE.MeshLambertMaterial({ color: 0xe8c8a0 });
        var goldMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        var redLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        var blueLightMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });

        // === MOTORCYCLE BODY ===
        // Main frame (white police bike)
        var frameGeo = new THREE.BoxGeometry(0.4, 0.35, 1.6);
        var frame = new THREE.Mesh(frameGeo, whiteMat);
        frame.position.set(0, 0.5, 0);
        group.add(frame);

        // Engine block (black, under frame)
        var engineGeo = new THREE.BoxGeometry(0.5, 0.25, 0.6);
        var engine = new THREE.Mesh(engineGeo, blackMat);
        engine.position.set(0, 0.3, 0.1);
        group.add(engine);

        // Exhaust pipes (chrome)
        var exhaustGeo = new THREE.BoxGeometry(0.06, 0.06, 0.8);
        var exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-0.25, 0.25, 0.3);
        group.add(exhaustL);
        var exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(0.25, 0.25, 0.3);
        group.add(exhaustR);

        // Front fairing / windshield
        var fairingGeo = new THREE.BoxGeometry(0.5, 0.5, 0.3);
        var fairing = new THREE.Mesh(fairingGeo, whiteMat);
        fairing.position.set(0, 0.7, -0.65);
        group.add(fairing);

        // Windshield (transparent)
        var windshieldMat = new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4 });
        var windshieldGeo = new THREE.BoxGeometry(0.4, 0.3, 0.04);
        var windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
        windshield.position.set(0, 0.9, -0.65);
        windshield.rotation.x = -0.3;
        group.add(windshield);

        // Headlight
        var headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        var headlightGeo = new THREE.BoxGeometry(0.2, 0.15, 0.06);
        var headlight = new THREE.Mesh(headlightGeo, headlightMat);
        headlight.position.set(0, 0.55, -0.82);
        group.add(headlight);

        // Taillight
        var taillightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        var taillightGeo = new THREE.BoxGeometry(0.2, 0.08, 0.04);
        var taillight = new THREE.Mesh(taillightGeo, taillightMat);
        taillight.position.set(0, 0.5, 0.82);
        group.add(taillight);

        // Seat (black)
        var seatGeo = new THREE.BoxGeometry(0.3, 0.08, 0.6);
        var seat = new THREE.Mesh(seatGeo, blackMat);
        seat.position.set(0, 0.7, 0.15);
        group.add(seat);

        // Handlebars (chrome)
        var handleGeo = new THREE.BoxGeometry(0.7, 0.04, 0.04);
        var handlebar = new THREE.Mesh(handleGeo, chromeMat);
        handlebar.position.set(0, 0.85, -0.5);
        group.add(handlebar);

        // Front fork (chrome)
        var forkGeo = new THREE.BoxGeometry(0.04, 0.5, 0.04);
        var forkL = new THREE.Mesh(forkGeo, chromeMat);
        forkL.position.set(-0.12, 0.35, -0.7);
        forkL.rotation.x = 0.15;
        group.add(forkL);
        var forkR = new THREE.Mesh(forkGeo, chromeMat);
        forkR.position.set(0.12, 0.35, -0.7);
        forkR.rotation.x = 0.15;
        group.add(forkR);

        // Front wheel
        var wheelGeo = new THREE.BoxGeometry(0.12, 0.5, 0.5);
        var frontWheel = new THREE.Mesh(wheelGeo, blackMat);
        frontWheel.position.set(0, 0.25, -0.75);
        group.add(frontWheel);
        // Front wheel hub (chrome)
        var hubGeo = new THREE.BoxGeometry(0.14, 0.2, 0.2);
        var frontHub = new THREE.Mesh(hubGeo, chromeMat);
        frontHub.position.set(0, 0.25, -0.75);
        group.add(frontHub);

        // Rear wheel
        var rearWheel = new THREE.Mesh(wheelGeo, blackMat);
        rearWheel.position.set(0, 0.25, 0.65);
        group.add(rearWheel);
        var rearHub = new THREE.Mesh(hubGeo, chromeMat);
        rearHub.position.set(0, 0.25, 0.65);
        group.add(rearHub);

        // Rear fender
        var fenderGeo = new THREE.BoxGeometry(0.3, 0.06, 0.5);
        var rearFender = new THREE.Mesh(fenderGeo, whiteMat);
        rearFender.position.set(0, 0.52, 0.6);
        group.add(rearFender);

        // === POLICE MARKINGS ===
        // Blue stripe on side
        var stripeGeo = new THREE.BoxGeometry(0.02, 0.08, 1.2);
        var stripeMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
        var stripeL = new THREE.Mesh(stripeGeo, stripeMat);
        stripeL.position.set(-0.21, 0.55, 0);
        group.add(stripeL);
        var stripeR = new THREE.Mesh(stripeGeo, stripeMat);
        stripeR.position.set(0.21, 0.55, 0);
        group.add(stripeR);

        // === SIREN LIGHTS (on fairing) ===
        // Red light (left)
        var sirenGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        this.redLight = new THREE.Mesh(sirenGeo, redLightMat);
        this.redLight.position.set(-0.15, 0.98, -0.6);
        group.add(this.redLight);

        // Blue light (right)
        this.blueLight = new THREE.Mesh(sirenGeo, blueLightMat);
        this.blueLight.position.set(0.15, 0.98, -0.6);
        group.add(this.blueLight);

        // Light bar base
        var lightBarGeo = new THREE.BoxGeometry(0.45, 0.04, 0.12);
        var lightBar = new THREE.Mesh(lightBarGeo, blackMat);
        lightBar.position.set(0, 0.95, -0.6);
        group.add(lightBar);

        // === COP RIDER ===
        // Boots
        var bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.2);
        var leftBoot = new THREE.Mesh(bootGeo, blackMat);
        leftBoot.position.set(-0.2, 0.45, 0.1);
        group.add(leftBoot);
        var rightBoot = new THREE.Mesh(bootGeo, blackMat);
        rightBoot.position.set(0.2, 0.45, 0.1);
        group.add(rightBoot);

        // Legs (dark blue pants)
        var legGeo = new THREE.BoxGeometry(0.13, 0.35, 0.13);
        var leftLeg = new THREE.Mesh(legGeo, darkBlueMat);
        leftLeg.position.set(-0.15, 0.65, 0.15);
        leftLeg.rotation.x = -0.3;
        group.add(leftLeg);
        var rightLeg = new THREE.Mesh(legGeo, darkBlueMat);
        rightLeg.position.set(0.15, 0.65, 0.15);
        rightLeg.rotation.x = -0.3;
        group.add(rightLeg);

        // Torso (blue uniform)
        var torsoGeo = new THREE.BoxGeometry(0.35, 0.35, 0.2);
        var torso = new THREE.Mesh(torsoGeo, blueMat);
        torso.position.set(0, 1.0, 0.0);
        torso.rotation.x = -0.15;
        group.add(torso);

        // Badge
        var badgeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
        var badge = new THREE.Mesh(badgeGeo, goldMat);
        badge.position.set(-0.08, 1.05, -0.1);
        group.add(badge);

        // Arms (reaching for handlebars)
        var armGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
        var leftArm = new THREE.Mesh(armGeo, blueMat);
        leftArm.position.set(-0.25, 0.9, -0.2);
        leftArm.rotation.x = -0.6;
        group.add(leftArm);
        var rightArm = new THREE.Mesh(armGeo, blueMat);
        rightArm.position.set(0.25, 0.9, -0.2);
        rightArm.rotation.x = -0.6;
        group.add(rightArm);

        // Hands on handlebars
        var handGeo = new THREE.BoxGeometry(0.08, 0.06, 0.06);
        var leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.set(-0.3, 0.82, -0.42);
        group.add(leftHand);
        var rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.set(0.3, 0.82, -0.42);
        group.add(rightHand);

        // Head
        var headGeo = new THREE.BoxGeometry(0.25, 0.25, 0.22);
        var head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.32, -0.05);
        group.add(head);

        // Motorcycle helmet (white with visor)
        var helmetGeo = new THREE.BoxGeometry(0.3, 0.2, 0.28);
        var helmet = new THREE.Mesh(helmetGeo, whiteMat);
        helmet.position.set(0, 1.45, -0.05);
        group.add(helmet);

        // Helmet visor (dark)
        var visorGeo = new THREE.BoxGeometry(0.28, 0.1, 0.04);
        var visorMat = new THREE.MeshLambertMaterial({ color: 0x222233, transparent: true, opacity: 0.7 });
        var visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.4, -0.17);
        group.add(visor);

        // Stern mouth
        var mouthGeo = new THREE.BoxGeometry(0.08, 0.02, 0.04);
        var mouthMat = new THREE.MeshBasicMaterial({ color: 0x884444 });
        var mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 1.24, -0.12);
        group.add(mouth);

        // Mustache
        var stacheGeo = new THREE.BoxGeometry(0.1, 0.025, 0.04);
        var stacheMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
        var stache = new THREE.Mesh(stacheGeo, stacheMat);
        stache.position.set(0, 1.26, -0.12);
        group.add(stache);

        return group;
    }

    playSiren() {
        var now = Date.now();
        if (now - this.lastSirenTime < 1200) return;
        this.lastSirenTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = this.audioCtx;
            var t = ctx.currentTime;

            // Higher-pitched motorcycle siren - more urgent wail
            var osc1 = ctx.createOscillator();
            var gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(800, t);
            osc1.frequency.linearRampToValueAtTime(1200, t + 0.2);
            osc1.frequency.linearRampToValueAtTime(800, t + 0.4);
            osc1.frequency.linearRampToValueAtTime(1200, t + 0.6);
            osc1.frequency.linearRampToValueAtTime(800, t + 0.8);
            gain1.gain.setValueAtTime(0.1, t);
            gain1.gain.linearRampToValueAtTime(0.07, t + 0.4);
            gain1.gain.linearRampToValueAtTime(0.1, t + 0.6);
            gain1.gain.linearRampToValueAtTime(0, t + 1.0);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 1.1);

            // Engine rumble undertone
            var osc2 = ctx.createOscillator();
            var gain2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(80, t);
            osc2.frequency.linearRampToValueAtTime(120, t + 0.3);
            osc2.frequency.linearRampToValueAtTime(80, t + 0.6);
            gain2.gain.setValueAtTime(0.06, t);
            gain2.gain.linearRampToValueAtTime(0.03, t + 0.5);
            gain2.gain.linearRampToValueAtTime(0, t + 0.9);
            var lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(200, t);
            osc2.connect(lp);
            lp.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t);
            osc2.stop(t + 1.0);
        } catch(e) {}
    }

    playShot() {
        var now = Date.now();
        if (now - this.lastShotTime < 500) return;
        this.lastShotTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = this.audioCtx;
            var t = ctx.currentTime;

            // Pistol shot from motorcycle cop
            var bufSize = ctx.sampleRate * 0.1;
            var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
            }
            var src = ctx.createBufferSource();
            src.buffer = buf;
            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            var hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(1000, t);
            src.connect(hp);
            hp.connect(gain);
            gain.connect(ctx.destination);
            src.start(t);

            // Low thump
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
            var oGain = ctx.createGain();
            oGain.gain.setValueAtTime(0.2, t);
            oGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            osc.connect(oGain);
            oGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.1);
        } catch(e) {}
    }

    update(dt, playerPos, wantedLevel) {
        if (!this.alive) return;

        var distToPlayer = this.position.distanceTo(playerPos);
        this.sirenPhase += dt * 4;
        this.sirenLightPhase += dt * 8;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // Flashing siren lights
        if (this.redLight && this.blueLight) {
            var flash = Math.sin(this.sirenLightPhase);
            this.redLight.visible = flash > 0;
            this.blueLight.visible = flash <= 0;
        }

        // Ground following
        var groundY = this.world.getSpawnHeight(this.position.x, this.position.z);
        var groundBlock = this.world.getBlock(Math.floor(this.position.x), groundY - 1, Math.floor(this.position.z));

        // Avoid water
        var inWater = (groundBlock === BlockType.WATER || groundY <= WATER_LEVEL + 1);
        if (inWater) {
            // Steer away from water - turn hard
            this.rotation += this.steerRate * dt * 4;
            this.speed = Math.max(this.speed - this.friction * dt * 2, 3);
        }

        // Vertical physics
        if (this.position.y > groundY + 0.1) {
            this.verticalVelocity += this.gravity * dt;
            this.position.y += this.verticalVelocity * dt;
            if (this.position.y <= groundY) {
                this.position.y = groundY;
                this.verticalVelocity = 0;
                this.onGround = true;
            } else {
                this.onGround = false;
            }
        } else {
            this.position.y = groundY;
            this.verticalVelocity = 0;
            this.onGround = true;
        }

        // === STUCK DETECTION ===
        // Every 1.5 seconds, check if we've barely moved - if so, steer around obstacle
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.5) {
            var movedDist = this.position.distanceTo(this.stuckCheckPos);
            if (movedDist < 1.5 && this.speed > 1) {
                // We're stuck! Turn sharply to get around obstacle
                this.rotation += (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.6;
                this.speed = Math.max(this.speed, 5);
            }
            this.stuckCheckPos.copy(this.position);
            this.stuckTimer = 0;
        }

        // === TERRAIN LOOKAHEAD - avoid obstacles ahead ===
        if (this.speed > 2 && !inWater) {
            var lookDist = 3 + this.speed * 0.3;
            var aheadX = this.position.x - Math.sin(this.rotation) * lookDist;
            var aheadZ = this.position.z - Math.cos(this.rotation) * lookDist;
            var aheadGroundY = this.world.getSpawnHeight(aheadX, aheadZ);
            var aheadBlock = this.world.getBlock(Math.floor(aheadX), aheadGroundY - 1, Math.floor(aheadZ));
            var heightDiff = aheadGroundY - this.position.y;

            // Steer away from steep terrain, water, or big height changes
            if (aheadBlock === BlockType.WATER || aheadGroundY <= WATER_LEVEL + 1 || heightDiff > 3) {
                // Try left and right to find a clear path
                var leftAngle = this.rotation + 0.8;
                var rightAngle = this.rotation - 0.8;
                var leftX = this.position.x - Math.sin(leftAngle) * lookDist;
                var leftZ = this.position.z - Math.cos(leftAngle) * lookDist;
                var rightX = this.position.x - Math.sin(rightAngle) * lookDist;
                var rightZ = this.position.z - Math.cos(rightAngle) * lookDist;
                var leftY = this.world.getSpawnHeight(leftX, leftZ);
                var rightY = this.world.getSpawnHeight(rightX, rightZ);
                var leftBlock = this.world.getBlock(Math.floor(leftX), leftY - 1, Math.floor(leftZ));
                var rightBlock = this.world.getBlock(Math.floor(rightX), rightY - 1, Math.floor(rightZ));

                var leftClear = leftBlock !== BlockType.WATER && leftY > WATER_LEVEL + 1 && Math.abs(leftY - this.position.y) < 3;
                var rightClear = rightBlock !== BlockType.WATER && rightY > WATER_LEVEL + 1 && Math.abs(rightY - this.position.y) < 3;

                if (leftClear && !rightClear) {
                    this.rotation += this.steerRate * dt * 3;
                } else if (rightClear && !leftClear) {
                    this.rotation -= this.steerRate * dt * 3;
                } else {
                    // Both blocked or both clear - pick one
                    this.rotation += this.steerRate * dt * 3;
                }
            }
        }

        // Chase behavior - always chase when wanted level >= 1 (no distance limit)
        this.chasing = wantedLevel >= 1;

        if (this.chasing) {
            // Play siren when within audible range
            if (distToPlayer < 60) {
                this.playSiren();
            }

            // Steer toward player
            var toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
            toPlayer.y = 0;
            if (toPlayer.length() > 0.5) {
                var targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
                var angleDiff = targetAngle - this.rotation;
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // Faster steering when far away or at high speed to keep on target
                var steerMult = 1.0;
                if (distToPlayer > 30) steerMult = 1.8;
                else if (distToPlayer > 15) steerMult = 1.4;

                // Steer toward target
                var steerAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.steerRate * steerMult * dt);
                this.rotation += steerAmount;

                // Lean into turns
                this.leanAngle = -angleDiff * 0.3;
                this.leanAngle = Math.max(-0.4, Math.min(0.4, this.leanAngle));
            }

            // Accelerate toward player - faster at higher wanted levels
            var chaseSpeed = this.maxSpeed * (wantedLevel >= 5 ? 1.3 : wantedLevel >= 4 ? 1.15 : 1.0);
            if (distToPlayer > 4) {
                this.speed += this.acceleration * dt;
                if (this.speed > chaseSpeed) this.speed = chaseSpeed;
            } else {
                // Slow down when very close to circle around player
                this.speed -= this.friction * 3 * dt;
                if (this.speed < 3) this.speed = 3;
            }

            // Shoot at player when in range
            if (distToPlayer < this.attackRange && this.attackCooldown <= 0 && this.player) {
                this.player.takeDamage(this.damage);
                this.playShot();
                this.attackCooldown = this.attackInterval;
                // Create muzzle flash effect
                this.createMuzzleFlash();
            }
        } else {
            // Patrol - wander around with some speed instead of just stopping
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderDir = this.rotation + (Math.random() - 0.5) * Math.PI * 0.5;
                this.wanderTimer = 3 + Math.random() * 4;
            }

            // Gently steer toward wander direction
            var wAngleDiff = this.wanderDir - this.rotation;
            while (wAngleDiff > Math.PI) wAngleDiff -= Math.PI * 2;
            while (wAngleDiff < -Math.PI) wAngleDiff += Math.PI * 2;
            this.rotation += Math.sign(wAngleDiff) * Math.min(Math.abs(wAngleDiff), this.steerRate * 0.5 * dt);

            // Cruise at a slow patrol speed
            var patrolSpeed = 4;
            if (this.speed < patrolSpeed) {
                this.speed += this.acceleration * 0.3 * dt;
            } else {
                this.speed -= this.friction * dt;
            }
            if (this.speed < 0) this.speed = 0;
            this.leanAngle *= 0.95;
        }

        // Move in facing direction
        var moveX = -Math.sin(this.rotation) * this.speed * dt;
        var moveZ = -Math.cos(this.rotation) * this.speed * dt;
        this.position.x += moveX;
        this.position.z += moveZ;

        // Wheel spin animation
        this.wheelSpinPhase += this.speed * dt * 3;

        // Fall off world check
        if (this.position.y < -10) this.alive = false;

        // Update mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.mesh.rotation.z = this.leanAngle;

        // Slight bounce when moving fast
        if (this.speed > 5) {
            this.mesh.position.y += Math.abs(Math.sin(this.wheelSpinPhase * 2)) * 0.04;
        }
    }

    createMuzzleFlash() {
        // Brief flash at the rider's hand position
        var flashGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        var flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        var flash = new THREE.Mesh(flashGeo, flashMat);

        // Position at right hand (world space)
        var cosR = Math.cos(this.rotation);
        var sinR = Math.sin(this.rotation);
        flash.position.set(
            this.position.x + sinR * 0.3 + cosR * 0.3,
            this.position.y + 0.85,
            this.position.z + cosR * 0.3 - sinR * 0.3
        );

        this.scene.add(flash);

        var frame = 0;
        var animateFlash = function() {
            frame++;
            flashMat.opacity = Math.max(0, 0.9 - frame * 0.3);
            var s = 1 + frame * 0.3;
            flash.scale.set(s, s, s);
            if (frame < 4) {
                requestAnimationFrame(animateFlash);
            } else {
                flash.parent.remove(flash);
                flashGeo.dispose();
                flashMat.dispose();
            }
        };
        requestAnimationFrame(animateFlash);
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

window.PoliceMotorcycle = PoliceMotorcycle;
