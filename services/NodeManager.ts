
import { NodeId, NodeState, P2PMessage } from '../types';
import { CONFIG } from '../constants';
import { remoteConnector } from './RemoteConnector';

class NodeManager {
  private nodes: Map<NodeId, NodeState> = new Map();
  private subscribers: ((states: NodeState[]) => void)[] = [];

  constructor() {
    this.initializeNetwork();
    setInterval(() => this.tick(), 2000);
  }

  private initializeNetwork() {
    // Generate 30 unique IDs
    const ids = Array.from({ length: CONFIG.nodeCount }, (_, i) => `node-${String(i + 1).padStart(2, '0')}`);
    
    ids.forEach(id => {
      // Give each node 2-3 random seed IDs from the set (excluding self)
      const seeds = ids
        .filter(seedId => seedId !== id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const initialState: NodeState = {
        id,
        status: 'online',
        connectedPeers: [],
        knownPeers: seeds,
        messageLog: [],
        lastUpdate: Date.now()
      };
      
      this.nodes.set(id, initialState);
      
      // Register with the "remote" connector
      remoteConnector.register(id, (rawMsg) => this.handleRemoteMessage(id, rawMsg));
    });
  }

  private handleRemoteMessage(recipientId: NodeId, rawMsg: string) {
    const msg: P2PMessage = JSON.parse(rawMsg);
    const node = this.nodes.get(recipientId);
    if (!node) return;

    // Deduplication (Basic gossip check)
    const alreadySeen = node.messageLog.some(log => log.content.includes(msg.id));
    if (alreadySeen && msg.type === 'DATA') return;

    // Update log
    this.addLog(recipientId, `Received ${msg.type} from ${msg.sender}`, 'in');

    if (msg.type === 'GOSSIP') {
      // Learn new peers
      const newKnown = Array.from(new Set([...node.knownPeers, ...msg.payload.knownPeers, msg.sender]));
      node.knownPeers = newKnown.filter(p => p !== recipientId);
      
      // If we don't have enough connections, try to connect to the sender
      if (node.connectedPeers.length < CONFIG.maxConnections && !node.connectedPeers.includes(msg.sender)) {
        node.connectedPeers.push(msg.sender);
        this.addLog(recipientId, `Established connection with ${msg.sender}`, 'in');
      }
    } else if (msg.type === 'DATA') {
      node.lastMessage = msg.payload.text;
      this.addLog(recipientId, `Broadcast: ${msg.payload.text} (Hops: ${msg.hopCount}) [ID: ${msg.id}]`, 'in');
      
      // Forward to all neighbors (Flood fill gossip)
      this.forwardMessage(recipientId, msg);
    }

    node.lastUpdate = Date.now();
    this.notify();
  }

  private forwardMessage(fromId: NodeId, msg: P2PMessage) {
    const node = this.nodes.get(fromId);
    if (!node) return;

    const newMsg: P2PMessage = {
      ...msg,
      hopCount: msg.hopCount + 1
    };

    node.connectedPeers.forEach(peerId => {
      // Don't send back to sender
      if (peerId !== msg.sender) {
        remoteConnector.send(fromId, peerId, newMsg);
      }
    });
  }

  broadcast(fromId: NodeId, text: string) {
    const msgId = Math.random().toString(36).substring(7);
    const msg: P2PMessage = {
      id: msgId,
      sender: fromId,
      type: 'DATA',
      payload: { text },
      hopCount: 0
    };

    this.addLog(fromId, `Initiating broadcast: ${text}`, 'out');
    this.forwardMessage(fromId, msg);
    this.notify();
  }

  private tick() {
    this.nodes.forEach((node, id) => {
      // 1. Randomly drop connections
      if (node.connectedPeers.length > 0 && Math.random() < CONFIG.connectionDropChance) {
        const dropIndex = Math.floor(Math.random() * node.connectedPeers.length);
        const dropped = node.connectedPeers.splice(dropIndex, 1)[0];
        this.addLog(id, `Connection to ${dropped} timed out`, 'out');
      }

      // 2. Maintenance: Reconnect if below min
      if (node.connectedPeers.length < CONFIG.minConnections) {
        const potentialPeers = node.knownPeers.filter(p => !node.connectedPeers.includes(p));
        if (potentialPeers.length > 0) {
          const newPeer = potentialPeers[Math.floor(Math.random() * potentialPeers.length)];
          node.connectedPeers.push(newPeer);
          this.addLog(id, `Auto-connecting to known peer ${newPeer}`, 'out');
        }
      }

      // 3. Periodic Gossip (Share known peers)
      if (node.connectedPeers.length > 0) {
        const randomPeer = node.connectedPeers[Math.floor(Math.random() * node.connectedPeers.length)];
        remoteConnector.send(id, randomPeer, {
          id: `gossip-${Date.now()}`,
          sender: id,
          type: 'GOSSIP',
          payload: { knownPeers: node.knownPeers },
          hopCount: 0
        });
      }
    });
    this.notify();
  }

  private addLog(id: NodeId, content: string, type: 'in' | 'out') {
    const node = this.nodes.get(id);
    if (node) {
      node.messageLog.unshift({ timestamp: Date.now(), content, type });
      node.messageLog = node.messageLog.slice(0, 50);
    }
  }

  subscribe(callback: (states: NodeState[]) => void) {
    this.subscribers.push(callback);
    callback(Array.from(this.nodes.values()));
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notify() {
    const states = Array.from(this.nodes.values());
    this.subscribers.forEach(s => s(states));
  }
}

export const nodeManager = new NodeManager();
