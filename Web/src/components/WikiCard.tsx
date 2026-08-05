import React from 'react';
import { WikiItem } from '../types';
import { getItemTypeBadgeColor, getDisplayName, parseRelations } from '../utils/textUtils';
import { Globe, Star, ArrowUpRight, Shield, MapPin, Package, User, Scroll } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface WikiCardProps {
  item: WikiItem;
  wikiData: WikiItem[];
  onOpenModal: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onEditItem: (item: WikiItem, e: React.MouseEvent) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
  onSelectTag: (tag: string) => void;
  index: number;
}

export const WikiCard: React.FC<WikiCardProps> = ({
  item,
  wikiData,
  onOpenModal,
  onToggleFavorite,
  onEditItem,
  onDeleteItem,
  onSelectTag,
  index,
}) => {
  const badgeColors = getItemTypeBadgeColor(item.tipo);
  const relations = parseRelations(item, wikiData);
  const worldName = getDisplayName(item.mundo_id, wikiData);

  // Helper: Obtener la imagen propia de la entidad o heredar la del Mundo
  const getCardImage = (item: WikiItem, wikiData: WikiItem[]): string | null => {
    // 1. Si la entidad tiene foto propia, la usa
    if (item.imagenes && item.imagenes.length > 0 && item.imagenes[0]) {
      return item.imagenes[0];
    }
    // 2. Si no tiene foto, busca la foto del Mundo al que pertenece (mundo_id)
    const parentWorld = wikiData.find((w) => w.id === item.mundo_id);
    if (parentWorld && parentWorld.imagenes && parentWorld.imagenes.length > 0 && parentWorld.imagenes[0]) {
      return parentWorld.imagenes[0];
    }
    return null;
  };

  const displayImage = getCardImage(item, wikiData);

  const getCategoryIcon = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (['npc', 'pc', 'personaje'].includes(t)) return <User className="w-3 h-3" />;
    if (t === 'lugar') return <MapPin className="w-3 h-3" />;
    if (t === 'objeto') return <Package className="w-3 h-3" />;
    if (t === 'faccion') return <Shield className="w-3 h-3" />;
    if (t === 'trama') return <Scroll className="w-3 h-3" />;
    return <Globe className="w-3 h-3" />;
  };

  // Excerpt of lore content
  const cleanContent = (item.contenido_lore || '')
    .replace(/#+\s*/g, '')
    .replace(/\*+/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .trim();

  const shortDescription = cleanContent.length > 120 ? cleanContent.slice(0, 120) + '...' : cleanContent;

  return (
    <div
      className="group relative bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/50 hover:-translate-y-1 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col"
    >
      {/* Top Media / Thumbnail */}
      <div
        className="relative w-full h-40 sm:h-44 bg-slate-950 overflow-hidden cursor-pointer"
        onClick={() => {
          onOpenModal(item.id);
          playSound('modal');
        }}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={item.nombre || item.id}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 flex items-center justify-center p-6 text-slate-700 group-hover:text-indigo-400 transition-colors">
            <Globe className="w-14 h-14 sm:w-16 sm:h-16 opacity-30" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent opacity-90" />

        {/* Type Badge */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border backdrop-blur-md ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
          >
            {getCategoryIcon(item.tipo)}
            <span>{(item.tipo || 'entidad').toUpperCase()}</span>
          </span>
        </div>

        {/* Favorite Star Button */}
        <button
          onClick={(e) => onToggleFavorite(item.id, e)}
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 backdrop-blur-md transition-all group-hover:scale-110"
          title={item.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>

        {/* World Chip */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg backdrop-blur-md">
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span className="truncate max-w-[150px] sm:max-w-[180px]">{worldName}</span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-3">
        
        <div>
          {/* Title */}
          <h3
            onClick={() => {
              onOpenModal(item.id);
              playSound('modal');
            }}
            className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors cursor-pointer flex items-center justify-between gap-2"
          >
            <span className="truncate">{item.nombre || item.id}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
          </h3>

          {/* Description Excerpt */}
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2 min-h-[36px]">
            {shortDescription || 'Sin descripción en lore aún.'}
          </p>

          {/* Key Attributes Highlights */}
          {item.detalles && Object.keys(item.detalles).length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/60">
              {Object.entries(item.detalles).slice(0, 2).map(([key, val]) => (
                <div key={key} className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 block truncate">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-medium text-slate-200 block truncate">
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};