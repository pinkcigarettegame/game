// Input handling
class InputHandler {
    constructor() {
        this.keys = {};
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.mouseLeft = false;
        this.mouseRight = false;
        this.scrollDelta = 0;
        this.pointerLocked = false;

        // Map e.key values to e.code equivalents for fallback
        this.keyToCode = {
            'w': 'KeyW', 'W': 'KeyW',
            'a': 'KeyA', 'A': 'KeyA',
            's': 'KeyS', 'S': 'KeyS',
            'd': 'KeyD', 'D': 'KeyD',
            ' ': 'Space',
            'Shift': 'ShiftLeft',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '4': 'Digit4',
            '5': 'Digit5', '6': 'Digit6', '7': 'Digit7', '8': 'Digit8',
            'g': 'KeyG', 'G': 'KeyG',
            'h': 'KeyH', 'H': 'KeyH',
            'm': 'KeyM', 'M': 'KeyM',
        };

        // Keys that should have their default browser action prevented
        this.preventDefaultKeys = new Set([
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Digit1', 'Digit2', 'Digit3', 'Digit4',
            'Digit5', 'Digit6', 'Digit7', 'Digit8',
        ]);

        this.setupListeners();
    }

    setupListeners() {
        document.addEventListener('keydown', (e) => {
            // Store by e.code (physical key)
            if (e.code) {
                this.keys[e.code] = true;
            }
            // Also map e.key to the expected code as fallback
            if (e.key && this.keyToCode[e.key]) {
                this.keys[this.keyToCode[e.key]] = true;
            }
            // Only prevent default for game-relevant keys
            const code = e.code || this.keyToCode[e.key];
            if (code && this.preventDefaultKeys.has(code)) {
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            // Clear by e.code (physical key)
            if (e.code) {
                this.keys[e.code] = false;
            }
            // Also clear the mapped code from e.key
            if (e.key && this.keyToCode[e.key]) {
                this.keys[this.keyToCode[e.key]] = false;
            }
            const code = e.code || this.keyToCode[e.key];
            if (code && this.preventDefaultKeys.has(code)) {
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouseDX += e.movementX;
                this.mouseDY += e.movementY;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (this.pointerLocked) {
                if (e.button === 0) this.mouseLeft = true;
                if (e.button === 2) this.mouseRight = true;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft = false;
            if (e.button === 2) this.mouseRight = false;
        });

        document.addEventListener('wheel', (e) => {
            this.scrollDelta += Math.sign(e.deltaY);
        });

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement !== null;
        });
    }

    requestPointerLock() {
        document.body.requestPointerLock();
    }

    consumeScroll() {
        const delta = this.scrollDelta;
        this.scrollDelta = 0;
        return delta;
    }

    // === ARCADE CABINET GAMEPAD SUPPORT ===
    // Polls gamepad state and OR's it into the existing input state.
    // Arcade layout (from proto7ype-arcade button-tester):
    //   Gamepad 0 (Main): B7=UP, B4=DOWN, B5=LEFT, B6=RIGHT, B8=ACTION1, B9=ACTION2, B2=COIN, B3=START
    //   Gamepad 1 (P2/Select): B7=UP, B4=DOWN, B5=LEFT, B6=RIGHT, B2=ACTION1(P2), B3=ACTION2(P2), B8=1P_SELECT, B9=2P_SELECT
    //
    // Mapping:
    //   GP0 D-pad (4-7)       -> Movement (WASD)
    //   GP0 ACTION1 (8)       -> Jump/Swim (Space)
    //   GP0 ACTION2 (9)       -> Sprint/Dive (Shift)
    //   GP0 COIN (2)          -> Toggle Glock (G)
    //   GP0 START (3)         -> Start game / Respawn (handled externally via arcadeStartPressed)
    //   GP1 D-pad (4-7)       -> Camera look (simulated mouse movement)
    //   GP1 ACTION1 P2 (2)    -> Shoot/Break (Left Click)
    //   GP1 ACTION2 P2 (3)    -> Place Block (Right Click)
    //   GP1 1P SELECT (8)     -> Enter/Exit Car (H)
    //   GP1 2P SELECT (9)     -> Money/Invite (M)
    pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp0 = gamepads[0];
        const gp1 = gamepads[1];

        // Helper: check if a button is pressed
        const btn = (gp, index) => gp && gp.buttons[index] && gp.buttons[index].pressed;

        // --- Gamepad 0: Movement + Actions ---
        if (gp0) {
            // D-pad -> Movement keys (OR with keyboard)
            if (btn(gp0, 7)) this.keys['KeyW'] = true;       // UP -> Forward
            if (btn(gp0, 4)) this.keys['KeyS'] = true;       // DOWN -> Back
            if (btn(gp0, 5)) this.keys['KeyA'] = true;       // LEFT -> Strafe left
            if (btn(gp0, 6)) this.keys['KeyD'] = true;       // RIGHT -> Strafe right

            // ACTION1 -> Jump / Swim up
            if (btn(gp0, 8)) this.keys['Space'] = true;

            // ACTION2 -> Sprint / Dive
            if (btn(gp0, 9)) this.keys['ShiftLeft'] = true;

            // COIN -> Toggle Glock (G key)
            if (btn(gp0, 2)) this.keys['KeyG'] = true;

            // START -> exposed as a flag for main.js to handle start/respawn
            this.arcadeStartPressed = !!btn(gp0, 3);

            // Also map Digit keys for hotbar via GP0 buttons 0,1 if needed
            // (buttons 0 and 1 are unmapped on the arcade - reserved)
        }

        // --- Gamepad 1: Camera Look + Shoot/Place + Car/Money ---
        if (gp1) {
            // D-pad -> Simulated mouse look (camera rotation)
            const LOOK_SPEED = 8; // pixels of simulated mouse movement per frame
            if (btn(gp1, 7)) this.mouseDY -= LOOK_SPEED;  // UP -> Look up
            if (btn(gp1, 4)) this.mouseDY += LOOK_SPEED;  // DOWN -> Look down
            if (btn(gp1, 5)) this.mouseDX -= LOOK_SPEED;  // LEFT -> Look left
            if (btn(gp1, 6)) this.mouseDX += LOOK_SPEED;  // RIGHT -> Look right

            // ACTION1 P2 -> Shoot / Break block (left click)
            if (btn(gp1, 2)) this.mouseLeft = true;

            // ACTION2 P2 -> Place block (right click)
            if (btn(gp1, 3)) this.mouseRight = true;

            // 1P SELECT -> Enter/Exit Car (H key)
            if (btn(gp1, 8)) this.keys['KeyH'] = true;

            // 2P SELECT -> Money spread / Invite stripper (M key)
            if (btn(gp1, 9)) this.keys['KeyM'] = true;
        }

        // Also handle hotbar cycling: GP0 buttons 0 and 1 for prev/next slot
        if (gp0) {
            if (btn(gp0, 0) && !this._gp0Btn0Was) this.scrollDelta -= 1; // Button 0 -> prev slot
            if (btn(gp0, 1) && !this._gp0Btn1Was) this.scrollDelta += 1; // Button 1 -> next slot
            this._gp0Btn0Was = !!btn(gp0, 0);
            this._gp0Btn1Was = !!btn(gp0, 1);
        }
    }
}

window.InputHandler = InputHandler;
