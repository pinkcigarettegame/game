// Police Helicopter - Spawns at 5 wanted stars, relentlessly pursues the player from the air
// Hovers above the player, spotlight effect, shoots down at them

class PoliceHelicopter {
    constructor(world, scene, x, y, z, player) {
        this.world = world;
        this.scene = scene;
        this.player = player;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.alive = true;
        this.health = 40;
        this.hoverHeight = 18; // How high above the player to hover (lowered for easier crashing)
        this.speed = 0;
        this.maxSpeed = 18;
        this.acceleration = 6;

        this.chasing = false;
        this.attackRange = 30;
        this.attackCooldown = 0;
        this.attackInterval = 1.2;
        this.damage = 2;

        // Stealing mechanic
        this.stolen = false;
        this.crashed = false;
        this.crashedTimer = 0;
        this.stealable = false;

        this.rotorPhase = 0;
        this.sirenLightPhase = 0;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.tiltX = 0;
        this.tiltZ = 0;

        this.audioCtx = null;
        this.lastSirenTime = 0;
        this.lastShotTime = 0;
        this.lastRotorSoundTime = 0;

        // Spotlight
        this.spotlightMesh = null;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this.createSpotlight();
    }

    createMesh() {
        var group = new THREE.Group();

        var whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
        var blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        var darkBlueMat = new THREE.MeshLambertMaterial({ color: 0x1a1a4e });
        var blueMat = new THREE.MeshLambertMaterial({ color: 0x2a2a6e });
        var chromeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        var glassMat = new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4 });
        var redLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        var blueLightMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
        var goldMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

        // === FUSELAGE (main body) ===
        var bodyGeo = new THREE.BoxGeometry(1.8, 1.2, 3.5);
        var body = new THREE.Mesh(bodyGeo, whiteMat);
        body.position.set(0, 0, 0);
        group.add(body);

        // Blue police stripe along sides
        var stripeGeo = new THREE.BoxGeometry(0.02, 0.3, 3.0);
        var stripeMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
        var stripeL = new THREE.Mesh(stripeGeo, stripeMat);
        stripeL.position.set(-0.91, 0, 0);
        group.add(stripeL);
        var stripeR = new THREE.Mesh(stripeGeo, stripeMat);
        stripeR.position.set(0.91, 0, 0);
        group.add(stripeR);

        // "POLICE" text area (dark blue rectangle on side)
        var textGeo = new THREE.BoxGeometry(0.02, 0.25, 1.2);
        var textL = new THREE.Mesh(textGeo, darkBlueMat);
        textL.position.set(-0.92, 0.2, -0.2);
        group.add(textL);
        var textR = new THREE.Mesh(textGeo, darkBlueMat);
        textR.position.set(0.92, 0.2, -0.2);
        group.add(textR);

        // Cockpit windshield (front, angled)
        var windshieldGeo = new THREE.BoxGeometry(1.6, 0.8, 0.06);
        var windshield = new THREE.Mesh(windshieldGeo, glassMat);
        windshield.position.set(0, 0.2, -1.75);
        windshield.rotation.x = -0.3;
        group.add(windshield);

        // Side windows
        var sideWinGeo = new THREE.BoxGeometry(0.06, 0.5, 1.0);
        var sideWinL = new THREE.Mesh(sideWinGeo, glassMat);
        sideWinL.position.set(-0.91, 0.2, -0.8);
        group.add(sideWinL);
        var sideWinR = new THREE.Mesh(sideWinGeo, glassMat);
        sideWinR.position.set(0.91, 0.2, -0.8);
        group.add(sideWinR);

        // Nose (front lower)
        var noseGeo = new THREE.BoxGeometry(1.4, 0.6, 0.8);
        var nose = new THREE.Mesh(noseGeo, whiteMat);
        nose.position.set(0, -0.3, -1.8);
        group.add(nose);

        // === TAIL BOOM ===
        var tailGeo = new THREE.BoxGeometry(0.5, 0.5, 2.5);
        var tail = new THREE.Mesh(tailGeo, whiteMat);
        tail.position.set(0, 0.1, 2.8);
        group.add(tail);

        // Tail fin (vertical stabilizer)
        var finGeo = new THREE.BoxGeometry(0.08, 1.0, 0.6);
        var fin = new THREE.Mesh(finGeo, whiteMat);
        fin.position.set(0, 0.7, 3.8);
        group.add(fin);

        // Horizontal stabilizer
        var hStabGeo = new THREE.BoxGeometry(1.2, 0.08, 0.4);
        var hStab = new THREE.Mesh(hStabGeo, whiteMat);
        hStab.position.set(0, 0.3, 3.8);
        group.add(hStab);

        // Tail rotor (small)
        var tailRotorGeo = new THREE.BoxGeometry(0.06, 0.8, 0.12);
        this.tailRotor = new THREE.Mesh(tailRotorGeo, chromeMat);
        this.tailRotor.position.set(0.05, 0.7, 4.0);
        group.add(this.tailRotor);

        // === MAIN ROTOR ===
        var rotorHub = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), chromeMat);
        rotorHub.position.set(0, 0.75, 0);
        group.add(rotorHub);

        // Rotor mast
        var mastGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        var mast = new THREE.Mesh(mastGeo, chromeMat);
        mast.position.set(0, 0.9, 0);
        group.add(mast);

        // Rotor blades (will be rotated)
        this.rotorGroup = new THREE.Group();
        this.rotorGroup.position.set(0, 1.1, 0);

        var bladeGeo = new THREE.BoxGeometry(6.0, 0.04, 0.3);
        var bladeMat = new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.7 });
        var blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        this.rotorGroup.add(blade1);
        var blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.rotation.y = Math.PI / 2;
        this.rotorGroup.add(blade2);

        group.add(this.rotorGroup);

        // === LANDING SKIDS ===
        var skidGeo = new THREE.BoxGeometry(0.08, 0.08, 2.5);
        var skidL = new THREE.Mesh(skidGeo, blackMat);
        skidL.position.set(-0.7, -0.8, -0.2);
        group.add(skidL);
        var skidR = new THREE.Mesh(skidGeo, blackMat);
        skidR.position.set(0.7, -0.8, -0.2);
        group.add(skidR);

        // Skid struts
        var strutGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
        var strutFL = new THREE.Mesh(strutGeo, blackMat);
        strutFL.position.set(-0.7, -0.55, -1.0);
        group.add(strutFL);
        var strutFR = new THREE.Mesh(strutGeo, blackMat);
        strutFR.position.set(0.7, -0.55, -1.0);
        group.add(strutFR);
        var strutBL = new THREE.Mesh(strutGeo, blackMat);
        strutBL.position.set(-0.7, -0.55, 0.6);
        group.add(strutBL);
        var strutBR = new THREE.Mesh(strutGeo, blackMat);
        strutBR.position.set(0.7, -0.55, 0.6);
        group.add(strutBR);

        // === SIREN LIGHTS ===
        var sirenGeo = new THREE.BoxGeometry(0.15, 0.1, 0.15);
        this.redLight = new THREE.Mesh(sirenGeo, redLightMat);
        this.redLight.position.set(-0.4, 0.65, -0.5);
        group.add(this.redLight);

        this.blueLight = new THREE.Mesh(sirenGeo, blueLightMat);
        this.blueLight.position.set(0.4, 0.65, -0.5);
        group.add(this.blueLight);

        // Belly light bar
        var bellyBarGeo = new THREE.BoxGeometry(0.8, 0.06, 0.2);
        var bellyBar = new THREE.Mesh(bellyBarGeo, blackMat);
        bellyBar.position.set(0, -0.63, -0.5);
        group.add(bellyBar);

        // Searchlight (under nose)
        var searchGeo = new THREE.BoxGeometry(0.2, 0.15, 0.2);
        var searchMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        this.searchLight = new THREE.Mesh(searchGeo, searchMat);
        this.searchLight.position.set(0, -0.65, -1.5);
        group.add(this.searchLight);

        return group;
    }

    createSpotlight() {
        // Create a cone of light below the helicopter (visual spotlight effect)
        var coneGeo = new THREE.CylinderGeometry(0.3, 4, 20, 8, 1, true);
        var coneMat = new THREE.MeshBasicMaterial({
            color: 0xffffcc,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.spotlightMesh = new THREE.Mesh(coneGeo, coneMat);
        this.spotlightMesh.position.set(0, -10, 0);
        this.mesh.add(this.spotlightMesh);

        // Ground circle (spotlight on ground)
        var circleGeo = new THREE.BoxGeometry(8, 0.05, 8);
        var circleMat = new THREE.MeshBasicMaterial({
            color: 0xffffcc,
            transparent: true,
            opacity: 0.15,
            depthWrite: false
        });
        this.spotlightGround = new THREE.Mesh(circleGeo, circleMat);
        this.scene.add(this.spotlightGround);
    }

    playRotorSound() {
        var now = Date.now();
        if (now - this.lastRotorSoundTime < 800) return;
        this.lastRotorSoundTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = this.audioCtx;
            var t = ctx.currentTime;

            // Helicopter rotor chop - rhythmic low frequency
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(40, t);
            osc.frequency.linearRampToValueAtTime(50, t + 0.1);
            osc.frequency.linearRampToValueAtTime(40, t + 0.2);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.linearRampToValueAtTime(0.08, t + 0.15);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.3);
            gain.gain.linearRampToValueAtTime(0, t + 0.6);
            var lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(150, t);
            osc.connect(lp);
            lp.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.7);

            // Blade whoosh (noise burst)
            var bufSize = ctx.sampleRate * 0.15;
            var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
            }
            var src = ctx.createBufferSource();
            src.buffer = buf;
            var nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.06, t);
            nGain.gain.linearRampToValueAtTime(0.03, t + 0.1);
            nGain.gain.linearRampToValueAtTime(0, t + 0.3);
            var bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(300, t);
            bp.Q.setValueAtTime(1, t);
            src.connect(bp);
            bp.connect(nGain);
            nGain.connect(ctx.destination);
            src.start(t);
        } catch(e) {}
    }

    playSiren() {
        var now = Date.now();
        if (now - this.lastSirenTime < 2000) return;
        this.lastSirenTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = this.audioCtx;
            var t = ctx.currentTime;

            // Helicopter PA siren - deeper, more authoritative
            var osc1 = ctx.createOscillator();
            var gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(500, t);
            osc1.frequency.linearRampToValueAtTime(800, t + 0.4);
            osc1.frequency.linearRampToValueAtTime(500, t + 0.8);
            osc1.frequency.linearRampToValueAtTime(800, t + 1.2);
            gain1.gain.setValueAtTime(0.08, t);
            gain1.gain.linearRampToValueAtTime(0.06, t + 0.6);
            gain1.gain.linearRampToValueAtTime(0, t + 1.5);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 1.6);
        } catch(e) {}
    }

    playShot() {
        var now = Date.now();
        if (now - this.lastShotTime < 400) return;
        this.lastShotTime = now;

        try {
            if (!this.audioCtx) {
                this.audioCtx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = this.audioCtx;
            var t = ctx.currentTime;

            // Rifle shot from helicopter (sharper, louder than pistol)
            var bufSize = ctx.sampleRate * 0.12;
            var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
            }
            var src = ctx.createBufferSource();
            src.buffer = buf;
            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            var hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(800, t);
            src.connect(hp);
            hp.connect(gain);
            gain.connect(ctx.destination);
            src.start(t);

            // Bass thump
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
            var oGain = ctx.createGain();
            oGain.gain.setValueAtTime(0.25, t);
            oGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.connect(oGain);
            oGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.12);
        } catch(e) {}
    }

    update(dt, playerPos, wantedLevel) {
        if (!this.alive) return;

        var distToPlayer = this.position.distanceTo(playerPos);
        var horizontalDist = Math.sqrt(
            Math.pow(this.position.x - playerPos.x, 2) +
            Math.pow(this.position.z - playerPos.z, 2)
        );
        this.sirenLightPhase += dt * 8;
        this.rotorPhase += dt * 25; // Fast rotor spin
        this.bobPhase += dt * 1.5;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // Flashing siren lights
        if (this.redLight && this.blueLight) {
            var flash = Math.sin(this.sirenLightPhase);
            this.redLight.visible = flash > 0;
            this.blueLight.visible = flash <= 0;
        }

        // Spin main rotor
        if (this.rotorGroup) {
            this.rotorGroup.rotation.y = this.rotorPhase;
        }
        // Spin tail rotor
        if (this.tailRotor) {
            this.tailRotor.rotation.z = this.rotorPhase * 1.5;
        }

        // Always chase when wanted level >= 5 (unless stolen/crashed)
        this.chasing = wantedLevel >= 5 && !this.stolen && !this.crashed;

        // When damaged, helicopter dips lower - easier to crash into!
        var damageRatio = this.health / 40;
        var effectiveHoverHeight = this.hoverHeight * (0.4 + 0.6 * damageRatio); // At low health, hovers at ~40% of normal height
        
        // Check if helicopter is stealable (low enough and damaged enough)
        var groundY_check = this.world.getSpawnHeight(this.position.x, this.position.z);
        var heightAboveGround_check = this.position.y - groundY_check;
        this.stealable = (heightAboveGround_check < 6 || this.health <= 15) && !this.stolen;

        // Handle crashed state (helicopter on ground, stealable)
        if (this.crashed && !this.stolen) {
            this.crashedTimer += dt;
            // Crashed helicopter slowly loses rotor speed
            this.rotorPhase += dt * Math.max(2, 25 - this.crashedTimer * 3);
            if (this.rotorGroup) this.rotorGroup.rotation.y = this.rotorPhase;
            if (this.tailRotor) this.tailRotor.rotation.z = this.rotorPhase * 1.5;
            
            // Settle on ground
            var crashGroundY = this.world.getSpawnHeight(this.position.x, this.position.z);
            if (this.position.y > crashGroundY + 1.5) {
                this.velocity.y -= 8 * dt;
                this.position.y += this.velocity.y * dt;
            } else {
                this.position.y = crashGroundY + 1.5;
                this.velocity.y = 0;
                this.velocity.x *= 0.95;
                this.velocity.z *= 0.95;
            }
            this.position.x += this.velocity.x * dt;
            this.position.z += this.velocity.z * dt;
            
            // Tilt when crashed
            this.tiltX = Math.sin(this.crashedTimer * 0.5) * 0.05;
            this.tiltZ = 0.1;
            
            this.mesh.position.copy(this.position);
            this.mesh.rotation.y = this.rotation;
            this.mesh.rotation.x = this.tiltX;
            this.mesh.rotation.z = this.tiltZ;
            
            if (this.spotlightMesh) this.spotlightMesh.visible = false;
            if (this.spotlightGround) this.spotlightGround.visible = false;
            
            // Crashed helicopter disappears after 30 seconds if not stolen
            if (this.crashedTimer > 30) this.alive = false;
            return;
        }

        // If health drops very low, crash the helicopter
        if (this.health <= 5 && !this.crashed && !this.stolen) {
            this.crashed = true;
            this.crashedTimer = 0;
            this.velocity.y = -3;
            return;
        }

        if (this.chasing) {
            // Sounds
            if (distToPlayer < 80) {
                this.playRotorSound();
                this.playSiren();
            }

            // Target position: above the player (lower when damaged!)
            var targetX = playerPos.x;
            var targetZ = playerPos.z;
            var targetY = playerPos.y + effectiveHoverHeight;

            // Horizontal pursuit - move toward player position
            var dx = targetX - this.position.x;
            var dz = targetZ - this.position.z;
            var horizontalDist2 = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist2 > 2) {
                // Accelerate toward player
                var moveSpeed = this.maxSpeed;
                if (horizontalDist2 < 10) moveSpeed *= 0.5; // Slow down when close
                var dirX = dx / horizontalDist2;
                var dirZ = dz / horizontalDist2;
                this.velocity.x += dirX * this.acceleration * dt;
                this.velocity.z += dirZ * this.acceleration * dt;

                // Clamp horizontal speed
                var hSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
                if (hSpeed > moveSpeed) {
                    this.velocity.x = (this.velocity.x / hSpeed) * moveSpeed;
                    this.velocity.z = (this.velocity.z / hSpeed) * moveSpeed;
                }

                // Face movement direction
                this.rotation = Math.atan2(dx, dz);
            } else {
                // Hover in place - slow down
                this.velocity.x *= 0.95;
                this.velocity.z *= 0.95;

                // Slight circular orbit when hovering
                var orbitAngle = this.bobPhase * 0.3;
                this.velocity.x += Math.cos(orbitAngle) * 0.5 * dt;
                this.velocity.z += Math.sin(orbitAngle) * 0.5 * dt;
            }

            // Vertical - maintain hover height
            var dy = targetY - this.position.y;
            this.velocity.y += dy * 3.0 * dt;
            this.velocity.y *= 0.92; // Damping

            // Tilt based on movement (lean forward when moving)
            var targetTiltX = -this.velocity.z * 0.02;
            var targetTiltZ = this.velocity.x * 0.02;
            this.tiltX += (targetTiltX - this.tiltX) * dt * 3;
            this.tiltZ += (targetTiltZ - this.tiltZ) * dt * 3;
            this.tiltX = Math.max(-0.2, Math.min(0.2, this.tiltX));
            this.tiltZ = Math.max(-0.2, Math.min(0.2, this.tiltZ));

            // Shoot at player when in range
            if (horizontalDist < this.attackRange && this.attackCooldown <= 0 && this.player) {
                this.player.takeDamage(this.damage);
                this.playShot();
                this.attackCooldown = this.attackInterval;
                this.createMuzzleFlash();
            }
        } else {
            // Not at 5 stars - fly away / hover idle
            this.velocity.x *= 0.98;
            this.velocity.z *= 0.98;
            // Slowly ascend and drift away
            this.velocity.y += 2.0 * dt;
            this.velocity.y *= 0.95;
            this.tiltX *= 0.95;
            this.tiltZ *= 0.95;
        }

        // Apply velocity
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Don't go below ground - lower minimum when damaged for easier crashing
        var groundY = this.world.getSpawnHeight(this.position.x, this.position.z);
        var minClearance = this.health <= 15 ? 3 : (this.health <= 25 ? 5 : 8);
        if (this.position.y < groundY + minClearance) {
            this.position.y = groundY + minClearance;
            this.velocity.y = Math.max(0, this.velocity.y);
        }

        // Hover bob
        var bob = Math.sin(this.bobPhase) * 0.3;

        // Update mesh
        this.mesh.position.copy(this.position);
        this.mesh.position.y += bob;
        this.mesh.rotation.y = this.rotation;
        this.mesh.rotation.x = this.tiltX;
        this.mesh.rotation.z = this.tiltZ;

        // Update spotlight ground position
        if (this.spotlightGround) {
            this.spotlightGround.position.set(
                this.position.x,
                groundY + 0.1,
                this.position.z
            );
            // Pulse the spotlight opacity
            this.spotlightGround.material.opacity = 0.1 + Math.sin(this.bobPhase * 2) * 0.05;
            // Scale based on height
            var heightAboveGround = this.position.y - groundY;
            var spotScale = Math.max(1, heightAboveGround * 0.4);
            this.spotlightGround.scale.set(spotScale, 1, spotScale);
        }

        // Update spotlight cone visibility
        if (this.spotlightMesh) {
            this.spotlightMesh.visible = this.chasing;
        }

        // Fall off world check
        if (this.position.y < -10) this.alive = false;
    }

    createMuzzleFlash() {
        var flashGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        var flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.9 });
        var flash = new THREE.Mesh(flashGeo, flashMat);

        // Position below the helicopter
        flash.position.set(
            this.position.x,
            this.position.y - 1.0,
            this.position.z
        );

        this.scene.add(flash);

        // Also create a tracer line down toward the player
        if (this.player) {
            var tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
            var tracerMat = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.6 });
            var tracer = new THREE.Mesh(tracerGeo, tracerMat);

            var playerPos = this.player.position;
            var midX = (this.position.x + playerPos.x) / 2;
            var midY = (this.position.y - 1 + playerPos.y) / 2;
            var midZ = (this.position.z + playerPos.z) / 2;
            tracer.position.set(midX, midY, midZ);

            var dx = playerPos.x - this.position.x;
            var dy = playerPos.y - (this.position.y - 1);
            var dz = playerPos.z - this.position.z;
            var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            tracer.scale.z = len;
            tracer.lookAt(playerPos);

            this.scene.add(tracer);

            var tFrame = 0;
            var animTracer = function() {
                tFrame++;
                tracerMat.opacity = Math.max(0, 0.6 - tFrame * 0.15);
                if (tFrame < 5) {
                    requestAnimationFrame(animTracer);
                } else {
                    tracer.parent.remove(tracer);
                    tracerGeo.dispose();
                    tracerMat.dispose();
                }
            };
            requestAnimationFrame(animTracer);
        }

        var frame = 0;
        var animateFlash = function() {
            frame++;
            flashMat.opacity = Math.max(0, 0.9 - frame * 0.3);
            var s = 1 + frame * 0.4;
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
        if (this.spotlightGround) {
            this.scene.remove(this.spotlightGround);
            if (this.spotlightGround.geometry) this.spotlightGround.geometry.dispose();
            if (this.spotlightGround.material) this.spotlightGround.material.dispose();
        }
    }
}

window.PoliceHelicopter = PoliceHelicopter;
