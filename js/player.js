// Player controller with physics
class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;

        // Position and movement
        this.position = new THREE.Vector3(8, 40, 8);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { x: 0, y: 0 }; // pitch, yaw

        // Physics constants
        this.speed = 4.5;
        this.sprintSpeed = 7.0;
        this.jumpForce = 8.0;
        this.gravity = -25.0;
        this.terminalVelocity = -50;

        // Player dimensions
        this.height = 1.62; // Eye height
        this.width = 0.6;   // Collision width
        this.fullHeight = 1.8;

        // State
        this.onGround = false;
        this.sprinting = false;
        this.flying = false;
        this.inWater = false;
        this.headUnderwater = false;
        this.swimBobPhase = 0;
        this.driving = false;
        this.drivingCar = null;

        // Health
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.dead = false;
        this.damageFlash = 0; // red flash timer
        this.invulnerable = 0; // invulnerability frames after damage

        // Block interaction
        this.selectedSlot = 0;
        this.reach = 6;
        this.breakCooldown = 0;
        this.placeCooldown = 0;

        // Money spread third-person state
        this.moneySpreadActive = false;
        this.moneySpreadTimer = 0;
        this.moneySpreadDuration = 3.5; // seconds
        this.moneySpreadSpinAngle = 0;
        this.moneySpreadCamAngle = 0;
        this.moneySpreadBills3D = [];

        // Reference to stripper spawner for showing collection during money spread
        this.stripperSpawnerRef = null;

        // Third-person character model (hidden in first person)
        this.characterMesh = this.createCharacterModel();
        this.characterMesh.visible = false;
        this.world.scene.add(this.characterMesh);

        // Highlight box for targeted block
        this.highlightMesh = this.createHighlightMesh();
        this.world.scene.add(this.highlightMesh);
    }

    createCharacterModel() {
        const group = new THREE.Group();

        // === GANGSTA PLAYER CHARACTER - Pink Cigarette style ===

        // Shoes (fresh Jordans - black/pink)
        const shoeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const shoeAccent = new THREE.MeshLambertMaterial({ color: 0xff44aa });
        const shoeGeo = new THREE.BoxGeometry(0.18, 0.1, 0.28);
        const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
        leftShoe.position.set(-0.12, 0.05, 0.02);
        group.add(leftShoe);
        const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
        rightShoe.position.set(0.12, 0.05, 0.02);
        group.add(rightShoe);
        // Shoe accents (pink swoosh)
        const swooshGeo = new THREE.BoxGeometry(0.04, 0.04, 0.18);
        const leftSwoosh = new THREE.Mesh(swooshGeo, shoeAccent);
        leftSwoosh.position.set(-0.12, 0.06, 0.02);
        group.add(leftSwoosh);
        const rightSwoosh = new THREE.Mesh(swooshGeo, shoeAccent);
        rightSwoosh.position.set(0.12, 0.06, 0.02);
        group.add(rightSwoosh);

        // Legs (baggy jeans - dark denim)
        const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1a1a3a });
        const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
        const leftLeg = new THREE.Mesh(legGeo, jeansMat);
        leftLeg.position.set(-0.12, 0.35, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, jeansMat);
        rightLeg.position.set(0.12, 0.35, 0);
        group.add(rightLeg);

        // Belt (gold chain belt)
        const beltMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const beltGeo = new THREE.BoxGeometry(0.42, 0.06, 0.22);
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.set(0, 0.63, 0);
        group.add(belt);

        // Torso (oversized pink hoodie)
        const hoodieMat = new THREE.MeshLambertMaterial({ color: 0xff69b4 });
        const torsoGeo = new THREE.BoxGeometry(0.42, 0.45, 0.24);
        const torso = new THREE.Mesh(torsoGeo, hoodieMat);
        torso.position.set(0, 0.9, 0);
        group.add(torso);

        // Gold chain necklace
        const chainMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const chainGeo = new THREE.BoxGeometry(0.2, 0.04, 0.02);
        const chain = new THREE.Mesh(chainGeo, chainMat);
        chain.position.set(0, 1.05, 0.13);
        group.add(chain);
        // Chain pendant (dollar sign area)
        const pendantGeo = new THREE.BoxGeometry(0.08, 0.1, 0.02);
        const pendant = new THREE.Mesh(pendantGeo, chainMat);
        pendant.position.set(0, 0.97, 0.13);
        group.add(pendant);

        // Arms (hoodie sleeves) - stored for animation
        const armGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
        this._leftArm = new THREE.Mesh(armGeo, hoodieMat);
        this._leftArm.position.set(-0.32, 0.88, 0);
        group.add(this._leftArm);
        this._rightArm = new THREE.Mesh(armGeo, hoodieMat);
        this._rightArm.position.set(0.32, 0.88, 0);
        group.add(this._rightArm);

        // Hands (skin tone)
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xc68642 });
        const handGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        this._leftHand = new THREE.Mesh(handGeo, skinMat);
        this._leftHand.position.set(-0.32, 0.58, 0);
        group.add(this._leftHand);
        this._rightHand = new THREE.Mesh(handGeo, skinMat);
        this._rightHand.position.set(0.32, 0.58, 0);
        group.add(this._rightHand);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.28);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.3, 0);
        group.add(head);

        // Sunglasses (dark, cool)
        const glassesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const glassGeo = new THREE.BoxGeometry(0.32, 0.08, 0.04);
        const glasses = new THREE.Mesh(glassGeo, glassesMat);
        glasses.position.set(0, 1.33, 0.14);
        group.add(glasses);
        // Lens shine
        const shineMat = new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.3 });
        const shineGeo = new THREE.BoxGeometry(0.1, 0.05, 0.01);
        const leftShine = new THREE.Mesh(shineGeo, shineMat);
        leftShine.position.set(-0.07, 1.33, 0.165);
        group.add(leftShine);
        const rightShine = new THREE.Mesh(shineGeo, shineMat);
        rightShine.position.set(0.07, 1.33, 0.165);
        group.add(rightShine);

        // Mouth (smirk)
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x442222 });
        const mouthGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0.02, 1.2, 0.14);
        mouth.rotation.z = 0.1; // slight smirk angle
        group.add(mouth);

        // Durag / wave cap (dark purple)
        const duragMat = new THREE.MeshLambertMaterial({ color: 0x440066 });
        const duragGeo = new THREE.BoxGeometry(0.32, 0.12, 0.3);
        const durag = new THREE.Mesh(duragGeo, duragMat);
        durag.position.set(0, 1.47, -0.01);
        group.add(durag);
        // Durag tail (hanging back)
        const tailGeo = new THREE.BoxGeometry(0.08, 0.04, 0.2);
        const tail = new THREE.Mesh(tailGeo, duragMat);
        tail.position.set(0, 1.42, -0.22);
        group.add(tail);

        // Gold rings on hands
        const ringGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const leftRing = new THREE.Mesh(ringGeo, chainMat);
        leftRing.position.set(-0.32, 0.56, 0.04);
        group.add(leftRing);
        const rightRing = new THREE.Mesh(ringGeo, chainMat);
        rightRing.position.set(0.32, 0.56, 0.04);
        group.add(rightRing);

        return group;
    }

    // Start the money spread third-person animation
    startMoneySpread() {
        if (this.moneySpreadActive) return;
        this.moneySpreadActive = true;
        this.moneySpreadTimer = 0;
        this.moneySpreadSpinAngle = this.rotation.y;
        this.moneySpreadCamAngle = this.rotation.y + Math.PI; // Camera starts behind player
        this.moneySpreadBills3D = [];

        // Show character model
        this.characterMesh.visible = true;
        this.characterMesh.position.set(
            this.position.x,
            this.position.y - this.fullHeight,
            this.position.z
        );
        this.characterMesh.rotation.y = this.rotation.y;

        // Hide block highlight
        this.highlightMesh.visible = false;

        // Show collected strippers in a circle around the player
        this._moneySpreadStrippers = [];
        if (this.stripperSpawnerRef) {
            const playerFeetY = this.position.y - this.fullHeight;
            let idx = 0;
            for (const s of this.stripperSpawnerRef.strippers) {
                if (!s.alive || !s.collected) continue;
                s.mesh.visible = true;
                s.dancePhase = Math.random() * Math.PI * 2; // Random dance start
                this._moneySpreadStrippers.push(s);
                idx++;
            }
        }
    }

    // Update the money spread animation each frame (called from main.js)
    updateMoneySpread(dt, scene) {
        if (!this.moneySpreadActive) return false;

        this.moneySpreadTimer += dt;
        const t = this.moneySpreadTimer;
        const duration = this.moneySpreadDuration;
        const progress = t / duration;

        if (t >= duration) {
            this.endMoneySpread(scene);
            return false;
        }

        // === Character animation ===
        // Slow gangsta spin
        this.moneySpreadSpinAngle += dt * 1.8;
        this.characterMesh.rotation.y = this.moneySpreadSpinAngle;

        // Position character at player feet
        this.characterMesh.position.set(
            this.position.x,
            this.position.y - this.fullHeight,
            this.position.z
        );

        // Arms spread out and up (money fan pose)
        if (this._leftArm && this._rightArm) {
            const armSpread = Math.min(1, t * 3); // Quick spread
            const armWave = Math.sin(t * 4) * 0.15;
            // Left arm goes out and up
            this._leftArm.rotation.z = armSpread * 1.2 + armWave;
            this._leftArm.position.set(-0.32 - armSpread * 0.15, 0.88 + armSpread * 0.2, 0);
            // Right arm goes out and up
            this._rightArm.rotation.z = -(armSpread * 1.2 + armWave);
            this._rightArm.position.set(0.32 + armSpread * 0.15, 0.88 + armSpread * 0.2, 0);
            // Hands follow arms
            if (this._leftHand && this._rightHand) {
                this._leftHand.position.set(-0.32 - armSpread * 0.35, 0.58 + armSpread * 0.45, 0);
                this._rightHand.position.set(0.32 + armSpread * 0.35, 0.58 + armSpread * 0.45, 0);
            }
        }

        // === Spawn 3D dollar bills from hands ===
        if (t > 0.3 && Math.random() < 0.4) {
            this.spawn3DDollarBill(scene);
        }

        // === Update existing 3D bills ===
        for (let i = this.moneySpreadBills3D.length - 1; i >= 0; i--) {
            const bill = this.moneySpreadBills3D[i];
            bill.life += dt;
            bill.mesh.position.x += bill.vx * dt;
            bill.mesh.position.y += bill.vy * dt;
            bill.mesh.position.z += bill.vz * dt;
            bill.vy -= 2.0 * dt; // gravity on bills
            bill.mesh.rotation.x += bill.spinX * dt;
            bill.mesh.rotation.y += bill.spinY * dt;
            bill.mesh.rotation.z += bill.spinZ * dt;

            // Flutter effect
            bill.vx += Math.sin(bill.life * 5 + bill.phase) * 0.5 * dt;
            bill.vz += Math.cos(bill.life * 4 + bill.phase) * 0.5 * dt;

            // Fade out
            if (bill.life > 2.0) {
                bill.mesh.material.opacity = Math.max(0, 1 - (bill.life - 2.0) / 1.0);
            }
            if (bill.life > 3.0) {
                scene.remove(bill.mesh);
                bill.mesh.geometry.dispose();
                bill.mesh.material.dispose();
                this.moneySpreadBills3D.splice(i, 1);
            }
        }

        // === Third-person camera ===
        // Camera orbits slowly around the player
        this.moneySpreadCamAngle += dt * 0.6;
        const camDist = 5;
        const camHeight = 2.5;
        const camX = this.position.x + Math.sin(this.moneySpreadCamAngle) * camDist;
        const camZ = this.position.z + Math.cos(this.moneySpreadCamAngle) * camDist;
        const camY = this.position.y + camHeight;

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(
            this.position.x,
            this.position.y - 0.5,
            this.position.z
        );

        // === Animate collected strippers dancing in a circle ===
        if (this._moneySpreadStrippers && this._moneySpreadStrippers.length > 0) {
            const count = this._moneySpreadStrippers.length;
            const circleRadius = 2.5 + count * 0.3; // Bigger circle with more strippers
            const playerFeetY = this.position.y - this.fullHeight;
            const orbitSpeed = 0.8; // How fast they orbit

            for (let i = 0; i < count; i++) {
                const s = this._moneySpreadStrippers[i];
                if (!s.alive) continue;

                // Position in circle around player, slowly orbiting
                const baseAngle = (i / count) * Math.PI * 2;
                const orbitAngle = baseAngle + t * orbitSpeed;
                const sx = this.position.x + Math.cos(orbitAngle) * circleRadius;
                const sz = this.position.z + Math.sin(orbitAngle) * circleRadius;

                s.position.set(sx, playerFeetY, sz);
                s.mesh.position.set(sx, playerFeetY, sz);

                // Face the player (inward)
                s.mesh.rotation.y = Math.atan2(
                    this.position.x - sx,
                    this.position.z - sz
                );

                // Dance animation - bounce and sway
                s.dancePhase += dt * 4;
                const bounce = Math.abs(Math.sin(s.dancePhase * 1.5)) * 0.08;
                const sway = Math.sin(s.dancePhase) * 0.06;
                s.mesh.position.y += bounce;
                s.mesh.rotation.z = sway;
            }
        }

        return true; // Still active
    }

    spawn3DDollarBill(scene) {
        // Create a 3D green dollar bill mesh
        const billGeo = new THREE.BoxGeometry(0.4, 0.02, 0.2);
        const billMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.1 + Math.random() * 0.15, 0.5 + Math.random() * 0.3, 0.1),
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        const billMesh = new THREE.Mesh(billGeo, billMat);

        // Spawn from character's hand positions (world space)
        const isLeft = Math.random() > 0.5;
        const handOffset = isLeft ? -0.5 : 0.5;
        const sinA = Math.sin(this.moneySpreadSpinAngle);
        const cosA = Math.cos(this.moneySpreadSpinAngle);

        billMesh.position.set(
            this.position.x + cosA * handOffset,
            this.position.y - 0.5 + Math.random() * 0.5,
            this.position.z - sinA * handOffset
        );

        // Random outward velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        const bill = {
            mesh: billMesh,
            vx: Math.cos(angle) * speed,
            vy: 3 + Math.random() * 4,
            vz: Math.sin(angle) * speed,
            spinX: (Math.random() - 0.5) * 8,
            spinY: (Math.random() - 0.5) * 8,
            spinZ: (Math.random() - 0.5) * 8,
            life: 0,
            phase: Math.random() * Math.PI * 2
        };

        scene.add(billMesh);
        this.moneySpreadBills3D.push(bill);
    }

    endMoneySpread(scene) {
        this.moneySpreadActive = false;

        // Hide collected strippers again
        if (this._moneySpreadStrippers) {
            for (const s of this._moneySpreadStrippers) {
                if (s.alive && s.collected) {
                    s.mesh.visible = false;
                    s.mesh.rotation.z = 0;
                }
            }
            this._moneySpreadStrippers = [];
        }

        // Hide character model
        this.characterMesh.visible = false;

        // Reset arm positions
        if (this._leftArm) {
            this._leftArm.rotation.z = 0;
            this._leftArm.position.set(-0.32, 0.88, 0);
        }
        if (this._rightArm) {
            this._rightArm.rotation.z = 0;
            this._rightArm.position.set(0.32, 0.88, 0);
        }
        if (this._leftHand) this._leftHand.position.set(-0.32, 0.58, 0);
        if (this._rightHand) this._rightHand.position.set(0.32, 0.58, 0);

        // Clean up remaining 3D bills
        for (const bill of this.moneySpreadBills3D) {
            scene.remove(bill.mesh);
            bill.mesh.geometry.dispose();
            bill.mesh.material.dispose();
        }
        this.moneySpreadBills3D = [];

        // Restore first-person camera
        this.updateCamera();
    }

    createHighlightMesh() {
        const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        const edges = new THREE.EdgesGeometry(geo);
        const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const mesh = new THREE.LineSegments(edges, mat);
        mesh.visible = false;
        return mesh;
    }

    spawn() {
        // Force generate the spawn chunk area first
        this.world.update(this.position.x, this.position.z);
        
        const spawnY = this.world.getSpawnHeight(this.position.x, this.position.z);
        this.position.y = spawnY + 2;
        this.updateCamera();
    }

    takeDamage(amount) {
        if (this.dead || this.invulnerable > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.damageFlash = 0.5;
        this.invulnerable = 0.5;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.dead = true;
        this.health = 0;

        // Reset missions on death
        if (window.missionSystem) window.missionSystem.reset();
        // Show death screen
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) deathScreen.style.display = 'flex';
    }

    respawn() {
        this.dead = false;
        this.health = this.maxHealth;
        this.damageFlash = 0;
        this.invulnerable = 2; // 2 seconds invulnerability after respawn
        this.velocity.set(0, 0, 0);
        this.position.set(8, 40, 8);
        this.world.update(this.position.x, this.position.z);
        const spawnY = this.world.getSpawnHeight(this.position.x, this.position.z);
        this.position.y = spawnY + 2;
        this.updateCamera();
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) deathScreen.style.display = 'none';
    }

    update(dt, input) {
        if (dt > 0.1) dt = 0.1; // Cap delta time

        // Update timers
        this.damageFlash = Math.max(0, this.damageFlash - dt);
        this.invulnerable = Math.max(0, this.invulnerable - dt);

        // Don't process input if dead or driving
        if (this.dead) return;
        if (this.driving) return;

        this.breakCooldown = Math.max(0, this.breakCooldown - dt);
        this.placeCooldown = Math.max(0, this.placeCooldown - dt);

        // Mouse look
        this.rotation.y -= input.mouseDX * 0.002;
        this.rotation.x -= input.mouseDY * 0.002;
        this.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotation.x));
        input.mouseDX = 0;
        input.mouseDY = 0;

        // Sprint
        this.sprinting = input.keys['ShiftLeft'] || input.keys['ShiftRight'];

        // Movement direction
        const moveSpeed = this.sprinting ? this.sprintSpeed : this.speed;
        const forward = new THREE.Vector3(
            -Math.sin(this.rotation.y),
            0,
            -Math.cos(this.rotation.y)
        );
        const right = new THREE.Vector3(
            Math.cos(this.rotation.y),
            0,
            -Math.sin(this.rotation.y)
        );

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveDir.add(forward);
        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveDir.sub(forward);
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveDir.sub(right);
        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize().multiplyScalar(moveSpeed);
        }

        // Check if player is in water
        this.checkWaterState();

        // Apply horizontal velocity (slower in water)
        if (this.inWater) {
            const waterSpeedMult = 0.55;
            this.velocity.x = moveDir.x * waterSpeedMult;
            this.velocity.z = moveDir.z * waterSpeedMult;
        } else {
            this.velocity.x = moveDir.x;
            this.velocity.z = moveDir.z;
        }

        // Gravity and jumping
        if (!this.flying) {
            if (this.inWater) {
                // Swimming physics
                this.swimBobPhase += dt * 2.5;
                
                // Water buoyancy - gentle upward force to float near surface
                const waterGravity = -5.0;
                const buoyancy = 3.0;
                
                // Apply reduced gravity in water
                this.velocity.y += waterGravity * dt;
                
                // Buoyancy pushes player up when submerged
                const feetY = this.position.y - this.fullHeight;
                if (feetY < WATER_LEVEL) {
                    const submersionDepth = Math.min(1.0, (WATER_LEVEL - feetY) / this.fullHeight);
                    this.velocity.y += buoyancy * submersionDepth * dt * 10;
                }
                
                // Space to swim up
                if (input.keys['Space']) {
                    this.velocity.y = 4.0;
                }
                // Shift to dive down
                if (input.keys['ShiftLeft'] || input.keys['ShiftRight']) {
                    this.velocity.y = -3.5;
                }
                
                // Clamp vertical speed in water
                this.velocity.y = Math.max(-5, Math.min(5, this.velocity.y));
                
                // Water drag
                this.velocity.y *= 0.95;
                
            } else if (this.onGround) {
                // Don't accumulate gravity when on ground
                this.velocity.y = -0.5; // Small downward force to stay grounded
                
                if (input.keys['Space']) {
                    this.velocity.y = this.jumpForce;
                    this.onGround = false;
                }
            } else {
                this.velocity.y += this.gravity * dt;
                if (this.velocity.y < this.terminalVelocity) {
                    this.velocity.y = this.terminalVelocity;
                }
            }
        } else {
            this.velocity.y = 0;
            if (input.keys['Space']) this.velocity.y = moveSpeed;
            if (input.keys['ShiftLeft'] || input.keys['ShiftRight']) this.velocity.y = -moveSpeed;
        }

        // Apply movement with collision detection
        this.moveWithCollision(dt);

        // Update camera
        this.updateCamera();

        // Block highlight
        this.updateHighlight();

        // Block interaction
        if (input.mouseLeft && this.breakCooldown <= 0) {
            this.breakBlock();
            this.breakCooldown = 0.25;
        }
        if (input.mouseRight && this.placeCooldown <= 0) {
            this.placeBlock();
            this.placeCooldown = 0.25;
        }

        // Hotbar selection
        for (let i = 0; i < 8; i++) {
            if (input.keys[`Digit${i + 1}`]) {
                this.selectedSlot = i;
            }
        }
    }

    moveWithCollision(dt) {
        const stepHeight = 1.01; // Auto-step up to 1 block

        // Move X
        const oldX = this.position.x;
        this.position.x += this.velocity.x * dt;
        if (this.checkCollision()) {
            // Try auto-step: move up by stepHeight and check again
            if (this.onGround && !this.inWater) {
                this.position.y += stepHeight;
                if (!this.checkCollision()) {
                    // Step-up succeeded - snap down to ground
                    this.snapToGround();
                } else {
                    // Can't step up either - revert
                    this.position.y -= stepHeight;
                    this.position.x = oldX;
                    this.velocity.x = 0;
                }
            } else {
                this.position.x = oldX;
                this.velocity.x = 0;
            }
        }

        // Move Y
        const oldY = this.position.y;
        this.position.y += this.velocity.y * dt;
        if (this.checkCollision()) {
            if (this.velocity.y < 0) {
                // Falling down - find the correct ground position
                const feetY = this.position.y - this.fullHeight;
                const groundBlockTop = Math.floor(feetY) + 1;
                this.position.y = groundBlockTop + this.fullHeight;
                this.onGround = true;
            } else {
                // Hit ceiling
                this.position.y = oldY;
            }
            this.velocity.y = 0;
        } else {
            // Check if we're still on ground (small downward probe)
            const probeY = this.position.y;
            this.position.y -= 0.05;
            if (this.checkCollision()) {
                this.onGround = true;
            } else {
                this.onGround = false;
            }
            this.position.y = probeY;
        }

        // Move Z
        const oldZ = this.position.z;
        this.position.z += this.velocity.z * dt;
        if (this.checkCollision()) {
            // Try auto-step: move up by stepHeight and check again
            if (this.onGround && !this.inWater) {
                this.position.y += stepHeight;
                if (!this.checkCollision()) {
                    // Step-up succeeded - snap down to ground
                    this.snapToGround();
                } else {
                    // Can't step up either - revert
                    this.position.y -= stepHeight;
                    this.position.z = oldZ;
                    this.velocity.z = 0;
                }
            } else {
                this.position.z = oldZ;
                this.velocity.z = 0;
            }
        }

        // Keep above void
        if (this.position.y < -10) {
            this.position.y = 50;
            this.velocity.y = 0;
        }
    }

    snapToGround() {
        // After a step-up, snap the player down to the actual ground level
        // Probe downward to find the ground
        const maxDrop = 1.5;
        const startY = this.position.y;
        for (let probe = 0; probe < maxDrop; probe += 0.1) {
            this.position.y = startY - probe;
            if (this.checkCollision()) {
                // Found ground - position feet on top of this block
                const feetY = this.position.y - this.fullHeight;
                const groundBlockTop = Math.floor(feetY) + 1;
                this.position.y = groundBlockTop + this.fullHeight;
                this.onGround = true;
                this.velocity.y = 0;
                return;
            }
        }
        // No ground found within maxDrop - keep the stepped-up position
        this.position.y = startY;
    }

    checkCollision() {
        const hw = this.width / 2;
        const feetY = this.position.y - this.fullHeight;
        const headY = this.position.y - 0.1;

        // Non-solid blocks the player can pass through
        const passable = [BlockType.AIR, BlockType.WATER, BlockType.CIGARETTE_SMOKE, 
                          BlockType.LEAVES, BlockType.CRACK_PIPE_GLASS];

        // Check multiple points around the player
        for (let dy = feetY; dy <= headY; dy += 0.9) {
            for (let dx = -hw; dx <= hw; dx += this.width) {
                for (let dz = -hw; dz <= hw; dz += this.width) {
                    const bx = Math.floor(this.position.x + dx);
                    const by = Math.floor(dy);
                    const bz = Math.floor(this.position.z + dz);
                    const block = this.world.getBlock(bx, by, bz);
                    if (!passable.includes(block)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkWaterState() {
        // Check if feet are in water
        const feetY = this.position.y - this.fullHeight;
        const feetBlock = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(feetY),
            Math.floor(this.position.z)
        );
        // Check if body/waist is in water
        const bodyBlock = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y - this.fullHeight / 2),
            Math.floor(this.position.z)
        );
        // Check if head/eyes are in water
        const headBlock = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y),
            Math.floor(this.position.z)
        );

        this.inWater = (feetBlock === BlockType.WATER || bodyBlock === BlockType.WATER);
        this.headUnderwater = (headBlock === BlockType.WATER);
    }

    updateCamera() {
        this.camera.position.copy(this.position);
        
        // Swimming bob effect
        if (this.inWater && !this.dead) {
            const bobAmount = Math.sin(this.swimBobPhase) * 0.06;
            this.camera.position.y += bobAmount;
        }
        
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.rotation.y;
        this.camera.rotation.x = this.rotation.x;
    }

    getLookDirection() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyEuler(new THREE.Euler(this.rotation.x, this.rotation.y, 0, 'YXZ'));
        return dir;
    }

    updateHighlight() {
        const origin = this.camera.position.clone();
        const direction = this.getLookDirection();
        const hit = this.world.raycast(origin, direction, this.reach);

        if (hit) {
            this.highlightMesh.position.set(
                hit.position.x + 0.5,
                hit.position.y + 0.5,
                hit.position.z + 0.5
            );
            this.highlightMesh.visible = true;
        } else {
            this.highlightMesh.visible = false;
        }
    }

    breakBlock() {
        const origin = this.camera.position.clone();
        const direction = this.getLookDirection();
        const hit = this.world.raycast(origin, direction, this.reach);

        if (hit) {
            this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
            // Broadcast block break to multiplayer
            if (window.mp && window.mp.connected) {
                window.mp.broadcastBlockChange(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
            }
        }
    }

    placeBlock() {
        const origin = this.camera.position.clone();
        const direction = this.getLookDirection();
        const hit = this.world.raycast(origin, direction, this.reach);

        if (hit && hit.previous) {
            const blockType = HotbarBlocks[this.selectedSlot];
            
            // Don't place block inside player
            const px = Math.floor(this.position.x);
            const py = Math.floor(this.position.y);
            const pyFeet = Math.floor(this.position.y - this.fullHeight);
            const pz = Math.floor(this.position.z);
            
            if (hit.previous.x === px && hit.previous.z === pz && 
                (hit.previous.y === py || hit.previous.y === pyFeet || hit.previous.y === py - 1)) {
                return;
            }

            this.world.setBlock(hit.previous.x, hit.previous.y, hit.previous.z, blockType);
            // Broadcast block place to multiplayer
            if (window.mp && window.mp.connected) {
                window.mp.broadcastBlockChange(hit.previous.x, hit.previous.y, hit.previous.z, blockType);
            }
        }
    }
}

window.Player = Player;
