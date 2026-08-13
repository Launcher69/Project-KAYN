import React, { useState } from 'react';
import { WikiItem, User } from '../types';
import { X, Plus, Trash2, Save, Sparkles, Image, Tag, FileText, Zap, Award, Lock, Link, Share2, MessageSquare, Search, Check } from 'lucide-react';

import { playSound } from '../utils/soundEffects';
import { formatMagicTextToMarkdown, getDisplayName } from '../utils/textUtils';
import { canUserEditWorld, canUserEditItem } from '../utils/permissions';

interface ItemEditorModalProps {
  itemToEdit: WikiItem | null;
  wikiData: WikiItem[];
  currentUser?: User | null;
  onSave: (newItem: WikiItem) => void;
  onClose: () => void;
}

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  itemToEdit,
  wikiData,
  currentUser,
  onSave,
  onClose,
}) => {
  const isEditing = !!itemToEdit;

  // Check if current user can edit this item or edit in general
  const canEditCurrentItem = isEditing ? canUserEditItem(currentUser, itemToEdit, wikiData) : true;

  const allWorlds = [...new Set(wikiData.map((i) => i.mundo_id).filter(Boolean))];
  const allowedWorlds = allWorlds.filter((w) => canUserEditWorld(currentUser, w));
  const effectiveWorlds = allowedWorlds.length > 0 ? allowedWorlds : allWorlds;

  const [id, setId] = useState<string>(itemToEdit?.id || `entidad_${Date.now()}`);
  const [nombre, setNombre] = useState<string>(itemToEdit?.nombre || '');
  const [tipo, setTipo] = useState<string>(itemToEdit?.tipo || 'npc');
  const [mundoId, setMundoId] = useState<string>(itemToEdit?.mundo_id || effectiveWorlds[0] || 'mundo_hillys');
  const [lore, setLore] = useState<string>(itemToEdit?.contenido_lore || '');
  const [tags, setTags] = useState<string>(itemToEdit?.etiquetas_discord?.join(', ') || '');
  const [urlDiscord, setUrlDiscord] = useState<string>(itemToEdit?.url_discord || '');
  const [imagenes, setImagenes] = useState<string[]>(itemToEdit?.imagenes || []);
  const [newImageUrl, setNewImageUrl] = useState<string>('');

  // Relationships state
  const parseExistingRelations = (relData: any): { targetId: string; label: string }[] => {
    if (!relData) return [];
    if (Array.isArray(relData)) {
      return relData
        .map((r) => {
          if (typeof r === 'string') return { targetId: r, label: 'Relacionado' };
          return {
            targetId: r.id_destino || r.target_id || '',
            label: r.relacion || 'Vínculo',
          };
        })
        .filter((r) => r.targetId !== '');
    }
    if (typeof relData === 'object') {
      const list: { targetId: string; label: string }[] = [];
      Object.entries(relData).forEach(([key, val]) => {
        if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === 'string') list.push({ targetId: v, label: key });
            else if (v && typeof v === 'object') list.push({ targetId: v.id_destino || v.target_id || '', label: key });
          });
        } else if (typeof val === 'string') {
          list.push({ targetId: val, label: key });
        }
      });
      return list.filter((r) => r.targetId !== '');
    }
    return [];
  };

  const [relations, setRelations] = useState<{ targetId: string; label: string }[]>(
    parseExistingRelations(itemToEdit?.relaciones)
  );
  const [newRelTargetId, setNewRelTargetId] = useState<string>('');
  const [newRelLabel, setNewRelLabel] = useState<string>('Aliado');
  const [relSearchTerm, setRelSearchTerm] = useState<string>('');
  const [isRelDropdownOpen, setIsRelDropdownOpen] = useState<boolean>(false);

  const selectableTargets = wikiData
    .filter((item) => item.id !== id)
    .filter((item) => {
      if (!relSearchTerm.trim()) return true;
      const term = relSearchTerm.toLowerCase().trim();
      const name = (item.nombre || '').toLowerCase();
      const itemId = (item.id || '').toLowerCase();
      const type = (item.tipo || '').toLowerCase();
      const world = (item.mundo_id || '').toLowerCase();
      return (
        name.includes(term) ||
        itemId.includes(term) ||
        type.includes(term) ||
        world.includes(term)
      );
    });

  // Attributes list state
  const initialDetails = itemToEdit?.detalles
    ? Object.entries(itemToEdit.detalles).map(([k, v]) => ({
        key: k,
        value: Array.isArray(v) ? v.join(', ') : String(v),
      }))
    : [{ key: '', value: '' }];

  const [attributes, setAttributes] = useState<{ key: string; value: string }[]>(initialDetails);

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: '', value: '' }]);
  };

  const handleRemoveAttribute = (idx: number) => {
    setAttributes(attributes.filter((_, i) => i !== idx));
  };

  const handleAddImage = () => {
    if (newImageUrl.trim()) {
      setImagenes([...imagenes, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImagenes(imagenes.filter((_, i) => i !== idx));
  };

  const handleAddRelation = () => {
    if (newRelTargetId) {
      setRelations([...relations, { targetId: newRelTargetId, label: newRelLabel.trim() || 'Vínculo' }]);
      setNewRelTargetId('');
      setNewRelLabel('Aliado');
      playSound('click');
    }
  };

  const handleRemoveRelation = (idx: number) => {
    setRelations(relations.filter((_, i) => i !== idx));
    playSound('click');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const detailsObj: Record<string, string> = {};
    attributes.forEach((attr) => {
      if (attr.key.trim() && attr.value.trim()) {
        detailsObj[attr.key.trim()] = attr.value.trim();
      }
    });

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const formattedRelaciones = relations.map((r) => ({
      id_destino: r.targetId,
      relacion: r.label,
    }));

    const newItem: WikiItem = {
      id: id.trim() || `entidad_${Date.now()}`,
      nombre: nombre.trim() || id,
      tipo: tipo.toLowerCase(),
      mundo_id: mundoId,
      contenido_lore: lore,
      etiquetas_discord: parsedTags,
      imagenes,
      detalles: detailsObj,
      relaciones: formattedRelaciones,
      url_discord: urlDiscord.trim(),
      isFavorite: itemToEdit?.isFavorite || false,
    };

    onSave(newItem);
    playSound('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {isEditing ? `Editar: ${itemToEdit.nombre || itemToEdit.id}` : 'Crear Nueva Entidad en Lore'}
            </h2>
          </div>
          <button
            onClick={() => {
              onClose();
              playSound('click');
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-200">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nombre de la Entidad</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Jade, Bar Akuda, Red IRIS..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">ID Único</label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Ej: npc_jade"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Categoría / Tipo</label>
              <select
                value={tipo}
                onChange={(e) => {
                  const newType = e.target.value;
                  setTipo(newType);
                  // Auto fill helpful default attributes if attributes list is empty/blank
                  if (attributes.length === 1 && !attributes[0].key) {
                    if (newType === 'poder') {
                      setAttributes([
                        { key: 'Nivel/Rango', value: 'Clase A' },
                        { key: 'Elemento/Tipo', value: 'Psíquico / Elemental' },
                        { key: 'Coste/Consumo', value: 'Energía / Maná' },
                        { key: 'Alcance', value: '15 metros' },
                        { key: 'Limitaciones', value: 'Requiere concentración' },
                      ]);
                    } else if (newType === 'ficha') {
                      setAttributes([
                        { key: 'Alias', value: 'Sombra' },
                        { key: 'Edad', value: '22 años' },
                        { key: 'Especie/Raza', value: 'Humano' },
                        { key: 'Alineamiento', value: 'Neutral Bueno' },
                        { key: 'Fuerza', value: '7/10' },
                        { key: 'Agilidad', value: '9/10' },
                        { key: 'Equipamiento', value: 'Daga de plasma, Visor táctico' },
                      ]);
                    }
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="npc">Personaje (NPC / PC)</option>
                <option value="lugar">Lugar / Ubicación</option>
                <option value="objeto">Objeto / Artefacto / Vehículo</option>
                <option value="faccion">Facción / Organización</option>
                <option value="trama">Trama / Arco Narrativo</option>
                <option value="mundo">Mundo / Planeta</option>
                <option value="poder">⚡ Poder / Habilidad / Magia</option>
                <option value="ficha">📋 Ficha de Personaje / Expediente</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mundo Asignado</label>
              <select
                value={mundoId}
                onChange={(e) => setMundoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {effectiveWorlds.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lore Markdown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Contenido de Lore (Markdown)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  if (lore.trim()) {
                    const formatted = formatMagicTextToMarkdown(lore);
                    setLore(formatted);
                    playSound('click');
                  }
                }}
                className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                title="Convierte texto plano de Rangos/Poderes a Markdown ordenado"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>✨ Auto-formatear Magia / Rangos</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={lore}
              onChange={(e) => setLore(e.target.value)}
              placeholder="Escribe la biografía, historia o pega el texto de tu magia (ej. Rango 0, Conexión, Armadura...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Tags & Discord URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Etiquetas (separadas por coma)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Ej: Resistencia, Reportera, Hillys"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Enlace de Mensaje en Discord (Opcional)</span>
              </label>
              <input
                type="url"
                value={urlDiscord}
                onChange={(e) => setUrlDiscord(e.target.value)}
                placeholder="Ej: https://discord.com/channels/123/456/789"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Relationships Manager */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Gestión de Relaciones y Vínculos ({relations.length})</span>
              </label>
            </div>

            {/* Add new relationship controls with integrated Combobox dropdown */}
            <div className="space-y-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800 relative">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                {/* Searchable Combobox */}
                <div className="sm:col-span-6 min-w-0 relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={relSearchTerm}
                      onFocus={() => setIsRelDropdownOpen(true)}
                      onChange={(e) => {
                        setRelSearchTerm(e.target.value);
                        setIsRelDropdownOpen(true);
                        if (newRelTargetId) {
                          setNewRelTargetId('');
                        }
                      }}
                      placeholder="Buscar entidad por nombre, tipo o mundo..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500 truncate"
                    />
                    {relSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setRelSearchTerm('');
                          setNewRelTargetId('');
                          setIsRelDropdownOpen(true);
                        }}
                        className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-800"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Combobox Dropdown Menu */}
                  {isRelDropdownOpen && (
                    <>
                      {/* Invisible backdrop to close dropdown when clicking outside */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsRelDropdownOpen(false)}
                      />
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-800/50">
                        {selectableTargets.length > 0 ? (
                          selectableTargets.map((target) => {
                            const isSelected = newRelTargetId === target.id;
                            return (
                              <button
                                key={target.id}
                                type="button"
                                onClick={() => {
                                  setNewRelTargetId(target.id);
                                  setRelSearchTerm(`${target.nombre || target.id}`);
                                  setIsRelDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 hover:bg-slate-900 cursor-pointer ${
                                  isSelected ? 'bg-indigo-950/40 text-indigo-300' : 'text-slate-200'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate">{target.nombre || target.id}</div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                                    <span className="text-slate-300">{target.tipo}</span>
                                    <span>•</span>
                                    <span className="text-indigo-400">{target.mundo_id}</span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2.5 text-xs text-slate-500 text-center italic">
                            No se encontraron entidades coincidentes
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="sm:col-span-4 min-w-0">
                  <input
                    type="text"
                    value={newRelLabel}
                    onChange={(e) => setNewRelLabel(e.target.value)}
                    placeholder="Tipo relación (ej. Aliado)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleAddRelation();
                      setRelSearchTerm('');
                      setIsRelDropdownOpen(false);
                    }}
                    disabled={!newRelTargetId}
                    className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Active relationships list */}
            {relations.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {relations.map((rel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] shrink-0">
                        {rel.label}
                      </span>
                      <span className="font-semibold text-slate-200 truncate">
                        {getDisplayName(rel.targetId, wikiData)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono truncate">({rel.targetId})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRelation(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar vínculo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic text-center py-1">
                Sin relaciones asignadas. Puedes vincular esta entidad con otros personajes, lugares u objetos.
              </p>
            )}
          </div>

          {/* Image URLs */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-indigo-400" />
              <span>Imágenes (URLs de fotos o ilustraciones)</span>
            </label>

            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium"
              >
                Añadir URL
              </button>
            </div>

            {imagenes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imagenes.map((img, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="truncate max-w-[200px] text-[10px] text-slate-400">{img}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Attributes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-slate-400">Atributos Personalizados</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAttributes([
                      { key: 'Fuerza', value: '9 / 10 — [T2] Sobrenatural' },
                      { key: 'Resistencia', value: '9 / 10 — [T2] Sobrenatural' },
                      { key: 'Destreza', value: '8 / 10 — [T2] Sobrenatural' },
                      { key: 'Combate Cuerpo a Cuerpo', value: '8 / 10 — [T1] Terrenal' },
                      { key: 'Combate a Distancia', value: '2 / 10 — [T1] Terrenal' },
                      { key: 'Inteligencia', value: '2 / 10 — [T1] Terrenal' },
                      { key: 'Magia / Ocultismo', value: '8 / 10 — [T4] Anomalía' },
                    ]);
                    playSound('click');
                  }}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="Carga la plantilla universal de 7 atributos base"
                >
                  <Award className="w-3 h-3 text-cyan-400" />
                  <span>📊 Plantilla Atributos Base</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Atributo</span>
                </button>
              </div>
            </div>


            <div className="space-y-2">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => {
                      const updated = [...attributes];
                      updated[idx].key = e.target.value;
                      setAttributes(updated);
                    }}
                    placeholder="Clave (Ej: Especie)"
                    className="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => {
                      const updated = [...attributes];
                      updated[idx].value = e.target.value;
                      setAttributes(updated);
                    }}
                    placeholder="Valor (Ej: Híbrido Porcino)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(idx)}
                    className="p-2 text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Entidad</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
