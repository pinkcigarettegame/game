// Crypto Billboard - Roadside billboards showing top 10 crypto prices with charts
// Cycles through coins displaying price, 24h change, and sparkline chart

class CryptoBillboard {
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

        // Billboard screen dimensions
        this.screenWidth = 10;
        this.screenHeight = 5;
        this.poleHeight = 4;

        // Coin cycling state
        this.currentCoinIndex = Math.floor(Math.random() * 10);
        this.coinDisplayTime = 0;
        this.coinCycleDuration = 5; // seconds per coin
        this.fadeAlpha = 1.0;
        this.fading = false;
        this.fadeTimer = 0;
        this.fadeDuration = 0.4;

        // Canvas for screen
        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.width = 512;
        this.screenCanvas.height = 320;
        this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
        this.screenTexture.minFilter = THREE.LinearFilter;
        this.screenTexture.magFilter = THREE.LinearFilter;

        this.clearArea();
        this.createStructure();
        this.updateScreen();
        this.scene.add(this.group);
    }

    clearArea() {
        var wx = Math.floor(this.position.x);
        var wy = Math.floor(this.position.y);
        var wz = Math.floor(this.position.z);
        var rot = this.rotation;
        var cosR = Math.cos(rot);
        var sinR = Math.sin(rot);

        for (var lx = -6; lx <= 6; lx++) {
            for (var lz = -2; lz <= 2; lz++) {
                var bx = wx + Math.round(lx * cosR + lz * sinR);
                var bz = wz + Math.round(-lx * sinR + lz * cosR);
                for (var by = wy; by < wy + 20; by++) {
                    var block = this.world.getBlock(bx, by, bz);
                    if (block !== BlockType.AIR && block !== BlockType.WATER &&
                        block !== BlockType.STONE && block !== BlockType.DIRT &&
                        block !== BlockType.GRASS && block !== BlockType.SAND &&
                        block !== BlockType.ROAD_ASPHALT && block !== BlockType.ROAD_LINE &&
                        block !== BlockType.ROAD_CURB) {
                        this.world.setBlock(bx, by, bz, BlockType.AIR);
                    }
                }
            }
        }
    }

    createStructure() {
        var poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        var darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });

        // Left support pole
        var poleGeo = new THREE.BoxGeometry(0.4, this.poleHeight, 0.4);
        var leftPole = new THREE.Mesh(poleGeo, poleMat);
        leftPole.position.set(-this.screenWidth / 2 + 0.5, this.poleHeight / 2, 0);
        this.group.add(leftPole);

        // Right support pole
        var rightPole = new THREE.Mesh(poleGeo, poleMat);
        rightPole.position.set(this.screenWidth / 2 - 0.5, this.poleHeight / 2, 0);
        this.group.add(rightPole);

        // Cross brace
        var braceGeo = new THREE.BoxGeometry(this.screenWidth - 0.6, 0.25, 0.25);
        var brace = new THREE.Mesh(braceGeo, poleMat);
        brace.position.set(0, this.poleHeight - 0.5, 0);
        this.group.add(brace);

        // Screen backing (dark box behind screen)
        var backingGeo = new THREE.BoxGeometry(this.screenWidth + 0.4, this.screenHeight + 0.4, 0.3);
        var backing = new THREE.Mesh(backingGeo, darkMat);
        backing.position.set(0, this.poleHeight + this.screenHeight / 2, 0);
        this.group.add(backing);

        // Screen (front face with canvas texture)
        var screenMat = new THREE.MeshBasicMaterial({ map: this.screenTexture, transparent: true });
        var screenGeo = new THREE.PlaneGeometry(this.screenWidth, this.screenHeight);
        var screenFront = new THREE.Mesh(screenGeo, screenMat);
        screenFront.position.set(0, this.poleHeight + this.screenHeight / 2, 0.16);
        this.group.add(screenFront);

        // Screen back face
        var screenBack = new THREE.Mesh(screenGeo, screenMat);
        screenBack.position.set(0, this.poleHeight + this.screenHeight / 2, -0.16);
        screenBack.rotation.y = Math.PI;
        this.group.add(screenBack);

        // Neon border - top
        var neonMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
        var neonTopGeo = new THREE.BoxGeometry(this.screenWidth + 0.6, 0.15, 0.4);
        var neonTop = new THREE.Mesh(neonTopGeo, neonMat);
        neonTop.position.set(0, this.poleHeight + this.screenHeight + 0.25, 0);
        this.group.add(neonTop);
        this.neonObjects.push(neonTop);

        // Neon border - bottom
        var neonBottom = new THREE.Mesh(neonTopGeo, neonMat);
        neonBottom.position.set(0, this.poleHeight - 0.25, 0);
        this.group.add(neonBottom);
        this.neonObjects.push(neonBottom);

        // Neon border - left
        var neonSideGeo = new THREE.BoxGeometry(0.15, this.screenHeight + 0.6, 0.4);
        var neonLeft = new THREE.Mesh(neonSideGeo, neonMat);
        neonLeft.position.set(-this.screenWidth / 2 - 0.25, this.poleHeight + this.screenHeight / 2, 0);
        this.group.add(neonLeft);
        this.neonObjects.push(neonLeft);

        // Neon border - right
        var neonRight = new THREE.Mesh(neonSideGeo, neonMat);
        neonRight.position.set(this.screenWidth / 2 + 0.25, this.poleHeight + this.screenHeight / 2, 0);
        this.group.add(neonRight);
        this.neonObjects.push(neonRight);

        // Top light fixtures
        var fixtureMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        var fixtureGeo = new THREE.BoxGeometry(1.0, 0.3, 0.6);
        var bulbGeo = new THREE.BoxGeometry(0.8, 0.1, 0.4);
        var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.9 });

        var lightPositions = [-3, 0, 3];
        for (var li = 0; li < lightPositions.length; li++) {
            var lx = lightPositions[li];
            var fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(lx, this.poleHeight + this.screenHeight + 0.6, 0.3);
            this.group.add(fixture);

            var bulb = new THREE.Mesh(bulbGeo, bulbMat);
            bulb.position.set(lx, this.poleHeight + this.screenHeight + 0.42, 0.3);
            this.group.add(bulb);
            this.neonObjects.push(bulb);
        }

        // Point light to illuminate the billboard
        var billboardLight = new THREE.PointLight(0x00ff88, 0.8, 15);
        billboardLight.position.set(0, this.poleHeight + this.screenHeight + 1, 2);
        this.group.add(billboardLight);
        this.neonObjects.push(billboardLight);

        // "LIVE CRYPTO" small label at top
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 32;
        var lCtx = labelCanvas.getContext('2d');
        lCtx.fillStyle = '#0a0a1a';
        lCtx.fillRect(0, 0, 256, 32);
        lCtx.font = 'bold 18px monospace';
        lCtx.textAlign = 'center';
        lCtx.fillStyle = '#00ff88';
        lCtx.shadowColor = '#00ff88';
        lCtx.shadowBlur = 8;
        lCtx.fillText('LIVE CRYPTO PRICES', 128, 22);
        var labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.minFilter = THREE.LinearFilter;
        var labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true });
        var labelGeo = new THREE.PlaneGeometry(4, 0.5);
        var labelFront = new THREE.Mesh(labelGeo, labelMat);
        labelFront.position.set(0, this.poleHeight + this.screenHeight + 0.9, 0.2);
        this.group.add(labelFront);
        var labelBack = new THREE.Mesh(labelGeo, labelMat);
        labelBack.position.set(0, this.poleHeight + this.screenHeight + 0.9, -0.2);
        labelBack.rotation.y = Math.PI;
        this.group.add(labelBack);
    }

    updateScreen() {
        var fetcher = window.cryptoPriceFetcher;
        if (!fetcher || !fetcher.initialized) return;

        var coin = fetcher.getCoinByIndex(this.currentCoinIndex);
        if (!coin) return;

        var ctx = this.screenCanvas.getContext('2d');
        var w = this.screenCanvas.width;
        var h = this.screenCanvas.height;

        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        // Border
        ctx.strokeStyle = '#00ff8844';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        // Apply fade alpha
        ctx.globalAlpha = this.fadeAlpha;

        // Coin color accent line at top
        ctx.fillStyle = coin.color;
        ctx.fillRect(8, 8, w - 16, 4);

        // Coin symbol and name
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = coin.color;
        ctx.shadowColor = coin.color;
        ctx.shadowBlur = 12;
        ctx.fillText(coin.symbol, 20, 65);

        ctx.font = '22px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.shadowBlur = 0;
        ctx.fillText(coin.name, 22, 92);

        // Price (large, right-aligned)
        ctx.font = 'bold 44px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillText(coin.priceFormatted, w - 20, 65);

        // 24h change
        var changeColor = coin.change24h >= 0 ? '#00ff44' : '#ff4444';
        var arrow = coin.change24h >= 0 ? '\u25B2' : '\u25BC';
        var changeText = arrow + ' ' + Math.abs(coin.change24h).toFixed(2) + '%';
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = changeColor;
        ctx.shadowColor = changeColor;
        ctx.shadowBlur = 8;
        ctx.fillText(changeText, w - 20, 95);

        // Divider line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(15, 110);
        ctx.lineTo(w - 15, 110);
        ctx.stroke();

        // "7D CHART" label
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#666688';
        ctx.fillText('7D CHART', 20, 128);

        // Draw sparkline chart
        this.drawSparkline(ctx, coin, 15, 135, w - 30, h - 155);

        // "LIVE" indicator
        var isLive = fetcher.isLive();
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = isLive ? '#00ff44' : '#ffaa00';
        ctx.shadowColor = isLive ? '#00ff44' : '#ffaa00';
        ctx.shadowBlur = 6;
        ctx.fillText(isLive ? '\u25CF LIVE' : '\u25CF CACHED', w - 15, 128);

        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        if (this.screenTexture) {
            this.screenTexture.needsUpdate = true;
        }
    }

    drawSparkline(ctx, coin, x, y, w, h) {
        var sparkline = coin.sparkline;
        if (!sparkline || sparkline.length < 2) {
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#444466';
            ctx.fillText('Loading chart data...', x + w / 2, y + h / 2);
            return;
        }

        var points = sparkline;
        var len = points.length;

        // Find min/max for scaling
        var min = points[0];
        var max = points[0];
        for (var i = 1; i < len; i++) {
            if (points[i] < min) min = points[i];
            if (points[i] > max) max = points[i];
        }
        var range = max - min;
        if (range === 0) range = 1;

        // Add padding to range
        var padding = range * 0.1;
        min -= padding;
        max += padding;
        range = max - min;

        // Determine if overall trend is up or down
        var isUp = points[len - 1] >= points[0];
        var lineColor = isUp ? '#00ff44' : '#ff4444';
        var fillColorTop = isUp ? 'rgba(0, 255, 68, 0.3)' : 'rgba(255, 68, 68, 0.3)';
        var fillColorBottom = isUp ? 'rgba(0, 255, 68, 0.02)' : 'rgba(255, 68, 68, 0.02)';

        // Draw filled area under the line
        var gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, fillColorTop);
        gradient.addColorStop(1, fillColorBottom);

        ctx.beginPath();
        ctx.moveTo(x, y + h);
        for (var i = 0; i < len; i++) {
            var px = x + (i / (len - 1)) * w;
            var py = y + h - ((points[i] - min) / range) * h;
            ctx.lineTo(px, py);
        }
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw the line
        ctx.beginPath();
        for (var i = 0; i < len; i++) {
            var px = x + (i / (len - 1)) * w;
            var py = y + h - ((points[i] - min) / range) * h;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw current price dot at end
        var lastPx = x + w;
        var lastPy = y + h - ((points[len - 1] - min) / range) * h;
        ctx.beginPath();
        ctx.arc(lastPx, lastPy, 4, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Price labels on Y axis
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#555577';
        var fetcher = window.cryptoPriceFetcher;
        if (fetcher) {
            ctx.fillText(fetcher.formatPrice(max + padding), x + w, y + 12);
            ctx.fillText(fetcher.formatPrice(min + padding), x + w, y + h - 4);
        }

        // Grid lines (horizontal, subtle)
        ctx.strokeStyle = '#1a1a33';
        ctx.lineWidth = 0.5;
        for (var g = 0; g < 4; g++) {
            var gy = y + (g / 3) * h;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + w, gy);
            ctx.stroke();
        }
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        var dist = this.position.distanceTo(playerPos);
        if (dist > 60) return;

        // Animate neon glow
        this.glowPhase += dt * 3;
        var pulse = 0.6 + Math.sin(this.glowPhase) * 0.4;
        for (var i = 0; i < this.neonObjects.length; i++) {
            var obj = this.neonObjects[i];
            if (obj.material && obj.material.opacity !== undefined) {
                obj.material.opacity = pulse;
            }
            if (obj.intensity !== undefined) {
                obj.intensity = 0.5 + Math.sin(this.glowPhase * 1.3) * 0.4;
            }
        }

        // Coin cycling with fade transition
        this.coinDisplayTime += dt;

        if (!this.fading && this.coinDisplayTime >= this.coinCycleDuration) {
            this.fading = true;
            this.fadeTimer = 0;
        }

        if (this.fading) {
            this.fadeTimer += dt;
            if (this.fadeTimer < this.fadeDuration) {
                // Fade out
                this.fadeAlpha = 1.0 - (this.fadeTimer / this.fadeDuration);
            } else if (this.fadeTimer < this.fadeDuration * 2) {
                // Switch coin at midpoint
                if (this.fadeAlpha <= 0.05) {
                    var fetcher = window.cryptoPriceFetcher;
                    var coinCount = fetcher ? fetcher.getCoinCount() : 10;
                    this.currentCoinIndex = (this.currentCoinIndex + 1) % coinCount;
                }
                // Fade in
                this.fadeAlpha = (this.fadeTimer - this.fadeDuration) / this.fadeDuration;
            } else {
                this.fadeAlpha = 1.0;
                this.fading = false;
                this.coinDisplayTime = 0;
            }
        }

        // Throttle canvas redraws to ~10fps
        this._screenTimer = (this._screenTimer || 0) + dt;
        if (this._screenTimer > 0.1) {
            this._screenTimer = 0;
            this.updateScreen();
        }
    }

    dispose() {
        this.alive = false;
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(function(child) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
        this.neonObjects = [];
        if (this.screenCanvas) {
            this.screenCanvas = null;
        }
        if (this.screenTexture) {
            this.screenTexture.dispose();
            this.screenTexture = null;
        }
    }
}

// Billboard Spawner - places billboards alongside roads
class BillboardSpawner {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.billboards = [];
        this.maxBillboards = 8;
        this.spawnCooldown = 3;
        this.spawnInterval = 6;
        this.checkedPositions = new Set();
    }

    update(dt, playerPos) {
        this.spawnCooldown -= dt;

        if (this.spawnCooldown <= 0 && this.billboards.length < this.maxBillboards) {
            this.trySpawn(playerPos);
            this.spawnCooldown = this.spawnInterval;
        }

        for (var i = this.billboards.length - 1; i >= 0; i--) {
            var bb = this.billboards[i];
            bb.update(dt, playerPos);

            var dist = bb.position.distanceTo(playerPos);
            if (dist > 150) {
                bb.dispose();
                this.billboards.splice(i, 1);
            }
        }
    }

    trySpawn(playerPos) {
        var ROAD_SPACING = 128;
        var ROAD_HALF_WIDTH = 5;
        var BILLBOARD_SETBACK = 8;

        var nearestXRoad = Math.round(playerPos.x / ROAD_SPACING) * ROAD_SPACING;
        var nearestZRoad = Math.round(playerPos.z / ROAD_SPACING) * ROAD_SPACING;

        var candidates = [];
        var offsets = [-60, -45, -30, -15, 15, 30, 45, 60];

        // Billboards angled at 45° toward oncoming traffic for better readability.
        // Base rotation faces the road, then offset by PI/4 to angle toward traffic.
        var ANGLE_OFFSET = Math.PI / 4; // 45 degrees

        // Along Z-aligned road (traffic flows along Z)
        for (var oi = 0; oi < offsets.length; oi++) {
            var oz = offsets[oi];
            // +X side of Z-aligned road: base faces -X, angled 45° toward -Z traffic
            candidates.push({
                x: nearestXRoad + BILLBOARD_SETBACK,
                z: nearestZRoad + oz,
                rot: -Math.PI / 2 + ANGLE_OFFSET
            });
            // -X side of Z-aligned road: base faces +X, angled 45° toward +Z traffic
            candidates.push({
                x: nearestXRoad - BILLBOARD_SETBACK,
                z: nearestZRoad + oz,
                rot: Math.PI / 2 - ANGLE_OFFSET
            });
        }

        // Along X-aligned road (traffic flows along X)
        for (var oi = 0; oi < offsets.length; oi++) {
            var ox = offsets[oi];
            // +Z side of X-aligned road: base faces -Z, angled 45° toward -X traffic
            candidates.push({
                x: nearestXRoad + ox,
                z: nearestZRoad + BILLBOARD_SETBACK,
                rot: Math.PI - ANGLE_OFFSET
            });
            // -Z side of X-aligned road: base faces +Z, angled 45° toward +X traffic
            candidates.push({
                x: nearestXRoad + ox,
                z: nearestZRoad - BILLBOARD_SETBACK,
                rot: ANGLE_OFFSET
            });
        }

        // Adjacent road cells
        var roadOffsets = [ROAD_SPACING, -ROAD_SPACING];
        for (var ri = 0; ri < roadOffsets.length; ri++) {
            var roadOff = roadOffsets[ri];
            for (var oi = 0; oi < offsets.length; oi++) {
                var oz = offsets[oi];
                candidates.push({
                    x: nearestXRoad + roadOff + BILLBOARD_SETBACK,
                    z: nearestZRoad + oz,
                    rot: -Math.PI / 2 + ANGLE_OFFSET
                });
                candidates.push({
                    x: nearestXRoad + roadOff - BILLBOARD_SETBACK,
                    z: nearestZRoad + oz,
                    rot: Math.PI / 2 - ANGLE_OFFSET
                });
            }
            for (var oi = 0; oi < offsets.length; oi++) {
                var ox = offsets[oi];
                candidates.push({
                    x: nearestXRoad + ox,
                    z: nearestZRoad + roadOff + BILLBOARD_SETBACK,
                    rot: Math.PI - ANGLE_OFFSET
                });
                candidates.push({
                    x: nearestXRoad + ox,
                    z: nearestZRoad + roadOff - BILLBOARD_SETBACK,
                    rot: ANGLE_OFFSET
                });
            }
        }

        // Shuffle candidates
        for (var i = candidates.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = temp;
        }

        for (var ci = 0; ci < candidates.length; ci++) {
            var cand = candidates[ci];
            var key = Math.round(cand.x / 10) + ',' + Math.round(cand.z / 10);
            if (this.checkedPositions.has(key)) continue;
            this.checkedPositions.add(key);

            var dx = cand.x - playerPos.x;
            var dz = cand.z - playerPos.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 20 || dist > 100) continue;

            // Check distance from existing billboards
            var tooClose = false;
            for (var bi = 0; bi < this.billboards.length; bi++) {
                var bb = this.billboards[bi];
                var sd = Math.sqrt(
                    Math.pow(bb.position.x - cand.x, 2) +
                    Math.pow(bb.position.z - cand.z, 2)
                );
                if (sd < 40) { tooClose = true; break; }
            }
            if (tooClose) continue;

            // Check distance from liquor stores
            if (window.liquorStoreSpawner && window.liquorStoreSpawner.stores) {
                for (var si = 0; si < window.liquorStoreSpawner.stores.length; si++) {
                    var store = window.liquorStoreSpawner.stores[si];
                    var sd = Math.sqrt(
                        Math.pow(store.position.x - cand.x, 2) +
                        Math.pow(store.position.z - cand.z, 2)
                    );
                    if (sd < 30) { tooClose = true; break; }
                }
            }
            if (tooClose) continue;

            // Avoid intersections
            if (this.isNearIntersection(cand.x, cand.z)) continue;

            // Get spawn height
            var sy = this.world.getSpawnHeight(Math.floor(cand.x), Math.floor(cand.z));
            if (sy <= WATER_LEVEL + 2) continue;

            // Check ground is solid
            var groundBlock = this.world.getBlock(Math.floor(cand.x), sy - 1, Math.floor(cand.z));
            if (groundBlock === BlockType.AIR || groundBlock === BlockType.WATER) continue;

            var billboard = new CryptoBillboard(this.scene, this.world, cand.x, sy, cand.z, cand.rot);
            this.billboards.push(billboard);
            return;
        }
    }

    isNearIntersection(wx, wz) {
        var ROAD_SPACING = 128;
        var MIN_DIST = 12;

        var nearestXRoad = Math.round(wx / ROAD_SPACING) * ROAD_SPACING;
        var nearestZRoad = Math.round(wz / ROAD_SPACING) * ROAD_SPACING;

        if (Math.abs(wx - nearestXRoad) < MIN_DIST && Math.abs(wz - nearestZRoad) < MIN_DIST) {
            return true;
        }
        return false;
    }

    getCount() {
        return this.billboards.length;
    }
}

window.CryptoBillboard = CryptoBillboard;
window.BillboardSpawner = BillboardSpawner;
