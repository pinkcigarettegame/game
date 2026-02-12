// World and Chunk management
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const WATER_LEVEL = 20;
const RENDER_DISTANCE = 4;

class Chunk {
    constructor(cx, cz, world) {
        this.cx = cx;
        this.cz = cz;
        this.world = world;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.mesh = null;
        this.dirty = true;
        this.generated = false;
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BlockType.AIR;
        }
        return this.blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
    }

    setBlock(x, y, z, type) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
        this.blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = type;
        this.dirty = true;
    }

    // Check if a world position is on a road, returns {onRoad, roadHeight, distFromCenter, roadWidth, isXRoad, isZRoad}
    getRoadInfo(wx, wz, noise) {
        const ROAD_SPACING = 128;   // Distance between road centers (more sparse)
        const ROAD_WIDTH = 5;       // Half-width of road (total width = 11 blocks)
        const ROAD_SMOOTH = 3;      // Extra blocks for terrain smoothing near road

        // Use noise to offset the grid so roads aren't perfectly straight
        // X-aligned roads (running along X axis, spaced along Z)
        const zRoadBase = Math.round(wz / ROAD_SPACING) * ROAD_SPACING;
        const zRoadOffset = noise.noise2D(wx * 0.005, zRoadBase * 0.1) * 4;
        const zRoadCenter = zRoadBase + zRoadOffset;
        const distFromZRoad = Math.abs(wz - zRoadCenter);

        // Z-aligned roads (running along Z axis, spaced along X)
        const xRoadBase = Math.round(wx / ROAD_SPACING) * ROAD_SPACING;
        const xRoadOffset = noise.noise2D(xRoadBase * 0.1, wz * 0.005) * 4;
        const xRoadCenter = xRoadBase + xRoadOffset;
        const distFromXRoad = Math.abs(wx - xRoadCenter);

        const onZRoad = distFromZRoad <= ROAD_WIDTH;
        const onXRoad = distFromXRoad <= ROAD_WIDTH;
        const nearZRoad = distFromZRoad <= ROAD_WIDTH + ROAD_SMOOTH;
        const nearXRoad = distFromXRoad <= ROAD_WIDTH + ROAD_SMOOTH;

        // Calculate road height using VERY wide sampling for ultra-smooth roads
        // Only use the lowest frequency noise octave, sampled very broadly
        let roadHeight = WATER_LEVEL + 4;

        if (onZRoad || onXRoad || nearZRoad || nearXRoad) {
            // Use only the lowest frequency terrain noise for road height
            // This makes roads follow the broad landscape but ignore small hills
            let centerX, centerZ;
            if (onZRoad || nearZRoad) {
                centerX = wx;
                centerZ = zRoadCenter;
            } else {
                centerX = xRoadCenter;
                centerZ = wz;
            }
            
            // Very wide averaging window for ultra-smooth road height
            // Use ±192 blocks, step 8 for maximum smoothness (fewer cliff-like jumps)
            let sumH = 0;
            let count = 0;
            for (let s = -192; s <= 192; s += 8) {
                let sx, sz;
                if (onZRoad || nearZRoad) {
                    sx = wx + s;
                    sz = zRoadCenter;
                } else {
                    sx = xRoadCenter;
                    sz = wz + s;
                }
                // Only use the lowest frequency octave for smoothness
                // Account for flatness biome in road height calculation
                const sFlatness = Math.max(0, Math.min(1, (noise.noise2D(sx * 0.003 + 500, sz * 0.003 + 500) + 1) * 0.5));
                const sMountainScale = 1.0 - sFlatness * 0.88;
                // Reduced amplitude (6 instead of 12) for gentler slopes
                let h = noise.noise2D(sx * 0.003, sz * 0.003) * 6 * sMountainScale + 28;
                h = Math.max(WATER_LEVEL + 3, h);
                sumH += h;
                count++;
            }
            roadHeight = Math.round(sumH / count);
            roadHeight = Math.max(WATER_LEVEL + 3, roadHeight);
        }

        return {
            onRoad: onZRoad || onXRoad,
            nearRoad: nearZRoad || nearXRoad,
            roadHeight: roadHeight,
            distFromZCenter: distFromZRoad,
            distFromXCenter: distFromXRoad,
            isZRoad: onZRoad,
            isXRoad: onXRoad,
            isIntersection: onZRoad && onXRoad,
            roadWidth: ROAD_WIDTH,
            roadSmooth: ROAD_SMOOTH
        };
    }

    generate(noise) {
        const worldX = this.cx * CHUNK_SIZE;
        const worldZ = this.cz * CHUNK_SIZE;

        // First pass: compute road info for all columns
        const roadInfos = new Array(CHUNK_SIZE * CHUNK_SIZE);
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldX + x;
                const wz = worldZ + z;
                roadInfos[x + z * CHUNK_SIZE] = this.getRoadInfo(wx, wz, noise);
            }
        }

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldX + x;
                const wz = worldZ + z;
                const ri = roadInfos[x + z * CHUNK_SIZE];

                // Flatness biome: 0 = mountains, 1 = flat plains
                const flatness = Math.max(0, Math.min(1, (noise.noise2D(wx * 0.003 + 500, wz * 0.003 + 500) + 1) * 0.5));
                const mountainScale = 1.0 - flatness * 0.88; // flat areas get ~12% of normal amplitude

                // Multi-octave terrain height (scaled by flatness)
                let height = 0;
                height += noise.noise2D(wx * 0.01, wz * 0.01) * 20 * mountainScale;
                height += noise.noise2D(wx * 0.03, wz * 0.03) * 8 * mountainScale;
                height += noise.noise2D(wx * 0.06, wz * 0.06) * 4 * mountainScale;
                height = Math.floor(height + 28);
                height = Math.max(1, Math.min(CHUNK_HEIGHT - 2, height));

                // If on or near a road, blend terrain height toward road height
                let finalHeight = height;
                if (ri.onRoad) {
                    finalHeight = ri.roadHeight;
                } else if (ri.nearRoad) {
                    // Smooth blend between road height and natural terrain
                    let minDist = Math.min(ri.distFromZCenter, ri.distFromXCenter);
                    let t = (minDist - ri.roadWidth) / ri.roadSmooth;
                    t = Math.max(0, Math.min(1, t));
                    // Smooth step
                    t = t * t * (3 - 2 * t);
                    finalHeight = Math.round(ri.roadHeight * (1 - t) + height * t);
                }

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let blockType = BlockType.AIR;

                    if (y === 0) {
                        blockType = BlockType.STONE; // Bedrock layer
                    } else if (y < finalHeight - 4) {
                        blockType = BlockType.STONE;
                    } else if (y < finalHeight - 1) {
                        blockType = BlockType.DIRT;
                    } else if (y === finalHeight - 1) {
                        if (ri.onRoad && finalHeight > WATER_LEVEL + 1) {
                            // Road surface block
                            const distZ = ri.distFromZCenter;
                            const distX = ri.distFromXCenter;
                            const rw = ri.roadWidth;

                            if (ri.isIntersection) {
                                // Intersection - all asphalt, curbs on outer edges
                                if ((distZ >= rw - 0.5 && distX >= rw - 0.5)) {
                                    blockType = BlockType.ROAD_CURB;
                                } else {
                                    blockType = BlockType.ROAD_ASPHALT;
                                }
                            } else if (ri.isZRoad) {
                                // Z-road (runs along X)
                                if (distZ >= rw - 0.5) {
                                    blockType = BlockType.ROAD_CURB;
                                } else if (distZ < 0.8) {
                                    // Center line (dashed - use noise for dash pattern)
                                    const dashPattern = Math.floor(wx / 4) % 3;
                                    blockType = dashPattern === 0 ? BlockType.ROAD_LINE : BlockType.ROAD_ASPHALT;
                                } else {
                                    blockType = BlockType.ROAD_ASPHALT;
                                }
                            } else if (ri.isXRoad) {
                                // X-road (runs along Z)
                                if (distX >= rw - 0.5) {
                                    blockType = BlockType.ROAD_CURB;
                                } else if (distX < 0.8) {
                                    // Center line (dashed)
                                    const dashPattern = Math.floor(wz / 4) % 3;
                                    blockType = dashPattern === 0 ? BlockType.ROAD_LINE : BlockType.ROAD_ASPHALT;
                                } else {
                                    blockType = BlockType.ROAD_ASPHALT;
                                }
                            }
                        } else if (finalHeight <= WATER_LEVEL + 1) {
                            blockType = BlockType.SAND;
                        } else {
                            blockType = BlockType.GRASS;
                        }
                    } else if (y < WATER_LEVEL) {
                        blockType = BlockType.WATER;
                    }

                    // Cave generation (not under roads)
                    if (!ri.onRoad && y > 0 && y < finalHeight - 1 && blockType !== BlockType.AIR && blockType !== BlockType.WATER) {
                        const cave = noise.noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                        const cave2 = noise.noise3D(wx * 0.08, y * 0.08, wz * 0.08);
                        if (cave + cave2 > 0.9) {
                            blockType = BlockType.AIR;
                        }
                    }

                    // Clear air above road surface (remove any terrain that would block the road)
                    if (ri.onRoad && y >= finalHeight && y < finalHeight + 5) {
                        blockType = BlockType.AIR;
                    }

                    this.setBlock(x, y, z, blockType);
                }

                // Cigarette generation (replaces trees) - NOT on roads
                if (!ri.onRoad && !ri.nearRoad && finalHeight > WATER_LEVEL + 2 && this.getBlock(x, finalHeight - 1, z) === BlockType.GRASS) {
                    if (flatness > 0.45 && x > 0 && x < CHUNK_SIZE - 1 && z > 0 && z < CHUNK_SIZE - 1) {
                        // Flat areas: cigarette tree groves (clustered, denser)
                        const groveNoise = noise.noise2D(wx * 0.06 + 200, wz * 0.06 + 200);
                        const groveDensity = noise.noise2D(wx * 0.4 + 300, wz * 0.4 + 300);
                        if (groveNoise > 0.15 && groveDensity > 0.2) {
                            this.generateCigarette(x, finalHeight, z);
                        }
                    } else {
                        // Mountainous areas: sparse individual cigarettes (original behavior)
                        const cigNoise = noise.noise2D(wx * 0.5, wz * 0.5);
                        if (cigNoise > 0.6 && x > 0 && x < CHUNK_SIZE - 1 && z > 0 && z < CHUNK_SIZE - 1) {
                            this.generateCigarette(x, finalHeight, z);
                        }
                    }
                }

                // Crack pipe generation (rarer than cigarettes) - NOT on roads
                if (!ri.onRoad && !ri.nearRoad && finalHeight > WATER_LEVEL + 1 && this.getBlock(x, finalHeight - 1, z) === BlockType.GRASS) {
                    const pipeNoise = noise.noise2D(wx * 0.8 + 100, wz * 0.8 + 100);
                    if (pipeNoise > 0.75 && x > 0 && x < CHUNK_SIZE - 4 && z > 0 && z < CHUNK_SIZE - 1) {
                        this.generateCrackPipe(x, finalHeight, z);
                    }
                }
            }
        }

        // Second pass: Fill ramp blocks where road height changes between adjacent columns
        // This ensures smooth transitions - if column A is height 25 and column B is height 26,
        // we add an extra road block at height 25 in column B so you can walk up smoothly
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const ri = roadInfos[x + z * CHUNK_SIZE];
                if (!ri.onRoad) continue;

                const thisHeight = ri.roadHeight;
                
                // Check all 4 neighbors for height differences
                const neighbors = [
                    { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
                    { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
                ];
                
                for (const n of neighbors) {
                    const nx = x + n.dx;
                    const nz = z + n.dz;
                    
                    let neighborRi;
                    if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                        neighborRi = roadInfos[nx + nz * CHUNK_SIZE];
                    } else {
                        // Neighbor is in adjacent chunk - compute road info
                        neighborRi = this.getRoadInfo(worldX + nx, worldZ + nz, noise);
                    }
                    
                    if (!neighborRi.onRoad) continue;
                    
                    const neighborHeight = neighborRi.roadHeight;
                    const diff = neighborHeight - thisHeight;
                    
                    // If neighbor is higher, add ramp blocks in this column
                    // Fill from thisHeight-1 up to neighborHeight-1 with road blocks
                    if (diff > 0) {
                        for (let rampY = thisHeight; rampY < neighborHeight; rampY++) {
                            if (rampY >= 0 && rampY < CHUNK_HEIGHT) {
                                const currentBlock = this.getBlock(x, rampY - 1, z);
                                if (currentBlock === BlockType.AIR || currentBlock === BlockType.WATER) {
                                    this.setBlock(x, rampY - 1, z, BlockType.ROAD_ASPHALT);
                                }
                                // Also fill the block itself if it's air
                                const aboveBlock = this.getBlock(x, rampY, z);
                                if (aboveBlock === BlockType.AIR) {
                                    this.setBlock(x, rampY, z, BlockType.ROAD_ASPHALT);
                                    // Clear above for headroom
                                    for (let clearY = rampY + 1; clearY < rampY + 4 && clearY < CHUNK_HEIGHT; clearY++) {
                                        this.setBlock(x, clearY, z, BlockType.AIR);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        this.generated = true;
        this.dirty = true;
    }

    generateCigarette(x, y, z) {
        // Cigarette structure: filter (bottom 2) + paper body (middle 4-5) + ember (top 1) + smoke (above)
        const bodyHeight = 4 + Math.floor(Math.random() * 2);
        const filterHeight = 2;
        
        // Filter at the bottom (orange/tan)
        for (let ty = 0; ty < filterHeight; ty++) {
            this.setBlock(x, y + ty, z, BlockType.CIGARETTE_FILTER);
        }
        
        // White paper body
        for (let ty = filterHeight; ty < filterHeight + bodyHeight; ty++) {
            this.setBlock(x, y + ty, z, BlockType.CIGARETTE_PAPER);
        }
        
        // Glowing ember at the top
        const emberY = y + filterHeight + bodyHeight;
        this.setBlock(x, emberY, z, BlockType.CIGARETTE_EMBER);
        
        // Smoke wisps above the ember
        const smokeStart = emberY + 1;
        for (let sy = 0; sy < 2 + Math.floor(Math.random() * 2); sy++) {
            if (smokeStart + sy < CHUNK_HEIGHT) {
                this.setBlock(x, smokeStart + sy, z, BlockType.CIGARETTE_SMOKE);
            }
        }
    }

    generateCrackPipe(x, y, z) {
        // Improved crack pipe: L-shaped with bowl on top, stem down, horizontal tube
        
        // Bowl on top (charred)
        this.setBlock(x, y + 2, z, BlockType.CRACK_PIPE_BOWL);
        
        // Vertical stem connecting bowl to base
        this.setBlock(x, y + 1, z, BlockType.CRACK_PIPE_GLASS);
        this.setBlock(x, y, z, BlockType.CRACK_PIPE_GLASS);
        
        // Horizontal glass tube extending in +x direction
        const pipeLength = 3 + Math.floor(Math.random() * 2);
        for (let px = 1; px <= pipeLength; px++) {
            if (x + px < CHUNK_SIZE) {
                this.setBlock(x + px, y, z, BlockType.CRACK_PIPE_GLASS);
            }
        }
        
        // Mouthpiece - slight upturn at the end
        const endX = x + pipeLength + 1;
        if (endX < CHUNK_SIZE) {
            this.setBlock(endX, y + 1, z, BlockType.CRACK_PIPE_GLASS);
        }
        
        // Smoke wisps above the bowl
        if (y + 3 < CHUNK_HEIGHT) {
            this.setBlock(x, y + 3, z, BlockType.CIGARETTE_SMOKE);
        }
        if (y + 4 < CHUNK_HEIGHT && Math.random() > 0.5) {
            this.setBlock(x, y + 4, z, BlockType.CIGARETTE_SMOKE);
        }
    }

    buildMesh(blockTextures) {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }

        const geometries = {}; // blockType -> {positions, normals, uvs, indices}

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.AIR) continue;

                    // Check each face
                    const faces = [
                        { dir: [1, 0, 0], face: 0 },   // right (+x)
                        { dir: [-1, 0, 0], face: 1 },   // left (-x)
                        { dir: [0, 1, 0], face: 2 },    // top (+y)
                        { dir: [0, -1, 0], face: 3 },   // bottom (-y)
                        { dir: [0, 0, 1], face: 4 },    // front (+z)
                        { dir: [0, 0, -1], face: 5 }    // back (-z)
                    ];

                    for (const { dir, face } of faces) {
                        const nx = x + dir[0];
                        const ny = y + dir[1];
                        const nz = z + dir[2];

                        let neighbor;
                        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
                            neighbor = this.world.getBlock(
                                this.cx * CHUNK_SIZE + nx,
                                ny,
                                this.cz * CHUNK_SIZE + nz
                            );
                        } else if (ny < 0 || ny >= CHUNK_HEIGHT) {
                            neighbor = BlockType.AIR;
                        } else {
                            neighbor = this.getBlock(nx, ny, nz);
                        }

                        // Don't render face if neighbor is solid
                        // Transparent types: WATER, LEAVES, CIGARETTE_SMOKE
                        const transparentTypes = [BlockType.AIR, BlockType.WATER, BlockType.LEAVES, BlockType.CIGARETTE_SMOKE, BlockType.CRACK_PIPE_GLASS];
                        const isNeighborTransparent = transparentTypes.includes(neighbor);
                        
                        if (!isNeighborTransparent) {
                            continue; // neighbor is solid, skip this face
                        }
                        // Don't render water face against water
                        if (block === BlockType.WATER && neighbor === BlockType.WATER) continue;
                        // Don't render smoke face against smoke
                        if (block === BlockType.CIGARETTE_SMOKE && neighbor === BlockType.CIGARETTE_SMOKE) continue;

                        const key = `${block}_${face}`;
                        if (!geometries[key]) {
                            geometries[key] = {
                                positions: [],
                                normals: [],
                                uvs: [],
                                indices: [],
                                blockType: block,
                                faceIndex: face
                            };
                        }

                        const geo = geometries[key];
                        const vi = geo.positions.length / 3;
                        const wx = this.cx * CHUNK_SIZE + x;
                        const wz = this.cz * CHUNK_SIZE + z;

                        this.addFace(geo, wx, y, wz, face, vi);
                    }
                }
            }
        }

        // Create merged meshes per block type
        const group = new THREE.Group();

        for (const key in geometries) {
            const geo = geometries[key];
            if (geo.positions.length === 0) continue;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uvs, 2));
            geometry.setIndex(geo.indices);

            const materials = blockTextures.getMaterial(geo.blockType);
            const material = materials[geo.faceIndex];

            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
        }

        this.mesh = group;
        this.world.scene.add(this.mesh);
        this.dirty = false;
    }

    addFace(geo, x, y, z, face, vi) {
        const faceData = {
            0: { // right (+x)
                positions: [x+1,y,z, x+1,y+1,z, x+1,y+1,z+1, x+1,y,z+1],
                normal: [1, 0, 0]
            },
            1: { // left (-x)
                positions: [x,y,z+1, x,y+1,z+1, x,y+1,z, x,y,z],
                normal: [-1, 0, 0]
            },
            2: { // top (+y)
                positions: [x,y+1,z, x,y+1,z+1, x+1,y+1,z+1, x+1,y+1,z],
                normal: [0, 1, 0]
            },
            3: { // bottom (-y)
                positions: [x,y,z+1, x,y,z, x+1,y,z, x+1,y,z+1],
                normal: [0, -1, 0]
            },
            4: { // front (+z)
                positions: [x,y,z+1, x+1,y,z+1, x+1,y+1,z+1, x,y+1,z+1],
                normal: [0, 0, 1]
            },
            5: { // back (-z)
                positions: [x+1,y,z, x,y,z, x,y+1,z, x+1,y+1,z],
                normal: [0, 0, -1]
            }
        };

        const data = faceData[face];
        geo.positions.push(...data.positions);
        for (let i = 0; i < 4; i++) {
            geo.normals.push(...data.normal);
        }
        geo.uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
        geo.indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
    }

    dispose() {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
            this.mesh = null;
        }
    }
}

// Fixed world seed so all multiplayer clients generate identical terrain
const WORLD_SEED = 42069;

class World {
    constructor(scene, seed) {
        this.scene = scene;
        this.seed = seed || WORLD_SEED;
        this.noise = new SimplexNoise(this.seed);
        this.chunks = {};
        this.blockTextures = new BlockTextures();
        this.pendingChunks = [];
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    getChunk(cx, cz) {
        return this.chunks[this.getChunkKey(cx, cz)];
    }

    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk || !chunk.generated) return BlockType.AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.getBlock(lx, wy, lz);
    }

    setBlock(wx, wy, wz, type) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk || !chunk.generated) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.setBlock(lx, wy, lz, type);
        chunk.dirty = true;

        // Mark neighboring chunks dirty if on edge
        if (lx === 0) this.markChunkDirty(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
        if (lz === 0) this.markChunkDirty(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);
    }

    markChunkDirty(cx, cz) {
        const chunk = this.getChunk(cx, cz);
        if (chunk) chunk.dirty = true;
    }

    update(playerX, playerZ) {
        const pcx = Math.floor(playerX / CHUNK_SIZE);
        const pcz = Math.floor(playerZ / CHUNK_SIZE);

        // Generate/load chunks within render distance
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
            for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = this.getChunkKey(cx, cz);

                if (!this.chunks[key]) {
                    const chunk = new Chunk(cx, cz, this);
                    this.chunks[key] = chunk;
                    chunk.generate(this.noise);
                }
            }
        }

        // Build/rebuild dirty chunk meshes (limit per frame for performance)
        let built = 0;
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
            for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
                if (built >= 2) break; // Max 2 chunk builds per frame
                const cx = pcx + dx;
                const cz = pcz + dz;
                const chunk = this.getChunk(cx, cz);
                if (chunk && chunk.dirty && chunk.generated) {
                    chunk.buildMesh(this.blockTextures);
                    built++;
                }
            }
        }

        // Unload far chunks
        for (const key in this.chunks) {
            const chunk = this.chunks[key];
            const dx = chunk.cx - pcx;
            const dz = chunk.cz - pcz;
            if (Math.abs(dx) > RENDER_DISTANCE + 2 || Math.abs(dz) > RENDER_DISTANCE + 2) {
                chunk.dispose();
                delete this.chunks[key];
            }
        }
    }

    // Raycast for block interaction (DDA-style for better performance)
    raycast(origin, direction, maxDist) {
        const step = 0.15;
        const pos = origin.clone();
        const dir = direction.clone().normalize().multiplyScalar(step);
        let prevBlockPos = null;

        for (let d = 0; d < maxDist; d += step) {
            pos.add(dir);
            const bx = Math.floor(pos.x);
            const by = Math.floor(pos.y);
            const bz = Math.floor(pos.z);

            const block = this.getBlock(bx, by, bz);
            if (block !== BlockType.AIR && block !== BlockType.WATER) {
                return {
                    block: block,
                    position: { x: bx, y: by, z: bz },
                    previous: prevBlockPos
                };
            }
            prevBlockPos = { x: bx, y: by, z: bz };
        }
        return null;
    }

    getSpawnHeight(x, z) {
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const block = this.getBlock(Math.floor(x), y, Math.floor(z));
            if (block !== BlockType.AIR && block !== BlockType.WATER) {
                return y + 1;
            }
        }
        return 30;
    }

    // Check if a block is a road type
    isRoadBlock(blockType) {
        return blockType === BlockType.ROAD_ASPHALT || 
               blockType === BlockType.ROAD_LINE || 
               blockType === BlockType.ROAD_CURB;
    }

    // Check if a world position is on a road
    isOnRoad(wx, wy, wz) {
        const block = this.getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
        return this.isRoadBlock(block);
    }

    // Get the road surface height at a given world position
    // Returns the road height if on/near a road, or null if not near a road
    getRoadSurfaceHeight(wx, wz) {
        // Replicate the road height calculation from Chunk.getRoadInfo
        const ROAD_SPACING = 128;
        const ROAD_WIDTH = 5;
        const ROAD_SMOOTH = 3;

        // Z-aligned road
        const xRoadBase = Math.round(wx / ROAD_SPACING) * ROAD_SPACING;
        const xRoadOffset = this.noise.noise2D(xRoadBase * 0.1, wz * 0.005) * 4;
        const xRoadCenter = xRoadBase + xRoadOffset;
        const distFromXRoad = Math.abs(wx - xRoadCenter);

        // X-aligned road
        const zRoadBase = Math.round(wz / ROAD_SPACING) * ROAD_SPACING;
        const zRoadOffset = this.noise.noise2D(wx * 0.005, zRoadBase * 0.1) * 4;
        const zRoadCenter = zRoadBase + zRoadOffset;
        const distFromZRoad = Math.abs(wz - zRoadCenter);

        const onZRoad = distFromZRoad <= ROAD_WIDTH;
        const onXRoad = distFromXRoad <= ROAD_WIDTH;
        const nearZRoad = distFromZRoad <= ROAD_WIDTH + ROAD_SMOOTH;
        const nearXRoad = distFromXRoad <= ROAD_WIDTH + ROAD_SMOOTH;

        if (!onZRoad && !onXRoad && !nearZRoad && !nearXRoad) return null;

        // Calculate road height using the same wide averaging as chunk generation
        let centerX, centerZ;
        let isZAligned = false; // true = road runs along Z axis (spaced along X)
        if (onZRoad || nearZRoad) {
            centerX = wx;
            centerZ = zRoadCenter;
        } else {
            centerX = xRoadCenter;
            centerZ = wz;
            isZAligned = true;
        }

        let sumH = 0;
        let count = 0;
        for (let s = -192; s <= 192; s += 8) {
            let sx, sz;
            if (!isZAligned) {
                sx = wx + s;
                sz = zRoadCenter;
            } else {
                sx = xRoadCenter;
                sz = wz + s;
            }
            const sFlatness = Math.max(0, Math.min(1, (this.noise.noise2D(sx * 0.003 + 500, sz * 0.003 + 500) + 1) * 0.5));
            const sMountainScale = 1.0 - sFlatness * 0.88;
            let h = this.noise.noise2D(sx * 0.003, sz * 0.003) * 6 * sMountainScale + 28;
            h = Math.max(WATER_LEVEL + 3, h);
            sumH += h;
            count++;
        }
        let roadHeight = Math.round(sumH / count);
        roadHeight = Math.max(WATER_LEVEL + 3, roadHeight);

        return roadHeight;
    }

    // Get the road edge position and height for a given world position
    // Used by liquor store to find the nearest road edge
    getNearestRoadEdgeHeight(wx, wz) {
        const ROAD_SPACING = 128;
        const ROAD_WIDTH = 5;

        // Find nearest Z-aligned road (runs along Z, spaced along X)
        const xRoadBase = Math.round(wx / ROAD_SPACING) * ROAD_SPACING;
        const xRoadOffset = this.noise.noise2D(xRoadBase * 0.1, wz * 0.005) * 4;
        const xRoadCenter = xRoadBase + xRoadOffset;
        const distFromXRoad = Math.abs(wx - xRoadCenter);

        // Find nearest X-aligned road (runs along X, spaced along Z)
        const zRoadBase = Math.round(wz / ROAD_SPACING) * ROAD_SPACING;
        const zRoadOffset = this.noise.noise2D(wx * 0.005, zRoadBase * 0.1) * 4;
        const zRoadCenter = zRoadBase + zRoadOffset;
        const distFromZRoad = Math.abs(wz - zRoadCenter);

        // Return the height of the nearest road
        let roadHeight;
        if (distFromXRoad < distFromZRoad) {
            // Nearest road is Z-aligned at xRoadCenter
            roadHeight = this.getRoadSurfaceHeight(xRoadCenter, wz);
        } else {
            // Nearest road is X-aligned at zRoadCenter
            roadHeight = this.getRoadSurfaceHeight(wx, zRoadCenter);
        }

        return roadHeight;
    }

    // Animate water textures (UV scrolling for wave effect)
    animateWater(dt) {
        const waterMats = this.blockTextures.materials[BlockType.WATER];
        if (waterMats) {
            for (const mat of waterMats) {
                if (mat.map) {
                    mat.map.offset.x += dt * 0.08;
                    mat.map.offset.y += dt * 0.04;
                    // Keep offsets in 0-1 range
                    mat.map.offset.x %= 1;
                    mat.map.offset.y %= 1;
                }
                // Subtle opacity pulsing for water shimmer
                mat.opacity = 0.65 + Math.sin(Date.now() * 0.002) * 0.08;
            }
        }
    }
}

window.World = World;
window.CHUNK_SIZE = CHUNK_SIZE;
window.CHUNK_HEIGHT = CHUNK_HEIGHT;
window.WATER_LEVEL = WATER_LEVEL;
window.RENDER_DISTANCE = RENDER_DISTANCE;
