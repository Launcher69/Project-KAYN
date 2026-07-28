import React from 'react';
import { WikiItem } from '../types';
import { Globe, Users, Network, Scroll } from 'lucide-react';

interface StatsOverviewProps {
  items: WikiItem[];
  getWorldDisplayName: (worldId: string) => string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ items }) => {
  const worlds = [...new Set(items.map((i) => i.mundo_id).filter(Boolean))];
  const characters = items.filter((i) => ['npc', 'pc', 'personaje'].includes((i.tipo || '').toLowerCase())).length;
  const plots = items.filter((i) => (i.tipo || '').toLowerCase() === 'trama').length;

  let totalConnections = 0;
  items.forEach((item) => {
    if (Array.isArray(item.relaciones)) {
      totalConnections += item.relaciones.length;
    } else if (item.relaciones && typeof item.relaciones === 'object') {
      Object.values(item.relaciones).forEach((val) => {
        if (Array.isArray(val)) totalConnections += val.length;
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2 mb-1 sm:mb-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 backdrop-blur-sm hover:border-slate-700/80 transition-all">
          <div className="p-2 sm:p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Mundos</p>
            <p className="text-sm sm:text-base font-bold text-slate-100 font-mono">{worlds.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 backdrop-blur-sm hover:border-slate-700/80 transition-all">
          <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Personajes</p>
            <p className="text-sm sm:text-base font-bold text-slate-100 font-mono">{characters}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 backdrop-blur-sm hover:border-slate-700/80 transition-all">
          <div className="p-2 sm:p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Vínculos</p>
            <p className="text-sm sm:text-base font-bold text-slate-100 font-mono">{totalConnections}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 backdrop-blur-sm hover:border-slate-700/80 transition-all">
          <div className="p-2 sm:p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Scroll className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Arcos Trama</p>
            <p className="text-sm sm:text-base font-bold text-slate-100 font-mono">{plots}</p>
          </div>
        </div>

      </div>
    </div>
  );
};
