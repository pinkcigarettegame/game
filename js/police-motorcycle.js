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

    // Get road info for a world position (which road it's on/near, road center, direction)
    getRoadInfo(wx, wz) {
        var ROAD_SPACING = 128;
        var ROAD_WIDTH = 5;

        // Z-aligned road (runs along Z, spaced along X)
        var xRoadBase = Math.round(wx / ROAD_SPACING) * ROAD_SPACING;
        var xRoadOffset = this.world.noise.noise2D(xRoadBase * 0.1, wz * 0.005) * 4;
        var xRoadCenter = xRoadBase + xRoadOffset;
        var distFromXRoad = Math.abs(wx - xRoadCenter);

        // X-aligned road (runs along X, spaced along Z)
        var zRoadBase = Math.round(wz / ROAD_SPACING) * ROAD_SPACING;
        var zRoadOffset = this.world.noise.noise2D(wx * 0.005, zRoadBase * 0.1) * 4;
        var zRoadCenter = zRoadBase + zRoadOffset;
        var distFromZRoad = Math.abs(wz - zRoadCenter);

        var onXRoad = distFromXRoad <= ROAD_WIDTH;
        var onZRoad = distFromZRoad <= ROAD_WIDTH;

        return {
            onRoad: onXRoad || onZRoad,
            onXRoad: onXRoad,
            onZRoad: onZRoad,
            isIntersection: onXRoad && onZRoad,
            xRoadCenter: xRoadCenter,
            zRoadCenter: zRoadCenter,
            distFromXRoad: distFromXRoad,
            distFromZRoad: distFromZRoad,
            nearestXRoadCenter: xRoadCenter,
            nearestZRoadCenter: zRoadCenter,
            roadSpacing: ROAD_SPACING,
            roadWidth: ROAD_WIDTH
        };
    }

    // Find the nearest road waypoint to navigate toward the player via roads
    getNextRoadWaypoint(playerPos) {
        var myRoad = this.getRoadInfo(this.position.x, this.position.z);
        var playerRoad = this.getRoadInfo(playerPos.x, playerPos.z);
        var ROAD_SPACING = 128;

        // If we're on a road and the player is close (within attack range), go direct
        var distToPlayer = this.position.distanceTo(playerPos);
        if (distToPlayer < 20) {
            return { x: playerPos.x, z: playerPos.z, direct: true };
        }

        // If we're on a road, navigate via the road network
        if (myRoad.onRoad) {
            // If at an intersection, decide which direction to go
            if (myRoad.isIntersection) {
                // At intersection: pick the road direction that gets us closer to the player
                var dx = playerPos.x - this.position.x;
                var dz = playerPos.z - this.position.z;

                // Should we go along X-road (change Z) or Z-road (change X)?
                if (Math.abs(dx) > Math.abs(dz)) {
                    // Player is more offset in X - take the Z-aligned road (runs along X... wait, Z-aligned = runs along Z)
                    // Z-aligned road changes Z position, X-aligned road changes X position
                    // We want to reduce dx, so go along X-aligned road (which runs along X axis)
                    return { x: playerPos.x, z: myRoad.zRoadCenter, direct: false };
                } else {
                    // Player is more offset in Z - take the Z-aligned road
                    return { x: myRoad.xRoadCenter, z: playerPos.z, direct: false };
                }
            }

            // On a Z-road (runs along Z axis): we can move in Z direction
            // Navigate toward the nearest intersection that gets us closer to the player
            if (myRoad.onXRoad && !myRoad.onZRoad) {
                // On X-road (runs along X): navigate along X toward player, or toward nearest Z-road intersection
                var playerDZ = playerPos.z - this.position.z;
                if (Math.abs(playerDZ) < 10) {
                    // Player is roughly on our road's Z level - just go along X toward them
                    return { x: playerPos.x, z: myRoad.zRoadCenter, direct: false };
                } else {
                    // Need to get to a Z-road to change our Z position
                    // Find the nearest Z-road intersection along our current X-road
                    var nearestZRoadX = Math.round(this.position.x / ROAD_SPACING) * ROAD_SPACING;
                    // Pick the one in the direction of the player
                    if ((playerPos.x - this.position.x) > 0 && nearestZRoadX < this.position.x) {
                        nearestZRoadX += ROAD_SPACING;
                    } else if ((playerPos.x - this.position.x) < 0 && nearestZRoadX > this.position.x) {
                        nearestZRoadX -= ROAD_SPACING;
                    }
                    return { x: nearestZRoadX, z: myRoad.zRoadCenter, direct: false };
                }
            }

            if (myRoad.onZRoad && !myRoad.onXRoad) {
                // On Z-road (runs along Z): navigate along Z toward player, or toward nearest X-road intersection
                var playerDX = playerPos.x - this.position.x;
                if (Math.abs(playerDX) < 10) {
                    // Player is roughly on our road's X level - just go along Z toward them
                    return { x: myRoad.xRoadCenter, z: playerPos.z, direct: false };
                } else {
                    // Need to get to an X-road to change our X position
                    var nearestXRoadZ = Math.round(this.position.z / ROAD_SPACING) * ROAD_SPACING;
                    if ((playerPos.z - this.position.z) > 0 && nearestXRoadZ < this.position.z) {
                        nearestXRoadZ += ROAD_SPACING;
                    } else if ((playerPos.z - this.position.z) < 0 && nearestXRoadZ > this.position.z) {
                        nearestXRoadZ -= ROAD_SPACING;
                    }
                    return { x: myRoad.xRoadCenter, z: nearestXRoadZ, direct: false };
                }
            }
        }

        // Not on a road - navigate to the nearest road first
        if (myRoad.distFromXRoad < myRoad.distFromZRoad) {
            // Nearest road is Z-aligned (at xRoadCenter)
            return { x: myRoad.xRoadCenter, z: this.position.z, direct: false };
        } else {
            // Nearest road is X-aligned (at zRoadCenter)
            return { x: this.position.x, z: myRoad.zRoadCenter, direct: false };
        }
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

        // === ROAD-AWARE HEIGHT FOLLOWING ===
        // Prefer road surface height when on/near a road for smooth riding
        var roadHeight = this.world.getRoadSurfaceHeight ? this.world.getRoadSurfaceHeight(this.position.x, this.position.z) : null;
        var groundY;
        if (roadHeight !== null) {
            groundY = roadHeight;
        } else {
            groundY = this.world.getSpawnHeight(this.position.x, this.position.z);
        }
        var groundBlock = this.world.getBlock(Math.floor(this.position.x), groundY - 1, Math.floor(this.position.z));

        // Avoid water
        var inWater = (groundBlock === BlockType.WATER || groundY <= WATER_LEVEL + 1);
        if (inWater) {
            this.rotation += this.steerRate * dt * 4;
            this.speed = Math.max(this.speed - this.friction * dt * 2, 3);
        }

        // Vertical physics - smooth height following
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
            // Smoothly interpolate to road height to avoid jerky movement
            var heightDiff = groundY - this.position.y;
            if (Math.abs(heightDiff) < 2) {
                this.position.y += heightDiff * Math.min(1, dt * 8);
            } else {
                this.position.y = groundY;
            }
            this.verticalVelocity = 0;
            this.onGround = true;
        }

        // === STUCK DETECTION ===
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.5) {
            var movedDist = this.position.distanceTo(this.stuckCheckPos);
            if (movedDist < 1.5 && this.speed > 1) {
                // Stuck! Turn sharply and boost speed
                this.rotation += (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.7;
                this.speed = Math.max(this.speed, 8);
            }
            this.stuckCheckPos.copy(this.position);
            this.stuckTimer = 0;
        }

        // Chase behavior - always chase when wanted level >= 1
        this.chasing = wantedLevel >= 1;

        if (this.chasing) {
            // Play siren when within audible range
            if (distToPlayer < 60) {
                this.playSiren();
            }

            // === ROAD-AWARE PURSUIT ===
            // Get the next waypoint to navigate toward the player via roads
            var waypoint = this.getNextRoadWaypoint(playerPos);
            var targetX = waypoint.x;
            var targetZ = waypoint.z;

            // Steer toward the waypoint
            var toTarget = new THREE.Vector3(targetX - this.position.x, 0, targetZ - this.position.z);
            var targetDist = toTarget.length();

            if (targetDist > 0.5) {
                var targetAngle = Math.atan2(toTarget.x, toTarget.z);
                var angleDiff = targetAngle - this.rotation;
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // Steering multiplier - steer faster when angle is large or at intersections
                var steerMult = 1.5;
                if (Math.abs(angleDiff) > Math.PI * 0.3) steerMult = 3.0; // Sharp turn needed (intersection)
                else if (distToPlayer > 30) steerMult = 2.0;

                var steerAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.steerRate * steerMult * dt);
                this.rotation += steerAmount;

                // Lean into turns
                this.leanAngle = -angleDiff * 0.3;
                this.leanAngle = Math.max(-0.4, Math.min(0.4, this.leanAngle));
            }

            // Speed control - slow down for sharp turns, speed up on straights
            var chaseSpeed = this.maxSpeed * (wantedLevel >= 5 ? 1.3 : wantedLevel >= 4 ? 1.15 : 1.0);
            var toTargetAngle = Math.atan2(toTarget.x, toTarget.z);
            var facingDiff = Math.abs(toTargetAngle - this.rotation);
            while (facingDiff > Math.PI) facingDiff = Math.PI * 2 - facingDiff;

            if (distToPlayer > 4) {
                // Slow down for sharp turns (like at intersections)
                if (facingDiff > Math.PI * 0.3) {
                    // Sharp turn - slow down
                    var turnSpeed = chaseSpeed * 0.4;
                    if (this.speed > turnSpeed) {
                        this.speed -= this.friction * 4 * dt;
                    } else {
                        this.speed += this.acceleration * 0.5 * dt;
                    }
                    if (this.speed < 3) this.speed = 3;
                } else {
                    // Mostly straight - full speed
                    this.speed += this.acceleration * dt;
                    if (this.speed > chaseSpeed) this.speed = chaseSpeed;
                }
            } else {
                // Very close to player - slow down to circle
                this.speed -= this.friction * 3 * dt;
                if (this.speed < 3) this.speed = 3;
            }

            // Shoot at player when in range
            if (distToPlayer < this.attackRange && this.attackCooldown <= 0 && this.player) {
                this.player.takeDamage(this.damage);
                this.playShot();
                this.attackCooldown = this.attackInterval;
                this.createMuzzleFlash();
            }
        } else {
            // Patrol - wander along roads
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                // Pick a new wander direction along the current road
                var myRoad = this.getRoadInfo(this.position.x, this.position.z);
                if (myRoad.onXRoad) {
                    // On X-road: wander along X axis
                    this.wanderDir = (Math.random() > 0.5) ? 0 : Math.PI;
                } else if (myRoad.onZRoad) {
                    // On Z-road: wander along Z axis
                    this.wanderDir = (Math.random() > 0.5) ? Math.PI * 0.5 : -Math.PI * 0.5;
                } else {
                    this.wanderDir = this.rotation + (Math.random() - 0.5) * Math.PI * 0.5;
                }
                this.wanderTimer = 3 + Math.random() * 4;
            }

            var wAngleDiff = this.wanderDir - this.rotation;
            while (wAngleDiff > Math.PI) wAngleDiff -= Math.PI * 2;
            while (wAngleDiff < -Math.PI) wAngleDiff += Math.PI * 2;
            this.rotation += Math.sign(wAngleDiff) * Math.min(Math.abs(wAngleDiff), this.steerRate * 0.5 * dt);

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
