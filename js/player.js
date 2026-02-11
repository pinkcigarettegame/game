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

        // Highlight box for targeted block
        this.highlightMesh = this.createHighlightMesh();
        this.world.scene.add(this.highlightMesh);
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
        }
    }
}

window.Player = Player;
