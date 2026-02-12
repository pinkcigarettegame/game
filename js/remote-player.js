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
        
        group.visible = false; // Hidden until we get position data
        this.scene.add(group);
        
        this.players[peerId] = {
            group: group,
            model: model,
            nameTag: nameTag,
            healthBar: healthBar,
            healthBarInner: healthBar.children[1], // The green bar
            glockModel: glockModel,
            muzzleFlash: muzzleFlash,
            name: name,
            targetPosition: new THREE.Vector3(0, 30, 0),
            targetRotationY: 0,
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
        
        if (data.position) {
            p.targetPosition.set(data.position.x, data.position.y, data.position.z);
            if (!p.visible) {
                // First position update - snap to position
                p.currentPosition.copy(p.targetPosition);
                p.group.position.copy(p.currentPosition);
                p.group.position.y -= 1.8; // Feet on ground
                p.group.visible = true;
                p.visible = true;
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
            p.driving = data.driving;
            p.model.visible = !data.driving; // Hide model when driving
            p.nameTag.visible = true; // Always show name
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
            
            // Position the group (offset Y for feet)
            p.group.position.set(
                p.currentPosition.x,
                p.currentPosition.y - 1.8,
                p.currentPosition.z
            );
            
            // Smooth rotation interpolation
            let rotDiff = p.targetRotationY - p.currentRotationY;
            // Handle wrapping around PI
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            p.currentRotationY += rotDiff * Math.min(1, this.interpSpeed * dt);
            p.model.rotation.y = p.currentRotationY;
            
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
            const timeSinceUpdate = now - (p.lastMoveTime || now);
            if (timeSinceUpdate > 15000) {
                // 15 seconds without update - fade out
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
