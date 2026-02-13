// Settings Page - Key/Gamepad Binding UI
// Full-screen overlay for remapping controls. Navigable by keyboard, mouse, and gamepad.

class SettingsUI {
    constructor(bindings) {
        this.bindings = bindings;
        this.visible = false;
        this.selectedRow = 0;
        this.listeningFor = null; // null, 'keyboard', or 'gamepad'
        this.listeningActionId = null;
        this.overlay = null;
        this.rows = [];
        this._keydownHandler = null;
        this._gamepadPollInterval = null;
        this._prevGamepadStates = {}; // Track previous button states for edge detection
        this._navCooldown = 0;

        this.build();
    }

    build() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'settings-overlay';
        this.overlay.style.display = 'none';
        this.overlay.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <h2>⚙️ CONTROLS</h2>
                    <p class="settings-subtitle">Click a binding to remap · Press any key or gamepad button</p>
                </div>
                <div class="settings-body" id="settings-body"></div>
                <div class="settings-footer">
                    <button class="settings-btn" id="settings-reset">🔄 Reset Defaults</button>
                    <button class="settings-btn settings-btn-primary" id="settings-close">✅ Save & Close</button>
                </div>
            </div>
            <div class="settings-listening-overlay" id="settings-listening" style="display:none;">
                <div class="listening-box">
                    <div class="listening-text" id="listening-text">Press a key...</div>
                    <div class="listening-hint">Press ESC to cancel · Press DELETE to clear</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        // Wire up buttons
        document.getElementById('settings-reset').addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetDefaults();
        });
        document.getElementById('settings-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        // Prevent clicks on the panel from closing
        this.overlay.querySelector('.settings-panel').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Click on overlay background to close
        this.overlay.addEventListener('click', () => {
            if (!this.listeningFor) this.close();
        });
    }

    populateRows() {
        const body = document.getElementById('settings-body');
        if (!body) return;
        body.innerHTML = '';
        this.rows = [];

        let lastCategory = '';
        for (let i = 0; i < this.bindings.actions.length; i++) {
            const action = this.bindings.actions[i];

            // Category header
            if (action.category !== lastCategory) {
                lastCategory = action.category;
                const catDiv = document.createElement('div');
                catDiv.className = 'settings-category';
                const catLabels = {
                    movement: '🏃 Movement',
                    camera: '👁️ Camera',
                    action: '🔫 Actions',
                    system: '⚡ System',
                    inventory: '🎒 Inventory'
                };
                catDiv.textContent = catLabels[action.category] || action.category;
                body.appendChild(catDiv);
            }

            const row = document.createElement('div');
            row.className = 'settings-row';
            row.dataset.index = i;
            row.dataset.actionId = action.id;

            const kbBinding = this.bindings.getKeyboard(action.id);
            const gpBinding = this.bindings.getGamepad(action.id);

            row.innerHTML = `
                <span class="settings-action-label">${action.label}</span>
                <span class="settings-binding settings-kb" data-type="keyboard" data-action="${action.id}">${Bindings.keyLabel(kbBinding)}</span>
                <span class="settings-binding settings-gp" data-type="gamepad" data-action="${action.id}">${Bindings.gamepadLabel(gpBinding)}</span>
            `;

            // Click handlers for binding cells
            row.querySelector('.settings-kb').addEventListener('click', (e) => {
                e.stopPropagation();
                this.startListening(action.id, 'keyboard');
            });
            row.querySelector('.settings-gp').addEventListener('click', (e) => {
                e.stopPropagation();
                this.startListening(action.id, 'gamepad');
            });

            // Click on row selects it
            row.addEventListener('click', (e) => {
                this.selectedRow = i;
                this.updateSelection();
            });

            body.appendChild(row);
            this.rows.push(row);
        }

        this.updateSelection();
    }

    updateSelection() {
        for (let i = 0; i < this.rows.length; i++) {
            if (i === this.selectedRow) {
                this.rows[i].classList.add('selected');
                // Scroll into view
                this.rows[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                this.rows[i].classList.remove('selected');
            }
        }
    }

    refreshRow(actionId) {
        for (const row of this.rows) {
            if (row.dataset.actionId === actionId) {
                const kbEl = row.querySelector('.settings-kb');
                const gpEl = row.querySelector('.settings-gp');
                if (kbEl) kbEl.textContent = Bindings.keyLabel(this.bindings.getKeyboard(actionId));
                if (gpEl) gpEl.textContent = Bindings.gamepadLabel(this.bindings.getGamepad(actionId));
                break;
            }
        }
    }

    open() {
        if (this.visible) return;
        this.visible = true;
        this.overlay.style.display = 'flex';
        this.populateRows();
        this.startInputListeners();

        // Exit pointer lock if active
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    close() {
        if (!this.visible) return;
        this.stopListening();
        this.visible = false;
        this.overlay.style.display = 'none';
        this.stopInputListeners();
        this.bindings.save();
    }

    isOpen() {
        return this.visible;
    }

    // === LISTENING MODE ===
    startListening(actionId, type) {
        this.listeningFor = type;
        this.listeningActionId = actionId;

        const listeningOverlay = document.getElementById('settings-listening');
        const listeningText = document.getElementById('listening-text');
        if (listeningOverlay) listeningOverlay.style.display = 'flex';

        const actionLabel = this.bindings.actions.find(a => a.id === actionId)?.label || actionId;
        if (type === 'keyboard') {
            listeningText.textContent = `⌨️ Press a key for "${actionLabel}"...`;
        } else {
            listeningText.textContent = `🎮 Press a gamepad button for "${actionLabel}"...`;
        }

        // Snapshot current gamepad states so we only detect NEW presses
        this._snapshotGamepadStates();
    }

    stopListening() {
        this.listeningFor = null;
        this.listeningActionId = null;
        const listeningOverlay = document.getElementById('settings-listening');
        if (listeningOverlay) listeningOverlay.style.display = 'none';
    }

    _snapshotGamepadStates() {
        this._prevGamepadStates = {};
        this._prevAxisStates = {};
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const AXIS_THRESHOLD = 0.5;
        for (let gi = 0; gi < gamepads.length; gi++) {
            const gp = gamepads[gi];
            if (!gp) continue;
            this._prevGamepadStates[gi] = {};
            for (let bi = 0; bi < gp.buttons.length; bi++) {
                this._prevGamepadStates[gi][bi] = gp.buttons[bi].pressed;
            }
            this._prevAxisStates[gi] = {};
            for (let ai = 0; ai < gp.axes.length; ai++) {
                const v = gp.axes[ai];
                // Store direction: -1, 0, or +1
                this._prevAxisStates[gi][ai] = v < -AXIS_THRESHOLD ? -1 : (v > AXIS_THRESHOLD ? 1 : 0);
            }
        }
    }

    // === INPUT LISTENERS (while settings is open) ===
    startInputListeners() {
        // Keyboard listener
        this._keydownHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.listeningFor === 'keyboard') {
                if (e.code === 'Escape') {
                    this.stopListening();
                    return;
                }
                if (e.code === 'Delete' || e.code === 'Backspace') {
                    this.bindings.clearKeyboard(this.listeningActionId);
                    this.refreshRow(this.listeningActionId);
                    this.stopListening();
                    return;
                }
                // Assign the key
                this.bindings.setKeyboard(this.listeningActionId, e.code);
                this.refreshRow(this.listeningActionId);
                this.stopListening();
                return;
            }

            if (this.listeningFor === 'gamepad') {
                // ESC cancels gamepad listening too
                if (e.code === 'Escape') {
                    this.stopListening();
                    return;
                }
                if (e.code === 'Delete' || e.code === 'Backspace') {
                    this.bindings.clearGamepad(this.listeningActionId);
                    this.refreshRow(this.listeningActionId);
                    this.stopListening();
                    return;
                }
                return; // Ignore other keys while waiting for gamepad
            }

            // Not listening - handle navigation
            if (e.code === 'Escape') {
                this.close();
                return;
            }
            if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                this.selectedRow = Math.max(0, this.selectedRow - 1);
                this.updateSelection();
                return;
            }
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                this.selectedRow = Math.min(this.rows.length - 1, this.selectedRow + 1);
                this.updateSelection();
                return;
            }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                // Select keyboard column
                const actionId = this.bindings.actions[this.selectedRow]?.id;
                if (actionId) this.startListening(actionId, 'keyboard');
                return;
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                // Select gamepad column
                const actionId = this.bindings.actions[this.selectedRow]?.id;
                if (actionId) this.startListening(actionId, 'gamepad');
                return;
            }
            if (e.code === 'Enter' || e.code === 'Space') {
                // Default: start listening for gamepad (most common for arcade setup)
                const actionId = this.bindings.actions[this.selectedRow]?.id;
                if (actionId) this.startListening(actionId, 'gamepad');
                return;
            }
        };
        document.addEventListener('keydown', this._keydownHandler, true); // capture phase

        // Gamepad polling
        this._gamepadPollInterval = setInterval(() => this._pollGamepadForSettings(), 50);
    }

    stopInputListeners() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler, true);
            this._keydownHandler = null;
        }
        if (this._gamepadPollInterval) {
            clearInterval(this._gamepadPollInterval);
            this._gamepadPollInterval = null;
        }
    }

    _pollGamepadForSettings() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const AXIS_THRESHOLD = 0.5;

        // Helper: get current axis direction (-1, 0, +1)
        const axisDir = (gp, ai) => {
            const v = gp.axes[ai];
            if (v === undefined) return 0;
            return v < -AXIS_THRESHOLD ? -1 : (v > AXIS_THRESHOLD ? 1 : 0);
        };

        if (this.listeningFor === 'gamepad') {
            // Check for any newly pressed button
            for (let gi = 0; gi < gamepads.length; gi++) {
                const gp = gamepads[gi];
                if (!gp) continue;
                // Check buttons
                for (let bi = 0; bi < gp.buttons.length; bi++) {
                    const pressed = gp.buttons[bi].pressed;
                    const wasPrev = this._prevGamepadStates[gi] && this._prevGamepadStates[gi][bi];
                    if (pressed && !wasPrev) {
                        this.bindings.setGamepad(this.listeningActionId, gi, bi);
                        this.refreshRow(this.listeningActionId);
                        this.stopListening();
                        this._snapshotGamepadStates();
                        return;
                    }
                }
                // Check axes (joystick)
                for (let ai = 0; ai < gp.axes.length; ai++) {
                    const dir = axisDir(gp, ai);
                    const prevDir = (this._prevAxisStates[gi] && this._prevAxisStates[gi][ai]) || 0;
                    if (dir !== 0 && dir !== prevDir) {
                        // New axis movement detected! Bind as axis
                        this.bindings.setGamepadAxis(this.listeningActionId, gi, ai, dir);
                        this.refreshRow(this.listeningActionId);
                        this.stopListening();
                        this._snapshotGamepadStates();
                        return;
                    }
                }
            }
            // Update previous states
            this._updatePrevGamepadStates(gamepads);
            return;
        }

        if (this.listeningFor === 'keyboard') {
            this._updatePrevGamepadStates(gamepads);
            return;
        }

        // Not listening - use gamepad for navigation (buttons + axes)
        this._navCooldown = Math.max(0, this._navCooldown - 50);
        if (this._navCooldown > 0) {
            this._updatePrevGamepadStates(gamepads);
            return;
        }

        let handled = false;

        for (let gi = 0; gi < gamepads.length; gi++) {
            const gp = gamepads[gi];
            if (!gp) continue;

            // Check buttons for navigation
            for (let bi = 0; bi < gp.buttons.length; bi++) {
                const pressed = gp.buttons[bi].pressed;
                const wasPrev = this._prevGamepadStates[gi] && this._prevGamepadStates[gi][bi];
                if (pressed && !wasPrev) {
                    if (bi === 7 || bi === 12) {
                        this.selectedRow = Math.max(0, this.selectedRow - 1);
                        this.updateSelection();
                        this._navCooldown = 150;
                        handled = true;
                    } else if (bi === 4 || bi === 13) {
                        this.selectedRow = Math.min(this.rows.length - 1, this.selectedRow + 1);
                        this.updateSelection();
                        this._navCooldown = 150;
                        handled = true;
                    } else if (bi === 5 || bi === 14) {
                        const actionId = this.bindings.actions[this.selectedRow]?.id;
                        if (actionId) this.startListening(actionId, 'keyboard');
                        this._navCooldown = 200;
                        handled = true;
                    } else if (bi === 6 || bi === 15) {
                        const actionId = this.bindings.actions[this.selectedRow]?.id;
                        if (actionId) this.startListening(actionId, 'gamepad');
                        this._navCooldown = 200;
                        handled = true;
                    } else if (bi === 8 || bi === 2 || bi === 0 || bi === 9) {
                        const actionId = this.bindings.actions[this.selectedRow]?.id;
                        if (actionId) this.startListening(actionId, 'gamepad');
                        this._navCooldown = 200;
                        handled = true;
                    } else if (bi === 3) {
                        this.close();
                        this._navCooldown = 300;
                        handled = true;
                    }
                    if (handled) break;
                }
            }
            if (handled) break;

            // Check axes for navigation (joystick up/down/left/right)
            for (let ai = 0; ai < gp.axes.length; ai++) {
                const dir = axisDir(gp, ai);
                const prevDir = (this._prevAxisStates[gi] && this._prevAxisStates[gi][ai]) || 0;
                if (dir !== 0 && dir !== prevDir) {
                    if (ai === 1 && dir === -1) {
                        // Axis 1 negative = UP
                        this.selectedRow = Math.max(0, this.selectedRow - 1);
                        this.updateSelection();
                        this._navCooldown = 150;
                        handled = true;
                    } else if (ai === 1 && dir === 1) {
                        // Axis 1 positive = DOWN
                        this.selectedRow = Math.min(this.rows.length - 1, this.selectedRow + 1);
                        this.updateSelection();
                        this._navCooldown = 150;
                        handled = true;
                    } else if (ai === 0 && dir === -1) {
                        // Axis 0 negative = LEFT - edit keyboard binding
                        const actionId = this.bindings.actions[this.selectedRow]?.id;
                        if (actionId) this.startListening(actionId, 'keyboard');
                        this._navCooldown = 200;
                        handled = true;
                    } else if (ai === 0 && dir === 1) {
                        // Axis 0 positive = RIGHT - edit gamepad binding
                        const actionId = this.bindings.actions[this.selectedRow]?.id;
                        if (actionId) this.startListening(actionId, 'gamepad');
                        this._navCooldown = 200;
                        handled = true;
                    }
                    if (handled) break;
                }
            }
            if (handled) break;
        }

        this._updatePrevGamepadStates(gamepads);
    }

    _updatePrevGamepadStates(gamepads) {
        const AXIS_THRESHOLD = 0.5;
        for (let gi = 0; gi < gamepads.length; gi++) {
            const gp = gamepads[gi];
            if (!gp) continue;
            if (!this._prevGamepadStates[gi]) this._prevGamepadStates[gi] = {};
            for (let bi = 0; bi < gp.buttons.length; bi++) {
                this._prevGamepadStates[gi][bi] = gp.buttons[bi].pressed;
            }
            if (!this._prevAxisStates) this._prevAxisStates = {};
            if (!this._prevAxisStates[gi]) this._prevAxisStates[gi] = {};
            for (let ai = 0; ai < gp.axes.length; ai++) {
                const v = gp.axes[ai];
                this._prevAxisStates[gi][ai] = v < -AXIS_THRESHOLD ? -1 : (v > AXIS_THRESHOLD ? 1 : 0);
            }
        }
    }

    resetDefaults() {
        this.bindings.reset();
        this.bindings.save();
        this.populateRows();
    }
}

window.SettingsUI = SettingsUI;
