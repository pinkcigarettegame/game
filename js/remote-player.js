// Remote player rendering - shows other players in the world
// Uses the same gangsta character model from Player class

class RemotePlayerRenderer {
    constructor(scene) {
        this.scene = scene;
        this.players = {}; // {peerId: {mesh, nameTag, data, ...}}
        this.interpSpeed = 10; // Interpolation speed
    }
    
    // Add a new remote player to the scene
    addPlayer(peerId, name) {
        if (this.players[peerId]) return; // Already exists
        
        const group = new THREE.Group();
        
        // Build the gangsta character model (scaled up 1.3x for better visibility)
        const model = this._createCharacterModel();
        model.scale.set(1.3, 1.3, 1.3);
        group.add(model);
        
        // Name tag (sprite above head - raised for scaled model)
        const nameTag = this._createNameTag(name);
        nameTag.position.set(0, 2.4, 0);
        group.add(nameTag);
        
        // Health bar above name
        const healthBar = this._createHealthBar();
        healthBar.position.set(0, 2.2, 0);
        group.add(healthBar);
        
        // Glock model (hidden by default)
        const glockModel = this._createGlockModel();
        glockModel.visible = false;
        model.add(glockModel);
        
        // Muzzle flash (hidden by default)
        const muzzleFlash = this._createMuzzleFlash();
        muzzleFlash.visible = false;
        glockModel.add(muzzleFlash);
        
        // Car model (hidden by default, shown when driving)
        const carModel = this._createSimplifiedCarModel();
        carModel.visible = false;
        group.add(carModel);
        
        group.visible = false; // Hidden until we get position data
        this.scene.add(group);
        
        this.players[peerId] = {
            group: group,
            model: model,
            carModel: carModel,
            nameTag: nameTag,
            healthBar: healthBar,
            healthBarInner: healthBar.children[1], // The green bar
            glockModel: glockModel,
            muzzleFlash: muzzleFlash,
            name: name,
            targetPosition: new THREE.Vector3(0, 30, 0),
            targetRotationY: 0,
            targetCarRotation: 0,
            currentCarRotation: 0,
            currentPosition: new THREE.Vector3(0, 30, 0),
            currentRotationY: 0,
            health: 20,
            maxHealth: 20,
            driving: false,
            glockEquipped: false,
            shooting: false,
            shootTime: 0,
            walkPhase: 0,
            lastMoveTime: Date.now(),
            visible: false
        };
    }
    
    // Remove a remote player from the scene
    removePlayer(peerId) {
        const p = this.players[peerId];
        if (!p) return;
        
        this.scene.remove(p.group);
        // Dispose geometries and materials
        p.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        
        delete this.players[peerId];
    }
    
    // Update a remote player's data
    updatePlayerData(peerId, data) {
        const p = this.players[peerId];
        if (!p) return;
        
        // Always update lastMoveTime when we receive any data
        p.lastMoveTime = Date.now();
        
        if (data.position) {
            p.targetPosition.set(data.position.x, data.position.y, data.position.z);
            if (!p.visible) {
                // First position update - snap to position
                p.currentPosition.copy(p.targetPosition);
                p.group.position.copy(p.currentPosition);
                p.group.position.y -= 1.8; // Feet on ground
                p.group.visible = true;
                p.visible = true;
            } else if (!p.group.visible) {
                // Player was hidden (e.g. by timeout) but we got new data - re-show
                p.group.visible = true;
            }
        }
        
        if (data.rotation) {
            p.targetRotationY = data.rotation.y || 0;
        }
        
        if (data.health !== undefined) {
            p.health = data.health;
            this._updateHealthBar(p);
        }
        
        if (data.driving !== undefined) {
            const wasDriving = p.driving;
            p.driving = data.driving;
            p.model.visible = !data.driving; // Hide character when driving
            p.carModel.visible = data.driving; // Show car when driving
            p.nameTag.visible = true; // Always show name
            // Raise name tag higher when driving (above car)
            if (data.driving) {
                p.nameTag.position.set(0, 3.5, 0);
                p.healthBar.position.set(0, 3.3, 0);
                // Snap car rotation on driving transition to avoid slow spin
                if (!wasDriving && data.carRotation !== undefined) {
                    p.currentCarRotation = data.carRotation;
                    p.targetCarRotation = data.carRotation;
                    p.carModel.rotation.y = data.carRotation;
                } else if (!wasDriving) {
                    // No car rotation data yet - use player's current rotation
                    p.currentCarRotation = p.currentRotationY;
                    p.targetCarRotation = p.currentRotationY;
                    p.carModel.rotation.y = p.currentRotationY;
                }
            } else {
                p.nameTag.position.set(0, 2.4, 0);
                p.healthBar.position.set(0, 2.2, 0);
            }
        }
        
        if (data.carRotation !== undefined) {
            p.targetCarRotation = data.carRotation;
            // If this is the first car rotation we receive while driving, snap to it
            if (p.driving && !p._hasReceivedCarRotation) {
                p.currentCarRotation = data.carRotation;
                p.carModel.rotation.y = data.carRotation;
                p._hasReceivedCarRotation = true;
            }
        }
        // Reset the flag when not driving
        if (!p.driving) {
            p._hasReceivedCarRotation = false;
        }
        
        // Track parked car position (when player is NOT driving, their car is parked somewhere)
        if (data.carPosition && data.carPosition.x !== undefined) {
            p.carParkedPosition = data.carPosition;
            p.carParkedRotation = data.carParkedRotation || 0;
            // Show parked car when player is on foot
            if (!p.driving) {
                p.carModel.visible = true;
                // Position the car at the parked location (relative to group)
                // The group is at the player's position, so we need to offset
                const dx = data.carPosition.x - p.currentPosition.x;
                const dy = (data.carPosition.y) - (p.currentPosition.y - 1.8); // car ground vs player group
                const dz = data.carPosition.z - p.currentPosition.z;
                p.carModel.position.set(dx, dy, dz);
                p.carModel.rotation.y = p.carParkedRotation;
                p._carIsParked = true;
            }
        } else if (!p.driving && !data.carPosition) {
            // No car position data and not driving - hide car
            if (!p._carIsParked) {
                p.carModel.visible = false;
            }
        }
        
        // When driving, reset parked car state and center car on player
        if (p.driving) {
            p._carIsParked = false;
            p.carModel.position.set(0, 1.8, 0); // Reset to centered on group
        }
        
        if (data.passengerCount !== undefined) {
            p.passengerCount = data.passengerCount;
        }
        
        if (data.glockEquipped !== undefined) {
            p.glockEquipped = data.glockEquipped;
            p.glockModel.visible = data.glockEquipped;
        }
        
        if (data.shooting) {
            p.shooting = true;
            p.shootTime = Date.now();
        }
        
        if (data.name && data.name !== p.name) {
            p.name = data.name;
            this._updateNameTag(p, data.name);
        }
    }
    
    // Update all remote players (call each frame)
    update(dt, cameraPosition) {
        const now = Date.now();
        
        for (const peerId in this.players) {
            const p = this.players[peerId];
            if (!p.visible) continue;
            
            // Smooth interpolation toward target position
            const prevPos = p.currentPosition.clone();
            p.currentPosition.lerp(p.targetPosition, Math.min(1, this.interpSpeed * dt));
            
            // Position the group (offset Y for feet on ground, or for car when driving)
            // When driving, the broadcast position is car.y + 2 (player sits in car)
            // Car model has internal Y offset of 1.8, so we need to subtract more when driving
            // to place the car on the ground: (carY + 2) - 3.8 + 1.8(internal) = carY
            const yOffset = p.driving ? 3.8 : 1.8;
            p.group.position.set(
                p.currentPosition.x,
                p.currentPosition.y - yOffset,
                p.currentPosition.z
            );
            
            // Smooth rotation interpolation
            let rotDiff = p.targetRotationY - p.currentRotationY;
            // Handle wrapping around PI
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            p.currentRotationY += rotDiff * Math.min(1, this.interpSpeed * dt);
            p.model.rotation.y = p.currentRotationY;
            
            // Car rotation interpolation (when driving)
            if (p.driving && p.carModel.visible) {
                let carRotDiff = p.targetCarRotation - p.currentCarRotation;
                while (carRotDiff > Math.PI) carRotDiff -= Math.PI * 2;
                while (carRotDiff < -Math.PI) carRotDiff += Math.PI * 2;
                p.currentCarRotation += carRotDiff * Math.min(1, this.interpSpeed * dt);
                p.carModel.rotation.y = p.currentCarRotation;
            }
            
            // Walk animation based on movement
            const moveSpeed = prevPos.distanceTo(p.currentPosition) / Math.max(dt, 0.001);
            if (moveSpeed > 0.5 && !p.driving) {
                p.walkPhase += dt * moveSpeed * 2;
                // Arm swing
                const armSwing = Math.sin(p.walkPhase) * 0.4;
                if (p.model._leftArm) p.model._leftArm.rotation.x = armSwing;
                if (p.model._rightArm) p.model._rightArm.rotation.x = -armSwing;
                // Slight body bob
                p.model.position.y = Math.abs(Math.sin(p.walkPhase * 2)) * 0.05;
            } else {
                // Idle - reset arms
                if (p.model._leftArm) p.model._leftArm.rotation.x *= 0.9;
                if (p.model._rightArm) p.model._rightArm.rotation.x *= 0.9;
                p.model.position.y *= 0.9;
            }
            
            // Muzzle flash
            if (p.shooting && now - p.shootTime < 100) {
                p.muzzleFlash.visible = true;
                p.muzzleFlash.rotation.z = Math.random() * Math.PI;
            } else {
                p.muzzleFlash.visible = false;
                p.shooting = false;
            }
            
            // Make name tag and health bar face the camera (billboard)
            if (cameraPosition) {
                p.nameTag.lookAt(cameraPosition);
                p.healthBar.lookAt(cameraPosition);
            }
            
            // Fade out players that haven't updated in a while
            // Aligned with Multiplayer.isPlayerActive() which uses 30 seconds
            const timeSinceUpdate = now - (p.lastMoveTime || now);
            if (timeSinceUpdate > 30000) {
                // 30 seconds without update - fade out
                p.group.visible = false;
            }
        }
    }
    
    // Create the gangsta character model (same as Player.createCharacterModel)
    _createCharacterModel() {
        const group = new THREE.Group();

        // Shoes
        const shoeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const shoeAccent = new THREE.MeshLambertMaterial({ color: 0xff44aa });
        const shoeGeo = new THREE.BoxGeometry(0.18, 0.1, 0.28);
        const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
        leftShoe.position.set(-0.12, 0.05, 0.02);
        group.add(leftShoe);
        const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
        rightShoe.position.set(0.12, 0.05, 0.02);
        group.add(rightShoe);
        const swooshGeo = new THREE.BoxGeometry(0.04, 0.04, 0.18);
        const leftSwoosh = new THREE.Mesh(swooshGeo, shoeAccent);
        leftSwoosh.position.set(-0.12, 0.06, 0.02);
        group.add(leftSwoosh);
        const rightSwoosh = new THREE.Mesh(swooshGeo, shoeAccent);
        rightSwoosh.position.set(0.12, 0.06, 0.02);
        group.add(rightSwoosh);

        // Legs
        const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1a1a3a });
        const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
        const leftLeg = new THREE.Mesh(legGeo, jeansMat);
        leftLeg.position.set(-0.12, 0.35, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, jeansMat);
        rightLeg.position.set(0.12, 0.35, 0);
        group.add(rightLeg);

        // Belt
        const beltMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const beltGeo = new THREE.BoxGeometry(0.42, 0.06, 0.22);
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.set(0, 0.63, 0);
        group.add(belt);

        // Torso - random color variation per player
        const hoodieColors = [0xff69b4, 0x44aaff, 0xff4444, 0x44ff88, 0xffaa00, 0xaa44ff, 0xff44ff, 0x44ffff];
        const hoodieColor = hoodieColors[Math.floor(Math.random() * hoodieColors.length)];
        const hoodieMat = new THREE.MeshLambertMaterial({ color: hoodieColor });
        const torsoGeo = new THREE.BoxGeometry(0.42, 0.45, 0.24);
        const torso = new THREE.Mesh(torsoGeo, hoodieMat);
        torso.position.set(0, 0.9, 0);
        group.add(torso);

        // Gold chain
        const chainMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const chainGeo = new THREE.BoxGeometry(0.2, 0.04, 0.02);
        const chain = new THREE.Mesh(chainGeo, chainMat);
        chain.position.set(0, 1.05, 0.13);
        group.add(chain);
        const pendantGeo = new THREE.BoxGeometry(0.08, 0.1, 0.02);
        const pendant = new THREE.Mesh(pendantGeo, chainMat);
        pendant.position.set(0, 0.97, 0.13);
        group.add(pendant);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
        const leftArm = new THREE.Mesh(armGeo, hoodieMat);
        leftArm.position.set(-0.32, 0.88, 0);
        group.add(leftArm);
        group._leftArm = leftArm;
        const rightArm = new THREE.Mesh(armGeo, hoodieMat);
        rightArm.position.set(0.32, 0.88, 0);
        group.add(rightArm);
        group._rightArm = rightArm;

        // Hands
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xc68642 });
        const handGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.set(-0.32, 0.58, 0);
        group.add(leftHand);
        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.set(0.32, 0.58, 0);
        group.add(rightHand);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.28);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.3, 0);
        group.add(head);

        // Sunglasses
        const glassesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const glassGeo = new THREE.BoxGeometry(0.32, 0.08, 0.04);
        const glasses = new THREE.Mesh(glassGeo, glassesMat);
        glasses.position.set(0, 1.33, 0.14);
        group.add(glasses);

        // Mouth
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x442222 });
        const mouthGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0.02, 1.2, 0.14);
        mouth.rotation.z = 0.1;
        group.add(mouth);

        // Durag
        const duragMat = new THREE.MeshLambertMaterial({ color: 0x440066 });
        const duragGeo = new THREE.BoxGeometry(0.32, 0.12, 0.3);
        const durag = new THREE.Mesh(duragGeo, duragMat);
        durag.position.set(0, 1.47, -0.01);
        group.add(durag);
        const tailGeo = new THREE.BoxGeometry(0.08, 0.04, 0.2);
        const tail = new THREE.Mesh(tailGeo, duragMat);
        tail.position.set(0, 1.42, -0.22);
        group.add(tail);

        // Gold rings
        const ringGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const leftRing = new THREE.Mesh(ringGeo, chainMat);
        leftRing.position.set(-0.32, 0.56, 0.04);
        group.add(leftRing);
        const rightRing = new THREE.Mesh(ringGeo, chainMat);
        rightRing.position.set(0.32, 0.56, 0.04);
        group.add(rightRing);

        return group;
    }
    
    // Create a floating name tag sprite
    _createNameTag(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(4, 4, 248, 56, 8);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)';
        ctx.lineWidth = 2;
        ctx.roundRect(4, 4, 248, 56, 8);
        ctx.stroke();
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.substring(0, 16), 128, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.5, 0.375, 1);
        sprite.renderOrder = 999;
        
        return sprite;
    }
    
    // Update name tag text
    _updateNameTag(player, name) {
        // Remove old name tag and create new one
        const oldTag = player.nameTag;
        const newTag = this._createNameTag(name);
        newTag.position.copy(oldTag.position);
        
        player.group.remove(oldTag);
        if (oldTag.material.map) oldTag.material.map.dispose();
        oldTag.material.dispose();
        
        player.group.add(newTag);
        player.nameTag = newTag;
    }
    
    // Create health bar
    _createHealthBar() {
        const group = new THREE.Group();
        
        // Background (dark)
        const bgGeo = new THREE.PlaneGeometry(0.8, 0.08);
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.renderOrder = 998;
        group.add(bg);
        
        // Health fill (green/red)
        const fillGeo = new THREE.PlaneGeometry(0.76, 0.05);
        const fillMat = new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.position.z = 0.001;
        fill.renderOrder = 999;
        group.add(fill);
        
        return group;
    }
    
    // Update health bar visual
    _updateHealthBar(player) {
        const pct = Math.max(0, player.health / player.maxHealth);
        const fill = player.healthBarInner;
        if (fill) {
            fill.scale.x = pct;
            fill.position.x = -(1 - pct) * 0.38;
            
            // Color based on health
            if (pct > 0.5) {
                fill.material.color.setHex(0x44ff44);
            } else if (pct > 0.25) {
                fill.material.color.setHex(0xffaa00);
            } else {
                fill.material.color.setHex(0xff4444);
            }
        }
    }
    
    // Create a simple glock model for remote players
    _createGlockModel() {
        const group = new THREE.Group();
        
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
        const barrel = new THREE.Mesh(barrelGeo, gunMat);
        barrel.position.set(0, 0, 0.15);
        group.add(barrel);
        
        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const grip = new THREE.Mesh(gripGeo, gunMat);
        grip.position.set(0, -0.08, -0.02);
        group.add(grip);
        
        // Position at right hand
        group.position.set(0.32, 0.65, 0.15);
        
        return group;
    }
    
    // Create muzzle flash
    _createMuzzleFlash() {
        const flashGeo = new THREE.PlaneGeometry(0.3, 0.3);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffff44,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.set(0, 0, 0.35);
        return flash;
    }
    
    // Create a simplified Dodge Challenger model for remote players driving
    _createSimplifiedCarModel() {
        const group = new THREE.Group();
        
        // Random pimp color palette (same as DodgeChallenger)
        const carColors = [
            { main: 0x8B008B, neon: 0xFF00FF },
            { main: 0x008B8B, neon: 0x00FFFF },
            { main: 0xFF1493, neon: 0xFF69B4 },
            { main: 0x4444FF, neon: 0x6666FF },
            { main: 0x32CD32, neon: 0x44FF44 },
            { main: 0xDAA520, neon: 0xFFD700 },
            { main: 0x9400D3, neon: 0xBB44FF },
            { main: 0xFF4500, neon: 0xFF6633 },
        ];
        const chosen = carColors[Math.floor(Math.random() * carColors.length)];
        
        const bodyMat = new THREE.MeshLambertMaterial({ color: chosen.main });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const goldMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        const chromeMat = new THREE.MeshLambertMaterial({ color: 0xE8E8E8 });
        const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, transparent: true, opacity: 0.4 });
        const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const neonMat = new THREE.MeshBasicMaterial({ color: chosen.neon });
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
        
        // Main body
        const bodyGeo = new THREE.BoxGeometry(2.2, 0.7, 5.0);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.65, 0);
        group.add(body);
        
        // Side panels
        const sidePanelGeo = new THREE.BoxGeometry(2.4, 0.3, 4.8);
        const sidePanel = new THREE.Mesh(sidePanelGeo, bodyMat);
        sidePanel.position.set(0, 0.45, 0);
        group.add(sidePanel);
        
        // Hood
        const hoodGeo = new THREE.BoxGeometry(2.0, 0.15, 1.8);
        const hood = new THREE.Mesh(hoodGeo, bodyMat);
        hood.position.set(0, 1.05, -1.3);
        group.add(hood);
        
        // Hood scoop
        const scoopGeo = new THREE.BoxGeometry(0.5, 0.2, 0.8);
        const scoop = new THREE.Mesh(scoopGeo, blackMat);
        scoop.position.set(0, 1.2, -1.2);
        group.add(scoop);
        
        // Trunk
        const trunkGeo = new THREE.BoxGeometry(2.0, 0.15, 1.2);
        const trunk = new THREE.Mesh(trunkGeo, bodyMat);
        trunk.position.set(0, 1.05, 1.4);
        group.add(trunk);
        
        // Spoiler
        const spoilerGeo = new THREE.BoxGeometry(2.1, 0.08, 0.3);
        const spoiler = new THREE.Mesh(spoilerGeo, goldMat);
        spoiler.position.set(0, 1.2, 2.0);
        group.add(spoiler);
        
        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2.0);
        const cabin = new THREE.Mesh(cabinGeo, bodyMat);
        cabin.position.set(0, 1.3, 0.2);
        group.add(cabin);
        
        // Roof
        const roofGeo = new THREE.BoxGeometry(1.7, 0.1, 1.8);
        const roof = new THREE.Mesh(roofGeo, bodyMat);
        roof.position.set(0, 1.65, 0.2);
        group.add(roof);
        
        // Windshield
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
        
        // Gold stripes
        const stripeGeo = new THREE.BoxGeometry(0.02, 0.08, 4.6);
        const stripeL = new THREE.Mesh(stripeGeo, goldMat);
        stripeL.position.set(-1.12, 0.7, 0);
        group.add(stripeL);
        const stripeR = new THREE.Mesh(stripeGeo, goldMat);
        stripeR.position.set(1.12, 0.7, 0);
        group.add(stripeR);
        
        // Headlights
        const headlightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
        const hlL = new THREE.Mesh(headlightGeo, headlightMat);
        hlL.position.set(-0.7, 0.65, -2.53);
        group.add(hlL);
        const hlR = new THREE.Mesh(headlightGeo, headlightMat);
        hlR.position.set(0.7, 0.65, -2.53);
        group.add(hlR);
        
        // Taillights
        const taillightGeo = new THREE.BoxGeometry(0.8, 0.15, 0.08);
        const tlL = new THREE.Mesh(taillightGeo, taillightMat);
        tlL.position.set(-0.55, 0.65, 2.53);
        group.add(tlL);
        const tlR = new THREE.Mesh(taillightGeo, taillightMat);
        tlR.position.set(0.55, 0.65, 2.53);
        group.add(tlR);
        
        // Wheels (4x)
        const wheelPositions = [
            { x: -1.05, z: -1.5 },
            { x: 1.05, z: -1.5 },
            { x: -1.05, z: 1.5 },
            { x: 1.05, z: 1.5 }
        ];
        for (const wp of wheelPositions) {
            const tireGeo = new THREE.BoxGeometry(0.35, 0.6, 0.6);
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.position.set(wp.x, 0.3, wp.z);
            group.add(tire);
            const rimGeo = new THREE.BoxGeometry(0.37, 0.4, 0.4);
            const rim = new THREE.Mesh(rimGeo, goldMat);
            rim.position.set(wp.x, 0.3, wp.z);
            group.add(rim);
        }
        
        // Neon underglow
        const neonSideGeo = new THREE.BoxGeometry(0.08, 0.06, 4.2);
        const neonL = new THREE.Mesh(neonSideGeo, neonMat);
        neonL.position.set(-1.15, 0.15, 0);
        group.add(neonL);
        const neonR = new THREE.Mesh(neonSideGeo, neonMat);
        neonR.position.set(1.15, 0.15, 0);
        group.add(neonR);
        const neonFBGeo = new THREE.BoxGeometry(2.0, 0.06, 0.08);
        const neonF = new THREE.Mesh(neonFBGeo, neonMat);
        neonF.position.set(0, 0.15, -2.3);
        group.add(neonF);
        const neonB = new THREE.Mesh(neonFBGeo, neonMat);
        neonB.position.set(0, 0.15, 2.3);
        group.add(neonB);
        
        // Ground glow
        const glowGeo = new THREE.BoxGeometry(2.0, 0.02, 4.0);
        const glowMat = new THREE.MeshBasicMaterial({ color: chosen.neon, transparent: true, opacity: 0.15 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0, 0.02, 0);
        group.add(glow);
        
        // Gold bumpers
        const bumperGeo = new THREE.BoxGeometry(2.3, 0.12, 0.15);
        const frontBumper = new THREE.Mesh(bumperGeo, goldMat);
        frontBumper.position.set(0, 0.38, -2.5);
        group.add(frontBumper);
        const rearBumper = new THREE.Mesh(bumperGeo, goldMat);
        rearBumper.position.set(0, 0.38, 2.5);
        group.add(rearBumper);
        
        // Exhaust pipes
        const exhaustGeo = new THREE.BoxGeometry(0.12, 0.12, 0.3);
        const exL = new THREE.Mesh(exhaustGeo, chromeMat);
        exL.position.set(-0.6, 0.3, 2.65);
        group.add(exL);
        const exR = new THREE.Mesh(exhaustGeo, chromeMat);
        exR.position.set(0.6, 0.3, 2.65);
        group.add(exR);
        
        // Position car so wheels sit on ground (Y offset)
        // The car's lowest point is wheels at Y=0, group is placed at player position - 1.8
        // So we need to offset the car up by about 1.8 to sit on the ground
        group.position.set(0, 1.8, 0);
        
        return group;
    }
    
    // Get count of visible remote players
    getVisibleCount() {
        let count = 0;
        for (const pid in this.players) {
            if (this.players[pid].visible) count++;
        }
        return count;
    }
    
    // Clean up all remote players
    dispose() {
        for (const pid in this.players) {
            this.removePlayer(pid);
        }
    }
}

window.RemotePlayerRenderer = RemotePlayerRenderer;
