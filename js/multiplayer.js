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
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.destroyed = false;
    }
    
    // Initialize multiplayer - tries to be host, falls back to client
    init(playerName) {
        this.playerName = playerName || 'Player';
        this.destroyed = false;
        
        // Try to claim the host ID first
        this._tryBecomeHost();
    }
    
    _tryBecomeHost() {
        if (this.destroyed) return;
        
        console.log('[MP] Trying to become host...');
        this._updateStatus('connecting', 'Trying to host...');
        
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
            this._updateStatus('host', 'Hosting (waiting for players...)');
            
            // Listen for incoming connections
            this.peer.on('connection', (conn) => {
                this._handleNewClient(conn);
            });
        });
        
        this.peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                // Host already exists - become a client
                console.log('[MP] Host exists, joining as client...');
                this.peer.destroy();
                this.peer = null;
                this._joinAsClient();
            } else if (err.type === 'peer-unavailable') {
                // Host went away while trying to connect
                console.log('[MP] Host unavailable, retrying...');
                this._scheduleReconnect();
            } else {
                console.error('[MP] Peer error:', err);
                this._updateStatus('error', 'Connection error');
                this._scheduleReconnect();
            }
        });
        
        this.peer.on('disconnected', () => {
            if (!this.destroyed) {
                console.log('[MP] Disconnected from signaling server');
                this._scheduleReconnect();
            }
        });
    }
    
    _joinAsClient() {
        if (this.destroyed) return;
        
        console.log('[MP] Joining as client...');
        this._updateStatus('connecting', 'Connecting to world...');
        
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
            });
            
            conn.on('data', (data) => {
                this._handleMessage(data, conn);
            });
            
            conn.on('close', () => {
                console.log('[MP] Lost connection to host');
                this.connected = false;
                this.hostConnection = null;
                this.remotePlayers = {};
                this._updateStatus('disconnected', 'Host disconnected');
                // Try to become the new host
                if (!this.destroyed) {
                    setTimeout(() => {
                        if (this.peer) {
                            this.peer.destroy();
                            this.peer = null;
                        }
                        this._tryBecomeHost();
                    }, 1000 + Math.random() * 2000); // Random delay to avoid race
                }
            });
            
            conn.on('error', (err) => {
                console.error('[MP] Connection error:', err);
            });
        });
        
        this.peer.on('error', (err) => {
            console.error('[MP] Client peer error:', err);
            if (err.type === 'peer-unavailable') {
                // Host doesn't exist anymore
                this._updateStatus('disconnected', 'No host found');
                if (this.peer) {
                    this.peer.destroy();
                    this.peer = null;
                }
                setTimeout(() => this._tryBecomeHost(), 1000 + Math.random() * 2000);
            } else {
                this._scheduleReconnect();
            }
        });
        
        this.peer.on('disconnected', () => {
            if (!this.destroyed) {
                this._scheduleReconnect();
            }
        });
    }
    
    // Host: handle a new client connecting
    _handleNewClient(conn) {
        console.log('[MP] New client connecting:', conn.peer);
        
        conn.on('open', () => {
            this.clientConnections[conn.peer] = conn;
            console.log('[MP] Client connected:', conn.peer);
            
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
    }
    
    // Handle incoming messages
    _handleMessage(data, fromConn) {
        if (!data || !data.type) return;
        
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
                    this.remotePlayers[this.HOST_ID] = {
                        name: data.hostName || 'Host',
                        position: { x: 0, y: 30, z: 0 },
                        rotation: { x: 0, y: 0 },
                        health: 20,
                        driving: false,
                        glockEquipped: false,
                        lastUpdate: Date.now()
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
    }
    
    // Send data to a specific connection
    _send(conn, data) {
        try {
            if (conn && conn.open) {
                conn.send(data);
            }
        } catch (e) {
            console.error('[MP] Send error:', e);
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
    
    // Get player count (including self)
    getPlayerCount() {
        return Object.keys(this.remotePlayers).length + 1;
    }
    
    // Get all remote player data
    getRemotePlayers() {
        return this.remotePlayers;
    }
    
    _updateStatus(state, message) {
        if (this.onConnectionStatus) {
            this.onConnectionStatus(state, message);
        }
    }
    
    _scheduleReconnect() {
        if (this.destroyed) return;
        if (this.reconnectTimer) return;
        
        this.reconnectAttempts++;
        if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
            this._updateStatus('error', 'Could not connect');
            return;
        }
        
        const delay = Math.min(2000 * this.reconnectAttempts, 10000);
        this._updateStatus('reconnecting', `Reconnecting (${this.reconnectAttempts})...`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this._tryBecomeHost();
        }, delay);
    }
    
    // Clean up
    destroy() {
        this.destroyed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connected = false;
        this.remotePlayers = {};
        this.clientConnections = {};
    }
}

window.Multiplayer = Multiplayer;
