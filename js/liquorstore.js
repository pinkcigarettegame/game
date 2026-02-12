// Crypto-Themed Liquor Store - Building + Shop System
// Part A: LiquorStore class and building construction

class LiquorStore {
    constructor(scene, world, x, y, z, rotation) {
        this.scene = scene;
        this.world = world;
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = rotation || 0; // Rotation in radians (0 = front faces +Z, PI/2 = front faces +X, etc.)
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this.group.rotation.y = this.rotation;
        this.alive = true;
        this.shopOpen = false;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.neonObjects = []; // Objects that glow/pulse
        this.audioCtx = null;

        // Building dimensions
        this.width = 10;
        this.depth = 8;
        this.wallHeight = 6;

        // Calculate the road edge height so parking lot is flush with road
        this.roadEdgeHeight = this.calculateRoadEdgeHeight();

        this.clearArea();
        this.createParkingLot();
        this.createBuilding();
        this.createSigns();
        this.createInterior();
        this.scene.add(this.group);
    }

    calculateRoadEdgeHeight() {
        // Find the world position of the road edge (just past the parking lot)
        // BUILDING_SETBACK=15, road half-width=5, so road edge is at local Z=10
        const wx = Math.floor(this.position.x);
        const wz = Math.floor(this.position.z);
        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        // Sample the road height at the road edge (local Z = 10)
        const roadEdgeLocalZ = 10;
        const roadEdgeWX = wx + Math.round(roadEdgeLocalZ * sinR);
        const roadEdgeWZ = wz + Math.round(roadEdgeLocalZ * cosR);

        // Use the world's road height calculation
        const roadHeight = this.world.getNearestRoadEdgeHeight(roadEdgeWX, roadEdgeWZ);
        if (roadHeight !== null && roadHeight !== undefined) {
            return roadHeight;
        }
        // Fallback: use the store's own Y position
        return Math.floor(this.position.y);
    }

    clearArea() {
        // Clear all blocks (cigarettes, trees, crack pipes, etc.) around the store
        // and flatten the terrain to create a clean parking lot area
        // Handles rotation: the "front" (+Z local) faces the road
        // The parking lot blends from the building height to the road height
        const wx = Math.floor(this.position.x);
        const wy = Math.floor(this.position.y);
        const wz = Math.floor(this.position.z);
        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        // Building ground level (Y of the surface block under the building)
        const buildingGroundY = wy - 1;
        // Road edge ground level (Y of the road surface)
        const roadGroundY = this.roadEdgeHeight - 1;

        // Parking lot zone: lz from 5 to 9 (stops before road edge)
        // BUILDING_SETBACK=15, road half-width=5, so road edge is at local Z=10
        const parkingStartZ = 5;
        const parkingEndZ = 9; // Stop 1 block before road edge
        const parkingRange = parkingEndZ - parkingStartZ; // 4 blocks

        // Clear a large area around the store (in local coords):
        // Local X: -9 to +9 (building width + margin)
        // Local Z: -7 to +14 (building depth + parking lot, stopping before road)
        // BUILDING_SETBACK is 15 from road center, road half-width is 5
        // So road edge is at local Z = 15 - 5 = 10 from store center
        // We stop the parking lot at local Z = 9 to avoid cutting into the road
        const parkingMaxZ = 9; // Stop before road edge (road edge is ~10 blocks away)
        for (let lx = -9; lx <= 9; lx++) {
            for (let lz = -7; lz <= parkingMaxZ; lz++) {
                // Rotate local coords to world coords
                const bx = wx + Math.round(lx * cosR + lz * sinR);
                const bz = wz + Math.round(-lx * sinR + lz * cosR);

                // Calculate the ground Y for this column, blending from building to road
                let groundY;
                const inParkingLot = (lz > parkingStartZ && lz <= parkingEndZ);

                if (inParkingLot) {
                    // Smoothly blend from building height to road height across the parking lot
                    const t = (lz - parkingStartZ) / parkingRange; // 0 at building edge, 1 at road edge
                    // Use smooth step for nicer transition
                    const st = t * t * (3 - 2 * t);
                    groundY = Math.round(buildingGroundY * (1 - st) + roadGroundY * st);
                } else {
                    groundY = buildingGroundY;
                }

                // Fill below to ensure solid ground (fill deeper to handle height differences)
                const minY = Math.min(buildingGroundY, roadGroundY) - 4;
                for (let by = minY; by <= groundY; by++) {
                    if (by >= 0) {
                        this.world.setBlock(bx, by, bz, BlockType.STONE);
                    }
                }

                // Clear everything above ground level - nuke all cigarettes, smoke, pipes, etc.
                const maxClearY = Math.max(buildingGroundY, roadGroundY) + 25;
                for (let by = groundY + 1; by < maxClearY; by++) {
                    this.world.setBlock(bx, by, bz, BlockType.AIR);
                }

                // Set the surface block based on local position
                if (inParkingLot) {
                    this.world.setBlock(bx, groundY, bz, BlockType.ROAD_ASPHALT);
                } else {
                    this.world.setBlock(bx, groundY, bz, BlockType.STONE);
                }
            }
        }
    }

    createParkingLot() {
        // Parking lot visual elements (Three.js meshes added to the group)
        // The parking lot is in front of the building (+Z direction)
        // Parking lot stops at local Z=9 (1 block before road edge at Z=10)
        // Building front is at local Z = depth/2 = 4, parking starts at ~Z=5
        const lotWidth = 14;
        const lotDepth = 5; // From building front to road edge (Z=4 to Z=9)
        const lotCenterZ = this.depth / 2 + lotDepth / 2 + 0.5; // In front of building

        // Height difference between building and road edge (in local Y space)
        // The group is positioned at the store's position, so road edge Y offset is:
        const roadYOffset = this.roadEdgeHeight - this.position.y;
        // The parking lot center is halfway between building edge and road edge
        const lotCenterYOffset = roadYOffset / 2;

        // === ASPHALT SURFACE (tilted plane to match slope from building to road) ===
        const asphaltGeo = new THREE.BoxGeometry(lotWidth, 0.12, lotDepth);
        const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
        asphalt.position.set(0, 0.06 + lotCenterYOffset, lotCenterZ);
        // Tilt the asphalt to slope from building to road
        if (Math.abs(roadYOffset) > 0.1) {
            asphalt.rotation.x = -Math.atan2(roadYOffset, lotDepth);
        }
        this.group.add(asphalt);

        // === SIDEWALK CURB (between building and lot) ===
        const curbGeo = new THREE.BoxGeometry(lotWidth + 2, 0.25, 1.2);
        const curbMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(0, 0.12, this.depth / 2 + 1.1);
        this.group.add(curb);

        // === PARKING LINE STRIPES (yellow) ===
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
        const numSpaces = 5;
        const spaceWidth = lotWidth / numSpaces;

        for (let i = 0; i <= numSpaces; i++) {
            const sx = -lotWidth / 2 + i * spaceWidth;
            // Vertical stripe (perpendicular to building)
            const stripeGeo = new THREE.BoxGeometry(0.15, 0.13, lotDepth * 0.6);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(sx, 0.13, lotCenterZ - 0.5);
            this.group.add(stripe);
        }

        // Horizontal line at back of parking spaces (near building)
        const backLineGeo = new THREE.BoxGeometry(lotWidth, 0.13, 0.15);
        const backLine = new THREE.Mesh(backLineGeo, stripeMat);
        backLine.position.set(0, 0.13, lotCenterZ - lotDepth * 0.3 - 0.5);
        this.group.add(backLine);

        // Horizontal line at front of parking spaces
        const frontLineGeo = new THREE.BoxGeometry(lotWidth, 0.13, 0.15);
        const frontLine = new THREE.Mesh(frontLineGeo, stripeMat);
        frontLine.position.set(0, 0.13, lotCenterZ + lotDepth * 0.3 - 0.5);
        this.group.add(frontLine);

        // === HANDICAP SYMBOL in first space (blue) ===
        const handicapCanvas = document.createElement('canvas');
        handicapCanvas.width = 32;
        handicapCanvas.height = 32;
        const hCtx = handicapCanvas.getContext('2d');
        hCtx.fillStyle = '#0044cc';
        hCtx.fillRect(0, 0, 32, 32);
        hCtx.font = 'bold 22px Arial';
        hCtx.textAlign = 'center';
        hCtx.textBaseline = 'middle';
        hCtx.fillStyle = '#ffffff';
        hCtx.fillText('♿', 16, 17);
        const handicapTexture = new THREE.CanvasTexture(handicapCanvas);
        const handicapMat = new THREE.MeshBasicMaterial({ map: handicapTexture });
        const handicapGeo = new THREE.BoxGeometry(spaceWidth * 0.6, 0.13, spaceWidth * 0.6);
        const handicapSign = new THREE.Mesh(handicapGeo, handicapMat);
        handicapSign.position.set(-lotWidth / 2 + spaceWidth / 2, 0.13, lotCenterZ);
        this.group.add(handicapSign);

        // === PARKING BOLLARDS (short yellow posts at edges) ===
        const bollardGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const bollardMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
        const bollardPositions = [
            [-lotWidth / 2 - 0.5, 0.4, lotCenterZ - lotDepth / 2 + 0.5],
            [lotWidth / 2 + 0.5, 0.4, lotCenterZ - lotDepth / 2 + 0.5],
            [-lotWidth / 2 - 0.5, 0.4, lotCenterZ + lotDepth / 2 - 0.5],
            [lotWidth / 2 + 0.5, 0.4, lotCenterZ + lotDepth / 2 - 0.5],
        ];
        for (const bp of bollardPositions) {
            const bollard = new THREE.Mesh(bollardGeo, bollardMat);
            bollard.position.set(bp[0], bp[1], bp[2]);
            this.group.add(bollard);

            // Reflective stripe on bollard
            const reflGeo = new THREE.BoxGeometry(0.32, 0.15, 0.32);
            const reflMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
            const refl = new THREE.Mesh(reflGeo, reflMat);
            refl.position.set(bp[0], bp[1] + 0.2, bp[2]);
            this.group.add(refl);
        }

        // === LIGHT POLES (tall with light on top) ===
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const polePositions = [
            [-lotWidth / 2 + 1, lotCenterZ],
            [lotWidth / 2 - 1, lotCenterZ],
        ];
        for (const pp of polePositions) {
            // Pole
            const poleGeo = new THREE.BoxGeometry(0.2, 5, 0.2);
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(pp[0], 2.5, pp[1]);
            this.group.add(pole);

            // Light fixture (box on top)
            const fixtureGeo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
            const fixtureMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(pp[0], 5.15, pp[1]);
            this.group.add(fixture);

            // Light bulb (glowing)
            const bulbGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
            const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.9 });
            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
            bulb.position.set(pp[0], 4.95, pp[1]);
            this.group.add(bulb);
            this.neonObjects.push(bulb);

            // Point light from pole
            const poleLight = new THREE.PointLight(0xffffcc, 0.6, 12);
            poleLight.position.set(pp[0], 4.8, pp[1]);
            this.group.add(poleLight);
        }

        // === "CUSTOMER PARKING ONLY" sign ===
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 128;
        signCanvas.height = 32;
        const sCtx = signCanvas.getContext('2d');
        sCtx.fillStyle = '#1a1a2e';
        sCtx.fillRect(0, 0, 128, 32);
        sCtx.strokeStyle = '#00ff88';
        sCtx.lineWidth = 2;
        sCtx.strokeRect(2, 2, 124, 28);
        sCtx.font = 'bold 11px monospace';
        sCtx.textAlign = 'center';
        sCtx.fillStyle = '#00ff88';
        sCtx.fillText('₿ HODLER PARKING', 64, 14);
        sCtx.font = '9px monospace';
        sCtx.fillStyle = '#ffd700';
        sCtx.fillText('VIOLATORS WILL BE LIQUIDATED', 64, 26);

        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.minFilter = THREE.LinearFilter;
        const signMat2 = new THREE.MeshBasicMaterial({ map: signTexture });
        const signGeo2 = new THREE.PlaneGeometry(3, 0.75);
        const parkingSign = new THREE.Mesh(signGeo2, signMat2);
        parkingSign.position.set(lotWidth / 2 + 0.8, 2.5, lotCenterZ);
        parkingSign.rotation.y = -Math.PI / 2;
        this.group.add(parkingSign);

        // Sign post
        const signPostGeo = new THREE.BoxGeometry(0.15, 3, 0.15);
        const signPost = new THREE.Mesh(signPostGeo, poleMat);
        signPost.position.set(lotWidth / 2 + 0.8, 1.5, lotCenterZ);
        this.group.add(signPost);
    }

    createBuilding() {
        // === FLOOR ===
        const floorGeo = new THREE.BoxGeometry(this.width, 0.3, this.depth);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, 0.15, 0);
        this.group.add(floor);

        // === WALLS (dark purple/black) ===
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x1a0a2e });
        const wallThickness = 0.4;

        // Back wall (full)
        const backWallGeo = new THREE.BoxGeometry(this.width, this.wallHeight, wallThickness);
        const backWall = new THREE.Mesh(backWallGeo, wallMat);
        backWall.position.set(0, this.wallHeight / 2, -this.depth / 2 + wallThickness / 2);
        this.group.add(backWall);

        // Left wall (full)
        const sideWallGeo = new THREE.BoxGeometry(wallThickness, this.wallHeight, this.depth);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-this.width / 2 + wallThickness / 2, this.wallHeight / 2, 0);
        this.group.add(leftWall);

        // Right wall (full)
        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(this.width / 2 - wallThickness / 2, this.wallHeight / 2, 0);
        this.group.add(rightWall);

        // Front wall - LEFT section (beside door)
        const frontLeftGeo = new THREE.BoxGeometry(3, this.wallHeight, wallThickness);
        const frontLeft = new THREE.Mesh(frontLeftGeo, wallMat);
        frontLeft.position.set(-this.width / 2 + 1.5, this.wallHeight / 2, this.depth / 2 - wallThickness / 2);
        this.group.add(frontLeft);

        // Front wall - RIGHT section (beside door)
        const frontRightGeo = new THREE.BoxGeometry(3, this.wallHeight, wallThickness);
        const frontRight = new THREE.Mesh(frontRightGeo, wallMat);
        frontRight.position.set(this.width / 2 - 1.5, this.wallHeight / 2, this.depth / 2 - wallThickness / 2);
        this.group.add(frontRight);

        // Front wall - ABOVE door
        const aboveDoorGeo = new THREE.BoxGeometry(4, 2, wallThickness);
        const aboveDoor = new THREE.Mesh(aboveDoorGeo, wallMat);
        aboveDoor.position.set(0, this.wallHeight - 1, this.depth / 2 - wallThickness / 2);
        this.group.add(aboveDoor);

        // === DOOR FRAME (gold trim) ===
        const frameMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
        // Left frame
        const frameVertGeo = new THREE.BoxGeometry(0.2, 4, 0.5);
        const leftFrame = new THREE.Mesh(frameVertGeo, frameMat);
        leftFrame.position.set(-2, 2, this.depth / 2 - 0.1);
        this.group.add(leftFrame);
        // Right frame
        const rightFrame = new THREE.Mesh(frameVertGeo, frameMat);
        rightFrame.position.set(2, 2, this.depth / 2 - 0.1);
        this.group.add(rightFrame);
        // Top frame
        const frameTopGeo = new THREE.BoxGeometry(4.4, 0.2, 0.5);
        const topFrame = new THREE.Mesh(frameTopGeo, frameMat);
        topFrame.position.set(0, 4, this.depth / 2 - 0.1);
        this.group.add(topFrame);

        // === ROOF ===
        const roofGeo = new THREE.BoxGeometry(this.width + 1, 0.4, this.depth + 1);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x0d0d1a });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, this.wallHeight + 0.2, 0);
        this.group.add(roof);

        // === ROOF EDGE NEON STRIP (green glow) ===
        const neonStripMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
        // Front edge
        const neonFrontGeo = new THREE.BoxGeometry(this.width + 1.2, 0.15, 0.15);
        const neonFront = new THREE.Mesh(neonFrontGeo, neonStripMat);
        neonFront.position.set(0, this.wallHeight + 0.45, this.depth / 2 + 0.5);
        this.group.add(neonFront);
        this.neonObjects.push(neonFront);

        // Left edge
        const neonSideGeo = new THREE.BoxGeometry(0.15, 0.15, this.depth + 1.2);
        const neonLeft = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonLeft.position.set(-this.width / 2 - 0.5, this.wallHeight + 0.45, 0);
        this.group.add(neonLeft);
        this.neonObjects.push(neonLeft);

        // Right edge
        const neonRight = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonRight.position.set(this.width / 2 + 0.5, this.wallHeight + 0.45, 0);
        this.group.add(neonRight);
        this.neonObjects.push(neonRight);

        // Back edge
        const neonBack = new THREE.Mesh(neonFrontGeo, neonStripMat);
        neonBack.position.set(0, this.wallHeight + 0.45, -this.depth / 2 - 0.5);
        this.group.add(neonBack);
        this.neonObjects.push(neonBack);

        // === CORNER PILLARS (gold accent) ===
        const pillarGeo = new THREE.BoxGeometry(0.5, this.wallHeight + 0.5, 0.5);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0xccaa00 });
        const corners = [
            [-this.width / 2, 0, -this.depth / 2],
            [this.width / 2, 0, -this.depth / 2],
            [-this.width / 2, 0, this.depth / 2],
            [this.width / 2, 0, this.depth / 2]
        ];
        for (const c of corners) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(c[0], (this.wallHeight + 0.5) / 2, c[2]);
            this.group.add(pillar);
        }

        // === FRONT STEP ===
        const stepGeo = new THREE.BoxGeometry(5, 0.2, 1);
        const stepMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
        const step = new THREE.Mesh(stepGeo, stepMat);
        step.position.set(0, 0.1, this.depth / 2 + 0.5);
        this.group.add(step);
    }

    createSigns() {
        // === MAIN FRONT SIGN: "₿ CRYPTO LIQUOR" ===
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256;
        signCanvas.height = 64;
        const ctx = signCanvas.getContext('2d');

        // Dark background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, 256, 64);

        // Neon green border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, 250, 58);

        // Main text
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.fillText('₿ CRYPTO LIQUOR', 128, 30);

        // Subtitle
        ctx.font = '14px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.fillText('🪙 HODL & DRINK 🪙', 128, 52);

        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.minFilter = THREE.LinearFilter;
        const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, this.wallHeight + 1.5, this.depth / 2 + 0.1);
        this.group.add(sign);
        this.neonObjects.push(sign);

        // === SIGN BACKING (dark box behind sign) ===
        const backingGeo = new THREE.BoxGeometry(8.4, 2.4, 0.3);
        const backingMat = new THREE.MeshLambertMaterial({ color: 0x0a0a1a });
        const backing = new THREE.Mesh(backingGeo, backingMat);
        backing.position.set(0, this.wallHeight + 1.5, this.depth / 2 - 0.05);
        this.group.add(backing);

        // === BITCOIN SYMBOL - LEFT SIDE WALL ===
        const btcCanvas = document.createElement('canvas');
        btcCanvas.width = 64;
        btcCanvas.height = 64;
        const btcCtx = btcCanvas.getContext('2d');
        btcCtx.fillStyle = '#0a0a1a';
        btcCtx.fillRect(0, 0, 64, 64);
        btcCtx.font = 'bold 48px monospace';
        btcCtx.textAlign = 'center';
        btcCtx.textBaseline = 'middle';
        btcCtx.fillStyle = '#f7931a'; // Bitcoin orange
        btcCtx.shadowColor = '#f7931a';
        btcCtx.shadowBlur = 12;
        btcCtx.fillText('₿', 32, 34);

        const btcTexture = new THREE.CanvasTexture(btcCanvas);
        const btcMat = new THREE.MeshBasicMaterial({ map: btcTexture, transparent: true });
        const btcGeo = new THREE.PlaneGeometry(2.5, 2.5);
        const btcSign = new THREE.Mesh(btcGeo, btcMat);
        btcSign.position.set(-this.width / 2 - 0.05, this.wallHeight - 1.5, 0);
        btcSign.rotation.y = Math.PI / 2;
        this.group.add(btcSign);
        this.neonObjects.push(btcSign);

        // === ETHEREUM SYMBOL - RIGHT SIDE WALL ===
        const ethCanvas = document.createElement('canvas');
        ethCanvas.width = 64;
        ethCanvas.height = 64;
        const ethCtx = ethCanvas.getContext('2d');
        ethCtx.fillStyle = '#0a0a1a';
        ethCtx.fillRect(0, 0, 64, 64);
        ethCtx.font = 'bold 48px monospace';
        ethCtx.textAlign = 'center';
        ethCtx.textBaseline = 'middle';
        ethCtx.fillStyle = '#627eea'; // Ethereum blue
        ethCtx.shadowColor = '#627eea';
        ethCtx.shadowBlur = 12;
        ethCtx.fillText('Ξ', 32, 34);

        const ethTexture = new THREE.CanvasTexture(ethCanvas);
        const ethMat = new THREE.MeshBasicMaterial({ map: ethTexture, transparent: true });
        const ethGeo = new THREE.PlaneGeometry(2.5, 2.5);
        const ethSign = new THREE.Mesh(ethGeo, ethMat);
        ethSign.position.set(this.width / 2 + 0.05, this.wallHeight - 1.5, 0);
        ethSign.rotation.y = -Math.PI / 2;
        this.group.add(ethSign);
        this.neonObjects.push(ethSign);

        // === TICKER DISPLAY above door ===
        this.tickerCanvas = document.createElement('canvas');
        this.tickerCanvas.width = 256;
        this.tickerCanvas.height = 32;
        this.tickerOffset = 0;
        this.tickerTexture = new THREE.CanvasTexture(this.tickerCanvas);
        this.tickerTexture.minFilter = THREE.LinearFilter;
        const tickerMat = new THREE.MeshBasicMaterial({ map: this.tickerTexture, transparent: true });
        const tickerGeo = new THREE.PlaneGeometry(6, 0.6);
        const ticker = new THREE.Mesh(tickerGeo, tickerMat);
        ticker.position.set(0, this.wallHeight - 0.1, this.depth / 2 + 0.05);
        this.group.add(ticker);
        this.updateTicker();

        // === NEON GLOW POINT LIGHTS ===
        // Green glow at front
        const greenLight = new THREE.PointLight(0x00ff88, 1.5, 15);
        greenLight.position.set(0, this.wallHeight + 1, this.depth / 2 + 2);
        this.group.add(greenLight);
        this.neonObjects.push(greenLight);

        // Gold glow at door
        const goldLight = new THREE.PointLight(0xffd700, 0.8, 8);
        goldLight.position.set(0, 3, this.depth / 2 + 1);
        this.group.add(goldLight);

        // Bitcoin orange glow on left
        const btcLight = new THREE.PointLight(0xf7931a, 0.6, 8);
        btcLight.position.set(-this.width / 2 - 1, this.wallHeight - 1.5, 0);
        this.group.add(btcLight);

        // Ethereum blue glow on right
        const ethLight = new THREE.PointLight(0x627eea, 0.6, 8);
        ethLight.position.set(this.width / 2 + 1, this.wallHeight - 1.5, 0);
        this.group.add(ethLight);
    }

    createInterior() {
        // === COUNTER (near back wall) ===
        const counterMat = new THREE.MeshLambertMaterial({ color: 0x2a1a3e });
        const counterGeo = new THREE.BoxGeometry(6, 1.2, 1.5);
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.set(0, 0.6, -this.depth / 2 + 1.5);
        this.group.add(counter);

        // Counter top (shiny dark surface)
        const counterTopGeo = new THREE.BoxGeometry(6.2, 0.1, 1.7);
        const counterTopMat = new THREE.MeshLambertMaterial({ color: 0x111122 });
        const counterTop = new THREE.Mesh(counterTopGeo, counterTopMat);
        counterTop.position.set(0, 1.25, -this.depth / 2 + 1.5);
        this.group.add(counterTop);

        // === CASH REGISTER (gold box on counter) ===
        const registerGeo = new THREE.BoxGeometry(0.8, 0.6, 0.6);
        const registerMat = new THREE.MeshLambertMaterial({ color: 0xccaa00 });
        const register = new THREE.Mesh(registerGeo, registerMat);
        register.position.set(1.5, 1.6, -this.depth / 2 + 1.5);
        this.group.add(register);

        // Register screen (green glow)
        const screenGeo = new THREE.BoxGeometry(0.5, 0.3, 0.05);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(1.5, 1.75, -this.depth / 2 + 1.85);
        this.group.add(screen);
        this.neonObjects.push(screen);

        // === SHELVES ON BACK WALL ===
        const shelfMat = new THREE.MeshLambertMaterial({ color: 0x3a2a4e });
        const shelfPositions = [2.0, 3.2, 4.4]; // Y positions for shelves

        for (const sy of shelfPositions) {
            // Shelf plank
            const shelfGeo = new THREE.BoxGeometry(this.width - 1.5, 0.15, 1.0);
            const shelf = new THREE.Mesh(shelfGeo, shelfMat);
            shelf.position.set(0, sy, -this.depth / 2 + 1.0);
            this.group.add(shelf);

            // Bottles on shelf
            const bottleColors = [0x00ff88, 0xf7931a, 0x627eea, 0xffd700, 0xff00ff, 0x00ffff];
            const numBottles = 6 + Math.floor(Math.random() * 4);
            for (let b = 0; b < numBottles; b++) {
                const bx = -this.width / 2 + 1.2 + b * ((this.width - 2.4) / numBottles);
                const color = bottleColors[Math.floor(Math.random() * bottleColors.length)];

                // Bottle body
                const bottleGeo = new THREE.BoxGeometry(0.25, 0.5 + Math.random() * 0.3, 0.25);
                const bottleMat = new THREE.MeshLambertMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.7
                });
                const bottle = new THREE.Mesh(bottleGeo, bottleMat);
                bottle.position.set(bx, sy + 0.35, -this.depth / 2 + 1.0);
                this.group.add(bottle);

                // Bottle neck
                const neckGeo = new THREE.BoxGeometry(0.12, 0.2, 0.12);
                const neck = new THREE.Mesh(neckGeo, bottleMat);
                neck.position.set(bx, sy + 0.7 + (Math.random() * 0.15), -this.depth / 2 + 1.0);
                this.group.add(neck);
            }
        }

        // === LEFT WALL SHELVES (side display) ===
        for (let sy = 2.0; sy <= 4.0; sy += 1.5) {
            const sideShelfGeo = new THREE.BoxGeometry(0.8, 0.12, this.depth - 2);
            const sideShelf = new THREE.Mesh(sideShelfGeo, shelfMat);
            sideShelf.position.set(-this.width / 2 + 0.8, sy, 0);
            this.group.add(sideShelf);

            // Bottles on side shelf
            for (let b = 0; b < 4; b++) {
                const bz = -this.depth / 2 + 1.5 + b * 1.5;
                const color = [0x00ff88, 0xf7931a, 0xff00ff][Math.floor(Math.random() * 3)];
                const bottleGeo = new THREE.BoxGeometry(0.22, 0.45, 0.22);
                const bottleMat = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.65 });
                const bottle = new THREE.Mesh(bottleGeo, bottleMat);
                bottle.position.set(-this.width / 2 + 0.8, sy + 0.3, bz);
                this.group.add(bottle);
            }
        }

        // === INTERIOR NEON LIGHT (purple ceiling strip) ===
        const ceilingLightGeo = new THREE.BoxGeometry(this.width - 2, 0.1, 0.2);
        const ceilingLightMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.8 });
        const ceilingLight = new THREE.Mesh(ceilingLightGeo, ceilingLightMat);
        ceilingLight.position.set(0, this.wallHeight - 0.3, 0);
        this.group.add(ceilingLight);
        this.neonObjects.push(ceilingLight);

        // Purple interior point light
        const interiorLight = new THREE.PointLight(0xaa00ff, 0.8, 12);
        interiorLight.position.set(0, this.wallHeight - 1, 0);
        this.group.add(interiorLight);

        // === FLOOR MAT (welcome mat with crypto symbol) ===
        const matCanvas = document.createElement('canvas');
        matCanvas.width = 64;
        matCanvas.height = 32;
        const matCtx = matCanvas.getContext('2d');
        matCtx.fillStyle = '#1a1a1a';
        matCtx.fillRect(0, 0, 64, 32);
        matCtx.font = 'bold 14px monospace';
        matCtx.textAlign = 'center';
        matCtx.fillStyle = '#00ff88';
        matCtx.fillText('WAGMI', 32, 20);

        const matTexture = new THREE.CanvasTexture(matCanvas);
        const matMaterial = new THREE.MeshLambertMaterial({ map: matTexture });
        const matGeo = new THREE.BoxGeometry(2.5, 0.05, 1.2);
        const welcomeMat = new THREE.Mesh(matGeo, matMaterial);
        welcomeMat.position.set(0, 0.33, this.depth / 2 - 0.8);
        this.group.add(welcomeMat);
    }

    updateTicker() {
        const ctx = this.tickerCanvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 32);

        const tickerText = '  BTC $69,420 ▲  ETH $4,200 ▲  DOGE $0.69 ▲  SOL $420 ▲  ';
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#00ff44';
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 4;

        const textWidth = ctx.measureText(tickerText).width;
        const x = -this.tickerOffset % textWidth;
        ctx.fillText(tickerText, x, 22);
        ctx.fillText(tickerText, x + textWidth, 22);

        if (this.tickerTexture) {
            this.tickerTexture.needsUpdate = true;
        }
    }

    isPlayerNear(playerPos) {
        const dist = this.position.distanceTo(playerPos);
        return dist < 12;
    }

    isPlayerInShopRange(playerPos) {
        const dist = this.position.distanceTo(playerPos);
        return dist < 7;
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        // Animate neon glow pulse
        this.glowPhase += dt * 3;
        const pulse = 0.6 + Math.sin(this.glowPhase) * 0.4;
        for (const obj of this.neonObjects) {
            if (obj.material && obj.material.opacity !== undefined) {
                obj.material.opacity = pulse;
            }
            if (obj.intensity !== undefined) {
                // Point light
                obj.intensity = 0.8 + Math.sin(this.glowPhase * 1.3) * 0.7;
            }
        }

        // Animate ticker scroll
        this.tickerOffset += dt * 60;
        this.updateTicker();
    }

    // Shop menu items
    static getMenuItems() {
        return [
            { key: '1', name: 'Bitcoin Beer', emoji: '🍺', price: 10, heal: 3, effect: null, desc: 'Heals 3 HP' },
            { key: '2', name: 'Ethereum Whiskey', emoji: '🥃', price: 25, heal: 8, effect: 'speed', desc: 'Heals 8 HP + Speed boost' },
            { key: '3', name: 'Doge Champagne', emoji: '🍾', price: 50, heal: 20, effect: 'strippers', desc: 'Full heal + Spawns strippers' },
            { key: '4', name: 'Shitcoin Moonshine', emoji: '🧪', price: 15, heal: 5, effect: 'high', desc: 'Heals 5 HP + Gets you high' }
        ];
    }

    purchase(itemIndex, glock, player, stripperSpawner) {
        const items = LiquorStore.getMenuItems();
        if (itemIndex < 0 || itemIndex >= items.length) return false;

        const item = items[itemIndex];

        // Check money
        if (glock.money < item.price) {
            this.playBrokeSound();
            return false;
        }

        // Deduct money
        glock.money -= item.price;

        // Heal player
        if (player) {
            player.health = Math.min(player.maxHealth, player.health + item.heal);
        }

        // Apply special effects
        if (item.effect === 'speed' && player) {
            player.speedBoostTimer = (player.speedBoostTimer || 0) + 8; // 8 seconds of speed
        }

        if (item.effect === 'strippers' && stripperSpawner && player) {
            for (let s = 0; s < 3; s++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 5 + Math.random() * 8;
                const sx = player.position.x + Math.cos(angle) * dist;
                const sz = player.position.z + Math.sin(angle) * dist;
                const sy = this.world.getSpawnHeight(sx, sz);
                if (sy > WATER_LEVEL + 1) {
                    const stripper = new Stripper(this.world, this.scene, sx, sy + 0.5, sz);
                    stripperSpawner.strippers.push(stripper);
                }
            }
        }

        if (item.effect === 'high') {
            // Will be handled by main.js setting highLevel
            this._lastPurchaseEffect = 'high';
        }

        // Play purchase sound
        this.playPurchaseSound();

        // Spawn floating text effect
        this.spawnPurchaseEffect(item);

        // Money bill animation
        if (glock.spawnDollarBill) {
            for (let d = 0; d < 5; d++) {
                setTimeout(() => glock.spawnDollarBill(), d * 80);
            }
        }

        return true;
    }

    playPurchaseSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Ka-ching! Cash register sound
            // High metallic ding
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1200, t);
            osc1.frequency.exponentialRampToValueAtTime(2400, t + 0.05);
            const gain1 = ctx.createGain();
            gain1.gain.setValueAtTime(0.3, t);
            gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.35);

            // Second ding (harmony)
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1800, t + 0.05);
            osc2.frequency.exponentialRampToValueAtTime(3200, t + 0.1);
            const gain2 = ctx.createGain();
            gain2.gain.setValueAtTime(0.2, t + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t + 0.05);
            osc2.stop(t + 0.4);

            // Coin jingle
            for (let i = 0; i < 4; i++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                const offset = 0.1 + i * 0.06;
                osc.frequency.setValueAtTime(3000 + Math.random() * 2000, t + offset);
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.08, t + offset);
                gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + offset);
                osc.stop(t + offset + 0.12);
            }
        } catch(e) {}
    }

    playBrokeSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const t = ctx.currentTime;

            // Sad buzzer
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.linearRampToValueAtTime(100, t + 0.4);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.6);
        } catch(e) {}
    }

    spawnPurchaseEffect(item) {
        // Floating text: "+3 HP 🍺" etc
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#00ff88';
        ctx.strokeStyle = '#003311';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        const text = `${item.emoji} +${item.heal} HP`;
        ctx.strokeText(text, 128, 40);
        ctx.fillText(text, 128, 40);

        const textTexture = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.SpriteMaterial({ map: textTexture, transparent: true, opacity: 1.0 });
        const textSprite = new THREE.Sprite(textMat);
        textSprite.scale.set(3, 0.75, 1);
        textSprite.position.copy(this.position);
        textSprite.position.y += 4;
        textSprite.position.z += this.depth / 2 + 1;
        this.scene.add(textSprite);

        let frame = 0;
        const animate = () => {
            frame++;
            textSprite.position.y += 0.04;
            textMat.opacity = Math.max(0, 1 - frame / 50);
            if (frame < 55) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(textSprite);
                textTexture.dispose();
                textMat.dispose();
            }
        };
        requestAnimationFrame(animate);

        // Green sparkle burst
        for (let i = 0; i < 10; i++) {
            const size = 0.08 + Math.random() * 0.12;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0, 1, 0.5),
                transparent: true,
                opacity: 0.8
            });
            const spark = new THREE.Mesh(geo, mat);
            spark.position.copy(this.position);
            spark.position.y += 2;
            spark.position.z += this.depth / 2;
            this.scene.add(spark);

            const vx = (Math.random() - 0.5) * 4;
            const vy = 1 + Math.random() * 3;
            const vz = 1 + Math.random() * 2;
            let f = 0;
            const animSpark = () => {
                f++;
                spark.position.x += vx * 0.016;
                spark.position.y += (vy - f * 0.15) * 0.016;
                spark.position.z += vz * 0.016;
                mat.opacity = Math.max(0, 0.8 - f / 25);
                if (f < 30) {
                    requestAnimationFrame(animSpark);
                } else {
                    this.scene.remove(spark);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animSpark);
        }
    }

    dispose() {
        this.alive = false;
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
        this.neonObjects = [];
    }
}

// Liquor Store Spawner - places stores near road intersections
class LiquorStoreSpawner {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.stores = [];
        this.maxStores = 4;
        this.spawnCooldown = 2; // Quick first spawn
        this.spawnInterval = 8;
        this.checkedPositions = new Set(); // Avoid re-checking same spots
        this.player = null;
        this.glock = null;
        this.stripperSpawner = null;
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        // Try to spawn new stores
        if (this.spawnCooldown <= 0 && this.stores.length < this.maxStores) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        // Update existing stores
        let nearestStore = null;
        let nearestDist = Infinity;

        for (let i = this.stores.length - 1; i >= 0; i--) {
            const store = this.stores[i];
            store.update(dt, playerPos);

            // Track nearest store for shop prompt
            const dist = store.position.distanceTo(playerPos);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestStore = store;
            }

            // Despawn if very far
            if (dist > 150) {
                store.dispose();
                this.stores.splice(i, 1);
            }
        }

        // Update shop prompt visibility
        this.updateShopPrompt(nearestStore, playerPos);

        return nearestStore;
    }

    updateShopPrompt(nearestStore, playerPos) {
        const prompt = document.getElementById('shop-prompt');
        if (!prompt) return;

        if (nearestStore && nearestStore.isPlayerInShopRange(playerPos)) {
            prompt.style.display = 'block';
        } else {
            prompt.style.display = 'none';
        }
    }

    // Check if a candidate position is too close to a road intersection
    // The store footprint extends ~9 blocks in local X and from -7 to +9 in local Z
    // We need to ensure the perpendicular road doesn't overlap with the building/parking lot
    isNearIntersection(candX, candZ, candRot) {
        const ROAD_SPACING = 128;
        const ROAD_HALF_WIDTH = 5;
        // Minimum safe distance from perpendicular road center to store center
        // Building extends 9 blocks in the perpendicular direction, plus road half-width, plus margin
        const MIN_PERP_DIST = 16; // 9 (building half-width) + 5 (road half-width) + 2 (margin)

        const rotNorm = ((candRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const facesX = (Math.abs(rotNorm - Math.PI / 2) < 0.1 || Math.abs(rotNorm - Math.PI * 3 / 2) < 0.1);
        // facesX: store faces along X axis (rotation ~PI/2 or ~3PI/2), meaning it's alongside a Z-aligned road
        // In this case, the perpendicular road is X-aligned (runs along X, spaced along Z)

        if (facesX) {
            // Store is alongside a Z-aligned road. Check distance to nearest X-aligned road (perpendicular)
            const nearestZRoad = Math.round(candZ / ROAD_SPACING) * ROAD_SPACING;
            const distToPerp = Math.abs(candZ - nearestZRoad);
            if (distToPerp < MIN_PERP_DIST) return true;
        } else {
            // Store faces along Z axis. Check distance to nearest Z-aligned road (perpendicular)
            const nearestXRoad = Math.round(candX / ROAD_SPACING) * ROAD_SPACING;
            const distToPerp = Math.abs(candX - nearestXRoad);
            if (distToPerp < MIN_PERP_DIST) return true;
        }

        return false;
    }

    trySpawn(playerPos) {
        // Place stores flush with roads - parking lot faces the road
        // Roads are at ROAD_SPACING intervals (128 blocks apart)
        // Road half-width is 5 blocks (total 11 blocks wide)
        const ROAD_SPACING = 128;
        const ROAD_HALF_WIDTH = 5;
        // Building center distance from road center:
        // road half-width (5) + parking lot depth (~10) = 15
        // This places the parking lot edge flush with the road
        const BUILDING_SETBACK = 15;

        // Find nearest road grid lines
        const nearestXRoad = Math.round(playerPos.x / ROAD_SPACING) * ROAD_SPACING; // Z-aligned road at this X
        const nearestZRoad = Math.round(playerPos.z / ROAD_SPACING) * ROAD_SPACING; // X-aligned road at this Z

        // Generate candidates: stores placed alongside roads, facing the road
        // Each candidate has x, z, rotation
        // rotation: 0 = front faces +Z, PI = front faces -Z, PI/2 = front faces +X, -PI/2 = front faces -X
        const candidates = [];

        // Offsets along the road from the nearest intersection
        // Avoid 0 offset (right at intersection) - use offsets that keep stores away from crossroads
        // MIN_PERP_DIST is 16, so offsets must be >= 16 to be safe from the perpendicular road
        const offsets = [-50, -35, -20, 20, 35, 50];

        // Along Z-aligned road (road runs along Z at x=nearestXRoad)
        // Store on the +X side of road, facing -X toward road
        for (const oz of offsets) {
            // +X side: store center at road + setback, facing road (rotation = -PI/2, front faces -X)
            candidates.push({
                x: nearestXRoad + BUILDING_SETBACK,
                z: nearestZRoad + oz,
                rot: -Math.PI / 2
            });
            // -X side: store center at road - setback, facing road (rotation = PI/2, front faces +X)
            candidates.push({
                x: nearestXRoad - BUILDING_SETBACK,
                z: nearestZRoad + oz,
                rot: Math.PI / 2
            });
        }

        // Along X-aligned road (road runs along X at z=nearestZRoad)
        for (const ox of offsets) {
            // +Z side: store center at road + setback, facing road (rotation = PI, front faces -Z)
            candidates.push({
                x: nearestXRoad + ox,
                z: nearestZRoad + BUILDING_SETBACK,
                rot: Math.PI
            });
            // -Z side: store center at road - setback, facing road (rotation = 0, front faces +Z)
            candidates.push({
                x: nearestXRoad + ox,
                z: nearestZRoad - BUILDING_SETBACK,
                rot: 0
            });
        }

        // Also check adjacent road grid cells
        for (const roadOff of [ROAD_SPACING, -ROAD_SPACING]) {
            for (const oz of offsets) {
                candidates.push({
                    x: nearestXRoad + roadOff + BUILDING_SETBACK,
                    z: nearestZRoad + oz,
                    rot: -Math.PI / 2
                });
                candidates.push({
                    x: nearestXRoad + roadOff - BUILDING_SETBACK,
                    z: nearestZRoad + oz,
                    rot: Math.PI / 2
                });
            }
            for (const ox of offsets) {
                candidates.push({
                    x: nearestXRoad + ox,
                    z: nearestZRoad + roadOff + BUILDING_SETBACK,
                    rot: Math.PI
                });
                candidates.push({
                    x: nearestXRoad + ox,
                    z: nearestZRoad + roadOff - BUILDING_SETBACK,
                    rot: 0
                });
            }
        }

        // Shuffle candidates
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        for (const cand of candidates) {
            const key = `${Math.round(cand.x / 8)},${Math.round(cand.z / 8)}`;
            if (this.checkedPositions.has(key)) continue;
            this.checkedPositions.add(key);

            // Check distance from player (not too close, not too far)
            const dx = cand.x - playerPos.x;
            const dz = cand.z - playerPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 25 || dist > 100) continue;

            // Check distance from existing stores (don't cluster)
            let tooClose = false;
            for (const store of this.stores) {
                const sd = Math.sqrt(
                    (store.position.x - cand.x) ** 2 +
                    (store.position.z - cand.z) ** 2
                );
                if (sd < 60) { tooClose = true; break; }
            }
            if (tooClose) continue;

            // Reject candidates too close to road intersections
            if (this.isNearIntersection(cand.x, cand.z, cand.rot)) continue;

            // Get road height at the parking lot edge to place store flush with road
            // Calculate where the road edge would be for this candidate
            // Road edge is at local Z=10 (BUILDING_SETBACK=15 minus ROAD_HALF_WIDTH=5)
            const candCosR = Math.cos(cand.rot);
            const candSinR = Math.sin(cand.rot);
            const roadEdgeLocalZ = 10;
            const roadEdgeWX = Math.floor(cand.x) + Math.round(roadEdgeLocalZ * candSinR);
            const roadEdgeWZ = Math.floor(cand.z) + Math.round(roadEdgeLocalZ * candCosR);
            const roadHeight = this.world.getNearestRoadEdgeHeight(roadEdgeWX, roadEdgeWZ);

            // Use road height as the store's Y position so parking lot meets road flush
            let sy;
            if (roadHeight !== null && roadHeight !== undefined && roadHeight > WATER_LEVEL + 2) {
                sy = roadHeight;
            } else {
                sy = this.world.getSpawnHeight(cand.x, cand.z);
            }
            if (sy <= WATER_LEVEL + 2) continue;

            // Check ground is solid (at the store position or road position)
            const groundBlock = this.world.getBlock(Math.floor(cand.x), sy - 1, Math.floor(cand.z));
            if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) {
                // Also try checking at road height
                const altBlock = this.world.getBlock(Math.floor(cand.x), Math.max(0, sy - 2), Math.floor(cand.z));
                if (altBlock === BlockType.AIR || altBlock === BlockType.WATER) continue;
            }

            // Spawn the store flush with the road!
            const store = new LiquorStore(this.scene, this.world, cand.x, sy, cand.z, cand.rot);
            this.stores.push(store);
            return;
        }
    }

    // Get the nearest store that the player can shop at
    getNearestShoppableStore(playerPos) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const store of this.stores) {
            if (!store.alive) continue;
            const dist = store.position.distanceTo(playerPos);
            if (dist < 7 && dist < nearestDist) {
                nearestDist = dist;
                nearest = store;
            }
        }
        return nearest;
    }

    // Force spawn a store at a specific road location (used for initial spawn)
    forceSpawnAtRoad(nearX, nearZ) {
        const ROAD_SPACING = 128;
        const BUILDING_SETBACK = 15;
        const MIN_PERP_DIST = 16; // Minimum distance from perpendicular road center

        // Find nearest road to the given position
        const nearestXRoad = Math.round(nearX / ROAD_SPACING) * ROAD_SPACING;
        const nearestZRoad = Math.round(nearZ / ROAD_SPACING) * ROAD_SPACING;

        // Determine which road is closer
        const distToXRoad = Math.abs(nearX - nearestXRoad);
        const distToZRoad = Math.abs(nearZ - nearestZRoad);

        let storeX, storeZ, storeRot;

        if (distToXRoad <= distToZRoad) {
            // Closer to a Z-aligned road (runs along Z at x=nearestXRoad)
            // Place store on the +X side
            storeX = nearestXRoad + BUILDING_SETBACK;
            storeZ = nearZ;
            storeRot = -Math.PI / 2; // Front faces -X toward road

            // Avoid intersection: check distance to nearest X-aligned road (perpendicular)
            const nearestPerpRoad = Math.round(storeZ / ROAD_SPACING) * ROAD_SPACING;
            const distToPerp = Math.abs(storeZ - nearestPerpRoad);
            if (distToPerp < MIN_PERP_DIST) {
                // Shift store along the road away from intersection
                if (storeZ >= nearestPerpRoad) {
                    storeZ = nearestPerpRoad + MIN_PERP_DIST + 5;
                } else {
                    storeZ = nearestPerpRoad - MIN_PERP_DIST - 5;
                }
            }
        } else {
            // Closer to an X-aligned road (runs along X at z=nearestZRoad)
            // Place store on the -Z side (front faces +Z toward road)
            storeX = nearX;
            storeZ = nearestZRoad - BUILDING_SETBACK;
            storeRot = 0; // Front faces +Z toward road

            // Avoid intersection: check distance to nearest Z-aligned road (perpendicular)
            const nearestPerpRoad = Math.round(storeX / ROAD_SPACING) * ROAD_SPACING;
            const distToPerp = Math.abs(storeX - nearestPerpRoad);
            if (distToPerp < MIN_PERP_DIST) {
                // Shift store along the road away from intersection
                if (storeX >= nearestPerpRoad) {
                    storeX = nearestPerpRoad + MIN_PERP_DIST + 5;
                } else {
                    storeX = nearestPerpRoad - MIN_PERP_DIST - 5;
                }
            }
        }

        // Make sure terrain is loaded
        this.world.update(storeX, storeZ);

        // Use road height so parking lot is flush with road
        // Road edge is at local Z=10 (BUILDING_SETBACK=15 minus road half-width=5)
        const cosR = Math.cos(storeRot);
        const sinR = Math.sin(storeRot);
        const roadEdgeLocalZ = 10;
        const roadEdgeWX = Math.floor(storeX) + Math.round(roadEdgeLocalZ * sinR);
        const roadEdgeWZ = Math.floor(storeZ) + Math.round(roadEdgeLocalZ * cosR);
        const roadHeight = this.world.getNearestRoadEdgeHeight(roadEdgeWX, roadEdgeWZ);

        let sy;
        if (roadHeight !== null && roadHeight !== undefined && roadHeight > WATER_LEVEL + 2) {
            sy = roadHeight;
        } else {
            sy = this.world.getSpawnHeight(storeX, storeZ);
        }
        const store = new LiquorStore(this.scene, this.world, storeX, sy, storeZ, storeRot);
        this.stores.push(store);
        return store;
    }

    // Get the parking lot world position for a store (for spawning player/car there)
    static getParkingPosition(store) {
        const parkingDist = 10; // Local Z distance to parking center
        const cosR = Math.cos(store.rotation);
        const sinR = Math.sin(store.rotation);
        return {
            x: store.position.x + parkingDist * sinR,
            y: store.position.y + 2,
            z: store.position.z + parkingDist * cosR
        };
    }

    getCount() {
        return this.stores.length;
    }
}

window.LiquorStore = LiquorStore;
window.LiquorStoreSpawner = LiquorStoreSpawner;
