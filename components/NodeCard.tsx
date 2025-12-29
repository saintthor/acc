
import React from 'react';
import { NodeState } from '../types';

interface NodeCardProps {
  state: NodeState;
  isSelected: boolean;
  onClick: () => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ state, isSelected, onClick }) => {
  const isBroadcasting = Date.now() - state.lastUpdate < 300;
  const connRatio = state.connectedPeers.length / 5;

  return (
    <div
      onClick={onClick}
      className={`
        relative h-20 rounded-lg cursor-pointer transition-all duration-300 transform
        flex flex-col items-center justify-center border-2 overflow-hidden
        ${isSelected ? 'scale-110 z-10 border-blue-500 bg-blue-900/40 shadow-lg shadow-blue-500/20' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'}
      `}
    >
      {isBroadcasting && (
        <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
      )}
      
      <div className="text-[10px] mono text-slate-500 mb-1">{state.id}</div>
      
      <div className="flex gap-0.5 mt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${i < state.connectedPeers.length ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <div className="absolute bottom-1 right-1 text-[8px] mono text-slate-600">
        {state.knownPeers.length}k
      </div>
      
      {state.lastMessage && (
         <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
      )}
    </div>
  );
};
