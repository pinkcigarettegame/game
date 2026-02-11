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
}

window.InputHandler = InputHandler;
