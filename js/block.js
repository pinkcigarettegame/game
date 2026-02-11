// Block types and texture generation
const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    SAND: 4,
    WOOD: 5,
    LEAVES: 6,
    WATER: 7,
    COBBLESTONE: 8,
    CIGARETTE_PAPER: 9,
    CIGARETTE_FILTER: 10,
    CIGARETTE_EMBER: 11,
    CIGARETTE_SMOKE: 12,
    CRACK_PIPE_GLASS: 13,
    CRACK_PIPE_BOWL: 14,
    ROAD_ASPHALT: 15,
    ROAD_LINE: 16,
    ROAD_CURB: 17
};

const BlockNames = {
    [BlockType.GRASS]: 'Pink Grass',
    [BlockType.DIRT]: 'Pink Dirt',
    [BlockType.STONE]: 'Pink Stone',
    [BlockType.SAND]: 'Pink Sand',
    [BlockType.WOOD]: 'Cigarette Paper',
    [BlockType.LEAVES]: 'Smoke',
    [BlockType.WATER]: 'Pink Water',
    [BlockType.COBBLESTONE]: 'Pink Cobblestone',
    [BlockType.CIGARETTE_PAPER]: 'Cigarette Paper',
    [BlockType.CIGARETTE_FILTER]: 'Cigarette Filter',
    [BlockType.CIGARETTE_EMBER]: 'Cigarette Ember',
    [BlockType.CIGARETTE_SMOKE]: 'Smoke',
    [BlockType.CRACK_PIPE_GLASS]: 'Glass Pipe',
    [BlockType.CRACK_PIPE_BOWL]: 'Pipe Bowl',
    [BlockType.ROAD_ASPHALT]: 'Pink Asphalt',
    [BlockType.ROAD_LINE]: 'Road Line',
    [BlockType.ROAD_CURB]: 'Pink Curb'
};

// Hotbar block order
const HotbarBlocks = [
    BlockType.GRASS,
    BlockType.DIRT,
    BlockType.STONE,
    BlockType.COBBLESTONE,
    BlockType.SAND,
    BlockType.CIGARETTE_PAPER,
    BlockType.CIGARETTE_FILTER,
    BlockType.CRACK_PIPE_GLASS
];

class BlockTextures {
    constructor() {
        this.textures = {};
        this.materials = {};
        this.textureSize = 16;
        this.generateAllTextures();
        this.createAllMaterials();
    }

    generateAllTextures() {
        this.textures[BlockType.GRASS] = {
            top: this.generatePinkGrassTop(),
            bottom: this.generatePinkDirt(),
            side: this.generatePinkGrassSide()
        };
        this.textures[BlockType.DIRT] = {
            all: this.generatePinkDirt()
        };
        this.textures[BlockType.STONE] = {
            all: this.generatePinkStone()
        };
        this.textures[BlockType.SAND] = {
            all: this.generatePinkSand()
        };
        this.textures[BlockType.WOOD] = {
            top: this.generateCigarettePaperTop(),
            bottom: this.generateCigarettePaperTop(),
            side: this.generateCigarettePaper()
        };
        this.textures[BlockType.LEAVES] = {
            all: this.generateCigaretteSmoke()
        };
        this.textures[BlockType.WATER] = {
            all: this.generatePinkWater()
        };
        this.textures[BlockType.COBBLESTONE] = {
            all: this.generatePinkCobblestone()
        };
        this.textures[BlockType.CIGARETTE_PAPER] = {
            all: this.generateCigarettePaper()
        };
        this.textures[BlockType.CIGARETTE_FILTER] = {
            all: this.generateCigaretteFilter()
        };
        this.textures[BlockType.CIGARETTE_EMBER] = {
            all: this.generateCigaretteEmber()
        };
        this.textures[BlockType.CIGARETTE_SMOKE] = {
            all: this.generateCigaretteSmoke()
        };
        this.textures[BlockType.CRACK_PIPE_GLASS] = {
            all: this.generateCrackPipeGlass()
        };
        this.textures[BlockType.CRACK_PIPE_BOWL] = {
            all: this.generateCrackPipeBowl()
        };
        this.textures[BlockType.ROAD_ASPHALT] = {
            all: this.generateRoadAsphalt()
        };
        this.textures[BlockType.ROAD_LINE] = {
            all: this.generateRoadLine()
        };
        this.textures[BlockType.ROAD_CURB] = {
            all: this.generateRoadCurb()
        };
    }

    createCanvasTexture(canvas) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    createAllMaterials() {
        const transparentTypes = [BlockType.WATER, BlockType.LEAVES, BlockType.CIGARETTE_SMOKE, BlockType.CRACK_PIPE_GLASS];
        const doubleSideTypes = [BlockType.LEAVES, BlockType.CIGARETTE_SMOKE];

        for (const blockType in this.textures) {
            const bt = parseInt(blockType);
            const texData = this.textures[blockType];
            const isTransparent = transparentTypes.includes(bt);
            const isDoubleSide = doubleSideTypes.includes(bt);
            const opacity = bt === BlockType.WATER ? 0.7 : (bt === BlockType.CIGARETTE_SMOKE ? 0.5 : (bt === BlockType.CRACK_PIPE_GLASS ? 0.6 : 1.0));

            if (texData.all) {
                const tex = this.createCanvasTexture(texData.all);
                this.materials[blockType] = [tex, tex, tex, tex, tex, tex].map(t => 
                    new THREE.MeshLambertMaterial({ 
                        map: t,
                        transparent: isTransparent,
                        opacity: opacity,
                        side: isDoubleSide ? THREE.DoubleSide : THREE.FrontSide
                    })
                );
            } else {
                const topTex = this.createCanvasTexture(texData.top);
                const bottomTex = this.createCanvasTexture(texData.bottom);
                const sideTex = this.createCanvasTexture(texData.side);
                this.materials[blockType] = [
                    new THREE.MeshLambertMaterial({ map: sideTex }),   // right
                    new THREE.MeshLambertMaterial({ map: sideTex }),   // left
                    new THREE.MeshLambertMaterial({ map: topTex }),    // top
                    new THREE.MeshLambertMaterial({ map: bottomTex }), // bottom
                    new THREE.MeshLambertMaterial({ map: sideTex }),   // front
                    new THREE.MeshLambertMaterial({ map: sideTex })    // back
                ];
            }
        }
    }

    getMaterial(blockType) {
        return this.materials[blockType];
    }

    // Texture generation helpers
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        return canvas;
    }

    addNoise(ctx, intensity, w, h) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // ==================== PINK TEXTURES ====================

    generatePinkGrassTop() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        ctx.fillStyle = '#e84090';
        ctx.fillRect(0, 0, s, s);
        
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const shade = Math.random() * 30 - 15;
            ctx.fillStyle = `rgb(${220 + Math.floor(shade)}, ${60 + Math.floor(shade/2)}, ${140 + Math.floor(shade)})`;
            ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
        this.addNoise(ctx, 15, s, s);
        return canvas;
    }

    generatePinkDirt() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        ctx.fillStyle = '#b05080';
        ctx.fillRect(0, 0, s, s);
        
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const shade = Math.random() * 20 - 10;
            ctx.fillStyle = `rgb(${176 + Math.floor(shade)}, ${80 + Math.floor(shade)}, ${128 + Math.floor(shade/2)})`;
            ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
        
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(80,20,50,0.15)';
            ctx.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), 2, 1);
        }
        this.addNoise(ctx, 12, s, s);
        return canvas;
    }

    generatePinkGrassSide() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Pink dirt base
        ctx.fillStyle = '#b05080';
        ctx.fillRect(0, 0, s, s);
        
        // Hot pink grass top strip
        ctx.fillStyle = '#e84090';
        ctx.fillRect(0, 0, s, 3);
        
        // Grass hanging bits
        for (let x = 0; x < s; x++) {
            const hang = Math.floor(Math.random() * 3);
            ctx.fillStyle = '#e84090';
            ctx.fillRect(x, 0, 1, 2 + hang);
        }
        
        this.addNoise(ctx, 15, s, s);
        return canvas;
    }

    generatePinkStone() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        ctx.fillStyle = '#c090a8';
        ctx.fillRect(0, 0, s, s);
        
        for (let i = 0; i < 50; i++) {
            const shade = Math.floor(Math.random() * 40 - 20);
            ctx.fillStyle = `rgb(${192+shade}, ${144+shade}, ${168+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = 'rgba(100,40,70,0.2)';
            const x = Math.floor(Math.random() * s);
            const y = Math.floor(Math.random() * s);
            ctx.fillRect(x, y, Math.floor(Math.random()*3)+1, 1);
        }
        this.addNoise(ctx, 10, s, s);
        return canvas;
    }

    generatePinkSand() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        ctx.fillStyle = '#f0b0c8';
        ctx.fillRect(0, 0, s, s);
        
        for (let i = 0; i < 60; i++) {
            const shade = Math.floor(Math.random() * 30 - 15);
            ctx.fillStyle = `rgb(${240+Math.min(shade,15)}, ${176+shade}, ${200+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        this.addNoise(ctx, 8, s, s);
        return canvas;
    }

    generatePinkWater() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Deeper, richer pink water base
        ctx.fillStyle = '#d050a0';
        ctx.fillRect(0, 0, s, s);
        
        // Water wave patterns - horizontal ripple lines
        for (let y = 0; y < s; y += 2) {
            const brightness = Math.sin(y * 0.8) * 15;
            ctx.fillStyle = `rgba(${210 + brightness}, ${80 + brightness}, ${155 + brightness}, 0.6)`;
            ctx.fillRect(0, y, s, 1);
        }
        
        // Scattered color variation for depth
        for (let i = 0; i < 40; i++) {
            const shade = Math.floor(Math.random() * 40 - 20);
            ctx.fillStyle = `rgba(${220+Math.min(shade,15)}, ${90+shade}, ${160+shade}, 0.4)`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 1);
        }
        
        // Bright specular highlights (sun reflections)
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = 'rgba(255,210,230,0.5)';
            const hx = Math.floor(Math.random()*s);
            const hy = Math.floor(Math.random()*s);
            ctx.fillRect(hx, hy, 3, 1);
            ctx.fillRect(hx + 1, hy - 1, 1, 1);
        }
        
        // Darker depth spots
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = 'rgba(140,40,90,0.25)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // Foam/bubble hints
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(255,230,240,0.35)';
            ctx.beginPath();
            ctx.arc(Math.random()*s, Math.random()*s, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return canvas;
    }

    generatePinkCobblestone() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        ctx.fillStyle = '#c888a0';
        ctx.fillRect(0, 0, s, s);
        
        const stones = [
            {x:0, y:0, w:5, h:4}, {x:5, y:0, w:6, h:5}, {x:11, y:0, w:5, h:4},
            {x:0, y:4, w:4, h:5}, {x:4, y:5, w:5, h:4}, {x:9, y:4, w:7, h:5},
            {x:0, y:9, w:6, h:4}, {x:6, y:9, w:5, h:4}, {x:11, y:9, w:5, h:4},
            {x:0, y:13, w:5, h:3}, {x:5, y:13, w:6, h:3}, {x:11, y:13, w:5, h:3}
        ];
        
        stones.forEach(stone => {
            const shade = Math.floor(Math.random() * 40 - 20);
            ctx.fillStyle = `rgb(${200+Math.min(shade,20)}, ${136+shade}, ${160+shade})`;
            ctx.fillRect(stone.x, stone.y, stone.w-1, stone.h-1);
        });
        
        ctx.fillStyle = 'rgba(100,40,70,0.3)';
        stones.forEach(stone => {
            ctx.fillRect(stone.x + stone.w - 1, stone.y, 1, stone.h);
            ctx.fillRect(stone.x, stone.y + stone.h - 1, stone.w, 1);
        });
        
        this.addNoise(ctx, 12, s, s);
        return canvas;
    }

    // ==================== CIGARETTE TEXTURES (NOT PINK) ====================

    generateCigarettePaper() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // White cigarette paper
        ctx.fillStyle = '#f0ece8';
        ctx.fillRect(0, 0, s, s);
        
        // Subtle paper texture
        for (let i = 0; i < 40; i++) {
            const shade = Math.floor(Math.random() * 12 - 6);
            ctx.fillStyle = `rgb(${240+shade}, ${236+shade}, ${232+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Very faint vertical lines (paper grain)
        for (let x = 0; x < s; x += 3) {
            ctx.fillStyle = 'rgba(200,195,190,0.15)';
            ctx.fillRect(x, 0, 1, s);
        }
        
        this.addNoise(ctx, 5, s, s);
        return canvas;
    }

    generateCigarettePaperTop() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // White circle on slightly off-white
        ctx.fillStyle = '#e8e4e0';
        ctx.fillRect(0, 0, s, s);
        
        // Tobacco visible from top - brown center
        ctx.fillStyle = '#8B7355';
        ctx.beginPath();
        ctx.arc(s/2, s/2, s/3, 0, Math.PI * 2);
        ctx.fill();
        
        // Paper ring
        ctx.strokeStyle = '#f0ece8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s/2, s/2, s/2.5, 0, Math.PI * 2);
        ctx.stroke();
        
        this.addNoise(ctx, 8, s, s);
        return canvas;
    }

    generateCigaretteFilter() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Orange/tan filter
        ctx.fillStyle = '#d4a050';
        ctx.fillRect(0, 0, s, s);
        
        // Cork-like pattern with dots
        for (let i = 0; i < 60; i++) {
            const shade = Math.floor(Math.random() * 30 - 15);
            ctx.fillStyle = `rgb(${212+shade}, ${160+shade}, ${80+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Horizontal lines typical of filter pattern
        for (let y = 0; y < s; y += 2) {
            ctx.fillStyle = 'rgba(180,130,50,0.2)';
            ctx.fillRect(0, y, s, 1);
        }
        
        // Gold band at top (where filter meets paper)
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(0, 0, s, 2);
        
        this.addNoise(ctx, 10, s, s);
        return canvas;
    }

    generateCigaretteEmber() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Glowing red-orange ember
        ctx.fillStyle = '#e04010';
        ctx.fillRect(0, 0, s, s);
        
        // Hot spots
        for (let i = 0; i < 30; i++) {
            const shade = Math.floor(Math.random() * 60);
            ctx.fillStyle = `rgb(${224+Math.min(shade,31)}, ${64+shade}, ${16+shade/3})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // Bright orange/yellow hot center spots
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = `rgb(255, ${180 + Math.floor(Math.random()*75)}, ${40 + Math.floor(Math.random()*40)})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Some dark ash spots
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(60,30,10,0.4)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 1);
        }
        
        this.addNoise(ctx, 15, s, s);
        return canvas;
    }

    generateCigaretteSmoke() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Light gray smoke
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(0, 0, s, s);
        
        // Wispy smoke texture
        for (let i = 0; i < 40; i++) {
            const shade = Math.floor(Math.random() * 40 - 20);
            ctx.fillStyle = `rgba(${208+shade}, ${208+shade}, ${208+shade}, 0.6)`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // White highlights
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 3, 1);
        }
        
        // Some transparency holes for wispy effect
        for (let i = 0; i < 12; i++) {
            ctx.clearRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        return canvas;
    }

    // ==================== CRACK PIPE TEXTURES (NOT PINK) ====================

    generateCrackPipeGlass() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Clear glass base with slight warm tint from use
        ctx.fillStyle = '#c8dce8';
        ctx.fillRect(0, 0, s, s);
        
        // Glass reflections - bright vertical streaks
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(Math.floor(s*0.25), 0, 2, s);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(Math.floor(s*0.7), 0, 1, s);
        
        // Scattered highlights
        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 2);
        }
        
        // Yellowish-brown residue/resin buildup inside
        for (let i = 0; i < 15; i++) {
            const r = 140 + Math.floor(Math.random() * 40);
            const g = 100 + Math.floor(Math.random() * 30);
            const b = 40 + Math.floor(Math.random() * 30);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 3);
        }
        
        // Char marks (dark spots)
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(50,40,30,0.15)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // Edge darkening for tube shape illusion
        ctx.fillStyle = 'rgba(80,100,120,0.15)';
        ctx.fillRect(0, 0, 2, s);
        ctx.fillRect(s-2, 0, 2, s);
        
        this.addNoise(ctx, 4, s, s);
        return canvas;
    }

    generateCrackPipeBowl() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Dark charred bowl
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, s, s);
        
        // Charred/burnt residue
        for (let i = 0; i < 40; i++) {
            const shade = Math.floor(Math.random() * 30);
            ctx.fillStyle = `rgb(${30+shade}, ${25+shade}, ${20+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // Some brownish burn marks
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = `rgba(${80+Math.floor(Math.random()*40)}, ${50+Math.floor(Math.random()*30)}, ${20+Math.floor(Math.random()*20)}, 0.5)`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 3, 2);
        }
        
        // Slight metallic sheen
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(100,100,110,0.3)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        this.addNoise(ctx, 8, s, s);
        return canvas;
    }

    // ==================== ROAD TEXTURES (PINK THEMED) ====================

    generateRoadAsphalt() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Dark pink-gray asphalt base
        ctx.fillStyle = '#6a3050';
        ctx.fillRect(0, 0, s, s);
        
        // Aggregate/gravel texture - scattered lighter and darker spots
        for (let i = 0; i < 80; i++) {
            const shade = Math.floor(Math.random() * 30 - 15);
            ctx.fillStyle = `rgb(${106+shade}, ${48+shade}, ${80+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Slightly lighter patches (worn spots)
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = 'rgba(140,80,110,0.2)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 2);
        }
        
        // Tiny dark cracks
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(40,15,30,0.3)';
            const cx = Math.floor(Math.random()*s);
            const cy = Math.floor(Math.random()*s);
            ctx.fillRect(cx, cy, 1, Math.floor(Math.random()*3)+1);
        }
        
        this.addNoise(ctx, 8, s, s);
        return canvas;
    }

    generateRoadLine() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Dark pink-gray asphalt base (same as road)
        ctx.fillStyle = '#6a3050';
        ctx.fillRect(0, 0, s, s);
        
        // Aggregate texture
        for (let i = 0; i < 50; i++) {
            const shade = Math.floor(Math.random() * 20 - 10);
            ctx.fillStyle = `rgb(${106+shade}, ${48+shade}, ${80+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Bright pink-white center line (dashed - top portion of texture)
        ctx.fillStyle = '#ffccdd';
        ctx.fillRect(Math.floor(s*0.35), 0, Math.floor(s*0.3), s);
        
        // Line wear/fading
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = 'rgba(106,48,80,0.25)';
            ctx.fillRect(
                Math.floor(s*0.35) + Math.floor(Math.random()*Math.floor(s*0.3)),
                Math.floor(Math.random()*s),
                1, 1
            );
        }
        
        this.addNoise(ctx, 6, s, s);
        return canvas;
    }

    generateRoadCurb() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');
        const s = this.textureSize;
        
        // Pink-tinted concrete curb
        ctx.fillStyle = '#d8a0b8';
        ctx.fillRect(0, 0, s, s);
        
        // Concrete texture - subtle variation
        for (let i = 0; i < 50; i++) {
            const shade = Math.floor(Math.random() * 20 - 10);
            ctx.fillStyle = `rgb(${216+shade}, ${160+shade}, ${184+shade})`;
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 1, 1);
        }
        
        // Slight edge highlight on top
        ctx.fillStyle = 'rgba(255,200,220,0.3)';
        ctx.fillRect(0, 0, s, 2);
        
        // Bottom shadow
        ctx.fillStyle = 'rgba(80,40,60,0.2)';
        ctx.fillRect(0, s-2, s, 2);
        
        // Occasional dirt/stain marks
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = 'rgba(100,50,70,0.15)';
            ctx.fillRect(Math.floor(Math.random()*s), Math.floor(Math.random()*s), 2, 1);
        }
        
        this.addNoise(ctx, 6, s, s);
        return canvas;
    }

    // Get a preview canvas for the hotbar
    getPreviewCanvas(blockType) {
        const texData = this.textures[blockType];
        if (texData.all) return texData.all;
        if (texData.top) return texData.top;
        return texData.side;
    }
}

window.BlockType = BlockType;
window.BlockNames = BlockNames;
window.HotbarBlocks = HotbarBlocks;
window.BlockTextures = BlockTextures;
