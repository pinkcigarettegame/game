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

        // Building dimensions (slightly bigger than liquor store)
        this.width = 12;
        this.depth = 10;
        this.wallHeight = 7;

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
        // Floor
        const floorGeo = new THREE.BoxGeometry(this.width, 0.3, this.depth);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a0a1a });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, 0.15, 0);
        this.group.add(floor);

        // Walls (dark pink/purple)
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x2a0a2e });
        const wallThickness = 0.4;

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

        // Front wall sections
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

        // Door frame (hot pink)
        const frameMat = new THREE.MeshLambertMaterial({ color: 0xff1493 });
        const frameVertGeo = new THREE.BoxGeometry(0.2, 4.5, 0.5);
        const leftFrame = new THREE.Mesh(frameVertGeo, frameMat);
        leftFrame.position.set(-2.5, 2.25, this.depth / 2 - 0.1);
        this.group.add(leftFrame);
        const rightFrame = new THREE.Mesh(frameVertGeo, frameMat);
        rightFrame.position.set(2.5, 2.25, this.depth / 2 - 0.1);
        this.group.add(rightFrame);
        const frameTopGeo = new THREE.BoxGeometry(5.2, 0.2, 0.5);
        const topFrame = new THREE.Mesh(frameTopGeo, frameMat);
        topFrame.position.set(0, 4.5, this.depth / 2 - 0.1);
        this.group.add(topFrame);

        // Roof
        const roofGeo = new THREE.BoxGeometry(this.width + 1, 0.4, this.depth + 1);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x0d0d1a });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, this.wallHeight + 0.2, 0);
        this.group.add(roof);

        // Neon edge strips (hot pink)
        const neonStripMat = new THREE.MeshBasicMaterial({ color: 0xff1493, transparent: true, opacity: 0.9 });
        const neonFrontGeo = new THREE.BoxGeometry(this.width + 1.2, 0.15, 0.15);
        const neonFront = new THREE.Mesh(neonFrontGeo, neonStripMat);
        neonFront.position.set(0, this.wallHeight + 0.45, this.depth / 2 + 0.5);
        this.group.add(neonFront);
        this.neonObjects.push(neonFront);

        const neonSideGeo = new THREE.BoxGeometry(0.15, 0.15, this.depth + 1.2);
        const neonLeft = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonLeft.position.set(-this.width / 2 - 0.5, this.wallHeight + 0.45, 0);
        this.group.add(neonLeft);
        this.neonObjects.push(neonLeft);
        const neonRight = new THREE.Mesh(neonSideGeo, neonStripMat);
        neonRight.position.set(this.width / 2 + 0.5, this.wallHeight + 0.45, 0);
        this.group.add(neonRight);
        this.neonObjects.push(neonRight);
        const neonBack = new THREE.Mesh(neonFrontGeo, neonStripMat);
        neonBack.position.set(0, this.wallHeight + 0.45, -this.depth / 2 - 0.5);
        this.group.add(neonBack);
        this.neonObjects.push(neonBack);

        // Corner pillars (pink)
        const pillarGeo = new THREE.BoxGeometry(0.5, this.wallHeight + 0.5, 0.5);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0xcc1177 });
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

        // Front step
        const stepGeo = new THREE.BoxGeometry(6, 0.2, 1);
        const stepMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
        const step = new THREE.Mesh(stepGeo, stepMat);
        step.position.set(0, 0.1, this.depth / 2 + 0.5);
        this.group.add(step);
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
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 4;
        ctx.fillText('💃 ' + this.stripperScore + ' STRIPPERS', 64, 22);
        if (this.scoreTexture) this.scoreTexture.needsUpdate = true;
    }

    depositStrippers(count) {
        this.stripperScore += count;
        this.updateScoreDisplay();
    }

    update(dt, playerPos) {
        if (!this.alive) return;
        const dist = this.position.distanceTo(playerPos);
        if (dist > 60) return;

        this.glowPhase += dt * 4; // Faster pulse than liquor store
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

// Strip Club Manager - tracks all strip clubs
class StripClubManager {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.clubs = [];
    }

    spawnClubNearStore(store) {
        // Spawn the strip club on the opposite side of the road from the store
        // or offset along the road
        const BUILDING_SETBACK = 15;
        const offset = 30; // 30 blocks along the road from the store

        const cosR = Math.cos(store.rotation);
        const sinR = Math.sin(store.rotation);

        // Place it offset along the road (perpendicular to store facing direction)
        const clubX = store.position.x + Math.round(offset * cosR);
        const clubZ = store.position.z - Math.round(offset * sinR);
        const clubRot = store.rotation;

        // Get road height
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

        // Make sure terrain is loaded
        this.world.update(clubX, clubZ);

        const club = new StripClub(this.scene, this.world, clubX, sy, clubZ, clubRot);
        this.clubs.push(club);
        return club;
    }

    update(dt, playerPos) {
        for (const club of this.clubs) {
            club.update(dt, playerPos);
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
