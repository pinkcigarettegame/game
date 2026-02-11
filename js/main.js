// Main game entry point
(function() {
    'use strict';

    // Game state
    let scene, camera, renderer;
    let world, player, input, ui, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner;
    let glock;
    let challenger; // Pimp Dodge Challenger
    let clock;
    let gameStarted = false;
    let gKeyWasDown = false;
    let hKeyWasDown = false;
    let mKeyWasDown = false;
    let drivingMode = false;
    let smoothCamPos = null; // For smooth camera follow
    const CAR_ENTER_DISTANCE = 6; // How close to be to enter car

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
        // Add camera to scene so child objects (gun) render
        scene.add(camera);
        glock = new Glock(scene, camera, player);
        glock.setTargets(catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner);

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
            
            // Update speed display
            updateDrivingHUD();
            
            // Still update NPCs
            if (catSpawner) catSpawner.update(dt, challenger.position);
            if (bongManSpawner) bongManSpawner.update(dt, challenger.position, catSpawner);
            if (stripperSpawner) stripperSpawner.update(dt, challenger.position);
            if (crackheadSpawner) crackheadSpawner.update(dt, challenger.position);
            ui.update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock);
            
            // Consume mouse input so it doesn't accumulate
            input.mouseDX = 0;
            input.mouseDY = 0;
        } else {
            // === NORMAL ON-FOOT MODE ===
            // Toggle glock with G key
            const gKeyDown = input.keys['KeyG'];
            if (gKeyDown && !gKeyWasDown && glock) {
                glock.toggle();
            }
            gKeyWasDown = gKeyDown;

            // Money spread with M key
            const mKeyDown = input.keys['KeyM'];
            if (mKeyDown && !mKeyWasDown && glock) {
                glock.moneySpread();
            }
            mKeyWasDown = mKeyDown;

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
            ui.update(dt, catSpawner, bongManSpawner, stripperSpawner, crackheadSpawner, glock);
            if (glock) glock.update(dt);
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
    }

    function spawnChallenger() {
        // Find the nearest road to the player spawn (8, 8)
        // Roads are on a grid with spacing of 48, so nearest roads are at x=0 and z=0
        // Search nearby for a road surface block
        const ROAD_SPACING = 48;
        const spawnX = player.position.x;
        const spawnZ = player.position.z;
        
        // Find nearest road center (round to nearest road grid line)
        const nearestRoadX = Math.round(spawnX / ROAD_SPACING) * ROAD_SPACING;
        const nearestRoadZ = Math.round(spawnZ / ROAD_SPACING) * ROAD_SPACING;
        
        // Try placing on the Z-aligned road (runs along Z axis at nearestRoadX)
        // Place it a few blocks ahead of the player along the road
        let carX = nearestRoadX;
        let carZ = spawnZ + 5; // A bit ahead of spawn
        
        // If the nearest road is too far, try the other axis
        if (Math.abs(nearestRoadX - spawnX) > 15) {
            // Try Z-road instead
            carX = spawnX + 5;
            carZ = nearestRoadZ;
        }
        
        // Get the ground height at the car position
        const carY = world.getSpawnHeight(carX, carZ);
        
        // Determine road direction for car rotation
        // If on X-road (road runs along X), car faces along X (rotation = PI/2)
        // If on Z-road (road runs along Z), car faces along Z (rotation = 0)
        let carRotation = 0;
        if (Math.abs(nearestRoadX - spawnX) <= Math.abs(nearestRoadZ - spawnZ)) {
            // Closer to a Z-aligned road - car faces along Z
            carX = nearestRoadX;
            carRotation = 0;
        } else {
            // Closer to an X-aligned road - car faces along X
            carZ = nearestRoadZ;
            carRotation = Math.PI / 2;
        }
        
        // Recalculate height at final position
        const finalY = world.getSpawnHeight(carX, carZ);
        
        // Create the pimp Challenger!
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
