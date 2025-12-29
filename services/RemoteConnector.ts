
import { NodeId, P2PMessage } from '../types';

/**
 * The RemoteConnector mimics an external infrastructure (like PeerJS or Ably).
 * It ensures nodes do not have local memory access to each other.
 * All communication is serialized and asynchronous.
 */
class RemoteConnector {
  private handlers: Map<NodeId, (msg: string) => void> = new Map();

  register(nodeId: NodeId, onMessage: (msg: string) => void) {
    this.handlers.set(nodeId, onMessage);
  }

  unregister(nodeId: NodeId) {
    this.handlers.delete(nodeId);
  }

  /**
   * Sends data to a remote node.
   * Simulates network latency and serialization.
   */
  async send(from: NodeId, to: NodeId, message: P2PMessage): Promise<boolean> {
    const handler = this.handlers.get(to);
    if (!handler) return false;

    // Simulate wire delay (50-200ms)
    const delay = Math.random() * 150 + 50;
    
    // Serialize to JSON to ensure no local reference leakage
    const serialized = JSON.stringify(message);

    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          handler(serialized);
          resolve(true);
        } catch (e) {
          console.error(`Failed to deliver to ${to}`, e);
          resolve(false);
        }
      }, delay);
    });
  }
}

export const remoteConnector = new RemoteConnector();
