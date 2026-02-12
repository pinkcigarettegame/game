// Main game entry point
(function() {
    'use strict';

    // Game state
    let scene, camera, renderer;
    let world, player, input, ui, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, copSpawner;
    let healthPotionSpawner;
    let liquorStoreSpawner;
    let glock;
    let challenger; // Pimp Dodge Challenger
    let clock;
    let gameStarted = false;
    let gKeyWasDown = false;
    let hKeyWasDown = false;
    let mKeyWasDown = false;
    let rKeyWasDown = false;
    let uKeyWasDown = false;
    let bKeyWasDown = false;
    let shopMenuOpen = false;
    let drivingMode = false;
    let moneySpreadMode = false; // Third-person money spread on foot
    let smoothCamPos = null; // For smooth camera follow
    const CAR_ENTER_DISTANCE = 6; // How close to be to enter car
    const STRIPPER_INVITE_RANGE = 20; // How far to look for strippers to invite
    const STRIPPER_INVITE_COST = 50; // Cost to invite a stripper into the car
    const STRIPPER_ARM_COST = 100; // Cost to arm a stripper with a glock
    let inviteCooldown = 0; // Cooldown between invite attempts
    let carHitCooldown = 0; // Cooldown to prevent multi-hits on same frame

    // Shared AudioContext for performance (avoid creating new ones per sound)
    let sharedAudioCtx = null;
    function getAudioCtx() {
        if (!sharedAudioCtx) {
            sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return sharedAudioCtx;
    }

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

        // Spawn crypto liquor store system
        liquorStoreSpawner = new LiquorStoreSpawner(world, scene);
        liquorStoreSpawner.player = player;
        liquorStoreSpawner.glock = glock;
        liquorStoreSpawner.stripperSpawner = stripperSpawner;

        // Spawn the pimp Dodge Challenger on the nearest road
        spawnChallenger();

        ui.show();
        
        clock.start();
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

    function animate() {
        requestAnimationFrame(animate);

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

        // === H KEY: Enter/Exit car ===
        const hKeyDown = input.keys['KeyH'];
        if (hKeyDown && !hKeyWasDown && challenger) {
            if (drivingMode) {
                // Exit the car
                exitCar();
            } else {
                // Check if close enough to enter
                const dist = challenger.getDistanceTo(player.position);
                if (dist < CAR_ENTER_DISTANCE) {
                    enterCar();
                }
            }
        }
        hKeyWasDown = hKeyDown;

        // === CAR PROXIMITY PROMPT ===
        updateCarPrompt();

        if (drivingMode) {
            // === DRIVING MODE ===
            // Update car physics
            challenger.updateDriving(dt, input);
            
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
            
            // === CHECK CAR-NPC COLLISIONS (roadkill!) ===
            checkCarNPCCollisions(dt);
            
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

            // Update game systems
            player.update(dt, input);
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
        }

        // === B KEY: Open/Close Crypto Liquor Store Shop ===
        const bKeyDown = input.keys['KeyB'];
        if (bKeyDown && !bKeyWasDown) {
            if (shopMenuOpen) {
                closeShopMenu();
            } else if (!drivingMode) {
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
        }

        // === ESC to close shop ===
        if (shopMenuOpen && input.keys['Escape']) {
            closeShopMenu();
        }

        // === HIGH EFFECT: check proximity to bongmen ===
        updateHighEffect(dt);

        // === UNDERWATER EFFECT ===
        updateUnderwaterEffect(dt);

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
        
        // Auto-board ALL collected/hired strippers (they teleport into the car)
        if (stripperSpawner) {
            for (const s of stripperSpawner.strippers) {
                if (!s.alive || s.inCar) continue;
                if (!s.hired && !s.collected) continue; // Only board hired or collected strippers
                s.collected = false; // No longer just collected - now actively in car
                challenger.addPassenger(s); // addPassenger sets inCar=true, hired=true
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
            // YOU BROKE! 
            showBrokeMessage();
            playBrokeSound();
            return;
        }

        // Find the nearest stripper within range that isn't already in the car or hired
        let nearestStripper = null;
        let nearestDist = Infinity;
        for (const s of stripperSpawner.strippers) {
            if (!s.alive || s.inCar || s.hired) continue; // Skip hired strippers - they're already yours
            const dist = s.position.distanceTo(challenger.position);
            if (dist < STRIPPER_INVITE_RANGE && dist < nearestDist) {
                nearestDist = dist;
                nearestStripper = s;
            }
        }

        if (!nearestStripper) {
            // No strippers nearby - show a different message
            showNoStrippersMessage();
            return;
        }

        // Success! Deduct money and add stripper to car
        glock.money -= STRIPPER_INVITE_COST;
        
        // Play money spread animation
        glock.playMoneyFlashSound();
        for (let d = 0; d < 8; d++) {
            setTimeout(() => glock.spawnDollarBill(), d * 60);
        }

        // Stripper squeals excitedly and gets in
        nearestStripper.playSqueal();
        challenger.addPassenger(nearestStripper);

        // Wire up references for hired stripper (combat + line-of-fire avoidance)
        nearestStripper.crackheadSpawner = crackheadSpawner;
        nearestStripper.copSpawner = copSpawner;
        nearestStripper.glockRef = glock;
        nearestStripper.playerRef = player;
        nearestStripper.cameraRef = camera;

        // Auto-equip with a glock when invited
        nearestStripper.equipGlock();

        // Show success message
        showInviteMessage(challenger.getPassengerCount());
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
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
                    // Kill the cat instantly (don't let it explode - just remove it)
                    cat.alive = false;
                    cat.dispose();
                    catSpawner.cats.splice(i, 1);
                    spawnCarBloodEffect(cat.position);
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
                    bm.dispose();
                    bongManSpawner.bongMen.splice(i, 1);
                    spawnCarBloodEffect(bm.position);
                    hitSomething = true;
                    hitCount++;
                    // Running over civilians = wanted!
                    if (copSpawner) copSpawner.addWanted(1);
                }
            }
        }

        // --- Check Strippers (not hired/in car) ---
        if (stripperSpawner && stripperSpawner.strippers) {
            for (let i = stripperSpawner.strippers.length - 1; i >= 0; i--) {
                const s = stripperSpawner.strippers[i];
                if (!s.alive || s.inCar || s.hired || s.collected) continue;
                if (challenger.isPointInCarBounds(s.position)) {
                    s.alive = false;
                    s.dispose();
                    stripperSpawner.strippers.splice(i, 1);
                    spawnCarBloodEffect(s.position);
                    hitSomething = true;
                    hitCount++;
                    // Running over civilians = wanted!
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
                    ch.dispose();
                    crackheadSpawner.crackheads.splice(i, 1);
                    spawnCarBloodEffect(ch.position);
                    hitSomething = true;
                    hitCount++;
                    // Earn money for crackhead kills
                    if (glock) {
                        glock.money += 2;
                        glock.spawnDollarBill();
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
                    // Cops are tougher - need higher speed to one-shot
                    if (carSpeed >= MIN_KILL_SPEED) {
                        cop.alive = false;
                        cop.dispose();
                        copSpawner.cops.splice(i, 1);
                        spawnCarBloodEffect(cop.position);
                        hitSomething = true;
                        hitCount++;
                        // Earn money but get more wanted
                        if (glock) {
                            glock.money += 10;
                            for (let d = 0; d < 5; d++) {
                                setTimeout(() => glock.spawnDollarBill(), d * 80);
                            }
                        }
                        if (copSpawner) copSpawner.addWanted(2);
                    } else {
                        // Low speed - just damage the cop and push them
                        cop.health -= Math.ceil(carSpeed * 3);
                        const pushDir = new THREE.Vector3(
                            -Math.sin(challenger.rotation),
                            0.5,
                            -Math.cos(challenger.rotation)
                        );
                        cop.position.add(pushDir.multiplyScalar(2));
                        cop.velocity.copy(pushDir.normalize().multiplyScalar(carSpeed * 2));
                        cop.velocity.y = 5;
                        spawnCarBloodEffect(cop.position);
                        hitSomething = true;
                        if (cop.health <= 0) {
                            cop.alive = false;
                            cop.dispose();
                            copSpawner.cops.splice(i, 1);
                            if (glock) {
                                glock.money += 10;
                                for (let d = 0; d < 5; d++) {
                                    setTimeout(() => glock.spawnDollarBill(), d * 80);
                                }
                            }
                            if (copSpawner) copSpawner.addWanted(2);
                        } else {
                            if (copSpawner) copSpawner.addWanted(1);
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
            // Slow the car down on impact
            const speedReduction = Math.min(carSpeed * 0.3, 2 + hitCount);
            if (challenger.speed > 0) {
                challenger.speed = Math.max(0, challenger.speed - speedReduction);
            } else {
                challenger.speed = Math.min(0, challenger.speed + speedReduction);
            }
        }
    }

    function spawnCarBloodEffect(hitPos) {
        const pos = hitPos.clone();
        pos.y += 0.5;

        // Blood splatter particles
        for (let i = 0; i < 12; i++) {
            const size = 0.05 + Math.random() * 0.15;
            const geo = new THREE.BoxGeometry(size, size, size);
            const shade = 0.4 + Math.random() * 0.6;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(shade, 0, 0),
                transparent: true,
                opacity: 0.9
            });
            const blood = new THREE.Mesh(geo, mat);
            blood.position.copy(pos);

            // Spray in car's forward direction + random spread
            const carDir = challenger ? challenger.rotation : 0;
            const spreadAngle = (Math.random() - 0.5) * Math.PI;
            const angle = carDir + spreadAngle;
            const speed = 3 + Math.random() * 8;
            const vx = -Math.sin(angle) * speed;
            const vy = 2 + Math.random() * 6;
            const vz = -Math.cos(angle) * speed;

            scene.add(blood);

            let frame = 0;
            const animateBlood = () => {
                frame++;
                blood.position.x += vx * 0.016;
                blood.position.y += (vy - frame * 0.4) * 0.016;
                blood.position.z += vz * 0.016;
                blood.rotation.x += 0.1;
                blood.rotation.z += 0.15;
                mat.opacity = Math.max(0, 0.9 - frame / 30);
                if (frame < 35) {
                    requestAnimationFrame(animateBlood);
                } else {
                    scene.remove(blood);
                    geo.dispose();
                    mat.dispose();
                }
            };
            requestAnimationFrame(animateBlood);
        }

        // Ground blood pool (flat red disc that fades)
        const poolGeo = new THREE.BoxGeometry(1.5, 0.02, 1.5);
        const poolMat = new THREE.MeshBasicMaterial({
            color: 0x880000,
            transparent: true,
            opacity: 0.6
        });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.position.set(pos.x, pos.y - 0.3, pos.z);
        scene.add(pool);

        let poolFrame = 0;
        const animatePool = () => {
            poolFrame++;
            poolMat.opacity = Math.max(0, 0.6 - poolFrame / 120);
            const scale = 1 + poolFrame * 0.02;
            pool.scale.set(scale, 1, scale);
            if (poolFrame < 120) {
                requestAnimationFrame(animatePool);
            } else {
                scene.remove(pool);
                poolGeo.dispose();
                poolMat.dispose();
            }
        };
        requestAnimationFrame(animatePool);
    }

    function playCarImpactSound(hitCount) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    let shopKeyStates = { '1': false, '2': false, '3': false, '4': false };

    function openShopMenu(store) {
        if (shopMenuOpen) return;
        shopMenuOpen = true;
        activeShopStore = store;

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

        // Re-lock pointer
        if (input) input.requestPointerLock();
    }

    function handleShopInput() {
        if (!activeShopStore || !glock) return;

        const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
        for (let i = 0; i < keys.length; i++) {
            const keyDown = input.keys[keys[i]];
            const keyName = String(i + 1);
            if (keyDown && !shopKeyStates[keyName]) {
                // Try to purchase
                const success = activeShopStore.purchase(i, glock, player, stripperSpawner);

                if (success) {
                    // Check if moonshine (high effect)
                    if (activeShopStore._lastPurchaseEffect === 'high') {
                        highLevel = Math.min(1, highLevel + 0.6);
                        activeShopStore._lastPurchaseEffect = null;
                    }

                    // Update the menu balance and item affordability
                    const balanceEl = document.getElementById('shop-balance-amount');
                    if (balanceEl) balanceEl.textContent = glock.money;

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
                } else {
                    // Show broke message
                    showBrokeMessage();
                }
            }
            shopKeyStates[keyName] = !!keyDown;
        }
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

    // Click to re-lock pointer
    document.addEventListener('click', () => {
        if (gameStarted && !input.pointerLocked) {
            input.requestPointerLock();
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
