// Strip Club - Purchasable building that stores collected strippers as score
// Spawns in the world similar to liquor stores

class StripClub {
    constructor(scene, world, x, y, z, rotation) {
        this.scene = scene;
        this.world = world;
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = rotation || 0;
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this.group.rotation.y = this.rotation;
        this.alive = true;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.neonObjects = [];
        this.stripperScore = 0; // Number of strippers deposited
        this.floors = 1; // Start with 1 floor
        this.maxFloors = 10;
        this.incomeTimer = 0; // Timer for $1/sec per hooker
        this.totalEarned = 0; // Total money earned from this club

        // Building dimensions (slightly bigger than liquor store)
        this.width = 12;
        this.depth = 10;
        this.wallHeight = 7;
        this.floorHeight = 4; // Height per additional floor

        this.roadEdgeHeight = this.calculateRoadEdgeHeight();
        this.clearArea();
        this.createParkingLot();
        this.createBuilding();
        this.createSigns();
        this.createInterior();
        this.scene.add(this.group);
    }

    calculateRoadEdgeHeight() {
        const wx = Math.floor(this.position.x);
        const wz = Math.floor(this.position.z);
        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const roadEdgeLocalZ = 10;
        const roadEdgeWX = wx + Math.round(roadEdgeLocalZ * sinR);
        const roadEdgeWZ = wz + Math.round(roadEdgeLocalZ * cosR);
        const roadHeight = this.world.getNearestRoadEdgeHeight(roadEdgeWX, roadEdgeWZ);
        if (roadHeight !== null && roadHeight !== undefined) return roadHeight;
        return Math.floor(this.position.y);
    }

    clearArea() {
        const wx = Math.floor(this.position.x);
        const wy = Math.floor(this.position.y);
        const wz = Math.floor(this.position.z);
        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const buildingGroundY = wy - 1;
        const roadGroundY = this.roadEdgeHeight - 1;
        const parkingStartZ = 6;
        const parkingEndZ = 9;
        const parkingRange = parkingEndZ - parkingStartZ;

        for (let lx = -10; lx <= 10; lx++) {
            for (let lz = -8; lz <= 9; lz++) {
                const bx = wx + Math.round(lx * cosR + lz * sinR);
                const bz = wz + Math.round(-lx * sinR + lz * cosR);
                let groundY;
                const inParkingLot = (lz > parkingStartZ && lz <= parkingEndZ);
                if (inParkingLot) {
                    const t = (lz - parkingStartZ) / parkingRange;
                    const st = t * t * (3 - 2 * t);
                    groundY = Math.round(buildingGroundY * (1 - st) + roadGroundY * st);
                } else {
                    groundY = buildingGroundY;
                }
                const minY = Math.min(buildingGroundY, roadGroundY) - 4;
                for (let by = minY; by <= groundY; by++) {
                    if (by >= 0) this.world.setBlock(bx, by, bz, BlockType.STONE);
                }
                const maxClearY = Math.max(buildingGroundY, roadGroundY) + 25;
                for (let by = groundY + 1; by < maxClearY; by++) {
                    this.world.setBlock(bx, by, bz, BlockType.AIR);
                }
                if (inParkingLot) {
                    this.world.setBlock(bx, groundY, bz, BlockType.ROAD_ASPHALT);
                } else {
                    this.world.setBlock(bx, groundY, bz, BlockType.STONE);
                }
            }
        }
    }

    createParkingLot() {
        const lotWidth = 16;
        const lotDepth = 4;
        const lotCenterZ = this.depth / 2 + lotDepth / 2 + 0.5;
        const roadYOffset = this.roadEdgeHeight - this.position.y;
        const lotCenterYOffset = roadYOffset / 2;

        // Asphalt
        const asphaltGeo = new THREE.BoxGeometry(lotWidth, 0.12, lotDepth);
        const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
        asphalt.position.set(0, 0.06 + lotCenterYOffset, lotCenterZ);
        if (Math.abs(roadYOffset) > 0.1) asphalt.rotation.x = -Math.atan2(roadYOffset, lotDepth);
        this.group.add(asphalt);

        // Curb
        const curbGeo = new THREE.BoxGeometry(lotWidth + 2, 0.25, 1.2);
        const curbMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(0, 0.12, this.depth / 2 + 1.1);
        this.group.add(curb);

        // Parking stripes (pink!)
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
        const numSpaces = 6;
        const spaceWidth = lotWidth / numSpaces;
        for (let i = 0; i <= numSpaces; i++) {
            const sx = -lotWidth / 2 + i * spaceWidth;
            const stripeGeo = new THREE.BoxGeometry(0.15, 0.13, lotDepth * 0.6);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(sx, 0.13, lotCenterZ - 0.5);
            this.group.add(stripe);
        }

        // Light poles with pink lights
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const polePositions = [[-lotWidth / 2 + 1, lotCenterZ], [lotWidth / 2 - 1, lotCenterZ]];
        for (const pp of polePositions) {
            const poleGeo = new THREE.BoxGeometry(0.2, 5, 0.2);
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(pp[0], 2.5, pp[1]);
            this.group.add(pole);
            const bulbGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
            const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.9 });
            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
            bulb.position.set(pp[0], 4.95, pp[1]);
            this.group.add(bulb);
            this.neonObjects.push(bulb);
            const poleLight = new THREE.PointLight(0xff69b4, 0.8, 12);
            poleLight.position.set(pp[0], 4.8, pp[1]);
            this.group.add(poleLight);
        }
    }

    createBuilding() {
        // === GLOSSY BLACK FLOOR ===
        const floorGeo = new THREE.BoxGeometry(this.width + 2, 0.3, this.depth + 2);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x050510 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, 0.15, 0);
        this.group.add(floor);

        // === WALLS - JET BLACK with purple tint ===
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a0515 });
        const wallThickness = 0.5;

        // Back wall
        const backWallGeo = new THREE.BoxGeometry(this.width, this.wallHeight, wallThickness);
        const backWall = new THREE.Mesh(backWallGeo, wallMat);
        backWall.position.set(0, this.wallHeight / 2, -this.depth / 2 + wallThickness / 2);
        this.group.add(backWall);

        // Side walls
        const sideWallGeo = new THREE.BoxGeometry(wallThickness, this.wallHeight, this.depth);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-this.width / 2 + wallThickness / 2, this.wallHeight / 2, 0);
        this.group.add(leftWall);
        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(this.width / 2 - wallThickness / 2, this.wallHeight / 2, 0);
        this.group.add(rightWall);

        // Front wall sections (wider solid sections)
        const frontLeftGeo = new THREE.BoxGeometry(3.5, this.wallHeight, wallThickness);
        const frontLeft = new THREE.Mesh(frontLeftGeo, wallMat);
        frontLeft.position.set(-this.width / 2 + 1.75, this.wallHeight / 2, this.depth / 2 - wallThickness / 2);
        this.group.add(frontLeft);
        const frontRight = new THREE.Mesh(frontLeftGeo, wallMat);
        frontRight.position.set(this.width / 2 - 1.75, this.wallHeight / 2, this.depth / 2 - wallThickness / 2);
        this.group.add(frontRight);
        const aboveDoorGeo = new THREE.BoxGeometry(5, 2.5, wallThickness);
        const aboveDoor = new THREE.Mesh(aboveDoorGeo, wallMat);
        aboveDoor.position.set(0, this.wallHeight - 1.25, this.depth / 2 - wallThickness / 2);
        this.group.add(aboveDoor);

        // === GRAND ENTRANCE - Neon archway ===
        const archMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.9 });
        // Left arch pillar
        const archPillarGeo = new THREE.BoxGeometry(0.3, 5, 0.6);
        const archL = new THREE.Mesh(archPillarGeo, archMat);
        archL.position.set(-2.6, 2.5, this.depth / 2 + 0.1);
        this.group.add(archL);
        this.neonObjects.push(archL);
        // Right arch pillar
        const archR = new THREE.Mesh(archPillarGeo, archMat);
        archR.position.set(2.6, 2.5, this.depth / 2 + 0.1);
        this.group.add(archR);
        this.neonObjects.push(archR);
        // Arch top
        const archTopGeo = new THREE.BoxGeometry(5.5, 0.3, 0.6);
        const archTop = new THREE.Mesh(archTopGeo, archMat);
        archTop.position.set(0, 5.0, this.depth / 2 + 0.1);
        this.group.add(archTop);
        this.neonObjects.push(archTop);

        // === VELVET ROPE & BOUNCER ===
        // Rope posts (gold)
        const goldPostMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        const postGeo = new THREE.BoxGeometry(0.15, 1.2, 0.15);
        const postL = new THREE.Mesh(postGeo, goldPostMat);
        postL.position.set(-3.5, 0.6, this.depth / 2 + 1.5);
        this.group.add(postL);
        const postR = new THREE.Mesh(postGeo, goldPostMat);
        postR.position.set(-1.5, 0.6, this.depth / 2 + 1.5);
        this.group.add(postR);
        // Velvet rope (red)
        const ropeMat = new THREE.MeshBasicMaterial({ color: 0xcc0033 });
        const ropeGeo = new THREE.BoxGeometry(2.0, 0.08, 0.08);
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.set(-2.5, 0.9, this.depth / 2 + 1.5);
        this.group.add(rope);

        // Bouncer (big blocky dude in black)
        const bouncerGroup = new THREE.Group();
        bouncerGroup.position.set(3.5, 0, this.depth / 2 + 1.5);
        // Bouncer body
        const bouncerBodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
        const bouncerBodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const bouncerBody = new THREE.Mesh(bouncerBodyGeo, bouncerBodyMat);
        bouncerBody.position.set(0, 1.2, 0);
        bouncerGroup.add(bouncerBody);
        // Bouncer head
        const bouncerHeadGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const bouncerHeadMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
        const bouncerHead = new THREE.Mesh(bouncerHeadGeo, bouncerHeadMat);
        bouncerHead.position.set(0, 1.9, 0);
        bouncerGroup.add(bouncerHead);
        // Bouncer sunglasses
        const glassGeo = new THREE.BoxGeometry(0.28, 0.08, 0.05);
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const glasses = new THREE.Mesh(glassGeo, glassMat);
        glasses.position.set(0, 1.92, 0.16);
        bouncerGroup.add(glasses);
        // Bouncer legs
        const bLegGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const bLegL = new THREE.Mesh(bLegGeo, bouncerBodyMat);
        bLegL.position.set(-0.15, 0.4, 0);
        bouncerGroup.add(bLegL);
        const bLegR = new THREE.Mesh(bLegGeo, bouncerBodyMat);
        bLegR.position.set(0.15, 0.4, 0);
        bouncerGroup.add(bLegR);
        // Bouncer arms (crossed)
        const bArmGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const bArmL = new THREE.Mesh(bArmGeo, bouncerBodyMat);
        bArmL.position.set(-0.35, 1.15, 0.1);
        bArmL.rotation.z = 0.4;
        bouncerGroup.add(bArmL);
        const bArmR = new THREE.Mesh(bArmGeo, bouncerBodyMat);
        bArmR.position.set(0.35, 1.15, 0.1);
        bArmR.rotation.z = -0.4;
        bouncerGroup.add(bArmR);
        this.group.add(bouncerGroup);

        // === ROOF - Flat black with raised parapet ===
        const roofGeo = new THREE.BoxGeometry(this.width + 1.5, 0.4, this.depth + 1.5);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x050510 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, this.wallHeight + 0.2, 0);
        this.group.add(roof);

        // Parapet walls (raised edge around roof)
        const parapetMat = new THREE.MeshLambertMaterial({ color: 0x0a0515 });
        const parapetH = 1.0;
        const parapetFrontGeo = new THREE.BoxGeometry(this.width + 1.5, parapetH, 0.3);
        const parapetFront = new THREE.Mesh(parapetFrontGeo, parapetMat);
        parapetFront.position.set(0, this.wallHeight + 0.4 + parapetH / 2, this.depth / 2 + 0.6);
        this.group.add(parapetFront);
        const parapetBack = new THREE.Mesh(parapetFrontGeo, parapetMat);
        parapetBack.position.set(0, this.wallHeight + 0.4 + parapetH / 2, -this.depth / 2 - 0.6);
        this.group.add(parapetBack);
        const parapetSideGeo = new THREE.BoxGeometry(0.3, parapetH, this.depth + 1.5);
        const parapetL = new THREE.Mesh(parapetSideGeo, parapetMat);
        parapetL.position.set(-this.width / 2 - 0.6, this.wallHeight + 0.4 + parapetH / 2, 0);
        this.group.add(parapetL);
        const parapetR = new THREE.Mesh(parapetSideGeo, parapetMat);
        parapetR.position.set(this.width / 2 + 0.6, this.wallHeight + 0.4 + parapetH / 2, 0);
        this.group.add(parapetR);

        // === NEON EDGE STRIPS - Multiple colors ===
        // Hot pink top edge
        const neonStripMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.9 });
        const neonFrontGeo = new THREE.BoxGeometry(this.width + 1.8, 0.2, 0.2);
        const neonFront = new THREE.Mesh(neonFrontGeo, neonStripMat);
        neonFront.position.set(0, this.wallHeight + 0.5, this.depth / 2 + 0.7);
        this.group.add(neonFront);
        this.neonObjects.push(neonFront);

        // Purple mid-strip
        const purpleNeonMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.8 });
        const purpleStripGeo = new THREE.BoxGeometry(this.width + 0.5, 0.12, 0.12);
        const purpleStrip = new THREE.Mesh(purpleStripGeo, purpleNeonMat);
        purpleStrip.position.set(0, this.wallHeight * 0.6, this.depth / 2 + 0.05);
        this.group.add(purpleStrip);
        this.neonObjects.push(purpleStrip);

        // Neon side strips
        const neonSideGeo = new THREE.BoxGeometry(0.2, 0.2, this.depth + 1.8);
        const neonLeft = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonLeft.position.set(-this.width / 2 - 0.7, this.wallHeight + 0.5, 0);
        this.group.add(neonLeft);
        this.neonObjects.push(neonLeft);
        const neonRight = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonRight.position.set(this.width / 2 + 0.7, this.wallHeight + 0.5, 0);
        this.group.add(neonRight);
        this.neonObjects.push(neonRight);

        // === GROUND NEON STRIPS (leading to entrance) ===
        const groundNeonMat = new THREE.MeshBasicMaterial({ color: 0xff1493, transparent: true, opacity: 0.7 });
        for (let i = 0; i < 4; i++) {
            const gNeonGeo = new THREE.BoxGeometry(5.5, 0.05, 0.15);
            const gNeon = new THREE.Mesh(gNeonGeo, groundNeonMat);
            gNeon.position.set(0, 0.32, this.depth / 2 + 0.8 + i * 0.6);
            this.group.add(gNeon);
            this.neonObjects.push(gNeon);
        }

        // === CORNER PILLARS - Taller, with neon caps ===
        const pillarGeo = new THREE.BoxGeometry(0.6, this.wallHeight + 1.5, 0.6);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0x0a0515 });
        const corners = [
            [-this.width / 2, 0, -this.depth / 2],
            [this.width / 2, 0, -this.depth / 2],
            [-this.width / 2, 0, this.depth / 2],
            [this.width / 2, 0, this.depth / 2]
        ];
        for (const c of corners) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(c[0], (this.wallHeight + 1.5) / 2, c[2]);
            this.group.add(pillar);
            // Neon cap on each pillar
            const capGeo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
            const capMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.85 });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.set(c[0], this.wallHeight + 1.5, c[2]);
            this.group.add(cap);
            this.neonObjects.push(cap);
        }

        // === FRONT STEPS (wider, with red carpet) ===
        const stepGeo = new THREE.BoxGeometry(6, 0.2, 1.5);
        const stepMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2a });
        const step = new THREE.Mesh(stepGeo, stepMat);
        step.position.set(0, 0.1, this.depth / 2 + 0.75);
        this.group.add(step);
        // Red carpet
        const carpetGeo = new THREE.BoxGeometry(3, 0.22, 3);
        const carpetMat = new THREE.MeshLambertMaterial({ color: 0x880022 });
        const carpet = new THREE.Mesh(carpetGeo, carpetMat);
        carpet.position.set(0, 0.11, this.depth / 2 + 1.5);
        this.group.add(carpet);

        // === AWNING / CANOPY over entrance ===
        const awningGeo = new THREE.BoxGeometry(7, 0.15, 3);
        const awningMat = new THREE.MeshLambertMaterial({ color: 0x1a0020 });
        const awning = new THREE.Mesh(awningGeo, awningMat);
        awning.position.set(0, 5.2, this.depth / 2 + 1.5);
        this.group.add(awning);
        // Awning underside neon
        const awningNeonGeo = new THREE.BoxGeometry(6.5, 0.08, 2.5);
        const awningNeonMat = new THREE.MeshBasicMaterial({ color: 0xff1493, transparent: true, opacity: 0.6 });
        const awningNeon = new THREE.Mesh(awningNeonGeo, awningNeonMat);
        awningNeon.position.set(0, 5.1, this.depth / 2 + 1.5);
        this.group.add(awningNeon);
        this.neonObjects.push(awningNeon);
    }

    createSigns() {
        // Main sign: "💃 STRIP CLUB 💃"
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256;
        signCanvas.height = 64;
        const ctx = signCanvas.getContext('2d');
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#ff1493';
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, 250, 58);
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff1493';
        ctx.shadowColor = '#ff1493';
        ctx.shadowBlur = 10;
        ctx.fillText('💃 STRIP CLUB 💃', 128, 30);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.fillText('VIP LOUNGE • OPEN 24/7', 128, 52);

        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.minFilter = THREE.LinearFilter;
        const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
        const signGeo = new THREE.PlaneGeometry(9, 2.2);
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, this.wallHeight + 1.5, this.depth / 2 + 0.1);
        this.group.add(sign);
        this.neonObjects.push(sign);

        // Sign backing
        const backingGeo = new THREE.BoxGeometry(9.4, 2.6, 0.3);
        const backingMat = new THREE.MeshLambertMaterial({ color: 0x0a0a1a });
        const backing = new THREE.Mesh(backingGeo, backingMat);
        backing.position.set(0, this.wallHeight + 1.5, this.depth / 2 - 0.05);
        this.group.add(backing);

        // Score display (stripper count)
        this.scoreCanvas = document.createElement('canvas');
        this.scoreCanvas.width = 128;
        this.scoreCanvas.height = 32;
        this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
        this.scoreTexture.minFilter = THREE.LinearFilter;
        const scoreMat = new THREE.MeshBasicMaterial({ map: this.scoreTexture, transparent: true });
        const scoreGeo = new THREE.PlaneGeometry(4, 1);
        this.scoreSign = new THREE.Mesh(scoreGeo, scoreMat);
        this.scoreSign.position.set(0, this.wallHeight - 0.3, this.depth / 2 + 0.05);
        this.group.add(this.scoreSign);
        this.updateScoreDisplay();

        // Neon glow lights
        const pinkLight = new THREE.PointLight(0xff1493, 2.0, 18);
        pinkLight.position.set(0, this.wallHeight + 1, this.depth / 2 + 2);
        this.group.add(pinkLight);
        this.neonObjects.push(pinkLight);

        const goldLight = new THREE.PointLight(0xffd700, 0.8, 8);
        goldLight.position.set(0, 3, this.depth / 2 + 1);
        this.group.add(goldLight);

        // Side wall symbols
        const sideSymbols = [
            { text: '💃', x: -this.width / 2 - 0.05, rotY: Math.PI / 2 },
            { text: '💋', x: this.width / 2 + 0.05, rotY: -Math.PI / 2 }
        ];
        for (const sym of sideSymbols) {
            const sCanvas = document.createElement('canvas');
            sCanvas.width = 64;
            sCanvas.height = 64;
            const sCtx = sCanvas.getContext('2d');
            sCtx.fillStyle = '#0a0a1a';
            sCtx.fillRect(0, 0, 64, 64);
            sCtx.font = '48px Arial';
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillText(sym.text, 32, 34);
            const sTexture = new THREE.CanvasTexture(sCanvas);
            const sMat = new THREE.MeshBasicMaterial({ map: sTexture, transparent: true });
            const sGeo = new THREE.PlaneGeometry(2.5, 2.5);
            const sMesh = new THREE.Mesh(sGeo, sMat);
            sMesh.position.set(sym.x, this.wallHeight - 1.5, 0);
            sMesh.rotation.y = sym.rotY;
            this.group.add(sMesh);
            this.neonObjects.push(sMesh);
        }
    }

    createInterior() {
        // Stage platform
        const stageGeo = new THREE.BoxGeometry(6, 0.5, 3);
        const stageMat = new THREE.MeshLambertMaterial({ color: 0x2a0a2e });
        const stage = new THREE.Mesh(stageGeo, stageMat);
        stage.position.set(0, 0.55, -this.depth / 2 + 2);
        this.group.add(stage);

        // Stage top (shiny)
        const stageTopGeo = new THREE.BoxGeometry(6.2, 0.05, 3.2);
        const stageTopMat = new THREE.MeshBasicMaterial({ color: 0x330033 });
        const stageTop = new THREE.Mesh(stageTopGeo, stageTopMat);
        stageTop.position.set(0, 0.83, -this.depth / 2 + 2);
        this.group.add(stageTop);

        // Pole (center stage)
        const poleGeo = new THREE.BoxGeometry(0.15, this.wallHeight - 0.5, 0.15);
        const poleMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(0, this.wallHeight / 2, -this.depth / 2 + 2);
        this.group.add(pole);
        this.neonObjects.push(pole);

        // Bar counter
        const barGeo = new THREE.BoxGeometry(4, 1.2, 1);
        const barMat = new THREE.MeshLambertMaterial({ color: 0x2a1a3e });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(-3, 0.6, 1);
        this.group.add(bar);

        // Seating (small cubes)
        const seatMat = new THREE.MeshLambertMaterial({ color: 0x440044 });
        const seatPositions = [[2, 0], [3.5, 0], [2, 1.5], [3.5, 1.5], [2, -1.5], [3.5, -1.5]];
        for (const sp of seatPositions) {
            const seatGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
            const seat = new THREE.Mesh(seatGeo, seatMat);
            seat.position.set(sp[0], 0.3, sp[1]);
            this.group.add(seat);
        }

        // Interior pink/purple lighting
        const interiorLight1 = new THREE.PointLight(0xff1493, 1.0, 15);
        interiorLight1.position.set(0, this.wallHeight - 1, -this.depth / 2 + 2);
        this.group.add(interiorLight1);
        this.neonObjects.push(interiorLight1);

        const interiorLight2 = new THREE.PointLight(0xaa00ff, 0.6, 10);
        interiorLight2.position.set(0, this.wallHeight - 1, 1);
        this.group.add(interiorLight2);

        // Ceiling neon strips
        const ceilingMat = new THREE.MeshBasicMaterial({ color: 0xff1493, transparent: true, opacity: 0.8 });
        const ceilGeo1 = new THREE.BoxGeometry(this.width - 2, 0.1, 0.2);
        const ceil1 = new THREE.Mesh(ceilGeo1, ceilingMat);
        ceil1.position.set(0, this.wallHeight - 0.3, -1);
        this.group.add(ceil1);
        this.neonObjects.push(ceil1);
        const ceil2 = new THREE.Mesh(ceilGeo1, ceilingMat);
        ceil2.position.set(0, this.wallHeight - 0.3, 2);
        this.group.add(ceil2);
        this.neonObjects.push(ceil2);
    }

    updateScoreDisplay() {
        const ctx = this.scoreCanvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 32);
        ctx.strokeStyle = '#ff1493';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 124, 28);
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 4;
        ctx.fillText('💃' + this.stripperScore + ' | F' + this.floors + ' | $' + this.getIncomePerSecond() + '/s', 64, 22);
        if (this.scoreTexture) this.scoreTexture.needsUpdate = true;
    }

    depositStrippers(count) {
        this.stripperScore += count;
        this.updateScoreDisplay();
    }

    // Get income per second: $1 per hooker per floor
    getIncomePerSecond() {
        return this.stripperScore * this.floors;
    }

    // Get cost to add next floor (exponential: $5000 * 3^(floors-1))
    getFloorUpgradeCost() {
        if (this.floors >= this.maxFloors) return Infinity;
        return Math.floor(5000 * Math.pow(3, this.floors - 1));
    }

    // Add a floor visually and logically
    addFloor() {
        if (this.floors >= this.maxFloors) return false;
        this.floors++;

        // Add visual floor on top of building
        const floorY = this.wallHeight + (this.floors - 1) * this.floorHeight;
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a0515 });
        const wallThickness = 0.5;

        // Floor slab
        const slabGeo = new THREE.BoxGeometry(this.width + 0.5, 0.3, this.depth + 0.5);
        const slabMat = new THREE.MeshLambertMaterial({ color: 0x050510 });
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(0, floorY, 0);
        this.group.add(slab);

        // Walls for new floor
        const fh = this.floorHeight;
        // Back wall
        const bwGeo = new THREE.BoxGeometry(this.width, fh, wallThickness);
        const bw = new THREE.Mesh(bwGeo, wallMat);
        bw.position.set(0, floorY + fh / 2, -this.depth / 2 + wallThickness / 2);
        this.group.add(bw);
        // Side walls
        const swGeo = new THREE.BoxGeometry(wallThickness, fh, this.depth);
        const lw = new THREE.Mesh(swGeo, wallMat);
        lw.position.set(-this.width / 2 + wallThickness / 2, floorY + fh / 2, 0);
        this.group.add(lw);
        const rw = new THREE.Mesh(swGeo, wallMat);
        rw.position.set(this.width / 2 - wallThickness / 2, floorY + fh / 2, 0);
        this.group.add(rw);
        // Front wall
        const fwGeo = new THREE.BoxGeometry(this.width, fh, wallThickness);
        const fw = new THREE.Mesh(fwGeo, wallMat);
        fw.position.set(0, floorY + fh / 2, this.depth / 2 - wallThickness / 2);
        this.group.add(fw);

        // Windows on front (purple glow)
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.6 });
        const numWindows = 4;
        const windowSpacing = this.width / (numWindows + 1);
        for (let i = 1; i <= numWindows; i++) {
            const winGeo = new THREE.BoxGeometry(1.2, 1.5, 0.1);
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(-this.width / 2 + i * windowSpacing, floorY + fh / 2, this.depth / 2);
            this.group.add(win);
            this.neonObjects.push(win);
        }

        // Neon strip around new floor
        const neonMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.85 });
        const nfGeo = new THREE.BoxGeometry(this.width + 1, 0.15, 0.15);
        const nf = new THREE.Mesh(nfGeo, neonMat);
        nf.position.set(0, floorY + fh, this.depth / 2 + 0.3);
        this.group.add(nf);
        this.neonObjects.push(nf);

        // New roof on top
        const roofGeo = new THREE.BoxGeometry(this.width + 1.5, 0.4, this.depth + 1.5);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x050510 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, floorY + fh + 0.2, 0);
        this.group.add(roof);

        // Interior light for new floor
        const light = new THREE.PointLight(0xff1493, 0.8, 12);
        light.position.set(0, floorY + fh - 1, 0);
        this.group.add(light);
        this.neonObjects.push(light);

        this.updateScoreDisplay();
        return true;
    }

    // Generate income - returns money earned this tick
    generateIncome(dt) {
        if (this.stripperScore <= 0) return 0;
        this.incomeTimer += dt;
        let earned = 0;
        while (this.incomeTimer >= 1.0) {
            this.incomeTimer -= 1.0;
            earned += this.getIncomePerSecond();
        }
        this.totalEarned += earned;
        return earned;
    }

    update(dt, playerPos) {
        if (!this.alive) return;
        const dist = this.position.distanceTo(playerPos);
        if (dist > 80) return;

        this.glowPhase += dt * 4;
        const pulse = 0.5 + Math.sin(this.glowPhase) * 0.5;
        const pulse2 = 0.5 + Math.sin(this.glowPhase * 1.5 + 1) * 0.5;
        for (const obj of this.neonObjects) {
            if (obj.material && obj.material.opacity !== undefined) {
                obj.material.opacity = 0.4 + pulse * 0.6;
            }
            if (obj.intensity !== undefined) {
                obj.intensity = 0.5 + pulse2 * 1.5;
            }
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

// Strip Club Manager - tracks purchased strip clubs only (no auto-spawn)
class StripClubManager {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.clubs = [];
        this.glock = null; // Reference to glock for adding income
    }

    spawnClubNearStore(store) {
        const BUILDING_SETBACK = 15;
        const offset = 30;

        const cosR = Math.cos(store.rotation);
        const sinR = Math.sin(store.rotation);

        const clubX = store.position.x + Math.round(offset * cosR);
        const clubZ = store.position.z - Math.round(offset * sinR);
        const clubRot = store.rotation;

        const roadEdgeLocalZ = 10;
        const roadEdgeWX = Math.floor(clubX) + Math.round(roadEdgeLocalZ * Math.sin(clubRot));
        const roadEdgeWZ = Math.floor(clubZ) + Math.round(roadEdgeLocalZ * Math.cos(clubRot));
        const roadHeight = this.world.getNearestRoadEdgeHeight(roadEdgeWX, roadEdgeWZ);

        let sy;
        if (roadHeight !== null && roadHeight !== undefined && roadHeight > WATER_LEVEL + 2) {
            sy = roadHeight;
        } else {
            sy = this.world.getSpawnHeight(clubX, clubZ);
        }

        this.world.update(clubX, clubZ);

        const club = new StripClub(this.scene, this.world, clubX, sy, clubZ, clubRot);
        this.clubs.push(club);
        return club;
    }

    // Find nearest club within range for upgrades/deposits
    getNearestClub(playerPos, maxDist) {
        maxDist = maxDist || 15;
        let nearest = null;
        let nearestDist = maxDist;
        for (const club of this.clubs) {
            if (!club.alive) continue;
            const dist = club.position.distanceTo(playerPos);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = club;
            }
        }
        return nearest;
    }

    // Get total income per second across all clubs
    getTotalIncomePerSecond() {
        let total = 0;
        for (const club of this.clubs) {
            total += club.getIncomePerSecond();
        }
        return total;
    }

    update(dt, playerPos) {
        // Generate income from all clubs and add to player money
        let totalIncome = 0;
        for (const club of this.clubs) {
            club.update(dt, playerPos);
            totalIncome += club.generateIncome(dt);
        }

        // Add income to player's money
        if (totalIncome > 0 && this.glock) {
            this.glock.money += totalIncome;
        }
    }

    getTotalScore() {
        let total = 0;
        for (const club of this.clubs) {
            total += club.stripperScore;
        }
        return total;
    }

    getCount() {
        return this.clubs.length;
    }
}

window.StripClub = StripClub;
window.StripClubManager = StripClubManager;
