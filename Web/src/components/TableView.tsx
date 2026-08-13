import React, { useState } from 'react';
import { WikiItem, User } from '../types';
import { getDisplayName, getItemTypeBadgeColor, parseRelations } from '../utils/textUtils';
import { Eye, Star, ArrowUpDown, Edit3, Trash2, Globe, Lock } from 'lucide-react';
import { playSound } from '../utils/soundEffects';
import { canUserEditItem } from '../utils/permissions';

interface TableViewProps {
  items: WikiItem[];
  wikiData: WikiItem[];
  currentUser?: User | null;
  onOpenModal: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onEditItem: (item: WikiItem, e: React.MouseEvent) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
}

export const TableView: React.FC<TableViewProps> = ({
  items,
  wikiData,
  currentUser,
  onOpenModal,
  onToggleFavorite,
  onEditItem,
  onDeleteItem,
}) => {
  const [sortField, setSortField] = useState<'nombre' | 'tipo' | 'mundo_id'>('nombre');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: 'nombre' | 'tipo' | 'mundo_id') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    playSound('click');
  };

  const sortedItems = [...items].sort((a, b) => {
    let valA = (a[sortField] || '').toLowerCase();
    let valB = (b[sortField] || '').toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">⭐</th>
                <th
                  onClick={() => handleSort('nombre')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nombre / ID</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('tipo')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoría</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('mundo_id')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Mundo</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Vínculos</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedItems.map((item) => {
                const badgeColors = getItemTypeBadgeColor(item.tipo);
                const relations = parseRelations(item, wikiData);
                const worldName = getDisplayName(item.mundo_id, wikiData);
                const canEdit = canUserEditItem(currentUser, item, wikiData);

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => onToggleFavorite(item.id, e)}
                        className="text-slate-500 hover:text-amber-400 transition-colors"
                      >
                        <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </td>

                    <td
                      onClick={() => {
                        onOpenModal(item.id);
                        playSound('modal');
                      }}
                      className="py-3 px-4 font-bold text-slate-100 hover:text-cyan-300 cursor-pointer"
                    >
                      {item.nombre || item.id}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
                      >
                        {(item.tipo || 'entidad').toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{worldName}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-indigo-300">{relations.length}</td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            onOpenModal(item.id);
                            playSound('modal');
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Ver Ficha"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canEdit ? (
                          <>
                            <button
                              onClick={(e) => onEditItem(item, e)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => onDeleteItem(item.id, e)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div
                            className="p-1.5 rounded-lg bg-slate-800/40 text-slate-600"
                            title="Solo administradores o usuarios asignados a este mundo pueden modificarlo"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
