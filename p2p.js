/**
 * Global Event Bus - 仅用于演示环境中的全网监控
 */
export const NetworkEvents = new EventTarget();

/**
 * RemoteConnector - 真实远端连接器
 * 使用 Gun.js 公共中继实现真正的 P2P 跨网通信。
 */
export class RemoteConnector {
    constructor() {
        this.gun = Gun([
            'https://gun-manhattan.herokuapp.com/gun',
            'https://peer.wall.org/gun'
        ]);
        this.lobby = this.gun.get('atomic_mesh_v2_lobby');
        this.nodes = this.gun.get('atomic_mesh_v2_nodes');
    }

    register(id, callback) {
        this.nodes.get(id).on((data) => {
            if (data && data.from && data.payload) {
                callback(data.from, data.payload);
            }
        });
        this.announce(id);
        setInterval(() => this.announce(id), 10000);
    }

    announce(id) {
        this.lobby.get(id).put(Date.now());
    }

    onDiscovery(callback) {
        this.lobby.map().on((time, id) => {
            if (Date.now() - time < 30000) {
                callback(id);
            }
        });
    }

    async send(from, to, payload) {
        this.nodes.get(to).put({
            from,
            payload: JSON.stringify(payload),
            ts: Date.now()
        });
    }
}

/**
 * P2PNode - 原子所有权节点逻辑
 */
export class P2PNode {
    constructor(id, connector, uiUpdate) {
        this.id = id;
        this.connector = connector;
        this.uiUpdate = uiUpdate;

        this.peers = new Set();      
        this.knownNodes = new Set(); 
        this.history = new Set();    
        this.logs = [];
        this.msgCount = 0; // 收到消息的计数

        this.connector.register(id, (sender, raw) => this._onReceive(sender, raw));
        this.connector.onDiscovery((foundId) => {
            if (foundId !== this.id) this.knownNodes.add(foundId);
        });
    }

    log(msg, type = 'info') {
        const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        this.logs.unshift({ t, msg, type });
        if (this.logs.length > 40) this.logs.pop();
        
        // 发送全网全局事件
        NetworkEvents.dispatchEvent(new CustomEvent('node-log', {
            detail: { nodeId: this.id, t, msg, type }
        }));

        this.uiUpdate(this);
    }

    _onReceive(sender, raw) {
        const data = JSON.parse(raw);

        if (data.type === 'GOSSIP') {
            data.known.forEach(n => { if (n !== this.id) this.knownNodes.add(n); });
            if (this.peers.size < 2 && !this.peers.has(sender)) this.connect(sender);
        } 
        else if (data.type === 'TX') {
            if (this.history.has(data.mid)) return;
            this.history.add(data.mid);
            this.msgCount++; // 计数增加

            this.log(`Received Atomic TX: "${data.content}"`, 'in');
            this.uiUpdate(this, true); 

            this.relay(data);
        }
    }

    connect(peerId) {
        if (this.peers.size >= 5 || peerId === this.id) return;
        this.peers.add(peerId);
        this.log(`Linked to ${peerId}`, 'info');
        this.uiUpdate(this);
    }

    disconnect(peerId) {
        if (this.peers.delete(peerId)) {
            this.log(`Link to ${peerId} dropped`, 'info');
            this.uiUpdate(this);
        }
    }

    broadcast(content) {
        const mid = Math.random().toString(36).substring(7);
        const data = { type: 'TX', mid, content, origin: this.id };
        this.history.add(mid);
        this.log(`Broadcasting: ${content}`, 'out');
        this.relay(data);
    }

    relay(data) {
        this.peers.forEach(p => {
            this.connector.send(this.id, p, data);
        });
    }

    tick() {
        if (Math.random() < 0.03 && this.peers.size > 2) {
            const arr = Array.from(this.peers);
            this.disconnect(arr[Math.floor(Math.random() * arr.length)]);
        }
        if (this.peers.size < 3 && this.knownNodes.size > 0) {
            const potential = Array.from(this.knownNodes).filter(n => !this.peers.has(n));
            if (potential.length > 0) {
                this.connect(potential[Math.floor(Math.random() * potential.length)]);
            }
        }
        if (this.peers.size > 0) {
            const target = Array.from(this.peers)[Math.floor(Math.random() * this.peers.size)];
            this.connector.send(this.id, target, {
                type: 'GOSSIP',
                known: Array.from(this.knownNodes).slice(0, 10)
            });
        }
    }
}