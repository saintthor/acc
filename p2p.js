/**
 * Global Event Bus - 用于演示环境中的全网监控
 */
export const NetworkEvents = new EventTarget();

/**
 * RemoteConnector - 全球 P2P 连接器
 * 使用 Gun.js 公共中继实现多页面、多设备间的实时同步。
 */
export class RemoteConnector {
    constructor() {
        this.gun = Gun([
            'https://gun-manhattan.herokuapp.com/gun',
            'https://peer.wall.org/gun'
        ]);
        // 核心命名空间
        this.root = this.gun.get('atomic_mesh_v5_global');
        this.nodesStore = this.root.get('nodes');
        this.messages = this.root.get('messages');
    }

    /**
     * 注册本地节点并监听发往该节点的消息
     */
    register(uuid, callback) {
        this.messages.get(uuid).on((data) => {
            if (data && data.from && data.payload) {
                callback(data.from, data.payload);
            }
        });
        this.announce(uuid);
        setInterval(() => this.announce(uuid), 8000);
    }

    /**
     * 向全网广播该节点在线
     */
    announce(uuid) {
        this.nodesStore.get(uuid).put(Date.now());
    }

    /**
     * 发现全网在线的节点
     */
    onDiscovery(callback) {
        this.nodesStore.map().on((time, uuid) => {
            // 30秒内有更新的视为在线
            if (Date.now() - time < 30000) {
                callback(uuid);
            }
        });
    }

    /**
     * 点对点发送加密/串行化数据
     */
    async send(from, to, payload) {
        this.messages.get(to).put({
            from,
            payload: JSON.stringify(payload),
            ts: Date.now()
        });
    }
}

/**
 * P2PNode - 原子所有权节点逻辑 (基于 UUID)
 */
export class P2PNode {
    constructor(uuid, connector, uiUpdate) {
        this.id = uuid; // 这里的 ID 现在是 UUID
        this.connector = connector;
        this.uiUpdate = uiUpdate;

        this.peers = new Set();      
        this.knownNodes = new Set(); 
        this.history = new Set();    
        this.logs = [];

        this.connector.register(this.id, (sender, raw) => this._onReceive(sender, raw));
        this.connector.onDiscovery((foundId) => {
            if (foundId !== this.id) {
                this.knownNodes.add(foundId);
                this.uiUpdate(this);
            }
        });
    }

    log(msg, type = 'info') {
        const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        this.logs.unshift({ t, msg, type });
        if (this.logs.length > 50) this.logs.pop();
        
        NetworkEvents.dispatchEvent(new CustomEvent('node-log', {
            detail: { nodeId: this.id, t, msg, type }
        }));
        this.uiUpdate(this);
    }

    _onReceive(sender, raw) {
        try {
            const data = JSON.parse(raw);
            if (data.type === 'GOSSIP') {
                data.known.forEach(n => { if (n !== this.id) this.knownNodes.add(n); });
                if (this.peers.size < 3 && !this.peers.has(sender)) this.connect(sender);
            } 
            else if (data.type === 'TX') {
                if (this.history.has(data.mid)) return;
                this.history.add(data.mid);
                this.log(`Global Sync TX: ${data.content}`, 'in');
                this.relay(data);
            }
        } catch(e) {}
    }

    connect(peerId) {
        if (this.peers.size >= 8 || peerId === this.id) return;
        this.peers.add(peerId);
        this.log(`P2P Connection Established with remote peer.`, 'info');
        this.uiUpdate(this);
    }

    broadcast(content) {
        const mid = Math.random().toString(36).substring(7);
        const data = { type: 'TX', mid, content, origin: this.id };
        this.history.add(mid);
        this.log(`Initiating Global Broadcast: ${content}`, 'out');
        this.relay(data);
    }

    relay(data) {
        this.peers.forEach(p => {
            this.connector.send(this.id, p, data);
        });
    }

    tick() {
        // 自动维护连接池
        if (this.peers.size < 2 && this.knownNodes.size > 0) {
            const potential = Array.from(this.knownNodes).filter(n => !this.peers.has(n));
            if (potential.length > 0) {
                this.connect(potential[Math.floor(Math.random() * potential.length)]);
            }
        }
        // 定期 Gossip
        if (this.peers.size > 0) {
            const target = Array.from(this.peers)[Math.floor(Math.random() * this.peers.size)];
            this.connector.send(this.id, target, {
                type: 'GOSSIP',
                known: Array.from(this.knownNodes).slice(0, 10)
            });
        }
    }
}