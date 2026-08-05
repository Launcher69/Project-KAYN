import React, { useState } from 'react';
import { WikiItem } from '../types';
import { X, Plus, Trash2, Save, Sparkles, Image, Tag, FileText } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface ItemEditorModalProps {
  itemToEdit: WikiItem | null;
  wikiData: WikiItem[];
  onSave: (newItem: WikiItem) => void;
  onClose: () => void;
}

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  itemToEdit,
  wikiData,
  onSave,
  onClose,
}) => {
  const isEditing = !!itemToEdit;

  const [id, setId] = useState<string>(itemToEdit?.id || `entidad_${Date.now()}`);
  const [nombre, setNombre] = useState<string>(itemToEdit?.nombre || '');
  const [tipo, setTipo] = useState<string>(itemToEdit?.tipo || 'npc');
  const [mundoId, setMundoId] = useState<string>(itemToEdit?.mundo_id || 'mundo_hillys');
  const [lore, setLore] = useState<string>(itemToEdit?.contenido_lore || '');
  const [tags, setTags] = useState<string>(itemToEdit?.etiquetas_discord?.join(', ') || '');
  const [imagenes, setImagenes] = useState<string[]>(itemToEdit?.imagenes || []);
  const [newImageUrl, setNewImageUrl] = useState<string>('');

  // Attributes list state
  const initialDetails = itemToEdit?.detalles
    ? Object.entries(itemToEdit.detalles).map(([k, v]) => ({
        key: k,
        value: Array.isArray(v) ? v.join(', ') : String(v),
      }))
    : [{ key: '', value: '' }];

  const [attributes, setAttributes] = useState<{ key: string; value: string }[]>(initialDetails);

  const worlds = [...new Set(wikiData.map((i) => i.mundo_id).filter(Boolean))];

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

    const newItem: WikiItem = {
      id: id.trim() || `entidad_${Date.now()}`,
      nombre: nombre.trim() || id,
      tipo: tipo.toLowerCase(),
      mundo_id: mundoId,
      contenido_lore: lore,
      etiquetas_discord: parsedTags,
      imagenes,
      detalles: detailsObj,
      relaciones: itemToEdit?.relaciones || [],
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
                onChange={(e) => setTipo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="npc">Personaje (NPC / PC)</option>
                <option value="lugar">Lugar / Ubicación</option>
                <option value="objeto">Objeto / Artefacto / Vehículo</option>
                <option value="faccion">Facción / Organización</option>
                <option value="trama">Trama / Arco Narrativo</option>
                <option value="mundo">Mundo / Planeta</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mundo Asignado</label>
              <select
                value={mundoId}
                onChange={(e) => setMundoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {worlds.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lore Markdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Contenido de Lore (Markdown)</span>
            </label>
            <textarea
              rows={5}
              value={lore}
              onChange={(e) => setLore(e.target.value)}
              placeholder="Escribe la biografía, historia o detalles descriptivos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs"
            />
          </div>

          {/* Tags */}
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
              <button
                type="button"
                onClick={handleAddAttribute}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Atributo</span>
              </button>
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
