
import React, { useState } from 'react';
import { NodeState } from '../types';
import { nodeManager } from '../services/NodeManager';
import { Send, X, Network, Database, Activity, Globe } from 'lucide-react';

interface NodeDetailOverlayProps {
  node: NodeState;
  onClose: () => void;
}

export const NodeDetailOverlay: React.FC<NodeDetailOverlayProps> = ({ node, onClose }) => {
  const [broadcastText, setBroadcastText] = useState('');

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    nodeManager.broadcast(node.id, broadcastText);
    setBroadcastText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-[#121214] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-900/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
              <Network className="text-blue-400 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mono">{node.id}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Atomic Block: #{(Math.random()*1000000).toFixed(0)}
                </span>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-emerald-400">ONLINE</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Col: Network Stats */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3" /> Active Peer Connections ({node.connectedPeers.length}/5)
              </h3>
              <div className="space-y-2">
                {node.connectedPeers.length === 0 ? (
                  <p className="text-sm text-slate-600 italic">No active connections</p>
                ) : (
                  node.connectedPeers.map(peerId => (
                    <div key={peerId} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-800">
                      <span className="text-sm mono text-blue-300">{peerId}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">ESTABLISHED</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Database className="w-3 h-3" /> Routing Table ({node.knownPeers.length} known)
              </h3>
              <div className="flex flex-wrap gap-2">
                {node.knownPeers.map(peerId => (
                  <span key={peerId} className="px-2 py-1 bg-slate-800/50 rounded text-[10px] mono text-slate-400">
                    {peerId}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Right Col: Messaging & Logs */}
          <div className="space-y-6 flex flex-col h-full">
            <section className="flex-1 flex flex-col min-h-0">
               <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Live Log Transmission</h3>
               <div className="flex-1 bg-black rounded-lg border border-slate-800 p-3 overflow-y-auto mono text-[11px] space-y-1 scrollbar-hide">
                  {node.messageLog.length === 0 ? (
                    <div className="text-slate-700">Waiting for activity...</div>
                  ) : (
                    node.messageLog.map((log, i) => (
                      <div key={i} className={`flex gap-2 ${log.type === 'in' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        <span>{log.type === 'in' ? '<<' : '>>'}</span>
                        <span className="break-all">{log.content}</span>
                      </div>
                    ))
                  )}
               </div>
            </section>

            <form onSubmit={handleBroadcast} className="relative mt-auto">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Broadcast atomic transaction payload..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1.5 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
