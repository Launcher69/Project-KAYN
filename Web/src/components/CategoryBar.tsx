import React from 'react';
import { CategoryType, FilterState, WikiItem } from '../types';
import { User, MapPin, Package, Shield, Scroll, Globe, Layers, Tag, X } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface CategoryBarProps {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  items: WikiItem[];
}

export const CategoryBar: React.FC<CategoryBarProps> = ({ filter, setFilter, items }) => {
  const categories: { type: CategoryType; label: string; icon: React.ReactNode }[] = [
    { type: 'todos', label: 'Todos', icon: <Layers className="w-3.5 h-3.5" /> },
    { type: 'npc', label: 'Personajes', icon: <User className="w-3.5 h-3.5" /> },
    { type: 'lugar', label: 'Lugares', icon: <MapPin className="w-3.5 h-3.5" /> },
    { type: 'objeto', label: 'Objetos', icon: <Package className="w-3.5 h-3.5" /> },
    { type: 'faccion', label: 'Facciones', icon: <Shield className="w-3.5 h-3.5" /> },
    { type: 'trama', label: 'Tramas', icon: <Scroll className="w-3.5 h-3.5" /> },
    { type: 'mundo', label: 'Mundos', icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  const getItemCountForCategory = (cat: CategoryType) => {
    if (cat === 'todos') return items.length;
    return items.filter((item) => {
      const type = (item.tipo || 'entidad').toLowerCase();
      if (cat === 'npc') return ['npc', 'pc', 'personaje'].includes(type);
      return type === cat;
    }).length;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
      <div className="flex items-center justify-between gap-2.5 bg-slate-900/60 p-1.5 sm:p-2 rounded-2xl border border-slate-800/80 backdrop-blur-md overflow-hidden">
        
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-0.5 px-0.5">
          {categories.map((cat) => {
            const isActive = filter.category === cat.type;
            const count = getItemCountForCategory(cat.type);

            return (
              <button
                key={cat.type}
                onClick={() => {
                  setFilter((prev) => ({ ...prev, category: cat.type }));
                  playSound('click');
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Tag or Filter Notice */}
        {filter.tag && (
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-xl text-xs text-indigo-300 shrink-0">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate max-w-[120px] sm:max-w-none">Etiqueta: <strong>{filter.tag}</strong></span>
            <button
              onClick={() => {
                setFilter((prev) => ({ ...prev, tag: '' }));
                playSound('click');
              }}
              className="text-indigo-400 hover:text-indigo-200 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
