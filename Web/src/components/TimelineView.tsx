import React from 'react';
import { WikiItem } from '../types';
import { getDisplayName, parseRelations } from '../utils/textUtils';
import { Scroll, Clock, CheckCircle2, AlertCircle, ArrowRight, User, MapPin, Package, Globe } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface TimelineViewProps {
  items: WikiItem[];
  wikiData: WikiItem[];
  onOpenModal: (id: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ items, wikiData, onOpenModal }) => {
  // Filter tramas
  const tramas = items.filter((i) => (i.tipo || '').toLowerCase() === 'trama');

  if (tramas.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <Scroll className="w-12 h-12 mx-auto mb-3 opacity-30 text-rose-400" />
        <p className="text-base font-medium">No se encontraron arcos de trama con los filtros actuales.</p>
      </div>
    );
  }

  // Group tramas by world
  const tramasByWorld = tramas.reduce<Record<string, WikiItem[]>>((acc, trama) => {
    const wId = trama.mundo_id || 'otros';
    if (!acc[wId]) acc[wId] = [];
    acc[wId].push(trama);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-10">
      {Object.entries(tramasByWorld).map(([worldId, worldTramas]) => {
        const worldName = getDisplayName(worldId, wikiData);

        return (
          <div key={worldId} className="space-y-6">
            
            {/* World Timeline Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">{worldName}</h2>
                <p className="text-xs text-slate-400 font-mono">
                  {worldTramas.length} arcos narrativos registrados
                </p>
              </div>
            </div>

            {/* Timeline Stream */}
            <div className="relative pl-6 md:pl-8 space-y-8 before:absolute before:left-2.5 md:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-rose-500/80 before:via-purple-500/50 before:to-slate-800">
              {worldTramas.map((trama, idx) => {
                const relations = parseRelations(trama, wikiData);
                const status = (trama.detalles?.estado_trama || trama.detalles?.estado || 'En desarrollo') as string;
                const importance = (trama.detalles?.importancia || '') as string;
                const isCompleted = status.toLowerCase().includes('completad') || status.toLowerCase().includes('concluid');

                return (
                  <div key={trama.id} className="relative group">
                    
                    {/* Timeline Node Point */}
                    <div
                      className={`absolute -left-[30px] md:-left-[38px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-slate-950 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-950 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20 animate-pulse'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Trama Card */}
                    <div className="bg-slate-900/80 border border-slate-800/80 hover:border-rose-500/40 rounded-2xl p-5 shadow-xl transition-all duration-300">
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <h3
                            onClick={() => {
                              onOpenModal(trama.id);
                              playSound('modal');
                            }}
                            className="text-base font-bold text-slate-100 hover:text-rose-400 cursor-pointer transition-colors"
                          >
                            {trama.nombre || trama.id}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              isCompleted
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {status}
                          </span>
                          {importance && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {importance}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-300 my-3 leading-relaxed">
                        {trama.contenido_lore?.replace(/#+\s*/g, '') || 'Sin resumen narrativo.'}
                      </p>

                      {/* Connected Elements */}
                      {relations.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-semibold mr-1">Elementos Conectados:</span>
                          {relations.map((rel) => (
                            <button
                              key={rel.targetId}
                              onClick={() => {
                                onOpenModal(rel.targetId);
                                playSound('modal');
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 text-xs transition-all"
                            >
                              <span className="text-slate-500 font-semibold">{rel.label}:</span>
                              <span className="font-medium text-slate-200">{rel.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        );
      })}
    </div>
  );
};
