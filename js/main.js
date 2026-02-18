// Main game entry point
(function() {
    'use strict';

    // Game state
    let scene, camera, renderer;
    let world, player, input, ui, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, copSpawner;
    let healthPotionSpawner;
    let liquorStoreSpawner;
    let billboardSpawner;
    let stripClubManager;
    let missionSystem;
    let glock;
    let challenger; // Pimp Dodge Challenger
    let clock;
    let gameStarted = false;
    
    // Multiplayer
    let mp = null; // Multiplayer instance
    let remoteRenderer = null; // Remote player renderer
    let playerName = 'Player';
    let gKeyWasDown = false;
    let hKeyWasDown = false;
    let mKeyWasDown = false;
    let rKeyWasDown = false;
    let uKeyWasDown = false;
    let bKeyWasDown = false;
    let fKeyWasDown = false;
    let bDepositKeyWasDown = false;
    let shopMenuOpen = false;
    let drivingMode = false;
    let moneySpreadMode = false; // Third-person money spread on foot
    let smoothCamPos = null; // For smooth camera follow
    const CAR_ENTER_DISTANCE = 6; // How close to be to enter car
    const STRIPPER_INVITE_RANGE = 20; // How far to look for strippers to invite
    const STRIPPER_INVITE_COST = 50; // Cost to invite a stripper into the car
    const STRIPPER_ARM_COST = 100; // Cost to arm a stripper with a glock
    let inviteCooldown = 0; // Cooldown between invite attempts
    let hookerCombo = 0; // Combo counter for rapid hooker invites
    let hookerComboTimer = 0; // Timer - combo resets when this hits 0
    const HOOKER_COMBO_WINDOW = 5; // Seconds to keep combo alive
    let carHitCooldown = 0; // Cooldown to prevent multi-hits on same frame
    let impactDrag = 0; // Smooth deceleration from NPC impacts

    // === GLOBAL PARTICLE PERFORMANCE CAPS ===
    const particleCaps = {
        bloodParticles: { active: 0, max: 120 },   // Blood spray meshes
        gibs: { active: 0, max: 20 },               // Body chunk gibs
        streaks: { active: 0, max: 15 },             // Ground blood streaks
        pools: { active: 0, max: 8 },                // Blood pools
        ragdolls: { active: 0, max: 4 },             // Flying ragdoll bodies
        screenSplats: { active: 0, max: 6 },         // DOM screen blood splatters
        dollarBills: { active: 0, max: 8 },          // DOM dollar bill elements
        tracers: { active: 0, max: 12 },             // Gun tracer lines
        miniSplats: { active: 0, max: 10 },          // Mini blood splats from gibs
    };
    // Make globally accessible for other files
    window.particleCaps = particleCaps;

    // Shared AudioContext for performance (avoid creating new ones per sound)
    let sharedAudioCtx = null;
    function getAudioCtx() {
        if (!sharedAudioCtx) {
            sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return sharedAudioCtx;
    }
    // Expose globally so all NPC classes can share one AudioContext
    window.getSharedAudioCtx = getAudioCtx;

    // High effect state
    let highLevel = 0; // 0 = sober, 1 = max high
    let highSpinAngle = 0;
    let highWobbleTime = 0;
    const HIGH_RANGE = 8; // distance to bongman to get high
    const HIGH_GAIN_RATE = 0.3; // how fast you get high per second (per nearby bongman)
    const HIGH_DECAY_RATE = 0.08; // how fast it wears off
    let highOverlay = null;

    // Underwater effect state
    let underwaterOverlay = null;
    let waterTime = 0;

    function init() {
        // Create Three.js scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xFFB0C8); // Pink sky
        scene.fog = new THREE.Fog(0xFFB0C8, 40, 80);

        // Camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = false;
        document.body.appendChild(renderer.domElement);

        // Lighting (pink-tinted)
        const ambientLight = new THREE.AmbientLight(0xffaacc, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffe0ee, 0.8);
        sunLight.position.set(50, 100, 30);
        scene.add(sunLight);

        const hemisphereLight = new THREE.HemisphereLight(0xFFB0C8, 0x884466, 0.3);
        scene.add(hemisphereLight);

        // Initialize game systems
        input = new InputHandler();
        
        // Initialize bindings system and wire into input handler
        const bindings = new Bindings();
        input.bindings = bindings;
        window.settingsUI = new SettingsUI(bindings);
        
        world = new World(scene);
        player = new Player(camera, world);
        ui = new UI(player, world);
        clock = new THREE.Clock();

        // Handle window resize
        window.addEventListener('resize', onResize);

        // Start screen click handler
        document.getElementById('start-screen').addEventListener('click', startGame);

        // Pointer lock change handler
        document.addEventListener('pointerlockchange', onPointerLockChange);

        // Start render loop (but don't update game until started)
        animate();
    }

    function startGame() {
        if (gameStarted) return;
        gameStarted = true;

        // Get player name from input
        const nameInput = document.getElementById('player-name-input');
        playerName = (nameInput && nameInput.value.trim()) || 'Player' + Math.floor(Math.random() * 999);

        input.requestPointerLock();
        
        // Generate initial chunks and spawn player
        player.spawn();
        catSpawner = new CatSpawner(world, scene, player);
        bongManSpawner = new BongManSpawner(world, scene);
        stripperSpawner = new StripperSpawner(world, scene);
        crackheadSpawner = new CrackheadSpawner(world, scene, player);
        copSpawner = new CopSpawner(world, scene, player);
        // Add camera to scene so child objects (gun) render
        scene.add(camera);
        glock = new Glock(scene, camera, player);
        glock.setTargets(catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, copSpawner);

        // Spawn health potion system (Mango Cart Ale pickups)
        healthPotionSpawner = new HealthPotionSpawner(world, scene);
        healthPotionSpawner.stripperSpawner = stripperSpawner;
        healthPotionSpawner.player = player;

        // Give player a reference to stripper spawner for money spread collection display
        player.stripperSpawnerRef = stripperSpawner;

        // Wire up cop spawner references for wanted-level NPC scaling
        crackheadSpawner.copSpawner = copSpawner;
        crackheadSpawner.stripperSpawner = stripperSpawner;
        stripperSpawner.copSpawner = copSpawner;

        // Spawn strip club manager
        stripClubManager = new StripClubManager(world, scene);

        // Initialize mission system
        missionSystem = new MissionSystem();
        missionSystem.glockRef = glock;
        missionSystem.show();
        window.missionSystem = missionSystem;

        // Start fetching real crypto prices for liquor store tickers
        if (window.cryptoPriceFetcher) {
            window.cryptoPriceFetcher.start();
        }

        // Spawn crypto liquor store system
        liquorStoreSpawner = new LiquorStoreSpawner(world, scene);
        liquorStoreSpawner.player = player;
        liquorStoreSpawner.glock = glock;
        liquorStoreSpawner.stripperSpawner = stripperSpawner;
        if (stripClubManager) stripClubManager.glock = glock;

        // Force-spawn the first liquor store near the player and teleport player there
        const firstStore = liquorStoreSpawner.forceSpawnAtRoad(player.position.x, player.position.z);
        if (firstStore) {
            const parkPos = LiquorStoreSpawner.getParkingPosition(firstStore);
            player.position.set(parkPos.x, parkPos.y, parkPos.z);
            player.velocity.set(0, 0, 0);
            world.update(player.position.x, player.position.z);
            player.updateCamera();
        }

        // Spawn crypto billboard system
        billboardSpawner = new BillboardSpawner(world, scene);
        // Expose liquorStoreSpawner globally so billboards can check distance
        window.liquorStoreSpawner = liquorStoreSpawner;

        // Spawn the pimp Dodge Challenger in the parking lot
        spawnChallenger();

        // === INITIALIZE MULTIPLAYER ===
        initMultiplayer();

        // === INITIALIZE MINIMAP ===
        initMinimap();

        ui.show();
        
        // Show multiplayer HUD
        const mpHud = document.getElementById('mp-hud');
        if (mpHud) mpHud.style.display = 'block';
        
        clock.start();
    }

    // === MULTIPLAYER SYSTEM ===
    function initMultiplayer() {
        mp = new Multiplayer();
        remoteRenderer = new RemotePlayerRenderer(scene);
        
        // Set up callbacks
        mp.onPlayerJoin = function(peerId, name) {
            console.log('[GAME] Player joined:', name);
            remoteRenderer.addPlayer(peerId, name);
            showMPMessage('🟢 ' + name + ' joined the world!', '#44ff88');
            updateMPPlayerCount();
        };
        
        mp.onPlayerLeave = function(peerId, name) {
            console.log('[GAME] Player left:', name);
            remoteRenderer.removePlayer(peerId);
            showMPMessage('🔴 ' + name + ' left the world', '#ff6666');
            updateMPPlayerCount();
        };
        
        mp.onPlayerUpdate = function(peerId, data) {
            remoteRenderer.updatePlayerData(peerId, data);
            // Update lastMoveTime for timeout detection
            if (remoteRenderer.players[peerId]) {
                remoteRenderer.players[peerId].lastMoveTime = Date.now();
            }
        };
        
        mp.onBlockChange = function(x, y, z, blockType) {
            // Apply block change from remote player
            world.setBlock(x, y, z, blockType);
        };
        
        mp.onConnectionStatus = function(state, message) {
            const statusEl = document.getElementById('mp-connection-status');
            const startStatusEl = document.getElementById('mp-status');
            if (statusEl) {
                statusEl.textContent = message;
                switch(state) {
                    case 'host': statusEl.style.color = '#ffaa00'; break;
                    case 'connected': statusEl.style.color = '#44ff88'; break;
                    case 'connecting': statusEl.style.color = '#ffff44'; break;
                    case 'reconnecting': statusEl.style.color = '#ffaa44'; break;
                    case 'error': statusEl.style.color = '#ff4444'; break;
                    default: statusEl.style.color = '#888888';
                }
            }
            if (startStatusEl) {
                startStatusEl.textContent = '🌐 ' + message;
            }
            updateMPPlayerCount();
        };
        
        // Expose mp globally so player.js can broadcast block changes
        window.mp = mp;
        
        // Start multiplayer connection
        mp.init(playerName);
    }
    
    function updateMPPlayerCount() {
        const countEl = document.getElementById('mp-player-count');
        if (!countEl || !mp) return;
        const count = mp.getPlayerCount();
        countEl.textContent = '👥 ' + count + ' player' + (count !== 1 ? 's' : '');
        if (mp.isHost) {
            countEl.textContent += ' ⭐';
        }
    }
    
    // === MINIMAP SYSTEM ===
    let minimapCanvas = null;
    let minimapCtx = null;
    let minimapFrameCounter = 0;
    let waterAnimTimer = 0;
    const MINIMAP_SIZE = 160;
    const MINIMAP_SCALE = 1.2; // pixels per block (so ~67 block radius visible)
    const MINIMAP_CENTER = MINIMAP_SIZE / 2;

    function initMinimap() {
        minimapCanvas = document.getElementById('minimap');
        if (!minimapCanvas) return;
        minimapCtx = minimapCanvas.getContext('2d');
        const container = document.getElementById('minimap-container');
        if (container) container.style.display = 'block';
    }

    function updateMinimap() {
        if (!minimapCtx || !player || !mp) return;

        const ctx = minimapCtx;
        const cx = MINIMAP_CENTER;
        const cy = MINIMAP_CENTER;
        const r = MINIMAP_SIZE / 2;

        // Clear with dark background
        ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Clip to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.clip();

        // Dark background
        ctx.fillStyle = 'rgba(10, 8, 20, 0.85)';
        ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Get player facing angle (yaw) for rotating the map
        const playerYaw = camera.rotation.y;

        // Draw faint grid lines (roads every 128 blocks)
        const ROAD_SPACING = 128;
        ctx.strokeStyle = 'rgba(60, 50, 80, 0.4)';
        ctx.lineWidth = 1;
        const viewRange = r / MINIMAP_SCALE;
        const px = player.position.x;
        const pz = player.position.z;

        // Draw road grid lines
        ctx.strokeStyle = 'rgba(100, 90, 120, 0.3)';
        ctx.lineWidth = 2;
        const minRoadX = Math.floor((px - viewRange) / ROAD_SPACING) * ROAD_SPACING;
        const maxRoadX = Math.ceil((px + viewRange) / ROAD_SPACING) * ROAD_SPACING;
        const minRoadZ = Math.floor((pz - viewRange) / ROAD_SPACING) * ROAD_SPACING;
        const maxRoadZ = Math.ceil((pz + viewRange) / ROAD_SPACING) * ROAD_SPACING;

        for (let rx = minRoadX; rx <= maxRoadX; rx += ROAD_SPACING) {
            drawMinimapLine(ctx, cx, cy, rx - px, -viewRange, rx - px, viewRange, playerYaw, MINIMAP_SCALE);
        }
        for (let rz = minRoadZ; rz <= maxRoadZ; rz += ROAD_SPACING) {
            drawMinimapLine(ctx, cx, cy, -viewRange, rz - pz, viewRange, rz - pz, playerYaw, MINIMAP_SCALE);
        }

        // Draw remote players (only active ones)
        const remotePlayers = mp.getRemotePlayers();
        for (const pid in remotePlayers) {
            const rp = remotePlayers[pid];
            if (!rp || !rp.position) continue;
            // Skip players that haven't sent position updates recently
            if (!mp.isPlayerActive(pid)) continue;

            // Relative position
            const dx = rp.position.x - px;
            const dz = rp.position.z - pz;

            // Rotate by player yaw (so forward is always up)
            const cos = Math.cos(playerYaw);
            const sin = Math.sin(playerYaw);
            const sx = (dx * cos - dz * sin) * MINIMAP_SCALE + cx;
            const sy = (dx * sin + dz * cos) * MINIMAP_SCALE + cy;

            // Check if within minimap circle
            const distFromCenter = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy));
            if (distFromCenter > r - 6) {
                // Draw at edge as an arrow indicator
                const angle = Math.atan2(sy - cy, sx - cx);
                const edgeX = cx + Math.cos(angle) * (r - 8);
                const edgeY = cy + Math.sin(angle) * (r - 8);

                // Small arrow pointing outward
                ctx.fillStyle = '#44ffff';
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(edgeX, edgeY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else {
                // Draw player dot
                ctx.fillStyle = rp.driving ? '#ffaa00' : '#44ffff';
                ctx.shadowColor = rp.driving ? '#ffaa00' : '#44ffff';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(sx, sy, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Draw name label
                if (rp.name) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 8px Courier New';
                    ctx.textAlign = 'center';
                    ctx.fillText(rp.name, sx, sy - 7);
                }
            }
        }

        // Draw Mt. Takedown marker on minimap
        const MTN_X = 256, MTN_Z = 256;
        const mtnDx = MTN_X - px;
        const mtnDz = MTN_Z - pz;
        const mtnCos = Math.cos(playerYaw);
        const mtnSin = Math.sin(playerYaw);
        const mtnSx = (mtnDx * mtnCos - mtnDz * mtnSin) * MINIMAP_SCALE + cx;
        const mtnSy = (mtnDx * mtnSin + mtnDz * mtnCos) * MINIMAP_SCALE + cy;
        const mtnDistFromCenter = Math.sqrt((mtnSx - cx) * (mtnSx - cx) + (mtnSy - cy) * (mtnSy - cy));
        
        if (mtnDistFromCenter < r - 6) {
            // Mountain is visible on minimap - draw triangle icon
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(mtnSx, mtnSy - 7);
            ctx.lineTo(mtnSx - 5, mtnSy + 3);
            ctx.lineTo(mtnSx + 5, mtnSy + 3);
            ctx.closePath();
            ctx.fill();
            // Snow cap
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(mtnSx, mtnSy - 7);
            ctx.lineTo(mtnSx - 2, mtnSy - 3);
            ctx.lineTo(mtnSx + 2, mtnSy - 3);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            // Label
            ctx.fillStyle = '#ff8833';
            ctx.font = 'bold 7px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('MT.TAKEDOWN', mtnSx, mtnSy + 12);
        } else {
            // Draw at edge as direction indicator
            const mtnAngle = Math.atan2(mtnSy - cy, mtnSx - cx);
            const mtnEdgeX = cx + Math.cos(mtnAngle) * (r - 10);
            const mtnEdgeY = cy + Math.sin(mtnAngle) * (r - 10);
            ctx.fillStyle = '#ff6600';
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(mtnEdgeX, mtnEdgeY - 4);
            ctx.lineTo(mtnEdgeX - 3, mtnEdgeY + 2);
            ctx.lineTo(mtnEdgeX + 3, mtnEdgeY + 2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw local player (center, white triangle pointing up = forward)
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw compass directions
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'bold 9px Courier New';
        ctx.textAlign = 'center';
        // N is at angle = playerYaw (rotated)
        const compassR = r - 12;
        const dirs = [
            { label: 'N', angle: 0 },
            { label: 'E', angle: Math.PI / 2 },
            { label: 'S', angle: Math.PI },
            { label: 'W', angle: -Math.PI / 2 }
        ];
        for (const d of dirs) {
            const a = d.angle + playerYaw;
            const lx = cx + Math.sin(a) * compassR;
            const ly = cy - Math.cos(a) * compassR;
            ctx.fillStyle = d.label === 'N' ? 'rgba(255, 100, 100, 0.7)' : 'rgba(255, 255, 255, 0.35)';
            ctx.fillText(d.label, lx, ly + 3);
        }

        // Draw circular border ring
        ctx.restore();
        ctx.strokeStyle = 'rgba(68, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawMinimapLine(ctx, cx, cy, x1, z1, x2, z2, yaw, scale) {
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const sx1 = (x1 * cos - z1 * sin) * scale + cx;
        const sy1 = (x1 * sin + z1 * cos) * scale + cy;
        const sx2 = (x2 * cos - z2 * sin) * scale + cx;
        const sy2 = (x2 * sin + z2 * cos) * scale + cy;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
    }

    function showMPMessage(text, color) {
        const container = document.getElementById('mp-messages');
        if (!container) return;
        
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.style.cssText = 'color:' + (color || '#ffffff') + '; padding:4px 8px; background:rgba(0,0,0,0.6); ' +
            'border-radius:4px; margin-bottom:4px; text-shadow:1px 1px 2px rgba(0,0,0,0.8); ' +
            'transition:opacity 0.5s; opacity:1;';
        container.appendChild(msg);
        
        // Fade out and remove after 5 seconds
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => {
                if (msg.parentNode) msg.parentNode.removeChild(msg);
            }, 500);
        }, 5000);
        
        // Keep max 5 messages
        while (container.children.length > 5) {
            container.removeChild(container.firstChild);
        }
    }

    function onPointerLockChange() {
        if (!document.pointerLockElement && gameStarted) {
            // Show pause state - could show start screen again
            // For now just let them click to re-lock
        }
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Track previous arcade START button state for edge detection
    let arcadeStartWasPressed = false;

    function animate() {
        requestAnimationFrame(animate);

        // === ARCADE GAMEPAD POLLING ===
        if (input) {
            input.pollGamepads();
        }

        // === ARCADE START BUTTON: start game or respawn ===
        if (input && input.arcadeStartPressed && !arcadeStartWasPressed) {
            if (!gameStarted) {
                startGame();
            } else if (player && player.dead) {
                player.respawn();
            }
        }
        arcadeStartWasPressed = input ? !!input.arcadeStartPressed : false;

        if (!gameStarted) {
            renderer.render(scene, camera);
            return;
        }

        const dt = Math.min(clock.getDelta(), 0.1);

        // Handle scroll wheel for hotbar selection
        const scroll = input.consumeScroll();
        if (scroll !== 0) {
            player.selectedSlot = ((player.selectedSlot + scroll) % 8 + 8) % 8;
        }

        // Re-lock pointer on click when unlocked
        if (!input.pointerLocked && input.keys['mousedown']) {
            input.requestPointerLock();
        }

        // === H KEY: Enter/Exit car (or steal remote player's car!) ===
        const hKeyDown = input.keys['KeyH'];
        if (hKeyDown && !hKeyWasDown) {
            if (drivingMode && challenger) {
                // Exit the car
                exitCar();
            } else if (!drivingMode) {
                // Check own car first
                let enteredOwnCar = false;
                if (challenger) {
                    const dist = challenger.getDistanceTo(player.position);
                    if (dist < CAR_ENTER_DISTANCE) {
                        enterCar();
                        enteredOwnCar = true;
                    }
                }
                // If not near own car, check for helicopter to steal
                if (!enteredOwnCar && copSpawner && copSpawner.helicopter) {
                    const heli = copSpawner.helicopter;
                    if (heli.alive && (heli.stealable || heli.crashed)) {
                        const heliDist = player.position.distanceTo(heli.position);
                        if (heliDist < 8) {
                            stealHelicopter(heli);
                            enteredOwnCar = true; // Prevent further checks
                        }
                    }
                }
                // If not near own car or helicopter, check for remote players' parked cars to steal
                if (!enteredOwnCar && remoteRenderer && mp) {
                    tryStealRemoteCar();
                }
            }
        }
        hKeyWasDown = hKeyDown;

        // === HELICOPTER PROXIMITY PROMPT ===
        updateHeliPrompt();

        // === CAR PROXIMITY PROMPT ===
        updateCarPrompt();

        if (drivingMode) {
            // === DRIVING MODE ===
            // Tick down player timers even while driving (damage flash, invulnerability)
            player.damageFlash = Math.max(0, player.damageFlash - dt);
            player.invulnerable = Math.max(0, player.invulnerable - dt);
            
            // Update car physics
            challenger.updateDriving(dt, input);
            
            // Update skid mark fading
            challenger.updateSkidMarks(dt);
            
            // Update world around car position
            world.update(challenger.position.x, challenger.position.z);
            world.animateWater(dt);
            
            // Move player position to car (for NPC spawning reference)
            player.position.copy(challenger.position);
            player.position.y += 2;
            
            // 3rd person camera - smooth follow behind car
            updateDrivingCamera(dt);
            
            // Update speed display and passenger count
            updateDrivingHUD();
            
            // === HOOKER COMBO TIMER DECAY ===
            if (hookerComboTimer > 0) {
                hookerComboTimer -= dt;
                if (hookerComboTimer <= 0) {
                    hookerCombo = 0; // Combo expired!
                    hookerComboTimer = 0;
                }
            }

            // === M KEY: Money spread to invite strippers while driving ===
            inviteCooldown = Math.max(0, inviteCooldown - dt);
            const mKeyDown = input.keys['KeyM'];
            if (mKeyDown && !mKeyWasDown && inviteCooldown <= 0) {
                inviteStripperToCar();
                inviteCooldown = 1.0; // 1 second cooldown between invites
            }
            mKeyWasDown = mKeyDown;
            
            // === U KEY: Upgrade stripper with glock while driving ===
            const uKeyDown = input.keys['KeyU'];
            if (uKeyDown && !uKeyWasDown) {
                upgradeStripperInCar();
            }
            uKeyWasDown = uKeyDown;
            
            // Still update NPCs
            if (catSpawner) catSpawner.update(dt, challenger.position);
            if (bongManSpawner) bongManSpawner.update(dt, challenger.position, catSpawner);
            if (stripperSpawner) stripperSpawner.update(dt, challenger.position);
            if (crackheadSpawner) crackheadSpawner.update(dt, challenger.position);
            if (copSpawner) copSpawner.update(dt, challenger.position);
            ui.update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock);
            if (glock) glock.update(dt);
            
            // Update health potions (Mango Cart Ale pickups)
            if (healthPotionSpawner) healthPotionSpawner.update(dt, challenger.position);

            // Update liquor stores while driving
            if (liquorStoreSpawner) liquorStoreSpawner.update(dt, challenger.position);

            // Update strip clubs while driving
            if (stripClubManager) stripClubManager.update(dt, challenger.position);

            // Update crypto billboards while driving
            if (billboardSpawner) billboardSpawner.update(dt, challenger.position);
            
            // === CHECK CAR-NPC COLLISIONS (roadkill!) ===
            checkCarNPCCollisions(dt);

            // === MT. TAKEDOWN: Check if player reached the summit with helicopter chasing ===
            checkMountainTakedown();
            
            // Consume mouse input so it doesn't accumulate
            input.mouseDX = 0;
            input.mouseDY = 0;
        } else if (player.moneySpreadActive) {
            // === MONEY SPREAD THIRD-PERSON MODE ===
            moneySpreadMode = true;
            
            // Update the third-person money spread animation
            const stillActive = player.updateMoneySpread(dt, scene);
            
            if (!stillActive) {
                // Money spread ended - restore normal mode
                moneySpreadMode = false;
                
                // Restore glock visibility if it was equipped
                if (glock && glock.equipped) {
                    glock.gunGroup.visible = true;
                }
                
                // Reset camera rotation order for first person
                camera.rotation.order = 'YXZ';
                camera.fov = 75;
                camera.updateProjectionMatrix();
            }
            
            // Still update world and NPCs during money spread
            world.update(player.position.x, player.position.z);
            world.animateWater(dt);
            if (catSpawner) catSpawner.update(dt, player.position);
            if (bongManSpawner) bongManSpawner.update(dt, player.position, catSpawner);
            if (stripperSpawner) stripperSpawner.update(dt, player.position);
            if (crackheadSpawner) crackheadSpawner.update(dt, player.position);
            if (copSpawner) copSpawner.update(dt, player.position);
            ui.update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock);
            if (glock) glock.update(dt);
            if (healthPotionSpawner) healthPotionSpawner.update(dt, player.position);

            // Update crypto billboards during money spread
            if (billboardSpawner) billboardSpawner.update(dt, player.position);
            
            // Consume mouse input so it doesn't accumulate
            input.mouseDX = 0;
            input.mouseDY = 0;
        } else {
            // === NORMAL ON-FOOT MODE ===
            moneySpreadMode = false;
            
            // Toggle glock with G key
            const gKeyDown = input.keys['KeyG'];
            if (gKeyDown && !gKeyWasDown && glock) {
                glock.toggle();
            }
            gKeyWasDown = gKeyDown;

            // Money spread with M key (only if not already in money spread)
            const mKeyDown = input.keys['KeyM'];
            if (mKeyDown && !mKeyWasDown && glock && !player.moneySpreadActive) {
                glock.moneySpread();
            }
            mKeyWasDown = mKeyDown;

            // R key to reload
            const rKeyDown = input.keys['KeyR'];
            if (rKeyDown && !rKeyWasDown && glock && glock.equipped) {
                glock.startReload();
            }
            rKeyWasDown = rKeyDown;

            // If glock is equipped, left click shoots instead of breaking blocks
            if (glock && glock.equipped) {
                if (input.mouseLeft) {
                    glock.shoot();
                    input.mouseLeft = false;
                }
            }

            // Update game systems (skip player input when shop menu is open to prevent movement/hotbar conflicts)
            if (shopMenuOpen) {
                // Only update timers, not movement or input
                player.damageFlash = Math.max(0, player.damageFlash - dt);
                player.invulnerable = Math.max(0, player.invulnerable - dt);
                player.updateCamera();
            } else {
                player.update(dt, input);
            }
            world.update(player.position.x, player.position.z);
            world.animateWater(dt);
            if (catSpawner) catSpawner.update(dt, player.position);
            if (bongManSpawner) bongManSpawner.update(dt, player.position, catSpawner);
            if (stripperSpawner) stripperSpawner.update(dt, player.position);
            if (crackheadSpawner) crackheadSpawner.update(dt, player.position);
            if (copSpawner) copSpawner.update(dt, player.position);
            ui.update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock);
            if (glock) glock.update(dt);

            // Update health potions (Mango Cart Ale pickups)
            if (healthPotionSpawner) healthPotionSpawner.update(dt, player.position);

            // Update liquor stores on foot
            if (liquorStoreSpawner) liquorStoreSpawner.update(dt, player.position);

            // Update strip clubs on foot
            if (stripClubManager) stripClubManager.update(dt, player.position);

            // === STRIP CLUB PROXIMITY: Floor upgrade (F key) and deposit hookers (B key) ===
            if (stripClubManager && !shopMenuOpen) {
                const nearClub = stripClubManager.getNearestClub(player.position, 15);
                const clubPrompt = document.getElementById('club-prompt');
                if (nearClub) {
                    // Show club interaction prompt
                    if (clubPrompt) {
                        const cost = nearClub.getFloorUpgradeCost();
                        const costStr = cost === Infinity ? 'MAX' : '$' + cost;
                        const income = nearClub.getIncomePerSecond();
                        clubPrompt.innerHTML = `💃 STRIP CLUB | Floor ${nearClub.floors}/${nearClub.maxFloors} | ${nearClub.stripperScore} hookers | $${income}/s<br>` +
                            `[F] Add Floor (${costStr}) | [B] Deposit Hookers`;
                        clubPrompt.style.display = 'block';
                    }

                    // F key: Buy floor upgrade
                    const fKeyDown = input.keys['KeyF'];
                    if (fKeyDown && !fKeyWasDown) {
                        const upgradeCost = nearClub.getFloorUpgradeCost();
                        if (upgradeCost !== Infinity && glock && glock.money >= upgradeCost) {
                            glock.money -= upgradeCost;
                            nearClub.addFloor();
                            // Play purchase sound
                            if (activeShopStore && activeShopStore.playPurchaseSound) {
                                activeShopStore.playPurchaseSound();
                            }
                            // Show message
                            const inviteMsg = document.getElementById('invite-message');
                            if (inviteMsg) {
                                inviteMsg.textContent = `🏗️ FLOOR ${nearClub.floors} ADDED! Income: $${nearClub.getIncomePerSecond()}/s 💰`;
                                inviteMsg.classList.remove('active');
                                inviteMsg.style.display = 'none';
                                void inviteMsg.offsetWidth;
                                inviteMsg.style.display = 'block';
                                inviteMsg.classList.add('active');
                                setTimeout(() => { inviteMsg.classList.remove('active'); inviteMsg.style.display = 'none'; }, 3000);
                            }
                        } else if (upgradeCost === Infinity) {
                            const brokeMsg = document.getElementById('broke-message');
                            if (brokeMsg) {
                                brokeMsg.textContent = '🏢 MAX FLOORS REACHED! 🏢';
                                brokeMsg.classList.remove('active'); brokeMsg.style.display = 'none';
                                void brokeMsg.offsetWidth;
                                brokeMsg.style.display = 'block'; brokeMsg.classList.add('active');
                                setTimeout(() => { brokeMsg.classList.remove('active'); brokeMsg.style.display = 'none'; }, 2000);
                            }
                        } else {
                            showBrokeMessage();
                            playBrokeSound();
                        }
                    }
                    fKeyWasDown = !!fKeyDown;

                    // B key: Deposit hookers from following strippers + car passengers
                    const bDepositDown = input.keys['KeyB'];
                    if (bDepositDown && !bDepositKeyWasDown) {
                        let deposited = 0;
                        // Deposit on-foot strippers
                        if (stripperSpawner && stripperSpawner.strippers) {
                            for (let i = stripperSpawner.strippers.length - 1; i >= 0; i--) {
                                const s = stripperSpawner.strippers[i];
                                if (s.alive && (s.collected || s.hired) && !s.inCar) {
                                    deposited++;
                                    s.alive = false;
                                    if (s.mesh) scene.remove(s.mesh);
                                    stripperSpawner.strippers.splice(i, 1);
                                }
                            }
                        }
                        // Deposit car passengers
                        if (challenger && challenger.passengers) {
                            for (let i = challenger.passengers.length - 1; i >= 0; i--) {
                                const s = challenger.passengers[i];
                                deposited++;
                                s.alive = false;
                                s.inCar = false;
                                if (s.mesh) scene.remove(s.mesh);
                            }
                            challenger.passengers = [];
                        }
                        if (deposited > 0) {
                            nearClub.depositStrippers(deposited);
                            // === MISSION: Strippers deposited ===
                            if (missionSystem) missionSystem.onStrippersDeposited(deposited);
                            const inviteMsg = document.getElementById('invite-message');
                            if (inviteMsg) {
                                inviteMsg.textContent = `💃 ${deposited} HOOKERS DEPOSITED! Income: $${nearClub.getIncomePerSecond()}/s 💰`;
                                inviteMsg.classList.remove('active'); inviteMsg.style.display = 'none';
                                void inviteMsg.offsetWidth;
                                inviteMsg.style.display = 'block'; inviteMsg.classList.add('active');
                                setTimeout(() => { inviteMsg.classList.remove('active'); inviteMsg.style.display = 'none'; }, 3000);
                            }
                        } else {
                            const brokeMsg = document.getElementById('broke-message');
                            if (brokeMsg) {
                                brokeMsg.textContent = '🤷 No hookers to deposit! 🤷';
                                brokeMsg.classList.remove('active'); brokeMsg.style.display = 'none';
                                void brokeMsg.offsetWidth;
                                brokeMsg.style.display = 'block'; brokeMsg.classList.add('active');
                                setTimeout(() => { brokeMsg.classList.remove('active'); brokeMsg.style.display = 'none'; }, 2000);
                            }
                        }
                    }
                    bDepositKeyWasDown = !!bDepositDown;
                } else {
                    if (clubPrompt) clubPrompt.style.display = 'none';
                }
            }

            // Update crypto billboards on foot
            if (billboardSpawner) billboardSpawner.update(dt, player.position);
        }

        // === V KEY: Open/Close Crypto Liquor Store Shop ===
        const bKeyDown = input.keys['KeyV'];
        if (bKeyDown && !bKeyWasDown) {
            if (shopMenuOpen) {
                closeShopMenu();
            } else if (!drivingMode && !player.moneySpreadActive) {
                // Try to open shop if near a store
                if (liquorStoreSpawner) {
                    const store = liquorStoreSpawner.getNearestShoppableStore(player.position);
                    if (store) {
                        openShopMenu(store);
                    }
                }
            }
        }
        bKeyWasDown = bKeyDown;

        // === SHOP MENU: Handle number key purchases ===
        if (shopMenuOpen && !drivingMode) {
            handleShopInput();

            // Auto-close shop if player is no longer near the store
            if (activeShopStore) {
                const stillNear = activeShopStore.alive && activeShopStore.isPlayerInShopRange(player.position);
                if (!stillNear) {
                    closeShopMenu();
                }
            }
        }

        // === ESC to close shop (with delay guard to prevent instant close from pointer lock release) ===
        if (shopMenuOpen && input.keys['Escape'] && (performance.now() - shopOpenTime > 500)) {
            closeShopMenu();
        }

        // === HIGH EFFECT: check proximity to bongmen ===
        updateHighEffect(dt);

        // === UNDERWATER EFFECT ===
        updateUnderwaterEffect(dt);

        // === MULTIPLAYER UPDATE ===
        if (mp && mp.connected) {
            // Build car position data for when we're NOT driving (so others can see our parked car)
            let carPosData = null;
            if (!drivingMode && challenger) {
                carPosData = {
                    x: challenger.position.x,
                    y: challenger.position.y,
                    z: challenger.position.z,
                    rotation: challenger.rotation
                };
            }
            const passengerCount = (drivingMode && challenger) ? challenger.getPassengerCount() : 0;
            
            // Broadcast local player position (include car rotation when driving, car position when parked)
            mp.broadcastPosition(
                player.position,
                { x: camera.rotation.x, y: camera.rotation.y },
                player.health,
                drivingMode,
                glock ? glock.equipped : false,
                drivingMode && challenger ? challenger.rotation : undefined,
                carPosData,
                passengerCount
            );
        }
        
        // Update remote player rendering
        if (remoteRenderer) {
            remoteRenderer.update(dt, camera.position);
        }

        // Update minimap (throttled to ~10fps for performance)
        minimapFrameCounter++;
        if (minimapFrameCounter >= 6) {
            minimapFrameCounter = 0;
            updateMinimap();
        }

        // Update mission system
        if (missionSystem) missionSystem.update(dt);

        // Render
        renderer.render(scene, camera);
    }

    function updateHighEffect(dt) {
        if (!highOverlay) {
            highOverlay = document.getElementById('high-overlay');
        }

        // Count nearby bongmen and increase high level
        let nearbyBongmen = 0;
        if (bongManSpawner && bongManSpawner.bongMen) {
            for (const bm of bongManSpawner.bongMen) {
                if (bm.alive) {
                    const dist = bm.position.distanceTo(player.position);
                    if (dist < HIGH_RANGE) {
                        // Closer = stronger effect
                        nearbyBongmen += 1 - (dist / HIGH_RANGE);
                    }
                }
            }
        }

        // Adjust high level
        if (nearbyBongmen > 0) {
            highLevel = Math.min(1, highLevel + HIGH_GAIN_RATE * nearbyBongmen * dt);
        } else {
            highLevel = Math.max(0, highLevel - HIGH_DECAY_RATE * dt);
        }

        // Apply visual effects based on high level
        if (highLevel > 0.01) {
            highWobbleTime += dt;
            highSpinAngle += dt * highLevel * 0.8; // slow spin

            // Camera roll (spin/tilt)
            camera.rotation.z = Math.sin(highSpinAngle) * highLevel * 0.15;

            // Camera wobble (slight swaying)
            const wobbleX = Math.sin(highWobbleTime * 1.3) * highLevel * 0.02;
            const wobbleY = Math.cos(highWobbleTime * 0.9) * highLevel * 0.015;
            camera.position.x += wobbleX;
            camera.position.y += wobbleY;

            // FOV distortion (breathing effect)
            const baseFOV = 75;
            const fovWobble = Math.sin(highWobbleTime * 0.7) * highLevel * 12;
            camera.fov = baseFOV + fovWobble;
            camera.updateProjectionMatrix();

            // Fog gets closer (vision clouded)
            const fogNear = 40 - highLevel * 25;
            const fogFar = 80 - highLevel * 40;
            scene.fog.near = Math.max(5, fogNear);
            scene.fog.far = Math.max(20, fogFar);

            // Tint the fog green-ish when high
            const greenTint = highLevel * 0.3;
            scene.fog.color.setRGB(
                1.0 - greenTint * 0.5,
                0.69 + greenTint * 0.3,
                0.78 - greenTint * 0.3
            );
            scene.background.copy(scene.fog.color);

            // Show overlay
            if (highOverlay) {
                highOverlay.classList.add('active');
                highOverlay.style.opacity = highLevel * 0.8;
            }
        } else {
            // Reset everything when sober
            camera.rotation.z = 0;
            camera.fov = 75;
            camera.updateProjectionMatrix();
            scene.fog.near = 40;
            scene.fog.far = 80;
            scene.fog.color.setHex(0xFFB0C8);
            scene.background.setHex(0xFFB0C8);
            if (highOverlay) {
                highOverlay.classList.remove('active');
                highOverlay.style.opacity = 0;
            }
        }
    }

    function updateUnderwaterEffect(dt) {
        if (!underwaterOverlay) {
            underwaterOverlay = document.getElementById('underwater-overlay');
        }

        waterTime += dt;

        if (player.inWater) {
            // Show underwater overlay
            if (underwaterOverlay) {
                underwaterOverlay.classList.add('active');
                // Stronger effect when head is underwater
                if (player.headUnderwater) {
                    underwaterOverlay.style.opacity = 0.85;
                } else {
                    underwaterOverlay.style.opacity = 0.4;
                }
            }

            // Underwater fog - reduce visibility, tint pink-blue
            if (highLevel <= 0.01) { // Don't override high effect
                if (player.headUnderwater) {
                    // Fully submerged - very close fog, dark pink-blue tint
                    scene.fog.near = 2;
                    scene.fog.far = 25;
                    const waveTint = Math.sin(waterTime * 1.5) * 0.03;
                    scene.fog.color.setRGB(0.65 + waveTint, 0.25, 0.5 + waveTint);
                    scene.background.copy(scene.fog.color);
                } else {
                    // Partially in water - moderate fog
                    scene.fog.near = 15;
                    scene.fog.far = 55;
                    scene.fog.color.setRGB(0.85, 0.45, 0.65);
                    scene.background.copy(scene.fog.color);
                }

                // Slight FOV distortion underwater (wavy)
                const underwaterFOV = 75 + Math.sin(waterTime * 2) * 2;
                camera.fov = underwaterFOV;
                camera.updateProjectionMatrix();
            }
        } else {
            // Not in water - hide overlay
            if (underwaterOverlay) {
                underwaterOverlay.classList.remove('active');
                underwaterOverlay.style.opacity = 0;
            }

            // Reset fog if not high either
            if (highLevel <= 0.01) {
                scene.fog.near = 40;
                scene.fog.far = 80;
                scene.fog.color.setHex(0xFFB0C8);
                scene.background.setHex(0xFFB0C8);
                camera.fov = 75;
                camera.updateProjectionMatrix();
            }
        }
    }

    function enterCar() {
        if (!challenger || drivingMode) return;
        
        drivingMode = true;
        player.driving = true;
        player.drivingCar = challenger;
        challenger.enter();
        
        // Auto-board ALL collected/hired/guarding strippers (they teleport into the car)
        if (stripperSpawner) {
            for (const s of stripperSpawner.strippers) {
                if (!s.alive || s.inCar) continue;
                if (!s.hired && !s.collected && !s.guardingCar) continue; // Only board hired, collected, or guarding strippers
                s.collected = false; // No longer just collected - now actively in car
                s.guardingCar = false; // No longer guarding - back in the car
                s.guardPosition = null;
                s.guardCarRef = null;
                challenger.addPassenger(s); // addPassenger sets inCar=true, hired=true
                
                // Wire up combat references so strippers can shoot from the car
                s.crackheadSpawner = crackheadSpawner;
                s.copSpawner = copSpawner;
                s.glockRef = glock;
                s.playerRef = player;
                s.cameraRef = camera;
                
                // Auto-equip with a glock if not already armed
                if (!s.armed) {
                    s.equipGlock();
                }
            }
        }
        
        // Initialize smooth camera position
        smoothCamPos = challenger.getCameraPosition();
        
        // Hide normal HUD elements, show driving HUD
        const hud = document.getElementById('hud');
        const drivingHud = document.getElementById('driving-hud');
        const carPrompt = document.getElementById('car-prompt');
        if (hud) hud.style.display = 'none';
        if (drivingHud) drivingHud.style.display = 'block';
        if (carPrompt) carPrompt.style.display = 'none';
        
        // Clear any active damage flash when entering car
        player.damageFlash = 0;
        const dmgFlash = document.getElementById('damage-flash');
        if (dmgFlash) dmgFlash.classList.remove('active');
        
        // Hide glock if equipped
        if (glock && glock.equipped) {
            glock.toggle();
        }
        
        // Hide block highlight
        if (player.highlightMesh) {
            player.highlightMesh.visible = false;
        }
        
        // Increase fog distance for driving (see further)
        scene.fog.near = 60;
        scene.fog.far = 120;
    }

    function exitCar() {
        if (!challenger || !drivingMode) return;
        
        // Get exit position from car
        const exitPos = challenger.exit();
        
        drivingMode = false;
        player.driving = false;
        player.drivingCar = null;
        
        // Teleport player to exit position
        player.position.copy(exitPos);
        player.velocity.set(0, 0, 0);
        player.onGround = false;
        
        // Restore normal HUD
        const hud = document.getElementById('hud');
        const drivingHud = document.getElementById('driving-hud');
        if (hud) hud.style.display = 'block';
        if (drivingHud) drivingHud.style.display = 'none';
        
        // Reset camera to first person
        camera.rotation.order = 'YXZ';
        camera.fov = 75;
        camera.updateProjectionMatrix();
        
        // Reset fog
        scene.fog.near = 40;
        scene.fog.far = 80;
        
        // Update camera immediately
        player.updateCamera();
    }

    function updateCarPrompt() {
        const carPrompt = document.getElementById('car-prompt');
        if (!carPrompt || !challenger || drivingMode) {
            if (carPrompt) carPrompt.style.display = 'none';
            return;
        }
        
        const dist = challenger.getDistanceTo(player.position);
        if (dist < CAR_ENTER_DISTANCE) {
            carPrompt.style.display = 'block';
        } else {
            carPrompt.style.display = 'none';
        }
    }

    function updateDrivingCamera(dt) {
        if (!challenger) return;
        
        // Get ideal camera position (behind and above car)
        const targetCamPos = challenger.getCameraPosition();
        const lookTarget = challenger.getCameraTarget();
        
        // Smooth camera follow with lerp
        const lerpSpeed = 4.0; // How fast camera catches up
        if (!smoothCamPos) {
            smoothCamPos = targetCamPos.clone();
        }
        
        smoothCamPos.lerp(targetCamPos, Math.min(1, lerpSpeed * dt));
        
        // Set camera position and look at car
        camera.position.copy(smoothCamPos);
        camera.lookAt(lookTarget);
        
        // Wider FOV for driving
        camera.fov = 80;
        camera.updateProjectionMatrix();
    }

    function updateDrivingHUD() {
        const speedDisplay = document.getElementById('speed-display');
        if (!speedDisplay || !challenger) return;
        
        // Convert blocks/sec to "mph" (just multiply for fun factor)
        const mph = Math.abs(Math.round(challenger.speed * 3.6));
        speedDisplay.textContent = mph + ' mph';

        // === MISSION: Track top speed ===
        if (missionSystem && mph > 0) missionSystem.onSpeedReached(mph);
        
        // Color based on speed
        if (mph > 50) {
            speedDisplay.style.color = '#FF4444'; // Red at high speed
        } else if (mph > 30) {
            speedDisplay.style.color = '#FFAA00'; // Orange at medium
        } else {
            speedDisplay.style.color = '#FFD700'; // Gold at low
        }
        
        // Update passenger display
        const passengerDisplay = document.getElementById('passenger-display');
        if (passengerDisplay) {
            const count = challenger.getPassengerCount();
            const armed = challenger.getArmedPassengerCount();
            const upgraded = challenger.getUpgradedPassengerCount();
            const upgradeable = challenger.getUpgradeablePassengerCount();
            const money = glock ? glock.money : 0;
            if (count > 0) {
                passengerDisplay.style.display = 'block';
                let text = `💃 ${count} stripper${count > 1 ? 's' : ''}`;
                if (upgraded > 0 && upgradeable > 0) {
                    text += ` (🔫${armed - upgraded} | 🔫🔫${upgraded})`;
                } else if (upgraded > 0) {
                    text += ` (🔫🔫${upgraded})`;
                } else {
                    text += ` (🔫${armed})`;
                }
                text += ` | 💵 $${money}`;
                if (upgradeable > 0) text += ` | U to upgrade 🔫🔫 $100`;
                passengerDisplay.textContent = text;
                passengerDisplay.style.color = '#FFD700';
            } else {
                passengerDisplay.style.display = 'block';
                passengerDisplay.textContent = `💵 $${money} | M to invite 💃`;
                passengerDisplay.style.color = money >= STRIPPER_INVITE_COST ? '#00ff88' : '#ff6666';
            }
        }
    }

    function inviteStripperToCar() {
        if (!challenger || !drivingMode || !glock || !stripperSpawner) return;

        // Check if player has enough money
        if (glock.money < STRIPPER_INVITE_COST) {
            showBrokeMessage();
            playBrokeSound();
            hookerCombo = 0; // Reset combo on broke
            return;
        }

        // Find the nearest stripper within range that isn't already in the car or hired
        let nearestStripper = null;
        let nearestDist = Infinity;
        for (const s of stripperSpawner.strippers) {
            if (!s.alive || s.inCar || s.hired) continue;
            const dist = s.position.distanceTo(challenger.position);
            if (dist < STRIPPER_INVITE_RANGE && dist < nearestDist) {
                nearestDist = dist;
                nearestStripper = s;
            }
        }

        if (!nearestStripper) {
            showNoStrippersMessage();
            return;
        }

        // Success! Deduct money and add stripper to car
        glock.money -= STRIPPER_INVITE_COST;
        
        // Play sound (reduced particles for performance - only 2 bills instead of 8)
        glock.playMoneyFlashSound();
        for (let d = 0; d < 2; d++) {
            setTimeout(() => glock.spawnDollarBill(), d * 100);
        }

        // Stripper squeals excitedly and gets in
        nearestStripper.playSqueal();
        challenger.addPassenger(nearestStripper);

        // Wire up references for hired stripper
        nearestStripper.crackheadSpawner = crackheadSpawner;
        nearestStripper.copSpawner = copSpawner;
        nearestStripper.glockRef = glock;
        nearestStripper.playerRef = player;
        nearestStripper.cameraRef = camera;
        nearestStripper.equipGlock();

        // === COMBO COUNTER ===
        hookerCombo++;
        hookerComboTimer = HOOKER_COMBO_WINDOW; // Reset combo timer
        showComboMessage(hookerCombo, challenger.getPassengerCount());

        // === MISSION: Stripper collected ===
        if (missionSystem) missionSystem.onStripperCollected();
    }

    function showComboMessage(combo, totalInCar) {
        const inviteMsg = document.getElementById('invite-message');
        if (!inviteMsg) return;

        let text;
        if (combo % 10 === 0 && combo >= 10) {
            // Milestone every 10!
            const milestones = {
                10: '🔥🔥 10x COMBO! PIMP STATUS! 🔥🔥',
                20: '💎💎 20x COMBO! LEGENDARY PIMP! 💎💎',
                30: '👑👑 30x COMBO! PIMP KING! 👑👑',
                40: '🌟🌟 40x COMBO! PIMP GOD! 🌟🌟',
                50: '💀💀 50x COMBO! UNSTOPPABLE! 💀💀'
            };
            text = milestones[combo] || `🏆🏆 ${combo}x COMBO! ABSOLUTE LEGEND! 🏆🏆`;
        } else {
            text = `💃 x${combo} COMBO! -$50 💸 (${totalInCar} in car)`;
        }

        inviteMsg.textContent = text;
        inviteMsg.classList.remove('active');
        inviteMsg.style.display = 'none';
        void inviteMsg.offsetWidth;
        inviteMsg.style.display = 'block';
        inviteMsg.classList.add('active');

        const duration = (combo % 10 === 0 && combo >= 10) ? 3500 : 2000;
        setTimeout(() => {
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
        }, duration);
    }

    function showBrokeMessage() {
        const brokeMsg = document.getElementById('broke-message');
        if (!brokeMsg) return;
        
        // Pick a random broke insult
        const insults = [
            '💀 YOU BROKE! 💀',
            '🚫 NO MONEY NO HONEY 🚫',
            '😂 YOU AIN\'T GOT $50?! 😂',
            '💸 BROKE BOY ALERT 💸',
            '🤡 GET THAT BREAD FIRST 🤡',
            '😭 SHE SAID YOU\'RE BROKE 😭'
        ];
        brokeMsg.textContent = insults[Math.floor(Math.random() * insults.length)];
        
        // Reset animation by removing and re-adding class
        brokeMsg.classList.remove('active');
        brokeMsg.style.display = 'none';
        // Force reflow
        void brokeMsg.offsetWidth;
        brokeMsg.style.display = 'block';
        brokeMsg.classList.add('active');
        
        // Hide after animation
        setTimeout(() => {
            brokeMsg.classList.remove('active');
            brokeMsg.style.display = 'none';
        }, 2500);
    }

    function showNoStrippersMessage() {
        const brokeMsg = document.getElementById('broke-message');
        if (!brokeMsg) return;
        
        brokeMsg.textContent = '🤷 No strippers nearby! 🤷';
        brokeMsg.classList.remove('active');
        brokeMsg.style.display = 'none';
        void brokeMsg.offsetWidth;
        brokeMsg.style.display = 'block';
        brokeMsg.classList.add('active');
        
        setTimeout(() => {
            brokeMsg.classList.remove('active');
            brokeMsg.style.display = 'none';
        }, 2000);
    }

    function showInviteMessage(passengerCount) {
        const inviteMsg = document.getElementById('invite-message');
        if (!inviteMsg) return;
        
        const messages = [
            '💃 She hopped in! -$50 💸',
            '💋 New passenger! -$50 💸',
            '🔥 She\'s in the whip! -$50 💸',
            '💃 Get in baby! -$50 💸',
            '😏 Another one! -$50 💸'
        ];
        inviteMsg.textContent = messages[Math.floor(Math.random() * messages.length)];
        
        // Reset animation
        inviteMsg.classList.remove('active');
        inviteMsg.style.display = 'none';
        void inviteMsg.offsetWidth;
        inviteMsg.style.display = 'block';
        inviteMsg.classList.add('active');
        
        setTimeout(() => {
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
        }, 2500);
    }

    function upgradeStripperInCar() {
        if (!challenger || !drivingMode || !glock) return;

        // Check if there are any upgradeable passengers (armed but not dual glocks yet)
        if (challenger.getUpgradeablePassengerCount() <= 0) {
            // No one to upgrade
            const brokeMsg = document.getElementById('broke-message');
            if (brokeMsg) {
                if (challenger.getPassengerCount() <= 0) {
                    brokeMsg.textContent = '🤷 No strippers in car! 🤷';
                } else {
                    brokeMsg.textContent = '🔫🔫 All strippers maxed out! 🔫🔫';
                }
                brokeMsg.classList.remove('active');
                brokeMsg.style.display = 'none';
                void brokeMsg.offsetWidth;
                brokeMsg.style.display = 'block';
                brokeMsg.classList.add('active');
                setTimeout(() => {
                    brokeMsg.classList.remove('active');
                    brokeMsg.style.display = 'none';
                }, 2000);
            }
            return;
        }

        // Check if player has enough money
        if (glock.money < STRIPPER_ARM_COST) {
            showBrokeMessage();
            playBrokeSound();
            return;
        }

        // Upgrade the first upgradeable passenger to dual glocks
        const upgraded = challenger.upgradePassenger();
        if (!upgraded) return;

        // Deduct money
        glock.money -= STRIPPER_ARM_COST;

        // Play upgrade sound and show message
        glock.playMoneyFlashSound();
        showUpgradeMessage();
    }

    function showUpgradeMessage() {
        const inviteMsg = document.getElementById('invite-message');
        if (!inviteMsg) return;

        const messages = [
            '💃🔫🔫 DUAL GLOCKS! -$100 💸',
            '🔥🔫🔫 Double strapped! -$100 💸',
            '💋🔫🔫 Gold glock upgrade! -$100 💸',
            '😈🔫🔫 Akimbo mode! -$100 💸',
            '💃🔫🔫 Twice the firepower! -$100 💸'
        ];
        inviteMsg.textContent = messages[Math.floor(Math.random() * messages.length)];

        inviteMsg.classList.remove('active');
        inviteMsg.style.display = 'none';
        void inviteMsg.offsetWidth;
        inviteMsg.style.display = 'block';
        inviteMsg.classList.add('active');

        setTimeout(() => {
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
        }, 2500);
    }

    function playBrokeSound() {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;

            // Sad trombone / buzzer - descending tone
            const osc1 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(400, t);
            osc1.frequency.linearRampToValueAtTime(200, t + 0.3);
            osc1.frequency.linearRampToValueAtTime(100, t + 0.6);
            const gain1 = ctx.createGain();
            gain1.gain.setValueAtTime(0.2, t);
            gain1.gain.linearRampToValueAtTime(0.15, t + 0.3);
            gain1.gain.linearRampToValueAtTime(0, t + 0.7);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.8);

            // Second lower tone for "wah wah" effect
            const osc2 = ctx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(350, t + 0.15);
            osc2.frequency.linearRampToValueAtTime(150, t + 0.45);
            osc2.frequency.linearRampToValueAtTime(80, t + 0.75);
            const gain2 = ctx.createGain();
            gain2.gain.setValueAtTime(0, t);
            gain2.gain.linearRampToValueAtTime(0.18, t + 0.2);
            gain2.gain.linearRampToValueAtTime(0, t + 0.8);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t + 0.15);
            osc2.stop(t + 0.9);

            // Buzzer noise burst
            const bufSize = ctx.sampleRate * 0.15;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.15, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(500, t);
            noise.connect(lp);
            lp.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);
        } catch(e) {}
    }

    // === CAR-NPC COLLISION SYSTEM ===
    const MIN_KILL_SPEED = 3;    // Minimum speed to kill NPCs (blocks/sec)
    const MIN_DAMAGE_SPEED = 1.5; // Minimum speed to damage NPCs
    const HIT_COOLDOWN_TIME = 0.15; // Seconds between hit checks per NPC

    function checkCarNPCCollisions(dt) {
        if (!challenger || !drivingMode) return;

        const carSpeed = Math.abs(challenger.speed);
        if (carSpeed < MIN_DAMAGE_SPEED) return;

        carHitCooldown = Math.max(0, carHitCooldown - dt);

        let hitSomething = false;
        let hitCount = 0;

        // --- Check Cats ---
        if (catSpawner && catSpawner.cats) {
            for (let i = catSpawner.cats.length - 1; i >= 0; i--) {
                const cat = catSpawner.cats[i];
                if (!cat.alive || cat.exploding) continue;
                if (challenger.isPointInCarBounds(cat.position)) {
                    cat.alive = false;
                    spawnCarBloodEffect(cat.position);
                    launchNPCRagdoll(cat.mesh, cat.position, carSpeed);
                    catSpawner.cats.splice(i, 1);
                    hitSomething = true;
                    hitCount++;
                }
            }
        }

        // --- Check Bongmen ---
        if (bongManSpawner && bongManSpawner.bongMen) {
            for (let i = bongManSpawner.bongMen.length - 1; i >= 0; i--) {
                const bm = bongManSpawner.bongMen[i];
                if (!bm.alive) continue;
                if (challenger.isPointInCarBounds(bm.position)) {
                    bm.alive = false;
                    spawnCarBloodEffect(bm.position);
                    launchNPCRagdoll(bm.mesh, bm.position, carSpeed);
                    bongManSpawner.bongMen.splice(i, 1);
                    hitSomething = true;
                    hitCount++;
                    if (copSpawner) copSpawner.addWanted(1);
                }
            }
        }

        // --- Check Strippers (not hired/in car) ---
        if (stripperSpawner && stripperSpawner.strippers) {
            for (let i = stripperSpawner.strippers.length - 1; i >= 0; i--) {
                const s = stripperSpawner.strippers[i];
                if (!s.alive || s.inCar || s.hired || s.collected || s.guardingCar) continue;
                if (challenger.isPointInCarBounds(s.position)) {
                    s.alive = false;
                    spawnCarBloodEffect(s.position);
                    launchNPCRagdoll(s.mesh, s.position, carSpeed);
                    stripperSpawner.strippers.splice(i, 1);
                    hitSomething = true;
                    hitCount++;
                    if (copSpawner) copSpawner.addWanted(1);
                }
            }
        }

        // --- Check Crackheads ---
        if (crackheadSpawner && crackheadSpawner.crackheads) {
            for (let i = crackheadSpawner.crackheads.length - 1; i >= 0; i--) {
                const ch = crackheadSpawner.crackheads[i];
                if (!ch.alive) continue;
                if (challenger.isPointInCarBounds(ch.position)) {
                    ch.alive = false;
                    spawnCarBloodEffect(ch.position);
                    launchNPCRagdoll(ch.mesh, ch.position, carSpeed);
                    crackheadSpawner.crackheads.splice(i, 1);
                    hitSomething = true;
                    // === MISSION: Crackhead killed by car ===
                    if (missionSystem) missionSystem.onCrackheadKilled();
                    hitCount++;
                    if (glock) {
                        glock.money += 2;
                        glock.spawnDollarBill();
                        // === MISSION: Money earned from crackhead roadkill ===
                        if (missionSystem) missionSystem.onMoneyEarned(2);
                    }
                }
            }
        }

        // --- Check Police Motorcycles ---
        if (copSpawner && copSpawner.motorcycles) {
            for (let i = copSpawner.motorcycles.length - 1; i >= 0; i--) {
                const moto = copSpawner.motorcycles[i];
                if (!moto.alive) continue;
                if (challenger.isPointInCarBounds(moto.position, 0.5)) {
                    if (carSpeed >= MIN_KILL_SPEED) {
                        moto.alive = false;
                        spawnCarBloodEffect(moto.position);
                        launchNPCRagdoll(moto.mesh, moto.position, carSpeed);
                        copSpawner.motorcycles.splice(i, 1);
                        hitSomething = true;
                        hitCount++;
                        if (glock) {
                            glock.money += 15;
                            glock.spawnDollarBill();
                            // === MISSION: Money earned + motorcycle destroyed ===
                            if (missionSystem) { missionSystem.onMoneyEarned(15); missionSystem.onMotorcycleDestroyed(); }
                        }
                        if (copSpawner) copSpawner.addWanted(2);
                    } else {
                        // Low speed - damage the motorcycle cop
                        moto.health -= Math.ceil(carSpeed * 4);
                        spawnCarBloodEffect(moto.position);
                        hitSomething = true;
                        if (moto.health <= 0) {
                            moto.alive = false;
                            launchNPCRagdoll(moto.mesh, moto.position, carSpeed);
                            copSpawner.motorcycles.splice(i, 1);
                            if (glock) {
                                glock.money += 15;
                                glock.spawnDollarBill();
                                // === MISSION: Money earned + motorcycle destroyed ===
                                if (missionSystem) { missionSystem.onMoneyEarned(15); missionSystem.onMotorcycleDestroyed(); }
                            }
                            if (copSpawner) copSpawner.addWanted(2);
                        } else {
                            if (copSpawner) copSpawner.addWanted(1);
                        }
                    }
                }
            }
        }

        // --- Check Cops ---
        if (copSpawner && copSpawner.cops) {
            for (let i = copSpawner.cops.length - 1; i >= 0; i--) {
                const cop = copSpawner.cops[i];
                if (!cop.alive) continue;
                if (challenger.isPointInCarBounds(cop.position)) {
                    if (carSpeed >= MIN_KILL_SPEED) {
                        cop.alive = false;
                        spawnCarBloodEffect(cop.position);
                        launchNPCRagdoll(cop.mesh, cop.position, carSpeed);
                        copSpawner.cops.splice(i, 1);
                        hitSomething = true;
                        hitCount++;
                        if (glock) {
                            glock.money += 10;
                            // Reduced from 5 to 1 bill for performance
                            glock.spawnDollarBill();
                        }
                        if (copSpawner) copSpawner.addWanted(2);
                        // === MISSION: Cop killed by car + money earned ===
                        if (missionSystem) { missionSystem.onCopKilled(); missionSystem.onMoneyEarned(10); }
                    } else {
                        // Low speed - push them with smooth physics
                        cop.health -= Math.ceil(carSpeed * 3);
                        const pushDir = new THREE.Vector3(
                            -Math.sin(challenger.rotation),
                            0.5,
                            -Math.cos(challenger.rotation)
                        );
                        cop.position.add(pushDir.clone().multiplyScalar(2));
                        cop.velocity.copy(pushDir.normalize().multiplyScalar(carSpeed * 2));
                        cop.velocity.y = 5;
                        spawnCarBloodEffect(cop.position);
                        hitSomething = true;
                        if (cop.health <= 0) {
                            cop.alive = false;
                            launchNPCRagdoll(cop.mesh, cop.position, carSpeed);
                            copSpawner.cops.splice(i, 1);
                            if (glock) {
                                glock.money += 10;
                                // Reduced from 5 to 1 bill for performance
                                glock.spawnDollarBill();
                            }
                            if (copSpawner) copSpawner.addWanted(2);
                            // === MISSION: Cop killed by car + money earned ===
                            if (missionSystem) { missionSystem.onCopKilled(); missionSystem.onMoneyEarned(10); }
                        } else {
                            if (copSpawner) copSpawner.addWanted(1);
                        }
                    }
                }
            }
        }

        // --- Check Police Helicopter (if flying low enough) ---
        if (copSpawner && copSpawner.helicopter) {
            const heli = copSpawner.helicopter;
            if (heli.alive && !heli.stolen) {
                // Check if helicopter is low enough to be hit by car (wider range when damaged)
                const heliHeightAboveCar = heli.position.y - challenger.position.y;
                const heliHitHeight = heli.health <= 20 ? 12 : 10; // Easier to hit when damaged
                if (heliHeightAboveCar < heliHitHeight && heliHeightAboveCar > -2) {
                    const dx = heli.position.x - challenger.position.x;
                    const dz = heli.position.z - challenger.position.z;
                    const horizDist = Math.sqrt(dx * dx + dz * dz);
                    if (horizDist < 6) { // Wider hitbox (was 4)
                        if (carSpeed >= MIN_KILL_SPEED) {
                            heli.health -= Math.ceil(carSpeed * 5);
                            spawnCarBloodEffect(heli.position);
                            hitSomething = true;
                            hitCount++;
                            if (heli.health <= 0) {
                                heli.alive = false;
                                // Helicopter drops BIG money $50-100
                                const heliMoney = 50 + Math.floor(Math.random() * 51);
                                if (glock) {
                                    glock.money += heliMoney;
                                    for (let d = 0; d < 10; d++) {
                                        setTimeout(() => glock.spawnDollarBill(), d * 60);
                                    }
                                    if (missionSystem) missionSystem.onMoneyEarned(heliMoney);
                                }
                                heli.dispose();
                                copSpawner.helicopter = null;
                                copSpawner.addWanted(2);
                            } else {
                                copSpawner.addWanted(1);
                            }
                        }
                    }
                }
            }
        }

        // Apply effects if we hit something
        if (hitSomething) {
            playCarImpactSound(hitCount);
            shakeCarCamera(hitCount);
            showRunoverMessage(hitCount);
            // No car slowdown - plow right through!

            // === MISSION: Roadkill tracking ===
            if (missionSystem && hitCount > 0) {
                missionSystem.onRoadkill(hitCount);
            }
        }
    }

    function spawnCarBloodEffect(hitPos) {
        const pos = hitPos.clone();
        pos.y += 0.5;
        const carDir = challenger ? challenger.rotation : 0;
        const carSpeed = challenger ? Math.abs(challenger.speed) : 5;
        const speedMult = Math.min(2.5, carSpeed / 8); // More speed = more gore

        // === 1. BLOOD SPRAY (capped for performance) ===
        const wantedParticles = Math.floor(30 + speedMult * 30);
        const particleCount = Math.min(wantedParticles, particleCaps.bloodParticles.max - particleCaps.bloodParticles.active);
        for (let i = 0; i < particleCount; i++) {
            particleCaps.bloodParticles.active++;
            const size = 0.12 + Math.random() * 0.6 * speedMult;
            const geo = new THREE.BoxGeometry(size, size * (0.5 + Math.random()), size);
            const shade = 0.3 + Math.random() * 0.7;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(shade, Math.random() * 0.05, Math.random() * 0.02),
                transparent: true,
                opacity: 0.95
            });
            const blood = new THREE.Mesh(geo, mat);
            blood.position.copy(pos);
            blood.position.x += (Math.random() - 0.5) * 0.5;
            blood.position.y += (Math.random() - 0.5) * 0.8;
            blood.position.z += (Math.random() - 0.5) * 0.5;

            // Spray in car's forward direction + wide random spread
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 1.4;
            const angle = carDir + spreadAngle;
            const speed = (2 + Math.random() * 12) * speedMult;
            const vx = -Math.sin(angle) * speed + (Math.random() - 0.5) * 4;
            const vy = 1 + Math.random() * 8 * speedMult;
            const vz = -Math.cos(angle) * speed + (Math.random() - 0.5) * 4;
            const spinX = (Math.random() - 0.5) * 15;
            const spinZ = (Math.random() - 0.5) * 15;
            const gravity = -12 - Math.random() * 8;

            scene.add(blood);

            let frame = 0;
            let velY = vy;
            const maxFrames = 40 + Math.floor(Math.random() * 20);
            const animateBlood = () => {
                frame++;
                velY += gravity * 0.016;
                blood.position.x += vx * 0.016;
                blood.position.y += velY * 0.016;
                blood.position.z += vz * 0.016;
                blood.rotation.x += spinX * 0.016;
                blood.rotation.z += spinZ * 0.016;
                mat.opacity = Math.max(0, 0.95 - frame / maxFrames);
                // Scale down as they fade
                const s = Math.max(0.3, 1 - frame / maxFrames * 0.5);
                blood.scale.set(s, s, s);
                if (frame < maxFrames && mat.opacity > 0) {
                    requestAnimationFrame(animateBlood);
                } else {
                    scene.remove(blood);
                    geo.dispose();
                    mat.dispose();
                    particleCaps.bloodParticles.active = Math.max(0, particleCaps.bloodParticles.active - 1);
                }
            };
            requestAnimationFrame(animateBlood);
        }

        // === 2. BODY CHUNK GIBS (capped for performance) ===
        const wantedGibs = Math.floor(4 + speedMult * 4);
        const gibCount = Math.min(wantedGibs, particleCaps.gibs.max - particleCaps.gibs.active);
        const gibColors = [0x882222, 0xaa3333, 0x661111, 0xcc8866, 0x993322, 0x774444];
        for (let i = 0; i < gibCount; i++) {
            const gw = 0.15 + Math.random() * 0.45;
            const gh = 0.12 + Math.random() * 0.35;
            const gd = 0.15 + Math.random() * 0.4;
            const gGeo = new THREE.BoxGeometry(gw, gh, gd);
            const gMat = new THREE.MeshLambertMaterial({
                color: gibColors[Math.floor(Math.random() * gibColors.length)],
                transparent: true,
                opacity: 1.0
            });
            const gib = new THREE.Mesh(gGeo, gMat);
            gib.position.copy(pos);

            const spreadAngle = (Math.random() - 0.5) * Math.PI;
            const angle = carDir + spreadAngle;
            const speed = (5 + Math.random() * 10) * speedMult;
            const gvx = -Math.sin(angle) * speed;
            let gvy = 3 + Math.random() * 10 * speedMult;
            const gvz = -Math.cos(angle) * speed;
            const gSpinX = (Math.random() - 0.5) * 20;
            const gSpinY = (Math.random() - 0.5) * 20;
            const gSpinZ = (Math.random() - 0.5) * 20;

            scene.add(gib);

            let gFrame = 0;
            let bounced = false;
            const animateGib = () => {
                gFrame++;
                gvy -= 20 * 0.016; // gravity
                gib.position.x += gvx * 0.016;
                gib.position.y += gvy * 0.016;
                gib.position.z += gvz * 0.016;
                gib.rotation.x += gSpinX * 0.016;
                gib.rotation.y += gSpinY * 0.016;
                gib.rotation.z += gSpinZ * 0.016;

                // Bounce off ground
                if (gib.position.y < pos.y - 0.4 && gvy < 0 && !bounced) {
                    gvy = Math.abs(gvy) * 0.3;
                    bounced = true;
                    // Spawn small blood splat where gib lands
                    spawnMiniBloodSplat(gib.position.clone());
                }

                gMat.opacity = Math.max(0, 1.0 - gFrame / 80);
                if (gFrame < 80 && gMat.opacity > 0) {
                    requestAnimationFrame(animateGib);
                } else {
                    scene.remove(gib);
                    gGeo.dispose();
                    gMat.dispose();
                }
            };
            requestAnimationFrame(animateGib);
        }

        // === 3. BLOOD STREAKS ON GROUND (directional smears) ===
        const streakCount = 5 + Math.floor(speedMult * 5);
        for (let i = 0; i < streakCount; i++) {
            const sLen = 2.0 + Math.random() * 6.0 * speedMult;
            const sWid = 0.3 + Math.random() * 0.8;
            const sGeo = new THREE.BoxGeometry(sWid, 0.02, sLen);
            const sShade = 0.3 + Math.random() * 0.4;
            const sMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(sShade, 0, 0),
                transparent: true,
                opacity: 0.7
            });
            const streak = new THREE.Mesh(sGeo, sMat);
            const sAngle = carDir + (Math.random() - 0.5) * 0.8;
            const sDist = Math.random() * 2 * speedMult;
            streak.position.set(
                pos.x - Math.sin(sAngle) * sDist + (Math.random() - 0.5) * 1.5,
                pos.y - 0.45,
                pos.z - Math.cos(sAngle) * sDist + (Math.random() - 0.5) * 1.5
            );
            streak.rotation.y = sAngle + (Math.random() - 0.5) * 0.3;
            scene.add(streak);

            let sFrame = 0;
            const animateStreak = () => {
                sFrame++;
                sMat.opacity = Math.max(0, 0.7 - sFrame / 200);
                if (sFrame < 200) {
                    requestAnimationFrame(animateStreak);
                } else {
                    scene.remove(streak);
                    sGeo.dispose();
                    sMat.dispose();
                }
            };
            requestAnimationFrame(animateStreak);
        }

        // === 4. LARGE BLOOD POOL (expanding, darker) ===
        const poolGeo = new THREE.BoxGeometry(3.5, 0.02, 3.5);
        const poolMat = new THREE.MeshBasicMaterial({
            color: 0x660000,
            transparent: true,
            opacity: 0.75
        });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.position.set(pos.x, pos.y - 0.45, pos.z);
        scene.add(pool);

        let poolFrame = 0;
        const animatePool = () => {
            poolFrame++;
            // Expand quickly then slow
            const scale = 1 + Math.min(poolFrame * 0.08, 2.5 * speedMult);
            pool.scale.set(scale, 1, scale * (0.6 + speedMult * 0.3));
            poolMat.opacity = Math.max(0, 0.75 - poolFrame / 250);
            if (poolFrame < 250) {
                requestAnimationFrame(animatePool);
            } else {
                scene.remove(pool);
                poolGeo.dispose();
                poolMat.dispose();
            }
        };
        requestAnimationFrame(animatePool);

        // === 5. SCREEN BLOOD SPLATTER (DOM overlay) ===
        spawnScreenBloodSplatter(speedMult);
    }

    // Mini blood splat where gibs land
    function spawnMiniBloodSplat(pos) {
        const sGeo = new THREE.BoxGeometry(0.3 + Math.random() * 0.4, 0.015, 0.3 + Math.random() * 0.4);
        const sMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.4 + Math.random() * 0.3, 0, 0),
            transparent: true,
            opacity: 0.6
        });
        const splat = new THREE.Mesh(sGeo, sMat);
        splat.position.copy(pos);
        splat.position.y = pos.y - 0.2;
        splat.rotation.y = Math.random() * Math.PI * 2;
        scene.add(splat);

        let f = 0;
        const anim = () => {
            f++;
            sMat.opacity = Math.max(0, 0.6 - f / 180);
            if (f < 180) {
                requestAnimationFrame(anim);
            } else {
                scene.remove(splat);
                sGeo.dispose();
                sMat.dispose();
            }
        };
        requestAnimationFrame(anim);
    }

    // Screen blood splatter overlay (red splotches on screen edges)
    function spawnScreenBloodSplatter(intensity) {
        const splatCount = Math.floor(4 + intensity * 5);
        for (let i = 0; i < splatCount; i++) {
            const splat = document.createElement('div');
            const size = 80 + Math.random() * 250 * intensity;
            // Position on screen edges (more cinematic)
            const edge = Math.floor(Math.random() * 4);
            let left, top;
            switch(edge) {
                case 0: left = Math.random() * 30; top = Math.random() * 100; break; // left
                case 1: left = 70 + Math.random() * 30; top = Math.random() * 100; break; // right
                case 2: left = Math.random() * 100; top = Math.random() * 25; break; // top
                case 3: left = Math.random() * 100; top = 75 + Math.random() * 25; break; // bottom
            }
            const r = 120 + Math.floor(Math.random() * 80);
            splat.style.cssText = `
                position: fixed;
                left: ${left}%;
                top: ${top}%;
                width: ${size}px;
                height: ${size}px;
                background: radial-gradient(ellipse at center,
                    rgba(${r}, 0, 0, 0.7) 0%,
                    rgba(${r - 40}, 0, 0, 0.4) 30%,
                    rgba(${r - 60}, 0, 0, 0.15) 60%,
                    transparent 100%);
                border-radius: ${30 + Math.random() * 40}% ${30 + Math.random() * 40}% ${30 + Math.random() * 40}% ${30 + Math.random() * 40}%;
                pointer-events: none;
                z-index: 350;
                opacity: 1;
                transform: rotate(${Math.random() * 360}deg) scale(${0.5 + Math.random() * 0.5});
                transition: opacity ${1.5 + Math.random()}s ease-out;
            `;
            document.body.appendChild(splat);

            // Drip effect - some splatters slide down
            if (Math.random() < 0.4) {
                const startTop = parseFloat(splat.style.top);
                let dripFrame = 0;
                const drip = () => {
                    dripFrame++;
                    splat.style.top = (startTop + dripFrame * 0.08) + '%';
                    splat.style.height = (size + dripFrame * 0.5) + 'px';
                    splat.style.width = (size - dripFrame * 0.2) + 'px';
                    if (dripFrame < 40) requestAnimationFrame(drip);
                };
                requestAnimationFrame(drip);
            }

            // Fade out
            setTimeout(() => {
                splat.style.opacity = '0';
                setTimeout(() => splat.remove(), 2000);
            }, 500 + Math.random() * 1500);
        }
    }

    // Launch NPC mesh as a ragdoll (smooth physics-based launch instead of instant disappear)
    function launchNPCRagdoll(mesh, hitPos, carSpeed) {
        if (!mesh || !challenger) return;
        
        // Detach mesh from any parent management - we'll animate it independently
        // The NPC is already marked dead and removed from its spawner array
        // but the mesh is still in the scene - we animate it flying through the air
        
        const carDir = challenger.rotation;
        const speedMult = Math.min(2.5, carSpeed / 6);
        
        // Calculate launch velocity - forward + up + sideways tumble
        const launchSpeed = (8 + carSpeed * 1.5) * speedMult;
        let vx = -Math.sin(carDir) * launchSpeed + (Math.random() - 0.5) * 6;
        let vy = 5 + Math.random() * 8 * speedMult; // Launch upward
        let vz = -Math.cos(carDir) * launchSpeed + (Math.random() - 0.5) * 6;
        
        // Tumble spin speeds
        const spinX = (Math.random() - 0.5) * 12;
        const spinY = (Math.random() - 0.5) * 8;
        const spinZ = (Math.random() - 0.5) * 12;
        
        const gravity = -20;
        let frame = 0;
        const maxFrames = 80; // ~1.3 seconds of ragdoll
        let bounced = false;
        const startY = mesh.position.y;
        
        const animateRagdoll = () => {
            frame++;
            
            // Physics
            vy += gravity * 0.016;
            mesh.position.x += vx * 0.016;
            mesh.position.y += vy * 0.016;
            mesh.position.z += vz * 0.016;
            
            // Tumble rotation
            mesh.rotation.x += spinX * 0.016;
            mesh.rotation.y += spinY * 0.016;
            mesh.rotation.z += spinZ * 0.016;
            
            // Air drag (slow down horizontal movement)
            vx *= 0.995;
            vz *= 0.995;
            
            // Ground bounce
            if (mesh.position.y < startY - 0.5 && vy < 0 && !bounced) {
                vy = Math.abs(vy) * 0.2; // Weak bounce
                vx *= 0.5;
                vz *= 0.5;
                bounced = true;
                // Spawn blood splat on landing
                spawnMiniBloodSplat(mesh.position.clone());
            }
            
            // Second ground contact - stop and fade
            if (bounced && mesh.position.y < startY - 0.3 && vy < 0) {
                mesh.position.y = startY - 0.3;
                vy = 0;
                vx *= 0.8;
                vz *= 0.8;
            }
            
            // Fade out in last 20 frames
            if (frame > maxFrames - 20) {
                const fadeProgress = (frame - (maxFrames - 20)) / 20;
                mesh.traverse(child => {
                    if (child.material && !child.material._ragdollFaded) {
                        child.material.transparent = true;
                        child.material.opacity = Math.max(0, 1 - fadeProgress);
                    }
                });
            }
            
            if (frame < maxFrames) {
                requestAnimationFrame(animateRagdoll);
            } else {
                // Clean up - remove mesh and dispose
                scene.remove(mesh);
                mesh.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        };
        requestAnimationFrame(animateRagdoll);
    }

    function playCarImpactSound(hitCount) {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;

            // Heavy thud/crunch impact
            const bufSize = ctx.sampleRate * 0.2;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const noiseGain = ctx.createGain();
            const volume = Math.min(0.5, 0.25 + hitCount * 0.08);
            noiseGain.gain.setValueAtTime(volume, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(600, t);
            lp.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            noise.connect(lp);
            lp.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);

            // Deep bass thump
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.15);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.35, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.25);

            // Bone crunch (higher frequency noise burst)
            const crunchBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
            const crunchData = crunchBuf.getChannelData(0);
            for (let i = 0; i < crunchData.length; i++) {
                crunchData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01)) *
                    (Math.random() > 0.7 ? 1.5 : 0.3); // Crackling texture
            }
            const crunch = ctx.createBufferSource();
            crunch.buffer = crunchBuf;
            const crunchGain = ctx.createGain();
            crunchGain.gain.setValueAtTime(0.2, t + 0.02);
            crunchGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(800, t);
            crunch.connect(hp);
            hp.connect(crunchGain);
            crunchGain.connect(ctx.destination);
            crunch.start(t + 0.02);
        } catch(e) {}
    }

    function shakeCarCamera(intensity) {
        if (!camera || !smoothCamPos) return;
        const shakeAmount = Math.min(0.8, 0.2 + intensity * 0.15);
        let frame = 0;
        const totalFrames = 12;
        const origPos = smoothCamPos.clone();

        const doShake = () => {
            frame++;
            const decay = 1 - frame / totalFrames;
            if (smoothCamPos) {
                smoothCamPos.x = origPos.x + (Math.random() - 0.5) * shakeAmount * decay;
                smoothCamPos.y = origPos.y + (Math.random() - 0.5) * shakeAmount * decay * 0.5;
                smoothCamPos.z = origPos.z + (Math.random() - 0.5) * shakeAmount * decay;
            }
            if (frame < totalFrames) {
                requestAnimationFrame(doShake);
            }
        };
        requestAnimationFrame(doShake);
    }

    function showRunoverMessage(hitCount) {
        const inviteMsg = document.getElementById('invite-message');
        if (!inviteMsg) return;

        const messages = hitCount > 1 ? [
            `💀 MULTI KILL! ${hitCount}x 💀`,
            `🚗💥 ${hitCount} DOWN! 🔥`,
            `☠️ ROAD RAGE x${hitCount}! ☠️`,
            `🏎️💀 COMBO x${hitCount}! 💀`
        ] : [
            '🚗💥 ROADKILL! 💀',
            '💀 SPLAT! 🩸',
            '☠️ WASTED! 🚗',
            '🏎️💀 HIT & RUN! 💸',
            '🩸 PANCAKE! 🚗',
            '💥 BUMPER KILL! ☠️'
        ];
        inviteMsg.textContent = messages[Math.floor(Math.random() * messages.length)];

        inviteMsg.classList.remove('active');
        inviteMsg.style.display = 'none';
        void inviteMsg.offsetWidth;
        inviteMsg.style.display = 'block';
        inviteMsg.classList.add('active');

        setTimeout(() => {
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
        }, 2000);
    }

    // === CRYPTO LIQUOR STORE SHOP MENU ===
    let activeShopStore = null;
    let shopKeyStates = { '1': false, '2': false, '3': false, '4': false, '5': false };

    let shopOpenTime = 0; // Track when shop was opened to prevent instant ESC close

    function openShopMenu(store) {
        if (shopMenuOpen) return;
        shopMenuOpen = true;
        activeShopStore = store;
        shopOpenTime = performance.now();

        const menu = document.getElementById('shop-menu');
        if (!menu) return;

        // Update balance
        const balanceEl = document.getElementById('shop-balance-amount');
        if (balanceEl && glock) {
            balanceEl.textContent = glock.money;
        }

        // Populate items
        const container = document.getElementById('shop-items-container');
        if (container) {
            container.innerHTML = '';
            const items = LiquorStore.getMenuItems();
            const money = glock ? glock.money : 0;

            for (const item of items) {
                const div = document.createElement('div');
                div.className = 'shop-item' + (money < item.price ? ' cant-afford' : '');
                div.innerHTML = `
                    <span class="item-key">${item.key}</span>
                    <span class="item-emoji">${item.emoji}</span>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.desc}</div>
                    </div>
                    <span class="item-price">$${item.price}</span>
                `;
                container.appendChild(div);
            }
        }

        menu.style.display = 'block';

        // Hide shop prompt while menu is open
        const prompt = document.getElementById('shop-prompt');
        if (prompt) prompt.style.display = 'none';

        // Release pointer lock so cursor is visible
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    function closeShopMenu() {
        if (!shopMenuOpen) return;
        shopMenuOpen = false;
        activeShopStore = null;

        const menu = document.getElementById('shop-menu');
        if (menu) menu.style.display = 'none';

        // Reset shop key states to prevent stuck keys
        shopKeyStates = { '1': false, '2': false, '3': false, '4': false, '5': false };

        // Clear ESC key state to prevent re-triggering
        if (input) input.keys['Escape'] = false;

        // Small delay before re-locking pointer to avoid browser ESC conflicts
        setTimeout(() => {
            if (input && !shopMenuOpen) input.requestPointerLock();
        }, 100);
    }

    function handleShopInput() {
        if (!activeShopStore || !glock) return;

        const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        for (let i = 0; i < keys.length; i++) {
            const keyDown = input.keys[keys[i]];
            const keyName = String(i + 1);
            if (keyDown && !shopKeyStates[keyName]) {
                // Special handling for strip club (item 5)
                if (i === 4) {
                    handleStripClubPurchase();
                } else {
                    // Try to purchase normal item
                    const success = activeShopStore.purchase(i, glock, player, stripperSpawner);

                    if (success) {
                        // === MISSION: Shop purchase ===
                        if (missionSystem) missionSystem.onShopPurchase();

                        // Check if moonshine (high effect)
                        if (activeShopStore._lastPurchaseEffect === 'high') {
                            highLevel = Math.min(1, highLevel + 0.6);
                            activeShopStore._lastPurchaseEffect = null;
                        }

                        refreshShopUI();
                    } else {
                        showBrokeMessage();
                    }
                }
            }
            shopKeyStates[keyName] = !!keyDown;
        }
    }

    function refreshShopUI() {
        const balanceEl = document.getElementById('shop-balance-amount');
        if (balanceEl && glock) balanceEl.textContent = glock.money;

        const container = document.getElementById('shop-items-container');
        if (container) {
            const items = LiquorStore.getMenuItems();
            const itemDivs = container.querySelectorAll('.shop-item');
            itemDivs.forEach((div, idx) => {
                if (idx < items.length) {
                    if (glock.money < items[idx].price) {
                        div.classList.add('cant-afford');
                    } else {
                        div.classList.remove('cant-afford');
                    }
                }
            });
        }
    }

    function handleStripClubPurchase() {
        if (!glock || !activeShopStore || !stripClubManager) return;

        // Check money
        if (glock.money < 1500) {
            showBrokeMessage();
            playBrokeSound();
            return;
        }

        // Deduct money
        glock.money -= 1500;

        // Count collected/hired strippers to deposit
        let stripperCount = 0;
        if (stripperSpawner && stripperSpawner.strippers) {
            for (let i = stripperSpawner.strippers.length - 1; i >= 0; i--) {
                const s = stripperSpawner.strippers[i];
                if (s.alive && (s.collected || s.hired) && !s.inCar) {
                    stripperCount++;
                    s.alive = false;
                    if (s.mesh) scene.remove(s.mesh);
                    stripperSpawner.strippers.splice(i, 1);
                }
            }
        }

        // Also count strippers in car
        if (challenger && challenger.passengers) {
            for (let i = challenger.passengers.length - 1; i >= 0; i--) {
                const s = challenger.passengers[i];
                stripperCount++;
                s.alive = false;
                s.inCar = false;
                if (s.mesh) scene.remove(s.mesh);
            }
            challenger.passengers = [];
        }

        // Spawn the strip club building near the store
        const club = stripClubManager.spawnClubNearStore(activeShopStore);

        // Deposit strippers into the club
        if (club && stripperCount > 0) {
            club.depositStrippers(stripperCount);
        }

        // Play purchase sound
        activeShopStore.playPurchaseSound();

        // Money bill animation (reduced from 15 to 3 for performance)
        if (glock.spawnDollarBill) {
            for (let d = 0; d < 3; d++) {
                setTimeout(() => glock.spawnDollarBill(), d * 100);
            }
        }

        // Show big purchase message
        const inviteMsg = document.getElementById('invite-message');
        if (inviteMsg) {
            const msgs = [
                `🏪💃 STRIP CLUB OPENED! ${stripperCount} strippers deposited! 💸`,
                `💃🔥 NEW STRIP CLUB! ${stripperCount} dancers inside! 🏪`,
                `🏪💋 BUSINESS OWNER! ${stripperCount} strippers working! 💰`
            ];
            inviteMsg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
            void inviteMsg.offsetWidth;
            inviteMsg.style.display = 'block';
            inviteMsg.classList.add('active');
            setTimeout(() => {
                inviteMsg.classList.remove('active');
                inviteMsg.style.display = 'none';
            }, 4000);
        }

        // === MISSION: Strip club purchased ===
        if (missionSystem) missionSystem.onStripClubPurchased();

        // Refresh shop UI
        refreshShopUI();
    }

    // === STEAL REMOTE PLAYER'S CAR ===
    function tryStealRemoteCar() {
        if (!remoteRenderer || !mp || drivingMode) return;
        
        const STEAL_DISTANCE = 8; // How close to be to steal a parked car
        
        // Check all remote players for parked cars nearby
        for (const pid in remoteRenderer.players) {
            const rp = remoteRenderer.players[pid];
            if (!rp || !rp.carParkedPosition) continue;
            if (rp.driving) continue; // Can't steal a car someone is driving
            
            // Calculate distance to the parked car
            const carPos = rp.carParkedPosition;
            const dx = carPos.x - player.position.x;
            const dz = carPos.z - player.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < STEAL_DISTANCE) {
                // Found a stealable car! Teleport our car to this location
                const stolenName = rp.name || 'Unknown';
                const stolenPassengers = rp.passengerCount || 0;
                
                // Move our challenger to the stolen car's position
                if (challenger) {
                    challenger.position.set(carPos.x, carPos.y, carPos.z);
                    challenger.rotation = rp.carParkedRotation || 0;
                    challenger.mesh.position.copy(challenger.position);
                    challenger.mesh.rotation.y = challenger.rotation;
                    challenger.speed = 0;
                }
                
                // Enter the stolen car immediately
                enterCar();
                
                // Show steal message
                showStealMessage(stolenName, stolenPassengers);
                
                // Play steal sound (car alarm + engine rev)
                playStealSound();
                
                // Add wanted level for stealing
                if (copSpawner) copSpawner.addWanted(2);
                
                // Show multiplayer message
                showMPMessage('🚗💨 You stole ' + stolenName + '\'s car!', '#ff4444');
                
                return; // Only steal one car
            }
        }
    }
    
    function showStealMessage(ownerName, passengerCount) {
        const inviteMsg = document.getElementById('invite-message');
        if (!inviteMsg) return;
        
        const messages = [
            `🚗💨 JACKED ${ownerName}'s WHIP! 🔥`,
            `😈 YOINK! ${ownerName}'s car is YOURS! 🚗`,
            `🏎️💀 GRAND THEFT AUTO on ${ownerName}! 💸`,
            `🔥 ${ownerName} just got CARJACKED! 😂`,
            `💀 ${ownerName}'s ride? YOUR ride now! 🚗`
        ];
        let text = messages[Math.floor(Math.random() * messages.length)];
        if (passengerCount > 0) {
            text += ` (+${passengerCount} 💃)`;
        }
        inviteMsg.textContent = text;
        
        inviteMsg.classList.remove('active');
        inviteMsg.style.display = 'none';
        void inviteMsg.offsetWidth;
        inviteMsg.style.display = 'block';
        inviteMsg.classList.add('active');
        
        setTimeout(() => {
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
        }, 3000);
    }
    
    function playStealSound() {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;
            
            // Car alarm beep (high pitched)
            const alarm = ctx.createOscillator();
            alarm.type = 'square';
            alarm.frequency.setValueAtTime(1200, t);
            alarm.frequency.setValueAtTime(800, t + 0.1);
            alarm.frequency.setValueAtTime(1200, t + 0.2);
            alarm.frequency.setValueAtTime(800, t + 0.3);
            const alarmGain = ctx.createGain();
            alarmGain.gain.setValueAtTime(0.15, t);
            alarmGain.gain.setValueAtTime(0.15, t + 0.35);
            alarmGain.gain.linearRampToValueAtTime(0, t + 0.5);
            alarm.connect(alarmGain);
            alarmGain.connect(ctx.destination);
            alarm.start(t);
            alarm.stop(t + 0.5);
            
            // Engine rev (low rumble)
            const engine = ctx.createOscillator();
            engine.type = 'sawtooth';
            engine.frequency.setValueAtTime(60, t + 0.3);
            engine.frequency.linearRampToValueAtTime(200, t + 0.8);
            engine.frequency.linearRampToValueAtTime(120, t + 1.2);
            const engineGain = ctx.createGain();
            engineGain.gain.setValueAtTime(0, t);
            engineGain.gain.linearRampToValueAtTime(0.2, t + 0.5);
            engineGain.gain.linearRampToValueAtTime(0.1, t + 1.0);
            engineGain.gain.linearRampToValueAtTime(0, t + 1.3);
            const engineLP = ctx.createBiquadFilter();
            engineLP.type = 'lowpass';
            engineLP.frequency.setValueAtTime(300, t);
            engine.connect(engineLP);
            engineLP.connect(engineGain);
            engineGain.connect(ctx.destination);
            engine.start(t + 0.3);
            engine.stop(t + 1.4);
            
            // Tire screech (noise burst)
            const screechBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
            const screechData = screechBuf.getChannelData(0);
            for (let i = 0; i < screechData.length; i++) {
                screechData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
            }
            const screech = ctx.createBufferSource();
            screech.buffer = screechBuf;
            const screechGain = ctx.createGain();
            screechGain.gain.setValueAtTime(0.1, t + 0.4);
            screechGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
            const screechHP = ctx.createBiquadFilter();
            screechHP.type = 'highpass';
            screechHP.frequency.setValueAtTime(2000, t);
            screech.connect(screechHP);
            screechHP.connect(screechGain);
            screechGain.connect(ctx.destination);
            screech.start(t + 0.4);
        } catch(e) {}
    }

    // === HELICOPTER STEALING SYSTEM ===
    let flyingHelicopter = null; // Reference to stolen helicopter being flown

    function stealHelicopter(heli) {
        if (!heli || !heli.alive || flyingHelicopter) return;

        // Mark helicopter as stolen
        heli.stolen = true;
        heli.crashed = false;
        heli.chasing = false;
        flyingHelicopter = heli;

        // Remove from cop spawner so it stops being managed as police
        if (copSpawner) {
            copSpawner.helicopter = null;
            copSpawner.addWanted(3); // Big wanted increase for stealing a helicopter!
        }

        // Teleport player into helicopter
        player.position.copy(heli.position);
        player.velocity.set(0, 0, 0);

        // Hide player mesh, show helicopter controls
        if (player.highlightMesh) player.highlightMesh.visible = false;
        if (glock && glock.equipped) glock.toggle();

        // Show steal message
        const inviteMsg = document.getElementById('invite-message');
        if (inviteMsg) {
            const msgs = [
                '🚁💨 HELICOPTER JACKED! Use WASD + Space/Shift to fly! 🔥',
                '🚁😈 YOU STOLE THE CHOPPER! WASD + Space/Shift! ⭐⭐⭐',
                '🚁🔥 GRAND THEFT HELICOPTER! Fly with WASD + Space/Shift! 💀'
            ];
            inviteMsg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
            inviteMsg.classList.remove('active');
            inviteMsg.style.display = 'none';
            void inviteMsg.offsetWidth;
            inviteMsg.style.display = 'block';
            inviteMsg.classList.add('active');
            setTimeout(() => { inviteMsg.classList.remove('active'); inviteMsg.style.display = 'none'; }, 4000);
        }

        // Increase fog distance for flying
        scene.fog.near = 80;
        scene.fog.far = 160;

        // Hide normal HUD
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'none';
    }

    function updateHeliPrompt() {
        // Show prompt when near a stealable helicopter
        let heliPrompt = document.getElementById('heli-prompt');
        if (!heliPrompt) {
            // Create the prompt element if it doesn't exist
            heliPrompt = document.createElement('div');
            heliPrompt.id = 'heli-prompt';
            heliPrompt.style.cssText = 'position:fixed; bottom:180px; left:50%; transform:translateX(-50%); ' +
                'background:rgba(0,0,0,0.7); color:#44ffff; padding:10px 20px; border-radius:8px; ' +
                'font-family:Courier New,monospace; font-size:16px; font-weight:bold; display:none; z-index:200; ' +
                'text-shadow:0 0 8px #44ffff; border:1px solid rgba(68,255,255,0.3);';
            document.body.appendChild(heliPrompt);
        }

        if (!copSpawner || !copSpawner.helicopter || drivingMode || flyingHelicopter) {
            heliPrompt.style.display = 'none';
            return;
        }

        const heli = copSpawner.helicopter;
        if (!heli.alive || (!heli.stealable && !heli.crashed)) {
            heliPrompt.style.display = 'none';
            return;
        }

        const dist = player.position.distanceTo(heli.position);
        if (dist < 10) {
            heliPrompt.textContent = '🚁 Press H to STEAL HELICOPTER! 🚁';
            heliPrompt.style.display = 'block';
        } else {
            heliPrompt.style.display = 'none';
        }
    }

    // === MT. TAKEDOWN: Helicopter takedown cutscene ===
    let mtnTakedownActive = false;
    let mtnTakedownCooldown = 0;
    const MTN_PEAK_X = 256;
    const MTN_PEAK_Z = 256;
    const MTN_PEAK_Y = 58;

    function checkMountainTakedown() {
        if (!challenger || !drivingMode || mtnTakedownActive) return;
        mtnTakedownCooldown = Math.max(0, mtnTakedownCooldown - 0.016);
        if (mtnTakedownCooldown > 0) return;

        // Check if helicopter is active
        if (!copSpawner || !copSpawner.helicopter || !copSpawner.helicopter.alive) return;
        const heli = copSpawner.helicopter;
        if (heli.stolen || heli.crashed) return;

        // Check if car is near the mountain peak
        const dx = challenger.position.x - MTN_PEAK_X;
        const dz = challenger.position.z - MTN_PEAK_Z;
        const horizDist = Math.sqrt(dx * dx + dz * dz);
        const carY = challenger.position.y;

        // Must be near peak (within 8 blocks horizontally) and high enough (above Y=55)
        if (horizDist < 8 && carY > MTN_PEAK_Y - 3) {
            // Must be going fast enough (launched off the ramp)
            const carSpeed = Math.abs(challenger.speed);
            if (carSpeed > 8) {
                startMountainTakedown(heli);
            }
        }
    }

    function startMountainTakedown(heli) {
        mtnTakedownActive = true;
        mtnTakedownCooldown = 30;

        const origCarPos = challenger.position.clone();
        const origCarSpeed = challenger.speed;
        const heliPos = heli.position.clone();

        // Calculate launch trajectory toward helicopter
        const launchDir = new THREE.Vector3(
            heliPos.x - origCarPos.x,
            heliPos.y - origCarPos.y + 8,
            heliPos.z - origCarPos.z
        ).normalize();

        // Show cinematic bars
        showCinematicBars();

        // Create dramatic screen flash
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:600;opacity:0;pointer-events:none;transition:opacity 0.1s;';
        document.body.appendChild(flash);

        // Create slow-mo vignette overlay
        const vignette = document.createElement('div');
        vignette.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:450;pointer-events:none;opacity:0;transition:opacity 0.3s;' +
            'background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.9) 100%);';
        document.body.appendChild(vignette);
        setTimeout(() => { vignette.style.opacity = '1'; }, 50);

        // Show epic title text with glow
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'position:fixed;top:35%;left:50%;transform:translate(-50%,-50%) scale(0.5);z-index:550;pointer-events:none;' +
            'font-family:"Impact",sans-serif;font-size:64px;color:#ff4400;text-shadow:0 0 30px #ff4400,0 0 60px #ff2200,0 0 90px #ff0000,2px 2px 0 #000;' +
            'letter-spacing:6px;opacity:0;transition:all 0.4s cubic-bezier(0.2,1,0.3,1);text-align:center;white-space:nowrap;';
        titleDiv.textContent = '⛰️ MT. TAKEDOWN ⛰️';
        document.body.appendChild(titleDiv);
        setTimeout(() => { titleDiv.style.opacity = '1'; titleDiv.style.transform = 'translate(-50%,-50%) scale(1)'; }, 100);

        // Play epic sound
        playTakedownSound();

        let phase = 0;
        let timer = 0;
        let carVelY = 18;
        const gravity = -8; // Slower gravity for more hang time
        let camAngle = 0;
        let slowMo = 0.4; // Start in slow motion
        let impactPos = null;
        let reward = 0;
        let fireParticles = [];
        let debrisParticles = [];

        // Spawn trailing fire/smoke from car during launch
        function spawnTrailParticle() {
            const colors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200];
            const size = 0.3 + Math.random() * 0.8;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true, opacity: 0.9
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(challenger.position);
            p.position.x += (Math.random() - 0.5) * 2;
            p.position.y += (Math.random() - 0.5) * 1;
            p.position.z += (Math.random() - 0.5) * 2;
            scene.add(p);
            fireParticles.push({ mesh: p, geo, mat, life: 0, maxLife: 30 + Math.random() * 20,
                vx: (Math.random() - 0.5) * 3, vy: -1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3 });
        }

        // Spawn explosion debris
        function spawnExplosionDebris(pos, count) {
            for (let i = 0; i < count; i++) {
                const size = 0.2 + Math.random() * 0.6;
                const geo = new THREE.BoxGeometry(size, size * 0.5, size);
                const isFlame = Math.random() > 0.4;
                const mat = new THREE.MeshBasicMaterial({
                    color: isFlame ? new THREE.Color(1, 0.2 + Math.random() * 0.5, 0) : new THREE.Color(0.2, 0.2, 0.2),
                    transparent: true, opacity: 1
                });
                const d = new THREE.Mesh(geo, mat);
                d.position.copy(pos);
                const speed = 5 + Math.random() * 20;
                const angle = Math.random() * Math.PI * 2;
                const pitch = (Math.random() - 0.3) * Math.PI;
                scene.add(d);
                debrisParticles.push({ mesh: d, geo, mat, life: 0, maxLife: 60 + Math.random() * 40,
                    vx: Math.cos(angle) * Math.cos(pitch) * speed,
                    vy: Math.sin(pitch) * speed + 5,
                    vz: Math.sin(angle) * Math.cos(pitch) * speed,
                    spinX: (Math.random() - 0.5) * 15, spinY: (Math.random() - 0.5) * 15,
                    spinZ: (Math.random() - 0.5) * 15, isFlame });
            }
        }

        // Spawn expanding shockwave ring
        function spawnShockwave(pos) {
            const ringGeo = new THREE.RingGeometry(0.5, 1.5, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(pos);
            ring.rotation.x = -Math.PI / 2;
            scene.add(ring);
            let f = 0;
            const animRing = () => {
                f++;
                const s = 1 + f * 1.5;
                ring.scale.set(s, s, s);
                ringMat.opacity = Math.max(0, 0.8 - f / 30);
                if (f < 30) { requestAnimationFrame(animRing); }
                else { scene.remove(ring); ringGeo.dispose(); ringMat.dispose(); }
            };
            requestAnimationFrame(animRing);
        }

        const animateTakedown = () => {
            const dt = 0.016 * slowMo;
            timer += dt;

            // Update fire trail particles
            for (let i = fireParticles.length - 1; i >= 0; i--) {
                const fp = fireParticles[i];
                fp.life++;
                fp.mesh.position.x += fp.vx * 0.016;
                fp.mesh.position.y += fp.vy * 0.016;
                fp.mesh.position.z += fp.vz * 0.016;
                const s = Math.max(0.1, 1 - fp.life / fp.maxLife);
                fp.mesh.scale.set(s, s, s);
                fp.mat.opacity = Math.max(0, 0.9 - fp.life / fp.maxLife);
                if (fp.life >= fp.maxLife) {
                    scene.remove(fp.mesh); fp.geo.dispose(); fp.mat.dispose();
                    fireParticles.splice(i, 1);
                }
            }

            // Update debris particles
            for (let i = debrisParticles.length - 1; i >= 0; i--) {
                const dp = debrisParticles[i];
                dp.life++;
                dp.vy -= 15 * 0.016;
                dp.mesh.position.x += dp.vx * 0.016;
                dp.mesh.position.y += dp.vy * 0.016;
                dp.mesh.position.z += dp.vz * 0.016;
                dp.mesh.rotation.x += dp.spinX * 0.016;
                dp.mesh.rotation.y += dp.spinY * 0.016;
                dp.mesh.rotation.z += dp.spinZ * 0.016;
                dp.vx *= 0.99; dp.vz *= 0.99;
                dp.mat.opacity = Math.max(0, 1 - dp.life / dp.maxLife);
                if (dp.isFlame) {
                    const r = Math.max(0, 1 - dp.life / dp.maxLife * 0.5);
                    const g = Math.max(0, 0.4 - dp.life / dp.maxLife * 0.4);
                    dp.mat.color.setRGB(r, g, 0);
                }
                if (dp.life >= dp.maxLife) {
                    scene.remove(dp.mesh); dp.geo.dispose(); dp.mat.dispose();
                    debrisParticles.splice(i, 1);
                }
            }

            if (phase === 0) {
                // === PHASE 0: SLOW-MO LAUNCH (0-1.5s real time) ===
                // Gradually speed up from slow-mo
                slowMo = Math.min(1, 0.4 + timer * 0.4);

                challenger.position.x += launchDir.x * 30 * dt;
                challenger.position.y += carVelY * dt;
                challenger.position.z += launchDir.z * 30 * dt;
                carVelY += gravity * dt;

                // Dramatic barrel roll
                challenger.rotation += 0.12 * slowMo;
                challenger.mesh.position.copy(challenger.position);
                challenger.mesh.rotation.y = challenger.rotation;
                // Tilt the car for barrel roll effect
                challenger.mesh.rotation.z = Math.sin(timer * 4) * 0.3;
                challenger.mesh.rotation.x = Math.sin(timer * 3) * 0.15;

                // Spawn fire trail
                if (Math.random() < 0.6) spawnTrailParticle();

                // === CINEMATIC CAMERA: Orbiting dramatic angle ===
                camAngle += 1.8 * dt;
                const camDist = 12 + Math.sin(timer * 2) * 4; // Breathing distance
                const camHeight = 2 + Math.sin(timer * 1.5) * 3;
                const camX = challenger.position.x + Math.sin(camAngle) * camDist;
                const camY = challenger.position.y + camHeight;
                const camZ = challenger.position.z + Math.cos(camAngle) * camDist;
                camera.position.set(camX, camY, camZ);

                // Look slightly ahead of the car (anticipation)
                const lookAhead = challenger.position.clone().add(launchDir.clone().multiplyScalar(5));
                camera.lookAt(lookAhead);

                // Dramatic FOV zoom
                camera.fov = 60 + Math.sin(timer * 3) * 10;
                camera.updateProjectionMatrix();

                // === CINEMATIC CAMERA SWITCH: When close, switch to side-view showing both car and heli ===
                const distToHeli = challenger.position.distanceTo(heli.position);
                if (distToHeli < 25 && distToHeli > 10) {
                    // Approaching - camera positioned to see BOTH car and helicopter
                    const midPoint = challenger.position.clone().lerp(heli.position, 0.5);
                    const perpX = -(heli.position.z - challenger.position.z);
                    const perpZ = (heli.position.x - challenger.position.x);
                    const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1;
                    camera.position.set(
                        midPoint.x + (perpX / perpLen) * 18,
                        midPoint.y + 3,
                        midPoint.z + (perpZ / perpLen) * 18
                    );
                    camera.lookAt(midPoint);
                    camera.fov = 55; // Tighter framing
                    camera.updateProjectionMatrix();
                }

                if (distToHeli < 10 || timer > 2.5) {
                    phase = 1;
                    timer = 0;
                    slowMo = 0.12; // EXTREME slow-mo for impact
                    impactPos = heli.position.clone(); // Impact AT the helicopter

                    // === IMPACT! Mark helicopter dead but DON'T dispose yet ===
                    heli.health = 0;
                    heli.alive = false;

                    // Snap car to helicopter position for visible collision
                    challenger.position.lerp(heli.position, 0.7);
                    challenger.mesh.position.copy(challenger.position);

                    // Camera: dramatic close-up showing car embedded in helicopter
                    const sideDir = new THREE.Vector3(
                        -(heli.position.z - origCarPos.z),
                        0,
                        (heli.position.x - origCarPos.x)
                    ).normalize();
                    camera.position.set(
                        impactPos.x + sideDir.x * 12,
                        impactPos.y + 2,
                        impactPos.z + sideDir.z * 12
                    );
                    camera.lookAt(impactPos);
                    camera.fov = 45; // Tight dramatic zoom
                    camera.updateProjectionMatrix();

                    // White flash
                    flash.style.opacity = '1';
                    setTimeout(() => { flash.style.opacity = '0'; }, 200);

                    // Screen shake
                    let shakeF = 0;
                    const shakeOrigin = camera.position.clone();
                    const doImpactShake = () => {
                        shakeF++;
                        const intensity = Math.max(0, 1 - shakeF / 30) * 2.5;
                        camera.position.x = shakeOrigin.x + (Math.random() - 0.5) * intensity;
                        camera.position.y = shakeOrigin.y + (Math.random() - 0.5) * intensity;
                        camera.position.z = shakeOrigin.z + (Math.random() - 0.5) * intensity;
                        camera.lookAt(impactPos);
                        if (shakeF < 30) requestAnimationFrame(doImpactShake);
                    };
                    requestAnimationFrame(doImpactShake);

                    // Massive explosion AT the helicopter
                    spawnExplosionDebris(impactPos, 50);
                    spawnShockwave(impactPos);

                    // Staggered explosion bursts around the helicopter
                    spawnCarBloodEffect(impactPos);
                    setTimeout(() => { spawnExplosionDebris(impactPos.clone().add(new THREE.Vector3(3, 2, 0)), 15); }, 150);
                    setTimeout(() => { spawnCarBloodEffect(impactPos.clone().add(new THREE.Vector3(-2, 1, 3))); }, 250);
                    setTimeout(() => { spawnExplosionDebris(impactPos.clone().add(new THREE.Vector3(0, 4, 0)), 20); }, 350);
                    setTimeout(() => { spawnCarBloodEffect(impactPos.clone().add(new THREE.Vector3(2, -1, -2))); }, 450);

                    // Break helicopter apart - scatter its mesh children as debris
                    if (heli.mesh) {
                        const heliParts = [];
                        heli.mesh.traverse(child => {
                            if (child.isMesh && child !== heli.mesh) {
                                heliParts.push(child);
                            }
                        });
                        // Detach parts and fling them
                        for (const part of heliParts) {
                            const worldPos = new THREE.Vector3();
                            part.getWorldPosition(worldPos);
                            heli.mesh.remove(part);
                            scene.add(part);
                            part.position.copy(worldPos);
                            const flingSpeed = 8 + Math.random() * 15;
                            const flingAngle = Math.random() * Math.PI * 2;
                            let pvx = Math.cos(flingAngle) * flingSpeed;
                            let pvy = 3 + Math.random() * 10;
                            let pvz = Math.sin(flingAngle) * flingSpeed;
                            const pSpinX = (Math.random() - 0.5) * 12;
                            const pSpinZ = (Math.random() - 0.5) * 12;
                            let pf = 0;
                            const animPart = () => {
                                pf++;
                                pvy -= 15 * 0.016;
                                part.position.x += pvx * 0.016;
                                part.position.y += pvy * 0.016;
                                part.position.z += pvz * 0.016;
                                part.rotation.x += pSpinX * 0.016;
                                part.rotation.z += pSpinZ * 0.016;
                                pvx *= 0.99; pvz *= 0.99;
                                if (part.material) {
                                    part.material.transparent = true;
                                    part.material.opacity = Math.max(0, 1 - pf / 80);
                                }
                                if (pf < 80) requestAnimationFrame(animPart);
                                else {
                                    scene.remove(part);
                                    if (part.geometry) part.geometry.dispose();
                                    if (part.material) part.material.dispose();
                                }
                            };
                            // Delay each part slightly for cascading breakup
                            setTimeout(() => requestAnimationFrame(animPart), Math.random() * 300);
                        }
                        // Hide the main helicopter mesh after parts scatter
                        setTimeout(() => {
                            if (heli.mesh) { scene.remove(heli.mesh); }
                        }, 400);
                    }

                    // Fireball light flash (brighter, longer)
                    const fireLight = new THREE.PointLight(0xff4400, 8, 60);
                    fireLight.position.copy(impactPos);
                    scene.add(fireLight);
                    let lightF = 0;
                    const fadeLight = () => {
                        lightF++;
                        fireLight.intensity = Math.max(0, 8 - lightF * 0.12);
                        fireLight.color.setRGB(1, Math.max(0, 0.3 - lightF * 0.005), 0);
                        if (lightF < 70) requestAnimationFrame(fadeLight);
                        else scene.remove(fireLight);
                    };
                    requestAnimationFrame(fadeLight);

                    // Big money reward
                    reward = 150 + Math.floor(Math.random() * 151);
                    if (glock) {
                        glock.money += reward;
                        for (let d = 0; d < 20; d++) {
                            setTimeout(() => glock.spawnDollarBill(), d * 60);
                        }
                        if (missionSystem) missionSystem.onMoneyEarned(reward);
                    }

                    // Clean up helicopter from cop spawner (mesh already scattered)
                    copSpawner.helicopter = null;
                    if (copSpawner.wantedLevel > 2) copSpawner.wantedLevel -= 2;

                    // Update title to show impact
                    titleDiv.textContent = `💥 DESTROYED 💥`;
                    titleDiv.style.color = '#ffaa00';
                    titleDiv.style.fontSize = '72px';
                    titleDiv.style.textShadow = '0 0 40px #ffaa00,0 0 80px #ff6600,0 0 120px #ff0000,3px 3px 0 #000';

                    // Play explosion boom
                    playExplosionBoom();
                }
            } else if (phase === 1) {
                // === PHASE 1: IMPACT SLOW-MO FREEZE (0-1.5s) ===
                // Camera slowly zooms into the explosion
                slowMo = Math.min(0.5, 0.15 + timer * 0.25);

                if (impactPos) {
                    const zoomDist = Math.max(5, 15 - timer * 8);
                    camAngle += 0.5 * 0.016;
                    camera.position.set(
                        impactPos.x + Math.sin(camAngle) * zoomDist,
                        impactPos.y + 3 + Math.sin(timer * 2) * 2,
                        impactPos.z + Math.cos(camAngle) * zoomDist
                    );
                    camera.lookAt(impactPos);
                    camera.fov = 50 + timer * 15;
                    camera.updateProjectionMatrix();
                }

                // Spawn lingering fire
                if (Math.random() < 0.3 && impactPos) {
                    spawnTrailParticle();
                    fireParticles[fireParticles.length - 1].mesh.position.copy(impactPos);
                    fireParticles[fireParticles.length - 1].mesh.position.y += Math.random() * 3;
                }

                if (timer > 1.5) {
                    phase = 2;
                    timer = 0;
                    slowMo = 1;

                    // Show reward text
                    titleDiv.textContent = `+$${reward} 💰 ⭐-2`;
                    titleDiv.style.fontSize = '48px';
                    titleDiv.style.color = '#00ff88';
                    titleDiv.style.textShadow = '0 0 20px #00ff88,0 0 40px #00aa44,2px 2px 0 #000';
                }
            } else if (phase === 2) {
                // === PHASE 2: CAR FALLS BACK DOWN (0-3s) ===
                carVelY += -18 * 0.016;
                challenger.position.y += carVelY * 0.016;
                challenger.rotation += 0.03;

                // Drift back toward mountain
                challenger.position.x += (MTN_PEAK_X - challenger.position.x) * 0.03;
                challenger.position.z += (MTN_PEAK_Z - challenger.position.z) * 0.03;

                challenger.mesh.position.copy(challenger.position);
                challenger.mesh.rotation.y = challenger.rotation;
                // Gradually level out the car
                challenger.mesh.rotation.z *= 0.95;
                challenger.mesh.rotation.x *= 0.95;

                // Chase camera from behind
                const behindDist = 12 + timer * 2;
                const behindHeight = 6 + Math.max(0, 3 - timer * 2);
                camera.position.set(
                    challenger.position.x + Math.sin(challenger.rotation + Math.PI) * behindDist,
                    challenger.position.y + behindHeight,
                    challenger.position.z + Math.cos(challenger.rotation + Math.PI) * behindDist
                );
                camera.lookAt(challenger.position);
                camera.fov = 75 + Math.max(0, (1 - timer) * 10);
                camera.updateProjectionMatrix();

                // Check if car landed
                const groundY = world.getSpawnHeight(challenger.position.x, challenger.position.z);
                if (challenger.position.y <= groundY + 1 || timer > 3.5) {
                    challenger.position.y = Math.max(groundY + 1, challenger.position.y);
                    challenger.speed = 3;
                    challenger.mesh.position.copy(challenger.position);
                    challenger.mesh.rotation.z = 0;
                    challenger.mesh.rotation.x = 0;

                    // Landing impact shake
                    let landF = 0;
                    const landShake = () => {
                        landF++;
                        const i = Math.max(0, 1 - landF / 10) * 0.5;
                        if (smoothCamPos) {
                            smoothCamPos.y += (Math.random() - 0.5) * i;
                        }
                        if (landF < 10) requestAnimationFrame(landShake);
                    };
                    requestAnimationFrame(landShake);

                    // Clean up UI
                    hideCinematicBars();
                    titleDiv.style.opacity = '0';
                    titleDiv.style.transform = 'translate(-50%,-50%) scale(1.5)';
                    vignette.style.opacity = '0';
                    setTimeout(() => { titleDiv.remove(); vignette.remove(); flash.remove(); }, 1000);

                    // Restore driving camera
                    smoothCamPos = challenger.getCameraPosition();
                    camera.fov = 80;
                    camera.updateProjectionMatrix();

                    mtnTakedownActive = false;
                    return;
                }
            }

            requestAnimationFrame(animateTakedown);
        };

        requestAnimationFrame(animateTakedown);
    }

    function playExplosionBoom() {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;

            // MASSIVE deep boom
            const boom = ctx.createOscillator();
            boom.type = 'sine';
            boom.frequency.setValueAtTime(80, t);
            boom.frequency.exponentialRampToValueAtTime(15, t + 0.8);
            const boomGain = ctx.createGain();
            boomGain.gain.setValueAtTime(0.7, t);
            boomGain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
            boom.connect(boomGain);
            boomGain.connect(ctx.destination);
            boom.start(t);
            boom.stop(t + 1.1);

            // Crackle/debris noise
            const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
            const noiseData = noiseBuf.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuf;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(t);

            // Metal crunch
            const crunch = ctx.createOscillator();
            crunch.type = 'sawtooth';
            crunch.frequency.setValueAtTime(200, t);
            crunch.frequency.exponentialRampToValueAtTime(50, t + 0.3);
            const crunchGain = ctx.createGain();
            crunchGain.gain.setValueAtTime(0.3, t);
            crunchGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            const dist = ctx.createWaveShaperFunction ? null : null;
            crunch.connect(crunchGain);
            crunchGain.connect(ctx.destination);
            crunch.start(t);
            crunch.stop(t + 0.4);

            // Secondary explosion (delayed)
            const boom2 = ctx.createOscillator();
            boom2.type = 'sine';
            boom2.frequency.setValueAtTime(50, t + 0.3);
            boom2.frequency.exponentialRampToValueAtTime(12, t + 1.0);
            const boom2Gain = ctx.createGain();
            boom2Gain.gain.setValueAtTime(0.4, t + 0.3);
            boom2Gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
            boom2.connect(boom2Gain);
            boom2Gain.connect(ctx.destination);
            boom2.start(t + 0.3);
            boom2.stop(t + 1.3);
        } catch(e) {}
    }

    function showCinematicBars() {
        let topBar = document.getElementById('cinema-top');
        let botBar = document.getElementById('cinema-bottom');
        if (!topBar) {
            topBar = document.createElement('div');
            topBar.id = 'cinema-top';
            topBar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:0;background:#000;z-index:500;transition:height 0.5s;';
            document.body.appendChild(topBar);
        }
        if (!botBar) {
            botBar = document.createElement('div');
            botBar.id = 'cinema-bottom';
            botBar.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:0;background:#000;z-index:500;transition:height 0.5s;';
            document.body.appendChild(botBar);
        }
        setTimeout(() => {
            topBar.style.height = '60px';
            botBar.style.height = '60px';
        }, 10);
    }

    function hideCinematicBars() {
        const topBar = document.getElementById('cinema-top');
        const botBar = document.getElementById('cinema-bottom');
        if (topBar) topBar.style.height = '0';
        if (botBar) botBar.style.height = '0';
    }

    function playTakedownSound() {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;

            // Epic whoosh (car flying through air)
            const whooshBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
            const whooshData = whooshBuf.getChannelData(0);
            for (let i = 0; i < whooshData.length; i++) {
                whooshData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
            }
            const whoosh = ctx.createBufferSource();
            whoosh.buffer = whooshBuf;
            const whooshGain = ctx.createGain();
            whooshGain.gain.setValueAtTime(0.3, t);
            whooshGain.gain.linearRampToValueAtTime(0.1, t + 1.5);
            const whooshBP = ctx.createBiquadFilter();
            whooshBP.type = 'bandpass';
            whooshBP.frequency.setValueAtTime(400, t);
            whooshBP.frequency.linearRampToValueAtTime(1200, t + 0.5);
            whooshBP.frequency.linearRampToValueAtTime(200, t + 1.5);
            whoosh.connect(whooshBP);
            whooshBP.connect(whooshGain);
            whooshGain.connect(ctx.destination);
            whoosh.start(t);

            // Explosion impact (delayed)
            setTimeout(() => {
                const t2 = ctx.currentTime;
                // Deep boom
                const boom = ctx.createOscillator();
                boom.type = 'sine';
                boom.frequency.setValueAtTime(60, t2);
                boom.frequency.exponentialRampToValueAtTime(20, t2 + 0.5);
                const boomGain = ctx.createGain();
                boomGain.gain.setValueAtTime(0.5, t2);
                boomGain.gain.exponentialRampToValueAtTime(0.01, t2 + 0.6);
                boom.connect(boomGain);
                boomGain.connect(ctx.destination);
                boom.start(t2);
                boom.stop(t2 + 0.7);

                // Explosion noise
                const expBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
                const expData = expBuf.getChannelData(0);
                for (let i = 0; i < expData.length; i++) {
                    expData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
                }
                const exp = ctx.createBufferSource();
                exp.buffer = expBuf;
                const expGain = ctx.createGain();
                expGain.gain.setValueAtTime(0.4, t2);
                expGain.gain.exponentialRampToValueAtTime(0.01, t2 + 0.4);
                exp.connect(expGain);
                expGain.connect(ctx.destination);
                exp.start(t2);
            }, 1500);
        } catch(e) {}
    }

    function spawnChallenger() {
        // Try to spawn the car in a liquor store parking lot first
        if (liquorStoreSpawner && liquorStoreSpawner.stores.length > 0) {
            const store = liquorStoreSpawner.stores[0];
            // Park in the parking lot (in front of the store, in local +Z direction)
            const parkingDist = 10; // Distance from store center to parking spot
            const cosR = Math.cos(store.rotation);
            const sinR = Math.sin(store.rotation);
            // Local parking spot is at (0, 0, parkingDist) rotated by store rotation
            const carX = store.position.x + parkingDist * sinR;
            const carZ = store.position.z + parkingDist * cosR;
            const carY = store.position.y;
            // Car faces along the road (perpendicular to store front)
            const carRotation = store.rotation + Math.PI / 2;
            challenger = new DodgeChallenger(scene, world, carX, carY, carZ, carRotation);
            return;
        }

        // Fallback: spawn on nearest road
        const ROAD_SPACING = 128;
        const spawnX = player.position.x;
        const spawnZ = player.position.z;
        
        const nearestRoadX = Math.round(spawnX / ROAD_SPACING) * ROAD_SPACING;
        const nearestRoadZ = Math.round(spawnZ / ROAD_SPACING) * ROAD_SPACING;
        
        let carX = nearestRoadX;
        let carZ = spawnZ + 5;
        let carRotation = 0;
        
        if (Math.abs(nearestRoadX - spawnX) <= Math.abs(nearestRoadZ - spawnZ)) {
            carX = nearestRoadX;
            carRotation = 0;
        } else {
            carZ = nearestRoadZ;
            carRotation = Math.PI / 2;
        }
        
        const finalY = world.getSpawnHeight(carX, carZ);
        challenger = new DodgeChallenger(scene, world, carX, finalY, carZ, carRotation);
    }

    // Click to re-lock pointer (but not when shop menu is open)
    document.addEventListener('click', () => {
        if (gameStarted && !input.pointerLocked && !shopMenuOpen) {
            input.requestPointerLock();
        }
    });

    // Clean up multiplayer on page unload (so other players see us leave immediately)
    window.addEventListener('beforeunload', () => {
        if (mp) {
            mp.destroy();
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
