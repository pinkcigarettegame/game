// Dodge Challenger - Pimp Edition
// A pimped-out muscle car sitting on the road

class DodgeChallenger {
    constructor(scene, world, x, y, z, rotation) {
        this.scene = scene;
        this.world = world;
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = rotation || 0; // Y-axis rotation in radians
        
        // Driving state
        this.occupied = false;
        this.passengers = []; // Strippers riding in the car
        this.speed = 0;           // Current speed (blocks/sec)
        this.maxSpeed = 18;       // Max forward speed
        this.maxReverse = -6;     // Max reverse speed
        this.acceleration = 12;   // Acceleration rate
        this.brakeForce = 20;     // Braking deceleration
        this.friction = 3;        // Natural deceleration (drag)
        this.steerAngle = 0;      // Current steering angle
        this.maxSteer = 2.5;      // Max steering rate (rad/sec)
        this.wheelBase = 3.0;     // Distance between axles for turning
        
        // Drift state
        this.drifting = false;
        this.driftAngle = 0;        // Sideways slide angle offset
        this.driftMomentum = 0;      // How much sideways momentum we have
        this.driftIntensity = 0;     // 0-1 how hard we're drifting (for effects)
        this.skidMarks = [];         // Array of skid mark meshes
        this.smokeParticles = [];    // Array of active smoke particles
        this.maxSkidMarks = 200;     // Max skid marks before cleanup
        this.skidMarkTimer = 0;      // Timer for spawning skid marks
        
        // Vertical physics / suspension
        this.verticalVelocity = 0;
        this.groundY = y;           // Current ground level
        this.onGround = true;
        this.suspensionStiffness = 45;  // Spring stiffness (softer for smoother ride)
        this.suspensionDamping = 10;    // Damping factor
        this.gravity = -30;
        
        // Tilt (pitch & roll)
        this.pitch = 0;              // Current pitch angle (rotation.x)
        this.roll = 0;               // Current roll angle (rotation.z)
        this.targetPitch = 0;
        this.targetRoll = 0;
        this.tiltSmoothing = 5;      // How fast tilt interpolates (slower = less jitter)
        
        // Wheel positions in local space (relative to car center)
        this.wheelOffsets = {
            frontLeft:  { x: -1.05, z: -1.5 },
            frontRight: { x:  1.05, z: -1.5 },
            rearLeft:   { x: -1.05, z:  1.5 },
            rearRight:  { x:  1.05, z:  1.5 }
        };
        
        // Camera
        this.cameraDistance = 10;  // Distance behind car
        this.cameraHeight = 5;    // Height above car
        this.cameraLookAhead = 2; // Look slightly ahead of car
        
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.scene.add(this.mesh);
    }

    // Get distance from a position to this car
    getDistanceTo(pos) {
        return this.position.distanceTo(pos);
    }

    // Check if a point is inside the car's bounding box (rotated)
    // Returns true if the NPC position is within the car's footprint
    isPointInCarBounds(point, padding) {
        padding = padding || 0.3;
        // Car dimensions: ~2.4 wide (X), ~5.0 long (Z) in local space
        const halfWidth = 1.4 + padding;  // half of car width + padding
        const halfLength = 2.8 + padding; // half of car length + padding

        // Transform point into car's local space
        const dx = point.x - this.position.x;
        const dz = point.z - this.position.z;

        // Rotate by negative car rotation to get local coordinates
        const cosR = Math.cos(-this.rotation);
        const sinR = Math.sin(-this.rotation);
        const localX = dx * cosR - dz * sinR;
        const localZ = dx * sinR + dz * cosR;

        // Check if within bounding box and roughly same height
        const dy = Math.abs(point.y - this.position.y);
        return Math.abs(localX) < halfWidth && Math.abs(localZ) < halfLength && dy < 2.5;
    }

    // Enter the car
    enter() {
        this.occupied = true;
        this.speed = 0;
    }

    // Exit the car - returns exit position for the player
    exit() {
        this.occupied = false;
        this.speed = 0;
        // Return position to the left of the car
        const exitX = this.position.x + Math.cos(this.rotation) * 2.5;
        const exitZ = this.position.z - Math.sin(this.rotation) * 2.5;
        const exitY = this.world.getSpawnHeight(exitX, exitZ);
        
        const exitPos = new THREE.Vector3(exitX, exitY + 1.8, exitZ);
        
        // Release all passenger strippers near the player's exit position
        this.releasePassengers(exitPos);
        
        return exitPos;
    }

    // Add a stripper passenger to the car
    addPassenger(stripper) {
        stripper.inCar = true;
        stripper.hired = true; // Mark as hired - she's been paid for
        stripper.carRef = this; // Give her a reference to the car for drive-by shooting
        stripper.mesh.visible = false;
        this.passengers.push(stripper);
    }

    // Release all passengers when exiting
    // Armed strippers split: up to 2 follow the player, rest guard the car with suppressing fire
    // Unarmed strippers become collected (hidden)
    releasePassengers(exitPos) {
        const maxEscorts = 2; // Max armed strippers that follow the player
        let escortCount = 0;
        let guardIndex = 0;

        for (let i = 0; i < this.passengers.length; i++) {
            const s = this.passengers[i];
            if (!s.alive) continue;
            s.inCar = false;
            s.carRef = null;
            s.velocity.set(0, 0, 0);

            if (s.armed && escortCount < maxEscorts) {
                // Armed escort - follows the player on foot as bodyguard
                s.collected = false;
                s.guardingCar = false;
                s.guardPosition = null;
                s.guardCarRef = null;
                s.mesh.visible = true;
                s.hired = true;
                // Position near the player exit point, spread out slightly
                if (exitPos) {
                    const spreadAngle = (escortCount - 0.5) * 1.5; // Spread left/right
                    s.position.set(
                        exitPos.x + Math.cos(this.rotation + spreadAngle) * 2,
                        exitPos.y,
                        exitPos.z - Math.sin(this.rotation + spreadAngle) * 2
                    );
                }
                escortCount++;
            } else if (s.armed) {
                // Armed car guard - stays near the car providing suppressing fire
                s.collected = false;
                s.guardingCar = true;
                s.guardCarRef = this;
                s.hired = true;
                s.mesh.visible = true;
                // Position around the car in a defensive spread
                const guardAngle = (guardIndex / Math.max(1, this.passengers.length - maxEscorts)) * Math.PI * 2;
                const guardDist = 3.0; // Distance from car center
                const guardX = this.position.x + Math.cos(guardAngle) * guardDist;
                const guardZ = this.position.z + Math.sin(guardAngle) * guardDist;
                const guardY = this.world.getSpawnHeight(guardX, guardZ) + 0.5;
                s.position.set(guardX, guardY, guardZ);
                s.guardPosition = new THREE.Vector3(guardX, guardY, guardZ);
                guardIndex++;
            } else {
                // Unarmed - collected and hidden as before
                s.collected = true;
                s.guardingCar = false;
                s.guardPosition = null;
                s.guardCarRef = null;
                s.mesh.visible = false;
                if (exitPos) {
                    s.position.copy(exitPos);
                }
            }
        }
        this.passengers = [];
    }

    // Upgrade a passenger's glock to dual glocks - returns the upgraded stripper or null
    upgradePassenger() {
        for (const s of this.passengers) {
            if (s.alive && s.armed && !s.upgraded) {
                s.upgradeGlock();
                return s;
            }
        }
        return null; // All passengers already upgraded or no passengers
    }

    // Get count of passengers that can be upgraded (armed but not yet upgraded)
    getUpgradeablePassengerCount() {
        let count = 0;
        for (const s of this.passengers) {
            if (s.alive && s.armed && !s.upgraded) count++;
        }
        return count;
    }

    // Get count of upgraded passengers (dual glocks)
    getUpgradedPassengerCount() {
        let count = 0;
        for (const s of this.passengers) {
            if (s.alive && s.upgraded) count++;
        }
        return count;
    }

    // Get count of armed passengers
    getArmedPassengerCount() {
        let count = 0;
        for (const s of this.passengers) {
            if (s.alive && s.armed) count++;
        }
        return count;
    }

    // Get passenger count
    getPassengerCount() {
        return this.passengers.length;
    }

    // Get world-space position of a wheel given its local offset
    getWheelWorldPos(localX, localZ) {
        const cosR = Math.cos(this.rotation);
        const sinR = Math.sin(this.rotation);
        // Rotate local offset by car's Y rotation
        const wx = this.position.x + localX * cosR - localZ * sinR;
        const wz = this.position.z + localX * sinR + localZ * cosR;
        return { x: wx, z: wz };
    }

    // Sample ground height at all 4 wheels and compute average, pitch, and roll
    sampleWheelHeights() {
        const wo = this.wheelOffsets;
        
        const fl = this.getWheelWorldPos(wo.frontLeft.x, wo.frontLeft.z);
        const fr = this.getWheelWorldPos(wo.frontRight.x, wo.frontRight.z);
        const rl = this.getWheelWorldPos(wo.rearLeft.x, wo.rearLeft.z);
        const rr = this.getWheelWorldPos(wo.rearRight.x, wo.rearRight.z);
        
        const hFL = this.world.getSpawnHeight(fl.x, fl.z);
        const hFR = this.world.getSpawnHeight(fr.x, fr.z);
        const hRL = this.world.getSpawnHeight(rl.x, rl.z);
        const hRR = this.world.getSpawnHeight(rr.x, rr.z);
        
        // Average height of all 4 wheels
        const avgHeight = (hFL + hFR + hRL + hRR) / 4;
        
        // Pitch: difference between front and rear (positive = nose up)
        // Front wheels are at -Z in local space, rear at +Z
        const frontAvg = (hFL + hFR) / 2;
        const rearAvg = (hRL + hRR) / 2;
        const wheelBaseZ = Math.abs(wo.frontLeft.z - wo.rearLeft.z); // 3.0
        const pitchAngle = Math.atan2(rearAvg - frontAvg, wheelBaseZ);
        
        // Roll: difference between left and right (positive = left side up)
        const leftAvg = (hFL + hRL) / 2;
        const rightAvg = (hFR + hRR) / 2;
        const wheelBaseX = Math.abs(wo.frontLeft.x - wo.frontRight.x); // 2.1
        const rollAngle = Math.atan2(leftAvg - rightAvg, wheelBaseX);
        
        return {
            avgHeight: avgHeight,
            pitch: pitchAngle,
            roll: rollAngle,
            maxHeight: Math.max(hFL, hFR, hRL, hRR),
            minHeight: Math.min(hFL, hFR, hRL, hRR)
        };
    }

    // Update car physics when being driven
    updateDriving(dt, input) {
        if (!this.occupied) return;

        // Acceleration / braking
        const wKey = input.keys['KeyW'] || input.keys['ArrowUp'];
        const sKey = input.keys['KeyS'] || input.keys['ArrowDown'];
        const aKey = input.keys['KeyA'] || input.keys['ArrowLeft'];
        const dKey = input.keys['KeyD'] || input.keys['ArrowRight'];
        const brakeKey = input.keys['Space'];

        if (wKey) {
            this.speed += this.acceleration * dt;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        } else if (sKey) {
            if (this.speed > 0.5) {
                // Braking when moving forward
                this.speed -= this.brakeForce * dt;
                if (this.speed < 0) this.speed = 0;
            } else {
                // Reverse
                this.speed -= this.acceleration * 0.5 * dt;
                if (this.speed < this.maxReverse) this.speed = this.maxReverse;
            }
        } else {
            // Natural friction/drag
            if (Math.abs(this.speed) < 0.3) {
                this.speed = 0;
            } else if (this.speed > 0) {
                this.speed -= this.friction * dt;
                if (this.speed < 0) this.speed = 0;
            } else {
                this.speed += this.friction * dt;
                if (this.speed > 0) this.speed = 0;
            }
        }

        // === DRIFT / HANDBRAKE SYSTEM ===
        const wasDrifting = this.drifting;
        
        if (brakeKey && Math.abs(this.speed) > 3) {
            // Handbrake engaged at speed - initiate drift!
            this.drifting = true;
            
            // Slow down but not as aggressively as normal brake
            if (this.speed > 0) {
                this.speed -= this.brakeForce * 0.8 * dt;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += this.brakeForce * 0.8 * dt;
                if (this.speed > 0) this.speed = 0;
            }
            
            // Build drift momentum based on steering input
            const driftBuildRate = 4.0;
            if (aKey) {
                this.driftMomentum += driftBuildRate * dt;
            } else if (dKey) {
                this.driftMomentum -= driftBuildRate * dt;
            } else {
                // No steering - drift momentum carries but decays slowly
                this.driftMomentum *= (1 - 0.5 * dt);
            }
            
            // Clamp drift momentum
            const maxDriftMomentum = 2.5;
            this.driftMomentum = Math.max(-maxDriftMomentum, Math.min(maxDriftMomentum, this.driftMomentum));
            
            // Apply drift angle (rear slides out)
            this.driftAngle += this.driftMomentum * dt;
            
            // Drift intensity for visual effects (0-1)
            this.driftIntensity = Math.min(1, Math.abs(this.driftMomentum) / maxDriftMomentum * 0.7 + Math.abs(this.speed) / this.maxSpeed * 0.3);
            
        } else if (brakeKey) {
            // Normal brake at low speed
            this.drifting = false;
            if (this.speed > 0) {
                this.speed -= this.brakeForce * 1.5 * dt;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += this.brakeForce * 1.5 * dt;
                if (this.speed > 0) this.speed = 0;
            }
        } else {
            // No brake - recover from drift
            this.drifting = false;
        }
        
        // Drift recovery when not braking
        if (!this.drifting) {
            // Drift angle recovers toward 0
            this.driftAngle *= (1 - 3.0 * dt);
            if (Math.abs(this.driftAngle) < 0.01) this.driftAngle = 0;
            
            // Drift momentum decays
            this.driftMomentum *= (1 - 5.0 * dt);
            if (Math.abs(this.driftMomentum) < 0.01) this.driftMomentum = 0;
            
            // Drift intensity fades
            this.driftIntensity *= (1 - 4.0 * dt);
            if (this.driftIntensity < 0.01) this.driftIntensity = 0;
        }

        // Steering (enhanced during drift)
        if (Math.abs(this.speed) > 0.1) {
            let steerRate;
            if (this.drifting) {
                // During drift: much more responsive steering, counter-steer feel
                steerRate = this.maxSteer * 1.8;
            } else {
                steerRate = this.maxSteer * Math.min(1, 5 / (Math.abs(this.speed) + 1));
            }
            if (aKey) {
                this.rotation += steerRate * dt * Math.sign(this.speed);
            }
            if (dKey) {
                this.rotation -= steerRate * dt * Math.sign(this.speed);
            }
        }

        // Move car in its facing direction + drift sideways slide
        // Car faces -Z in local space, rotation is around Y
        const effectiveRotation = this.rotation + this.driftAngle * 0.3; // Drift offsets movement direction
        const moveX = -Math.sin(this.rotation) * this.speed * dt;
        const moveZ = -Math.cos(this.rotation) * this.speed * dt;
        
        // Add sideways slide from drift
        const slideX = Math.cos(this.rotation) * this.driftAngle * Math.abs(this.speed) * 0.15 * dt;
        const slideZ = -Math.sin(this.rotation) * this.driftAngle * Math.abs(this.speed) * 0.15 * dt;

        this.position.x += moveX + slideX;
        this.position.z += moveZ + slideZ;
        
        // === DRIFT EFFECTS (smoke + skid marks) ===
        if (this.onGround) {
            this.updateDriftEffects(dt, brakeKey);
        }

        // === TERRAIN-AWARE GROUND FOLLOWING WITH TILT ===
        
        // Sample ground at all 4 wheel positions
        const wheelData = this.sampleWheelHeights();
        // Use the higher of average or (max - 0.5) to prevent clipping through ledges
        this.groundY = Math.max(wheelData.avgHeight, wheelData.maxHeight - 0.5);
        
        // Vertical physics (suspension spring)
        const groundTarget = this.groundY;
        const heightDiff = groundTarget - this.position.y;
        
        if (this.position.y < groundTarget) {
            // Below ground - push up immediately (don't clip through terrain)
            this.position.y = groundTarget;
            if (this.verticalVelocity < 0) {
                // Landing impact - bounce proportional to impact speed
                const impactSpeed = Math.abs(this.verticalVelocity);
                if (impactSpeed > 3) {
                    // Small bounce on hard landing
                    this.verticalVelocity = impactSpeed * 0.15;
                } else {
                    this.verticalVelocity = 0;
                }
            }
            this.onGround = true;
        } else if (heightDiff > -0.3) {
            // Close to ground - apply suspension spring force
            const springForce = this.suspensionStiffness * heightDiff;
            const dampingForce = -this.suspensionDamping * this.verticalVelocity;
            this.verticalVelocity += (springForce + dampingForce) * dt;
            this.position.y += this.verticalVelocity * dt;
            this.onGround = true;
            
            // Prevent sinking below ground
            if (this.position.y < groundTarget) {
                this.position.y = groundTarget;
                if (this.verticalVelocity < 0) this.verticalVelocity = 0;
            }
        } else {
            // Airborne - apply gravity
            this.verticalVelocity += this.gravity * dt;
            this.position.y += this.verticalVelocity * dt;
            this.onGround = false;
            
            // Clamp to ground if we overshoot
            if (this.position.y < groundTarget) {
                this.position.y = groundTarget;
                const impactSpeed = Math.abs(this.verticalVelocity);
                if (impactSpeed > 3) {
                    this.verticalVelocity = impactSpeed * 0.15;
                } else {
                    this.verticalVelocity = 0;
                }
                this.onGround = true;
            }
        }
        
        // Slope effect on speed (slight slowdown uphill, speedup downhill)
        if (this.onGround && Math.abs(this.speed) > 0.5) {
            const slopeEffect = Math.sin(wheelData.pitch) * 5.0 * dt;
            // When pitch > 0 (nose up = going uphill), slow down
            // When pitch < 0 (nose down = going downhill), speed up
            if (this.speed > 0) {
                this.speed -= slopeEffect;
            } else {
                this.speed += slopeEffect;
            }
        }
        
        // === TILT INTERPOLATION ===
        // Set target pitch and roll from terrain
        this.targetPitch = wheelData.pitch;
        this.targetRoll = wheelData.roll;
        
        // Clamp max tilt angles to prevent crazy flipping
        const maxTiltAngle = 0.35; // ~20 degrees max
        this.targetPitch = Math.max(-maxTiltAngle, Math.min(maxTiltAngle, this.targetPitch));
        this.targetRoll = Math.max(-maxTiltAngle, Math.min(maxTiltAngle, this.targetRoll));
        
        // Smoothly interpolate current tilt toward target
        const tiltLerp = Math.min(1, this.tiltSmoothing * dt);
        this.pitch += (this.targetPitch - this.pitch) * tiltLerp;
        this.roll += (this.targetRoll - this.roll) * tiltLerp;
        
        // When airborne, slowly level out
        if (!this.onGround) {
            this.pitch *= (1 - 0.5 * dt);
            this.roll *= (1 - 0.5 * dt);
        }
        
        // Add drift-induced body roll (car leans into the drift)
        let driftRoll = 0;
        if (this.drifting || Math.abs(this.driftAngle) > 0.01) {
            driftRoll = -this.driftAngle * 0.12; // Lean opposite to drift direction
            driftRoll = Math.max(-0.2, Math.min(0.2, driftRoll)); // Clamp
        }

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = this.rotation + this.driftAngle * 0.15; // Visual yaw offset during drift
        this.mesh.rotation.x = this.pitch;
        this.mesh.rotation.z = this.roll + driftRoll;
    }

    // Get the ideal 3rd person camera position
    getCameraPosition() {
        // Camera behind and above the car
        const behindX = this.position.x + Math.sin(this.rotation) * this.cameraDistance;
        const behindZ = this.position.z + Math.cos(this.rotation) * this.cameraDistance;
        let camY = this.position.y + this.cameraHeight;
        
        // Adjust camera height based on pitch - when going uphill, raise camera more
        camY += Math.sin(this.pitch) * 2.0;
        
        // Ensure camera doesn't go below terrain
        const terrainY = this.world.getSpawnHeight(behindX, behindZ);
        if (camY < terrainY + 2) {
            camY = terrainY + 2;
        }
        
        return new THREE.Vector3(behindX, camY, behindZ);
    }

    // Get the point the camera should look at (slightly ahead of car)
    getCameraTarget() {
        const aheadX = this.position.x - Math.sin(this.rotation) * this.cameraLookAhead;
        const aheadZ = this.position.z - Math.cos(this.rotation) * this.cameraLookAhead;
        // Adjust look target height based on pitch for smoother hill transitions
        const pitchOffset = Math.sin(this.pitch) * 0.8;
        return new THREE.Vector3(aheadX, this.position.y + 1.2 + pitchOffset, aheadZ);
    }

    createMesh() {
        const group = new THREE.Group();

        // === COLORS - Pimp Edition ===
        // Randomize car color from a pimp palette
        const carColors = [
            { main: 0x8B008B, dark: 0x5B005B, neon: 0xFF00FF }, // Deep purple/magenta
            { main: 0x008B8B, dark: 0x005B5B, neon: 0x00FFFF }, // Cyan/teal
            { main: 0xFF1493, dark: 0xAA0066, neon: 0xFF69B4 }, // Hot pink
            { main: 0x4444FF, dark: 0x2222AA, neon: 0x6666FF }, // Electric blue
            { main: 0x32CD32, dark: 0x1E8B1E, neon: 0x44FF44 }, // Lime green
            { main: 0xDAA520, dark: 0x8B6914, neon: 0xFFD700 }, // Gold
            { main: 0x9400D3, dark: 0x5B0088, neon: 0xBB44FF }, // Dark violet
            { main: 0xFF4500, dark: 0xAA2200, neon: 0xFF6633 }, // Orange red
        ];
        const chosenColor = carColors[Math.floor(Math.random() * carColors.length)];
        const bodyColor = new THREE.MeshLambertMaterial({ color: chosenColor.main });
        const bodyColorDark = new THREE.MeshLambertMaterial({ color: chosenColor.dark });
        const chromeMat = new THREE.MeshLambertMaterial({ color: 0xE8E8E8 }); // Chrome/silver
        const goldMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold trim
        const goldMatShiny = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Bright gold
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Black
        const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Tire black
        const rimMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Gold rims!
        const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, transparent: true, opacity: 0.4 }); // Tinted windows
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc }); // Headlights
        const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1111 }); // Taillights
        const interiorMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 }); // Red leather interior
        const furMat = new THREE.MeshLambertMaterial({ color: 0xFFF0F5 }); // White fur (dashboard)
        const neonMat = new THREE.MeshBasicMaterial({ color: chosenColor.neon }); // Neon underglow (matches body)

        // === BODY - Low-rider stance ===
        // Main body (long, wide, low muscle car shape)
        const bodyGeo = new THREE.BoxGeometry(2.2, 0.7, 5.0);
        const body = new THREE.Mesh(bodyGeo, bodyColor);
        body.position.set(0, 0.65, 0);
        group.add(body);

        // Body side panels (slightly wider at bottom for muscular look)
        const sidePanelGeo = new THREE.BoxGeometry(2.4, 0.3, 4.8);
        const sidePanel = new THREE.Mesh(sidePanelGeo, bodyColorDark);
        sidePanel.position.set(0, 0.45, 0);
        group.add(sidePanel);

        // Hood (front, slightly raised for muscle car look)
        const hoodGeo = new THREE.BoxGeometry(2.0, 0.15, 1.8);
        const hood = new THREE.Mesh(hoodGeo, bodyColor);
        hood.position.set(0, 1.05, -1.3);
        group.add(hood);

        // Hood scoop (aggressive muscle car feature)
        const scoopGeo = new THREE.BoxGeometry(0.5, 0.2, 0.8);
        const scoop = new THREE.Mesh(scoopGeo, blackMat);
        scoop.position.set(0, 1.2, -1.2);
        group.add(scoop);
        // Scoop intake
        const intakeGeo = new THREE.BoxGeometry(0.35, 0.08, 0.3);
        const intake = new THREE.Mesh(intakeGeo, chromeMat);
        intake.position.set(0, 1.32, -1.1);
        group.add(intake);

        // Trunk (rear, slightly raised)
        const trunkGeo = new THREE.BoxGeometry(2.0, 0.15, 1.2);
        const trunk = new THREE.Mesh(trunkGeo, bodyColor);
        trunk.position.set(0, 1.05, 1.4);
        group.add(trunk);

        // Trunk spoiler (pimp wing)
        const spoilerGeo = new THREE.BoxGeometry(2.1, 0.08, 0.3);
        const spoiler = new THREE.Mesh(spoilerGeo, goldMat);
        spoiler.position.set(0, 1.2, 2.0);
        group.add(spoiler);
        // Spoiler supports
        const supportGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const supportL = new THREE.Mesh(supportGeo, goldMat);
        supportL.position.set(-0.8, 1.12, 2.0);
        group.add(supportL);
        const supportR = new THREE.Mesh(supportGeo, goldMat);
        supportR.position.set(0.8, 1.12, 2.0);
        group.add(supportR);

        // === CABIN / ROOF ===
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2.0);
        const cabin = new THREE.Mesh(cabinGeo, bodyColor);
        cabin.position.set(0, 1.3, 0.2);
        group.add(cabin);

        // Roof (slightly narrower)
        const roofGeo = new THREE.BoxGeometry(1.7, 0.1, 1.8);
        const roof = new THREE.Mesh(roofGeo, bodyColor);
        roof.position.set(0, 1.65, 0.2);
        group.add(roof);

        // === WINDOWS (tinted dark - pimp style) ===
        // Windshield (front, angled)
        const windshieldGeo = new THREE.BoxGeometry(1.6, 0.5, 0.08);
        const windshield = new THREE.Mesh(windshieldGeo, glassMat);
        windshield.position.set(0, 1.3, -0.75);
        windshield.rotation.x = -0.25;
        group.add(windshield);

        // Rear window
        const rearWindowGeo = new THREE.BoxGeometry(1.5, 0.4, 0.08);
        const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
        rearWindow.position.set(0, 1.3, 1.15);
        rearWindow.rotation.x = 0.2;
        group.add(rearWindow);

        // Side windows left
        const sideWindowGeo = new THREE.BoxGeometry(0.06, 0.4, 1.6);
        const leftWindow = new THREE.Mesh(sideWindowGeo, glassMat);
        leftWindow.position.set(-0.92, 1.35, 0.2);
        group.add(leftWindow);

        // Side windows right
        const rightWindow = new THREE.Mesh(sideWindowGeo, glassMat);
        rightWindow.position.set(0.92, 1.35, 0.2);
        group.add(rightWindow);

        // === GOLD TRIM (pimp details) ===
        // Gold stripe down the side
        const stripeGeo = new THREE.BoxGeometry(0.02, 0.08, 4.6);
        const stripeL = new THREE.Mesh(stripeGeo, goldMatShiny);
        stripeL.position.set(-1.12, 0.7, 0);
        group.add(stripeL);
        const stripeR = new THREE.Mesh(stripeGeo, goldMatShiny);
        stripeR.position.set(1.12, 0.7, 0);
        group.add(stripeR);

        // Gold door handles
        const handleGeo = new THREE.BoxGeometry(0.04, 0.04, 0.15);
        const handleL = new THREE.Mesh(handleGeo, goldMatShiny);
        handleL.position.set(-1.12, 0.8, 0.0);
        group.add(handleL);
        const handleR = new THREE.Mesh(handleGeo, goldMatShiny);
        handleR.position.set(1.12, 0.8, 0.0);
        group.add(handleR);

        // Gold bumper trim front
        const frontBumperGeo = new THREE.BoxGeometry(2.3, 0.12, 0.15);
        const frontBumper = new THREE.Mesh(frontBumperGeo, goldMat);
        frontBumper.position.set(0, 0.38, -2.5);
        group.add(frontBumper);

        // Gold bumper trim rear
        const rearBumper = new THREE.Mesh(frontBumperGeo, goldMat);
        rearBumper.position.set(0, 0.38, 2.5);
        group.add(rearBumper);

        // === FRONT GRILLE ===
        const grilleGeo = new THREE.BoxGeometry(1.6, 0.35, 0.1);
        const grille = new THREE.Mesh(grilleGeo, blackMat);
        grille.position.set(0, 0.6, -2.52);
        group.add(grille);

        // Grille chrome bars
        for (let i = 0; i < 5; i++) {
            const barGeo = new THREE.BoxGeometry(1.5, 0.02, 0.12);
            const bar = new THREE.Mesh(barGeo, chromeMat);
            bar.position.set(0, 0.48 + i * 0.07, -2.53);
            group.add(bar);
        }

        // === HEADLIGHTS ===
        const headlightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
        const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
        headlightL.position.set(-0.7, 0.65, -2.53);
        group.add(headlightL);
        const headlightR = new THREE.Mesh(headlightGeo, headlightMat);
        headlightR.position.set(0.7, 0.65, -2.53);
        group.add(headlightR);

        // Headlight chrome bezels
        const bezelGeo = new THREE.BoxGeometry(0.42, 0.27, 0.02);
        const bezelL = new THREE.Mesh(bezelGeo, chromeMat);
        bezelL.position.set(-0.7, 0.65, -2.55);
        group.add(bezelL);
        const bezelR = new THREE.Mesh(bezelGeo, chromeMat);
        bezelR.position.set(0.7, 0.65, -2.55);
        group.add(bezelR);

        // === TAILLIGHTS ===
        const taillightGeo = new THREE.BoxGeometry(0.8, 0.15, 0.08);
        const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
        taillightL.position.set(-0.55, 0.65, 2.53);
        group.add(taillightL);
        const taillightR = new THREE.Mesh(taillightGeo, taillightMat);
        taillightR.position.set(0.55, 0.65, 2.53);
        group.add(taillightR);

        // Taillight chrome trim
        const tailTrimGeo = new THREE.BoxGeometry(0.85, 0.2, 0.02);
        const tailTrimL = new THREE.Mesh(tailTrimGeo, chromeMat);
        tailTrimL.position.set(-0.55, 0.65, 2.55);
        group.add(tailTrimL);
        const tailTrimR = new THREE.Mesh(tailTrimGeo, chromeMat);
        tailTrimR.position.set(0.55, 0.65, 2.55);
        group.add(tailTrimR);

        // === WHEELS (Gold rims - pimp style!) ===
        const wheelPositions = [
            { x: -1.05, z: -1.5 }, // Front left
            { x: 1.05, z: -1.5 },  // Front right
            { x: -1.05, z: 1.5 },  // Rear left
            { x: 1.05, z: 1.5 }    // Rear right
        ];

        for (const wp of wheelPositions) {
            // Tire
            const tireGeo = new THREE.BoxGeometry(0.35, 0.6, 0.6);
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.position.set(wp.x, 0.3, wp.z);
            group.add(tire);

            // Gold rim (center)
            const rimGeo = new THREE.BoxGeometry(0.37, 0.4, 0.4);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.position.set(wp.x, 0.3, wp.z);
            group.add(rim);

            // Rim spokes (gold cross pattern)
            const spokeGeo1 = new THREE.BoxGeometry(0.38, 0.06, 0.5);
            const spoke1 = new THREE.Mesh(spokeGeo1, rimMat);
            spoke1.position.set(wp.x, 0.3, wp.z);
            group.add(spoke1);
            const spokeGeo2 = new THREE.BoxGeometry(0.38, 0.5, 0.06);
            const spoke2 = new THREE.Mesh(spokeGeo2, rimMat);
            spoke2.position.set(wp.x, 0.3, wp.z);
            group.add(spoke2);

            // Rim center cap (gold)
            const capGeo = new THREE.BoxGeometry(0.39, 0.15, 0.15);
            const cap = new THREE.Mesh(capGeo, goldMatShiny);
            cap.position.set(wp.x, 0.3, wp.z);
            group.add(cap);

            // Wheel well (dark arch above tire)
            const wellGeo = new THREE.BoxGeometry(0.4, 0.15, 0.7);
            const well = new THREE.Mesh(wellGeo, blackMat);
            well.position.set(wp.x, 0.6, wp.z);
            group.add(well);
        }

        // === NEON UNDERGLOW (pink/magenta - pimp essential!) ===
        const neonGeoSide = new THREE.BoxGeometry(0.08, 0.06, 4.2);
        const neonL = new THREE.Mesh(neonGeoSide, neonMat);
        neonL.position.set(-1.15, 0.15, 0);
        group.add(neonL);
        const neonR = new THREE.Mesh(neonGeoSide, neonMat);
        neonR.position.set(1.15, 0.15, 0);
        group.add(neonR);

        const neonGeoFB = new THREE.BoxGeometry(2.0, 0.06, 0.08);
        const neonF = new THREE.Mesh(neonGeoFB, neonMat);
        neonF.position.set(0, 0.15, -2.3);
        group.add(neonF);
        const neonB = new THREE.Mesh(neonGeoFB, neonMat);
        neonB.position.set(0, 0.15, 2.3);
        group.add(neonB);

        // Neon ground glow (flat plane underneath)
        const glowGeo = new THREE.BoxGeometry(2.0, 0.02, 4.0);
        const glowMat = new THREE.MeshBasicMaterial({ color: chosenColor.neon, transparent: true, opacity: 0.15 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0, 0.02, 0);
        group.add(glow);

        // === INTERIOR DETAILS ===
        // Red leather seats (visible through windows)
        const seatGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const seatFL = new THREE.Mesh(seatGeo, interiorMat);
        seatFL.position.set(-0.45, 1.05, -0.1);
        group.add(seatFL);
        const seatFR = new THREE.Mesh(seatGeo, interiorMat);
        seatFR.position.set(0.45, 1.05, -0.1);
        group.add(seatFR);

        // Fuzzy dice hanging from mirror (pimp essential!)
        const diceGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const diceMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const dice1 = new THREE.Mesh(diceGeo, diceMat);
        dice1.position.set(0, 1.35, -0.65);
        dice1.rotation.y = 0.3;
        group.add(dice1);
        const dice2 = new THREE.Mesh(diceGeo, diceMat);
        dice2.position.set(0.08, 1.28, -0.65);
        dice2.rotation.y = -0.4;
        dice2.rotation.z = 0.2;
        group.add(dice2);
        // Dice dots (black)
        const dotGeo = new THREE.BoxGeometry(0.025, 0.025, 0.005);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        // A few dots on the dice faces
        for (let d = 0; d < 3; d++) {
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(-0.02 + d * 0.02, 1.38, -0.6);
            group.add(dot);
        }
        // String for dice
        const stringGeo = new THREE.BoxGeometry(0.01, 0.15, 0.01);
        const stringMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const string = new THREE.Mesh(stringGeo, stringMat);
        string.position.set(0.04, 1.45, -0.65);
        group.add(string);

        // White fur on dashboard
        const furGeo = new THREE.BoxGeometry(1.5, 0.08, 0.4);
        const fur = new THREE.Mesh(furGeo, furMat);
        fur.position.set(0, 1.02, -0.55);
        group.add(fur);

        // Steering wheel (left side)
        const wheelGeo = new THREE.BoxGeometry(0.04, 0.3, 0.3);
        const steeringWheel = new THREE.Mesh(wheelGeo, blackMat);
        steeringWheel.position.set(-0.45, 1.15, -0.5);
        steeringWheel.rotation.x = -0.3;
        group.add(steeringWheel);
        // Gold center of steering wheel
        const swCenterGeo = new THREE.BoxGeometry(0.05, 0.1, 0.1);
        const swCenter = new THREE.Mesh(swCenterGeo, goldMatShiny);
        swCenter.position.set(-0.45, 1.15, -0.5);
        group.add(swCenter);

        // === SIDE MIRRORS (chrome) ===
        const mirrorGeo = new THREE.BoxGeometry(0.15, 0.1, 0.08);
        const mirrorL = new THREE.Mesh(mirrorGeo, chromeMat);
        mirrorL.position.set(-1.2, 1.0, -0.6);
        group.add(mirrorL);
        const mirrorR = new THREE.Mesh(mirrorGeo, chromeMat);
        mirrorR.position.set(1.2, 1.0, -0.6);
        group.add(mirrorR);

        // === EXHAUST PIPES (dual, chrome, big) ===
        const exhaustGeo = new THREE.BoxGeometry(0.12, 0.12, 0.3);
        const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-0.6, 0.3, 2.65);
        group.add(exhaustL);
        const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(0.6, 0.3, 2.65);
        group.add(exhaustR);
        // Exhaust tips (gold)
        const tipGeo = new THREE.BoxGeometry(0.14, 0.14, 0.05);
        const tipL = new THREE.Mesh(tipGeo, goldMat);
        tipL.position.set(-0.6, 0.3, 2.82);
        group.add(tipL);
        const tipR = new THREE.Mesh(tipGeo, goldMat);
        tipR.position.set(0.6, 0.3, 2.82);
        group.add(tipR);

        // === LICENSE PLATE (custom) ===
        const plateGeo = new THREE.BoxGeometry(0.5, 0.2, 0.02);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.4, 2.57);
        group.add(plate);
        // Plate text background
        const plateTextGeo = new THREE.BoxGeometry(0.4, 0.1, 0.025);
        const plateTextMat = new THREE.MeshBasicMaterial({ color: chosenColor.main });
        const plateText = new THREE.Mesh(plateTextGeo, plateTextMat);
        plateText.position.set(0, 0.4, 2.58);
        group.add(plateText);

        // Front plate
        const frontPlate = new THREE.Mesh(plateGeo, plateMat);
        frontPlate.position.set(0, 0.4, -2.57);
        group.add(frontPlate);
        const frontPlateText = new THREE.Mesh(plateTextGeo, plateTextMat);
        frontPlateText.position.set(0, 0.4, -2.58);
        group.add(frontPlateText);

        return group;
    }

    // === DRIFT EFFECTS: Tire smoke + Skid marks ===
    updateDriftEffects(dt, brakeKey) {
        const absSpeed = Math.abs(this.speed);
        const shouldSmoke = (this.drifting && absSpeed > 3) || (brakeKey && absSpeed > 6);
        
        if (!shouldSmoke) {
            this.skidMarkTimer = 0;
            return;
        }
        
        // Determine effect intensity
        const intensity = this.drifting ? this.driftIntensity : Math.min(1, (absSpeed - 6) / 12);
        
        // Timer for spawning effects (don't spawn every frame)
        this.skidMarkTimer += dt;
        const spawnInterval = this.drifting ? 0.03 : 0.05; // Faster spawn during drift
        
        if (this.skidMarkTimer >= spawnInterval) {
            this.skidMarkTimer = 0;
            
            // Get rear wheel world positions for effects
            const wo = this.wheelOffsets;
            const rlPos = this.getWheelWorldPos(wo.rearLeft.x, wo.rearLeft.z);
            const rrPos = this.getWheelWorldPos(wo.rearRight.x, wo.rearRight.z);
            const groundY = this.position.y + 0.02;
            
            // Spawn skid marks at rear wheels
            this.spawnSkidMark(rlPos.x, groundY, rlPos.z, intensity);
            this.spawnSkidMark(rrPos.x, groundY, rrPos.z, intensity);
            
            // Spawn tire smoke at rear wheels
            this.spawnTireSmoke(rlPos.x, this.position.y + 0.3, rlPos.z, intensity);
            this.spawnTireSmoke(rrPos.x, this.position.y + 0.3, rrPos.z, intensity);
            
            // Extra smoke during heavy drift
            if (this.drifting && intensity > 0.5) {
                // Spawn additional smoke puffs between the wheels
                const midX = (rlPos.x + rrPos.x) / 2;
                const midZ = (rlPos.z + rrPos.z) / 2;
                this.spawnTireSmoke(midX, this.position.y + 0.5, midZ, intensity * 0.7);
            }
        }
        
        // Play tire screech sound during drift
        if (this.drifting && intensity > 0.3) {
            this.playTireScreech(dt, intensity);
        }
    }
    
    // Spawn a single skid mark on the ground
    spawnSkidMark(x, y, z, intensity) {
        // Skid mark is a thin dark strip on the ground
        const length = 0.3 + intensity * 0.5;
        const width = 0.15 + intensity * 0.1;
        const geo = new THREE.BoxGeometry(width, 0.015, length);
        const darkness = 0.05 + Math.random() * 0.1;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(darkness, darkness, darkness),
            transparent: true,
            opacity: 0.4 + intensity * 0.4
        });
        const mark = new THREE.Mesh(geo, mat);
        mark.position.set(x, y, z);
        mark.rotation.y = this.rotation + this.driftAngle * 0.2;
        this.scene.add(mark);
        
        // Track for cleanup
        this.skidMarks.push({
            mesh: mark,
            geo: geo,
            mat: mat,
            life: 0,
            maxLife: 8 + Math.random() * 4 // Fade over 8-12 seconds
        });
        
        // Clean up old skid marks if too many
        while (this.skidMarks.length > this.maxSkidMarks) {
            const old = this.skidMarks.shift();
            this.scene.remove(old.mesh);
            old.geo.dispose();
            old.mat.dispose();
        }
        
        // Animate skid mark fade (handled in updateSkidMarks, called from animate loop)
    }
    
    // Spawn a tire smoke puff
    spawnTireSmoke(x, y, z, intensity) {
        const size = 0.4 + Math.random() * 0.8 * intensity;
        const geo = new THREE.BoxGeometry(size, size * 0.6, size);
        const brightness = 0.7 + Math.random() * 0.3;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(brightness, brightness, brightness * 0.95),
            transparent: true,
            opacity: 0.3 + intensity * 0.3
        });
        const smoke = new THREE.Mesh(geo, mat);
        smoke.position.set(
            x + (Math.random() - 0.5) * 0.5,
            y,
            z + (Math.random() - 0.5) * 0.5
        );
        smoke.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(smoke);
        
        // Animate the smoke puff rising and fading
        const startOpacity = mat.opacity;
        const vx = (Math.random() - 0.5) * 1.5;
        const vy = 1.5 + Math.random() * 2.0;
        const vz = (Math.random() - 0.5) * 1.5;
        // Add car's backward direction to smoke drift
        const carBackX = Math.sin(this.rotation) * Math.abs(this.speed) * 0.15;
        const carBackZ = Math.cos(this.rotation) * Math.abs(this.speed) * 0.15;
        let frame = 0;
        const maxFrames = 30 + Math.floor(Math.random() * 20);
        
        const animateSmoke = () => {
            frame++;
            const t = frame / maxFrames;
            
            // Rise and drift
            smoke.position.x += (vx + carBackX) * 0.016;
            smoke.position.y += vy * 0.016;
            smoke.position.z += (vz + carBackZ) * 0.016;
            
            // Slow down vertical rise
            // vy *= 0.98; // Can't reassign const, handled by natural deceleration
            
            // Expand as it rises
            const scale = 1 + t * 2.0;
            smoke.scale.set(scale, scale * 0.7, scale);
            
            // Fade out
            mat.opacity = startOpacity * (1 - t);
            
            // Slight rotation for visual variety
            smoke.rotation.y += 0.5 * 0.016;
            
            if (frame < maxFrames && mat.opacity > 0.01) {
                requestAnimationFrame(animateSmoke);
            } else {
                this.scene.remove(smoke);
                geo.dispose();
                mat.dispose();
            }
        };
        requestAnimationFrame(animateSmoke);
    }
    
    // Update skid mark fading (call this from the game loop)
    updateSkidMarks(dt) {
        for (let i = this.skidMarks.length - 1; i >= 0; i--) {
            const mark = this.skidMarks[i];
            mark.life += dt;
            
            // Start fading after half the life
            if (mark.life > mark.maxLife * 0.5) {
                const fadeProgress = (mark.life - mark.maxLife * 0.5) / (mark.maxLife * 0.5);
                mark.mat.opacity = Math.max(0, mark.mat.opacity * (1 - fadeProgress * 0.05));
            }
            
            // Remove when fully faded
            if (mark.life >= mark.maxLife) {
                this.scene.remove(mark.mesh);
                mark.geo.dispose();
                mark.mat.dispose();
                this.skidMarks.splice(i, 1);
            }
        }
    }
    
    // Tire screech sound effect
    playTireScreech(dt, intensity) {
        // Throttle sound - don't play too often
        if (!this._screechCooldown) this._screechCooldown = 0;
        this._screechCooldown -= dt;
        if (this._screechCooldown > 0) return;
        this._screechCooldown = 0.15 + Math.random() * 0.1; // Play every ~150-250ms
        
        try {
            const ctx = window.getSharedAudioCtx ? window.getSharedAudioCtx() : new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            
            // High-pitched filtered noise for tire screech
            const bufSize = Math.floor(ctx.sampleRate * (0.08 + intensity * 0.12));
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                // Mix of noise and tonal component for realistic screech
                const noise = (Math.random() * 2 - 1);
                const tone = Math.sin(i / ctx.sampleRate * Math.PI * 2 * (800 + intensity * 600)) * 0.3;
                data[i] = (noise * 0.7 + tone) * Math.exp(-i / (ctx.sampleRate * 0.06));
            }
            
            const source = ctx.createBufferSource();
            source.buffer = buf;
            
            // Bandpass filter for tire-like sound
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(1500 + intensity * 1000, t);
            bp.Q.setValueAtTime(2 + intensity * 3, t);
            
            const gain = ctx.createGain();
            const volume = 0.04 + intensity * 0.08; // Subtle but audible
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 + intensity * 0.1);
            
            source.connect(bp);
            bp.connect(gain);
            gain.connect(ctx.destination);
            source.start(t);
        } catch(e) {}
    }

    dispose() {
        // Clean up skid marks
        for (const mark of this.skidMarks) {
            this.scene.remove(mark.mesh);
            mark.geo.dispose();
            mark.mat.dispose();
        }
        this.skidMarks = [];
        
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

window.DodgeChallenger = DodgeChallenger;
