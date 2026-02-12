// Multiplayer networking using PeerJS (WebRTC P2P)
// Auto-connect: first player becomes host, others join automatically

class Multiplayer {
    constructor() {
        // Connection state
        this.peer = null;
        this.isHost = false;
        this.connected = false;
        this.hostConnection = null; // Client's connection to host
        this.clientConnections = {}; // Host's connections to clients {peerId: conn}
        this.myId = null;
        this.playerName = 'Player';
        
        // Fixed host ID - everyone connects to this
        this.HOST_ID = 'pink-cig-world-host-v1';
        
        // Player data
        this.remotePlayers = {}; // {peerId: {name, position, rotation, health, ...}}
        
        // Block changes queue (to sync with new joiners)
        this.blockChanges = []; // [{x, y, z, type, timestamp}]
        this.MAX_BLOCK_HISTORY = 500;
        
        // Update throttling
        this.lastPositionBroadcast = 0;
        this.POSITION_BROADCAST_INTERVAL = 66; // ~15 updates/sec (ms)
        
        // Callbacks
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onPlayerUpdate = null;
        this.onBlockChange = null;
        this.onConnectionStatus = null;
        
        // Reconnection
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 15;
        this.destroyed = false;
        this._isReconnecting = false; // Guard against duplicate reconnection attempts
        this._signalingReconnectAttempts = 0; // Track signaling-only reconnect attempts
        this.MAX_SIGNALING_RECONNECTS = 3; // Try reconnect() this many times before full recreate
        
        // Heartbeat / keepalive system
        this._heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 5000; // Send ping every 5 seconds
        this.HEARTBEAT_TIMEOUT = 15000; // Consider dead after 15 seconds without pong
        this._lastPongReceived = {}; // {peerId: timestamp} - host tracks per-client
        this._lastHostPong = 0; // Client tracks host pong time
    }
    
    // Initialize multiplayer - tries to be host, falls back to client
    init(playerName) {
        this.playerName = playerName || 'Player';
        this.destroyed = false;
        this._isReconnecting = false;
        
        // Try to claim the host ID first
        this._tryBecomeHost();
    }
    
    _tryBecomeHost() {
        if (this.destroyed) return;
        if (this._isReconnecting) return; // Prevent duplicate attempts
        this._isReconnecting = true;
        
        console.log('[MP] Trying to become host...');
        this._updateStatus('connecting', 'Trying to host...');
        
        // Clean up any existing peer first
        if (this.peer) {
            try { this.peer.destroy(); } catch(e) {}
            this.peer = null;
        }
        
        this.peer = new Peer(this.HOST_ID, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            console.log('[MP] I am the HOST! ID:', id);
            this.isHost = true;
            this.myId = id;
            this.connected = true;
            this._isReconnecting = false;
            this.reconnectAttempts = 0;
            this._signalingReconnectAttempts = 0;
            this._updateStatus('host', 'Hosting (waiting for players...)');
            
            // Start heartbeat system to detect dead connections
            this._startHeartbeat();
            
            // Listen for incoming connections
            this.peer.on('connection', (conn) => {
                this._handleNewClient(conn);
            });
        });
        
        this.peer.on('error', (err) => {
            this._isReconnecting = false;
            
            if (err.type === 'unavailable-id') {
                // Host already exists - become a client
                console.log('[MP] Host exists, joining as client...');
                if (this.peer) {
                    try { this.peer.destroy(); } catch(e) {}
                    this.peer = null;
                }
                this._joinAsClient();
            } else if (err.type === 'peer-unavailable') {
                // Host went away while trying to connect
                console.log('[MP] Host unavailable, retrying...');
                this._scheduleReconnect();
            } else {
                console.error('[MP] Peer error:', err.type, err);
                this._updateStatus('error', 'Connection error');
                this._scheduleReconnect();
            }
        });
        
        this.peer.on('disconnected', () => {
            if (this.destroyed) return;
            console.log('[MP] Host disconnected from signaling server');
            
            // WebRTC data channels survive signaling disconnections!
            // Try to reconnect to signaling server without destroying existing connections
            this._trySignalingReconnect();
        });
    }
    
    _joinAsClient() {
        if (this.destroyed) return;
        if (this._isReconnecting) return; // Prevent duplicate attempts
        this._isReconnecting = true;
        
        console.log('[MP] Joining as client...');
        this._updateStatus('connecting', 'Connecting to world...');
        
        // Clean up any existing peer first
        if (this.peer) {
            try { this.peer.destroy(); } catch(e) {}
            this.peer = null;
        }
        
        // Create peer with random ID
        this.peer = new Peer(undefined, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            this.myId = id;
            this._isReconnecting = false;
            this._signalingReconnectAttempts = 0;
            console.log('[MP] My client ID:', id);
            
            // Connect to host
            const conn = this.peer.connect(this.HOST_ID, { reliable: true });
            this.hostConnection = conn;
            
            conn.on('open', () => {
                console.log('[MP] Connected to host!');
                this.connected = true;
                this.reconnectAttempts = 0;
                this._updateStatus('connected', 'Connected!');
                
                // Send our info to host
                this._send(conn, {
                    type: 'join',
                    name: this.playerName,
                    id: this.myId
                });
                
                // Start heartbeat to detect if host dies silently
                this._lastHostPong = Date.now();
                this._startHeartbeat();
            });
            
            conn.on('data', (data) => {
                this._handleMessage(data, conn);
            });
            
            conn.on('close', () => {
                console.log('[MP] Lost connection to host');
                this.connected = false;
                this.hostConnection = null;
                
                // Notify about all remote players leaving
                for (const pid in this.remotePlayers) {
                    if (this.onPlayerLeave) {
                        this.onPlayerLeave(pid, this.remotePlayers[pid].name || 'Unknown');
                    }
                }
                this.remotePlayers = {};
                
                this._updateStatus('disconnected', 'Host disconnected');
                
                // Try to become the new host with a longer random delay
                // Use a wider jitter range to reduce race conditions
                if (!this.destroyed) {
                    const delay = 2000 + Math.random() * 5000; // 2-7 seconds random delay
                    console.log('[MP] Will attempt host takeover in', Math.round(delay), 'ms');
                    setTimeout(() => {
                        if (this.destroyed) return;
                        if (this.peer) {
                            try { this.peer.destroy(); } catch(e) {}
                            this.peer = null;
                        }
                        this._isReconnecting = false; // Reset guard before attempting
                        this._tryBecomeHost();
                    }, delay);
                }
            });
            
            conn.on('error', (err) => {
                console.error('[MP] Connection to host error:', err);
            });
        });
        
        this.peer.on('error', (err) => {
            this._isReconnecting = false;
            console.error('[MP] Client peer error:', err.type, err);
            
            if (err.type === 'peer-unavailable') {
                // Host doesn't exist anymore - try to become host
                this._updateStatus('disconnected', 'No host found');
                if (this.peer) {
                    try { this.peer.destroy(); } catch(e) {}
                    this.peer = null;
                }
                // Longer delay with jitter for host takeover
                const delay = 2000 + Math.random() * 5000;
                console.log('[MP] No host found, will try to become host in', Math.round(delay), 'ms');
                setTimeout(() => {
                    if (this.destroyed) return;
                    this._tryBecomeHost();
                }, delay);
            } else {
                this._scheduleReconnect();
            }
        });
        
        this.peer.on('disconnected', () => {
            if (this.destroyed) return;
            console.log('[MP] Client disconnected from signaling server');
            
            // WebRTC data channels survive signaling disconnections!
            // Only need signaling for NEW connections, existing ones keep working
            // Try to reconnect to signaling without destroying data channels
            this._trySignalingReconnect();
        });
    }
    
    // Try to reconnect to the signaling server without destroying the peer
    // This preserves existing WebRTC data channels
    _trySignalingReconnect() {
        if (this.destroyed) return;
        if (!this.peer) return;
        
        this._signalingReconnectAttempts++;
        
        if (this._signalingReconnectAttempts <= this.MAX_SIGNALING_RECONNECTS) {
            // Try gentle reconnect - preserves existing data channels
            console.log(`[MP] Attempting signaling reconnect (${this._signalingReconnectAttempts}/${this.MAX_SIGNALING_RECONNECTS})...`);
            this._updateStatus('reconnecting', `Reconnecting to signaling (${this._signalingReconnectAttempts})...`);
            
            try {
                this.peer.reconnect();
            } catch(e) {
                console.error('[MP] Reconnect failed:', e);
                // If reconnect() throws, fall through to full reconnect
                this._signalingReconnectAttempts = this.MAX_SIGNALING_RECONNECTS + 1;
                this._scheduleReconnect();
            }
        } else {
            // Gentle reconnect exhausted - do a full reconnect
            console.log('[MP] Signaling reconnect attempts exhausted, doing full reconnect...');
            this._signalingReconnectAttempts = 0;
            this._scheduleReconnect();
        }
    }
    
    // Host: handle a new client connecting
    _handleNewClient(conn) {
        console.log('[MP] New client connecting:', conn.peer);
        
        conn.on('open', () => {
            // Check for duplicate connections from same peer
            if (this.clientConnections[conn.peer]) {
                console.log('[MP] Duplicate connection from', conn.peer, '- closing old one');
                try { this.clientConnections[conn.peer].close(); } catch(e) {}
            }
            
            this.clientConnections[conn.peer] = conn;
            console.log('[MP] Client connected:', conn.peer);
            
            // Initialize heartbeat tracking for this client
            this._lastPongReceived[conn.peer] = Date.now();
            
            // Send existing player list to new client
            const playerList = {};
            for (const pid in this.remotePlayers) {
                playerList[pid] = {
                    name: this.remotePlayers[pid].name,
                    position: this.remotePlayers[pid].position,
                    rotation: this.remotePlayers[pid].rotation,
                    health: this.remotePlayers[pid].health
                };
            }
            
            this._send(conn, {
                type: 'welcome',
                players: playerList,
                blockChanges: this.blockChanges,
                hostName: this.playerName
            });
            
            this._updateStatus('host', `Hosting (${Object.keys(this.clientConnections).length} players)`);
        });
        
        conn.on('data', (data) => {
            this._handleMessage(data, conn);
        });
        
        conn.on('close', () => {
            console.log('[MP] Client disconnected:', conn.peer);
            delete this.clientConnections[conn.peer];
            delete this._lastPongReceived[conn.peer];
            
            // Notify other clients
            const playerName = this.remotePlayers[conn.peer] ? this.remotePlayers[conn.peer].name : 'Unknown';
            delete this.remotePlayers[conn.peer];
            
            if (this.onPlayerLeave) {
                this.onPlayerLeave(conn.peer, playerName);
            }
            
            this._broadcastFromHost({
                type: 'player_leave',
                id: conn.peer
            }, conn.peer);
            
            this._updateStatus('host', `Hosting (${Object.keys(this.clientConnections).length} players)`);
        });
        
        conn.on('error', (err) => {
            console.error('[MP] Client connection error:', conn.peer, err);
            // Clean up the failed connection
            if (this.clientConnections[conn.peer] === conn) {
                delete this.clientConnections[conn.peer];
                const playerName = this.remotePlayers[conn.peer] ? this.remotePlayers[conn.peer].name : 'Unknown';
                delete this.remotePlayers[conn.peer];
                if (this.onPlayerLeave) {
                    this.onPlayerLeave(conn.peer, playerName);
                }
                this._broadcastFromHost({
                    type: 'player_leave',
                    id: conn.peer
                }, conn.peer);
                this._updateStatus('host', `Hosting (${Object.keys(this.clientConnections).length} players)`);
            }
        });
    }
    
    // Handle incoming messages
    _handleMessage(data, fromConn) {
        if (!data || !data.type) return;
        
        try {
            switch (data.type) {
                case 'join':
                    // A new player joined (host receives this)
                    if (this.isHost) {
                        this.remotePlayers[data.id] = {
                            name: data.name,
                            position: { x: 0, y: 30, z: 0 },
                            rotation: { x: 0, y: 0 },
                            health: 20,
                            driving: false,
                            glockEquipped: false,
                            lastUpdate: Date.now()
                        };
                        
                        if (this.onPlayerJoin) {
                            this.onPlayerJoin(data.id, data.name);
                        }
                        
                        // Tell all other clients about the new player
                        this._broadcastFromHost({
                            type: 'player_join',
                            id: data.id,
                            name: data.name
                        }, data.id);
                    }
                    break;
                    
                case 'welcome':
                    // Client receives welcome from host with existing players
                    if (!this.isHost) {
                        // Add host as a remote player
                        // lastUpdate is 0 until host actually sends position data
                        // This prevents phantom player count from stale hosts
                        this.remotePlayers[this.HOST_ID] = {
                            name: data.hostName || 'Host',
                            position: { x: 0, y: 30, z: 0 },
                            rotation: { x: 0, y: 0 },
                            health: 20,
                            driving: false,
                            glockEquipped: false,
                            lastUpdate: 0
                        };
                        
                        // Add existing players
                        for (const pid in data.players) {
                            this.remotePlayers[pid] = {
                                ...data.players[pid],
                                lastUpdate: Date.now()
                            };
                            if (this.onPlayerJoin) {
                                this.onPlayerJoin(pid, data.players[pid].name);
                            }
                        }
                        
                        if (this.onPlayerJoin) {
                            this.onPlayerJoin(this.HOST_ID, data.hostName || 'Host');
                        }
                        
                        // Apply block changes
                        if (data.blockChanges && this.onBlockChange) {
                            for (const change of data.blockChanges) {
                                this.onBlockChange(change.x, change.y, change.z, change.blockType);
                            }
                        }
                    }
                    break;
                    
                case 'player_join':
                    // Another player joined (clients receive this from host)
                    if (!this.isHost && data.id !== this.myId) {
                        this.remotePlayers[data.id] = {
                            name: data.name,
                            position: { x: 0, y: 30, z: 0 },
                            rotation: { x: 0, y: 0 },
                            health: 20,
                            driving: false,
                            glockEquipped: false,
                            lastUpdate: Date.now()
                        };
                        if (this.onPlayerJoin) {
                            this.onPlayerJoin(data.id, data.name);
                        }
                    }
                    break;
                    
                case 'player_leave':
                    if (data.id !== this.myId) {
                        const name = this.remotePlayers[data.id] ? this.remotePlayers[data.id].name : 'Unknown';
                        delete this.remotePlayers[data.id];
                        if (this.onPlayerLeave) {
                            this.onPlayerLeave(data.id, name);
                        }
                    }
                    break;
                    
                case 'position':
                    // Player position update
                    const senderId = this.isHost ? fromConn.peer : data.id;
                    if (senderId === this.myId) break;
                    
                    if (!this.remotePlayers[senderId]) {
                        this.remotePlayers[senderId] = {
                            name: data.name || 'Unknown',
                            position: data.position,
                            rotation: data.rotation,
                            health: data.health || 20,
                            driving: data.driving || false,
                            glockEquipped: data.glockEquipped || false,
                            lastUpdate: Date.now()
                        };
                    } else {
                        // Store previous position for interpolation
                        const rp = this.remotePlayers[senderId];
                        rp.prevPosition = rp.position ? { ...rp.position } : data.position;
                        rp.prevRotation = rp.rotation ? { ...rp.rotation } : data.rotation;
                        rp.position = data.position;
                        rp.rotation = data.rotation;
                        rp.health = data.health || rp.health;
                        rp.driving = data.driving || false;
                        rp.glockEquipped = data.glockEquipped || false;
                        if (data.name) rp.name = data.name;
                        rp.lastUpdate = Date.now();
                        rp.interpT = 0; // Reset interpolation
                    }
                    
                    if (this.onPlayerUpdate) {
                        this.onPlayerUpdate(senderId, this.remotePlayers[senderId]);
                    }
                    
                    // Host relays position to other clients
                    if (this.isHost) {
                        this._broadcastFromHost({
                            type: 'position',
                            id: senderId,
                            name: data.name,
                            position: data.position,
                            rotation: data.rotation,
                            health: data.health,
                            driving: data.driving,
                            glockEquipped: data.glockEquipped
                        }, senderId);
                    }
                    break;
                    
                case 'block_change':
                    // Block was broken/placed
                    if (this.isHost) {
                        // Store and relay
                        this.blockChanges.push({
                            x: data.x, y: data.y, z: data.z,
                            blockType: data.blockType,
                            timestamp: Date.now()
                        });
                        if (this.blockChanges.length > this.MAX_BLOCK_HISTORY) {
                            this.blockChanges.shift();
                        }
                        this._broadcastFromHost({
                            type: 'block_change',
                            x: data.x, y: data.y, z: data.z,
                            blockType: data.blockType
                        }, fromConn.peer);
                    }
                    
                    if (this.onBlockChange) {
                        this.onBlockChange(data.x, data.y, data.z, data.blockType);
                    }
                    break;
                    
                case 'ping':
                    // Respond to ping with pong
                    if (this.isHost) {
                        // Host received ping from client - respond directly
                        this._send(fromConn, { type: 'pong' });
                    } else {
                        // Client received ping from host - respond
                        this._send(this.hostConnection, { type: 'pong' });
                    }
                    break;
                    
                case 'pong':
                    // Received pong response
                    if (this.isHost) {
                        // Host received pong from a client
                        this._lastPongReceived[fromConn.peer] = Date.now();
                    } else {
                        // Client received pong from host
                        this._lastHostPong = Date.now();
                    }
                    break;
                    
                case 'chat':
                    // Future: chat messages
                    break;
                    
                case 'shoot':
                    // Player shot their glock (visual only for others)
                    const shooterId = this.isHost ? fromConn.peer : data.id;
                    if (shooterId === this.myId) break;
                    
                    if (this.remotePlayers[shooterId]) {
                        this.remotePlayers[shooterId].shooting = true;
                        this.remotePlayers[shooterId].shootTime = Date.now();
                    }
                    
                    if (this.isHost) {
                        this._broadcastFromHost({
                            type: 'shoot',
                            id: shooterId
                        }, shooterId);
                    }
                    break;
            }
        } catch (e) {
            console.error('[MP] Error handling message:', data.type, e);
        }
    }
    
    // Send data to a specific connection
    _send(conn, data) {
        try {
            if (!conn || !conn.open) return;
            
            // Check if the underlying data channel is actually usable
            // PeerJS conn.open can be true while the RTCDataChannel is closing
            if (conn.dataChannel && conn.dataChannel.readyState !== 'open') return;
            
            conn.send(data);
        } catch (e) {
            // Don't log ping/pong errors to avoid console spam
            if (data && data.type !== 'ping' && data.type !== 'pong') {
                console.error('[MP] Send error:', e);
            }
            
            // If send fails, the connection is likely dead
            // Mark it for cleanup on next heartbeat cycle
            if (this.isHost && conn.peer && this.clientConnections[conn.peer] === conn) {
                // Set lastPong to 0 so heartbeat will clean it up
                this._lastPongReceived[conn.peer] = 0;
            }
        }
    }
    
    // Host broadcasts to all clients except excludeId
    _broadcastFromHost(data, excludeId) {
        if (!this.isHost) return;
        for (const pid in this.clientConnections) {
            if (pid !== excludeId) {
                this._send(this.clientConnections[pid], data);
            }
        }
    }
    
    // Send to host (client) or broadcast (host)
    broadcast(data) {
        if (this.isHost) {
            this._broadcastFromHost(data);
        } else if (this.hostConnection && this.hostConnection.open) {
            this._send(this.hostConnection, data);
        }
    }
    
    // Broadcast local player position (throttled)
    broadcastPosition(position, rotation, health, driving, glockEquipped) {
        const now = Date.now();
        if (now - this.lastPositionBroadcast < this.POSITION_BROADCAST_INTERVAL) return;
        this.lastPositionBroadcast = now;
        
        this.broadcast({
            type: 'position',
            id: this.myId,
            name: this.playerName,
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { x: rotation.x, y: rotation.y },
            health: health,
            driving: driving,
            glockEquipped: glockEquipped
        });
    }
    
    // Broadcast a block change
    broadcastBlockChange(x, y, z, blockType) {
        const data = { type: 'block_change', x, y, z, blockType };
        
        if (this.isHost) {
            // Store locally
            this.blockChanges.push({ x, y, z, blockType, timestamp: Date.now() });
            if (this.blockChanges.length > this.MAX_BLOCK_HISTORY) {
                this.blockChanges.shift();
            }
        }
        
        this.broadcast(data);
    }
    
    // Broadcast that we shot
    broadcastShoot() {
        this.broadcast({ type: 'shoot', id: this.myId });
    }
    
    // Get player count (including self) - only counts players with recent updates
    getPlayerCount() {
        const now = Date.now();
        let count = 1; // Self
        for (const pid in this.remotePlayers) {
            const rp = this.remotePlayers[pid];
            // Only count players that have sent a position update in the last 30 seconds
            if (rp.lastUpdate && (now - rp.lastUpdate) < 30000) {
                count++;
            }
        }
        return count;
    }
    
    // Get all remote player data (only active players)
    getRemotePlayers() {
        return this.remotePlayers;
    }
    
    // Check if a remote player is active (has recent updates)
    isPlayerActive(peerId) {
        const rp = this.remotePlayers[peerId];
        if (!rp) return false;
        if (!rp.lastUpdate) return false;
        return (Date.now() - rp.lastUpdate) < 30000;
    }
    
    _updateStatus(state, message) {
        if (this.onConnectionStatus) {
            this.onConnectionStatus(state, message);
        }
    }
    
    _scheduleReconnect() {
        if (this.destroyed) return;
        if (this.reconnectTimer) return; // Already scheduled
        
        this.reconnectAttempts++;
        if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
            this._updateStatus('error', 'Could not connect after ' + this.MAX_RECONNECT_ATTEMPTS + ' attempts');
            // Reset and try again after a long delay
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.reconnectAttempts = 0;
                this._isReconnecting = false;
                if (this.peer) {
                    try { this.peer.destroy(); } catch(e) {}
                    this.peer = null;
                }
                this._tryBecomeHost();
            }, 30000); // Wait 30 seconds before trying again
            return;
        }
        
        // Exponential backoff with jitter
        const baseDelay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts - 1), 15000);
        const jitter = Math.random() * 2000;
        const delay = baseDelay + jitter;
        
        this._updateStatus('reconnecting', `Reconnecting (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        console.log(`[MP] Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._isReconnecting = false; // Reset guard
            if (this.peer) {
                try { this.peer.destroy(); } catch(e) {}
                this.peer = null;
            }
            this._tryBecomeHost();
        }, delay);
    }
    
    // Start heartbeat system - sends pings and checks for dead connections
    _startHeartbeat() {
        this._stopHeartbeat(); // Clear any existing heartbeat
        
        console.log('[MP] Starting heartbeat system');
        
        this._heartbeatInterval = setInterval(() => {
            if (this.destroyed) {
                this._stopHeartbeat();
                return;
            }
            
            const now = Date.now();
            
            if (this.isHost) {
                // Host: ping all clients and check for dead ones
                for (const pid in this.clientConnections) {
                    this._send(this.clientConnections[pid], { type: 'ping' });
                    
                    // Check if client has timed out
                    const lastPong = this._lastPongReceived[pid];
                    if (lastPong && (now - lastPong) > this.HEARTBEAT_TIMEOUT) {
                        console.log('[MP] Client', pid, 'timed out (no pong for', Math.round((now - lastPong) / 1000), 's)');
                        // Force close the dead connection
                        try { this.clientConnections[pid].close(); } catch(e) {}
                        delete this.clientConnections[pid];
                        delete this._lastPongReceived[pid];
                        
                        const playerName = this.remotePlayers[pid] ? this.remotePlayers[pid].name : 'Unknown';
                        delete this.remotePlayers[pid];
                        
                        if (this.onPlayerLeave) {
                            this.onPlayerLeave(pid, playerName);
                        }
                        this._broadcastFromHost({ type: 'player_leave', id: pid }, pid);
                        this._updateStatus('host', `Hosting (${Object.keys(this.clientConnections).length} players)`);
                    }
                }
            } else if (this.connected && this.hostConnection) {
                // Client: ping host and check for timeout
                this._send(this.hostConnection, { type: 'ping' });
                
                if (this._lastHostPong > 0 && (now - this._lastHostPong) > this.HEARTBEAT_TIMEOUT) {
                    console.log('[MP] Host timed out (no pong for', Math.round((now - this._lastHostPong) / 1000), 's)');
                    // Host is dead - trigger reconnection
                    this._lastHostPong = 0;
                    if (this.hostConnection) {
                        try { this.hostConnection.close(); } catch(e) {}
                    }
                    // The conn.on('close') handler will take care of reconnection
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    }
    
    // Stop heartbeat system
    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
        this._lastPongReceived = {};
        this._lastHostPong = 0;
    }
    
    // Clean up
    destroy() {
        this.destroyed = true;
        this._isReconnecting = false;
        this._stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch(e) {}
            this.peer = null;
        }
        this.connected = false;
        this.remotePlayers = {};
        this.clientConnections = {};
    }
}

window.Multiplayer = Multiplayer;
