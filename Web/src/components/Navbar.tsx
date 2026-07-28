import React from 'react';
import {
  LayoutGrid,
  Share2,
  GitCommit,
  Table,
  Star,
  Globe,
  Search,
  X,
} from 'lucide-react';
import { ViewMode, FilterState } from '../types';
import { playSound } from '../utils/soundEffects';

interface NavbarProps {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  worlds: string[];
  getWorldDisplayName: (worldId: string) => string;
  onOpenNewItem?: () => void;
  totalCount: number;
  filteredCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  filter,
  setFilter,
  viewMode,
  setViewMode,
  worlds,
  getWorldDisplayName,
  totalCount,
  filteredCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-2.5 sm:gap-4">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div
            className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer"
            onClick={() => {
              setFilter(prev => ({ ...prev, search: '', category: 'todos', world: 'all', tag: '' }));
              playSound('click');
            }}
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center text-indigo-400 group-hover:text-cyan-300 transition-colors">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-slate-100 via-indigo-200 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
                Multiverse Wiki
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="text-cyan-400 font-mono">{filteredCount}/{totalCount} entidades</span>
              </p>
            </div>
          </div>
        </div>

        {/* Search & World Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto flex-1 max-w-2xl">
          {/* Search Box */}
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar por nombre, tipo, etiqueta o lore..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
            {filter.search && (
              <button
                onClick={() => setFilter(prev => ({ ...prev, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* World Selector */}
          <div className="relative w-full sm:w-auto sm:min-w-[170px] shrink-0">
            <select
              value={filter.world}
              onChange={(e) => {
                setFilter(prev => ({ ...prev, world: e.target.value }));
                playSound('click');
              }}
              className="w-full appearance-none bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 pr-8 text-xs font-medium text-indigo-300 cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all truncate"
            >
              <option value="all">🌍 Todos los Mundos</option>
              {worlds.map((w) => (
                <option key={w} value={w}>
                  🌌 {getWorldDisplayName(w)}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end overflow-x-auto no-scrollbar pb-0.5 lg:pb-0 shrink-0">
          
          {/* View Toggles */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 shrink-0">
            <button
              onClick={() => { setViewMode('cards'); playSound('click'); }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="Vista en Tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="inline">Fichas</span>
            </button>

            <button
              onClick={() => { setViewMode('graph'); playSound('click'); }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'graph'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="Vista en Grafo Interactivo"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="inline">Grafo</span>
            </button>

            <button
              onClick={() => { setViewMode('timeline'); playSound('click'); }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'timeline'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="Línea Temporal de Tramas"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span className="inline">Tramas</span>
            </button>

            <button
              onClick={() => { setViewMode('table'); playSound('click'); }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="Vista en Tabla"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="inline">Tabla</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Favorites Toggle Button */}
            <button
              onClick={() => {
                setFilter(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }));
                playSound('click');
              }}
              className={`p-2 rounded-xl border text-xs font-medium transition-all ${
                filter.favoritesOnly
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
              }`}
              title="Mostrar solo favoritos"
            >
              <Star className={`w-4 h-4 ${filter.favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

          </div>

        </div>

      </div>
    </header>
  );
};
