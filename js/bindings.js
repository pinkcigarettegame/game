// Key/Gamepad Bindings System
// Allows remapping of all game actions to keyboard keys and gamepad buttons.
// Persists to localStorage.

class Bindings {
    constructor() {
        // Action definitions: each action has a default keyboard code and default gamepad binding
        this.actions = [
            { id: 'moveForward',  label: 'Move Forward',    category: 'movement' },
            { id: 'moveBack',     label: 'Move Back',       category: 'movement' },
            { id: 'moveLeft',     label: 'Move Left',       category: 'movement' },
            { id: 'moveRight',    label: 'Move Right',      category: 'movement' },
            { id: 'jump',         label: 'Jump / Swim Up',  category: 'movement' },
            { id: 'sprint',       label: 'Sprint / Dive',   category: 'movement' },
            { id: 'lookUp',       label: 'Look Up',         category: 'camera' },
            { id: 'lookDown',     label: 'Look Down',       category: 'camera' },
            { id: 'lookLeft',     label: 'Look Left',       category: 'camera' },
            { id: 'lookRight',    label: 'Look Right',      category: 'camera' },
            { id: 'shoot',        label: 'Shoot / Break',   category: 'action' },
            { id: 'place',        label: 'Place Block',     category: 'action' },
            { id: 'toggleGlock',  label: 'Toggle Glock',    category: 'action' },
            { id: 'reload',       label: 'Reload',          category: 'action' },
            { id: 'enterCar',     label: 'Enter/Exit Car',  category: 'action' },
            { id: 'money',        label: 'Money / Invite',  category: 'action' },
            { id: 'shop',         label: 'Shop',            category: 'action' },
            { id: 'start',        label: 'Start / Respawn', category: 'system' },
            { id: 'hotbarPrev',   label: 'Hotbar Prev',     category: 'inventory' },
            { id: 'hotbarNext',   label: 'Hotbar Next',     category: 'inventory' },
        ];

        // Default bindings
        this.defaults = {
            moveForward:  { keyboard: 'KeyW',       gamepad: { index: 0, button: 7 } },
            moveBack:     { keyboard: 'KeyS',       gamepad: { index: 0, button: 4 } },
            moveLeft:     { keyboard: 'KeyA',       gamepad: { index: 0, button: 5 } },
            moveRight:    { keyboard: 'KeyD',       gamepad: { index: 0, button: 6 } },
            jump:         { keyboard: 'Space',      gamepad: { index: 0, button: 8 } },
            sprint:       { keyboard: 'ShiftLeft',  gamepad: { index: 0, button: 9 } },
            lookUp:       { keyboard: null,         gamepad: { index: 1, button: 7 } },
            lookDown:     { keyboard: null,         gamepad: { index: 1, button: 4 } },
            lookLeft:     { keyboard: null,         gamepad: { index: 1, button: 5 } },
            lookRight:    { keyboard: null,         gamepad: { index: 1, button: 6 } },
            shoot:        { keyboard: null,         gamepad: { index: 1, button: 2 } },  // mouse left
            place:        { keyboard: null,         gamepad: { index: 1, button: 3 } },  // mouse right
            toggleGlock:  { keyboard: 'KeyG',       gamepad: { index: 0, button: 2 } },
            reload:       { keyboard: 'KeyR',       gamepad: null },
            enterCar:     { keyboard: 'KeyH',       gamepad: { index: 1, button: 8 } },
            money:        { keyboard: 'KeyM',       gamepad: { index: 1, button: 9 } },
            shop:         { keyboard: 'KeyB',       gamepad: null },
            start:        { keyboard: null,         gamepad: { index: 0, button: 3 } },
            hotbarPrev:   { keyboard: null,         gamepad: { index: 0, button: 0 } },
            hotbarNext:   { keyboard: null,         gamepad: { index: 0, button: 1 } },
        };

        // Current bindings (deep copy of defaults, then overridden by localStorage)
        this.bindings = {};
        this.reset();
        this.load();
    }

    // Reset all bindings to defaults
    reset() {
        this.bindings = {};
        for (const key in this.defaults) {
            const d = this.defaults[key];
            this.bindings[key] = {
                keyboard: d.keyboard,
                gamepad: d.gamepad ? { index: d.gamepad.index, button: d.gamepad.button } : null
            };
        }
    }

    // Load bindings from localStorage
    load() {
        try {
            const saved = localStorage.getItem('pcw_bindings');
            if (saved) {
                const parsed = JSON.parse(saved);
                for (const key in parsed) {
                    if (this.bindings[key]) {
                        if (parsed[key].keyboard !== undefined) {
                            this.bindings[key].keyboard = parsed[key].keyboard;
                        }
                        if (parsed[key].gamepad !== undefined) {
                            this.bindings[key].gamepad = parsed[key].gamepad;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Bindings] Failed to load from localStorage:', e);
        }
    }

    // Save bindings to localStorage
    save() {
        try {
            localStorage.setItem('pcw_bindings', JSON.stringify(this.bindings));
        } catch (e) {
            console.warn('[Bindings] Failed to save to localStorage:', e);
        }
    }

    // Get the keyboard code for an action (e.g., 'KeyW')
    getKeyboard(actionId) {
        return this.bindings[actionId] ? this.bindings[actionId].keyboard : null;
    }

    // Get the gamepad binding for an action (e.g., { index: 0, button: 7 })
    getGamepad(actionId) {
        return this.bindings[actionId] ? this.bindings[actionId].gamepad : null;
    }

    // Set the keyboard binding for an action
    setKeyboard(actionId, keyCode) {
        if (this.bindings[actionId]) {
            this.bindings[actionId].keyboard = keyCode;
            this.save();
        }
    }

    // Set the gamepad binding for an action
    setGamepad(actionId, gamepadIndex, buttonIndex) {
        if (this.bindings[actionId]) {
            this.bindings[actionId].gamepad = { index: gamepadIndex, button: buttonIndex };
            this.save();
        }
    }

    // Clear the keyboard binding for an action
    clearKeyboard(actionId) {
        if (this.bindings[actionId]) {
            this.bindings[actionId].keyboard = null;
            this.save();
        }
    }

    // Clear the gamepad binding for an action
    clearGamepad(actionId) {
        if (this.bindings[actionId]) {
            this.bindings[actionId].gamepad = null;
            this.save();
        }
    }

    // Get a human-readable label for a keyboard code
    static keyLabel(code) {
        if (!code) return '—';
        const labels = {
            'KeyW': 'W', 'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D',
            'KeyG': 'G', 'KeyH': 'H', 'KeyM': 'M', 'KeyR': 'R', 'KeyB': 'B',
            'KeyQ': 'Q', 'KeyE': 'E', 'KeyF': 'F', 'KeyT': 'T', 'KeyU': 'U',
            'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P', 'KeyJ': 'J', 'KeyK': 'K',
            'KeyL': 'L', 'KeyZ': 'Z', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V',
            'KeyN': 'N', 'KeyY': 'Y',
            'Space': 'Space', 'ShiftLeft': 'L-Shift', 'ShiftRight': 'R-Shift',
            'ControlLeft': 'L-Ctrl', 'ControlRight': 'R-Ctrl',
            'AltLeft': 'L-Alt', 'AltRight': 'R-Alt',
            'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
            'Enter': 'Enter', 'Escape': 'Esc', 'Tab': 'Tab', 'Backspace': 'Backspace',
            'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4',
            'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8',
            'Digit9': '9', 'Digit0': '0',
        };
        return labels[code] || code;
    }

    // Get a human-readable label for a gamepad binding
    static gamepadLabel(gp) {
        if (!gp) return '—';
        return 'GP' + gp.index + ' B' + gp.button;
    }
}

window.Bindings = Bindings;
