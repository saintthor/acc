
/**
 * Types and interfaces for the P2P network simulation.
 */

export type NodeId = string;

export interface LogEntry {
  timestamp: number;
  content: string;
  type: 'in' | 'out';
}

export interface NodeState {
  id: NodeId;
  status: 'online' | 'offline';
  connectedPeers: NodeId[];
  knownPeers: NodeId[];
  messageLog: LogEntry[];
  lastUpdate: number;
  lastMessage?: string;
}

export interface P2PMessage {
  id: string;
  sender: NodeId;
  type: 'GOSSIP' | 'DATA';
  payload: {
    knownPeers?: NodeId[];
    text?: string;
  };
  hopCount: number;
}
