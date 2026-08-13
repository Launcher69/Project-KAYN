import React, { useState, useEffect } from 'react';
import { WikiItem, User } from '../types';
import { canUserEditItem } from '../utils/permissions';
import {
  StatAttribute,
  TierLevel,
  parseCharacterStats,
  hasCharacterStats,
  getTierDefaultLabel,
  getDisplayName,
  getItemImages,
  cleanText,
} from '../utils/textUtils';
import {
  X,
  Edit3,
  Save,
  Shield,
  ShieldAlert,
  Zap,
  Flame,
  Swords,
  Target,
  Brain,
  Sparkles,
  UserCheck,
  Award,
  BookOpen,
  Package,
  RotateCcw,
  Sliders,
  Check,
  ArrowLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { playSound } from '../utils/soundEffects';

interface CharacterSheetModalProps {
  item: WikiItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveItem?: (updatedItem: WikiItem) => void;
  currentUser?: User | null;
  wikiData?: WikiItem[];
  onNavigateTo?: (id: string) => void;
  initialIsEditing?: boolean;
}

export const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({
  item,
  isOpen,
  onClose,
  onSaveItem,
  currentUser,
  wikiData = [],
  onNavigateTo,
  initialIsEditing = false,
}) => {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [stats, setStats] = useState<StatAttribute[]>(() => item ? parseCharacterStats(item) : []);
  const [alias, setAlias] = useState<string>('');
  const [especie, setEspecie] = useState<string>('');
  const [alineamiento, setAlineamiento] = useState<string>('');
  const [equipamiento, setEquipamiento] = useState<string>('');

  // Find character associated with this sheet (if item is a ficha)
  const isItemFicha = item ? ['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes((item.tipo || '').toLowerCase()) : false;
  const linkedCharacter = (item && isItemFicha)
    ? wikiData.find((other) => {
        const otherType = (other.tipo || '').toLowerCase();
        const isOtherChar = ['npc', 'pc', 'personaje'].includes(otherType);
        if (!isOtherChar) return false;
        const otherLinksToSheet = Array.isArray(other.relaciones) && other.relaciones.some((rel: any) => (rel.id_destino || rel.target_id) === item.id);
        const sheetLinksToChar = Array.isArray(item.relaciones) && item.relaciones.some((rel: any) => (rel.id_destino || rel.target_id) === other.id);
        return otherLinksToSheet || sheetLinksToChar;
      })
    : null;

  // Sync state when item changes or modal opens
  useEffect(() => {
    if (item && isOpen) {
      setStats(parseCharacterStats(item));
      setAlias(String(item.detalles?.alias || item.detalles?.Alias || linkedCharacter?.detalles?.alias || linkedCharacter?.detalles?.Alias || ''));
      setEspecie(String(item.detalles?.especie || item.detalles?.['Especie/Raza'] || item.detalles?.raza || linkedCharacter?.detalles?.especie || linkedCharacter?.detalles?.['Especie/Raza'] || linkedCharacter?.detalles?.raza || ''));
      setAlineamiento(String(item.detalles?.alineamiento || item.detalles?.Alineamiento || linkedCharacter?.detalles?.alineamiento || linkedCharacter?.detalles?.Alineamiento || ''));
      setEquipamiento(String(item.detalles?.equipamiento || item.detalles?.Equipamiento || linkedCharacter?.detalles?.equipamiento || linkedCharacter?.detalles?.Equipamiento || ''));
      setIsEditing(initialIsEditing);
    }
  }, [item, isOpen, initialIsEditing, linkedCharacter]);

  if (!isOpen || !item) return null;

  // Find powers associated with this character sheet or linked character
  const targetIds = [item.id];
  if (linkedCharacter) {
    targetIds.push(linkedCharacter.id);
  }

  const linkedPowers = wikiData.filter((other) => {
    const otherType = (other.tipo || '').toLowerCase();
    const isPowerType = ['poder', 'poderes', 'habilidad', 'habilidades', 'sistema_poder', 'magia', 'magias', 'hechizo'].includes(otherType);
    if (!isPowerType) return false;

    const powerLinksToTarget = other.relaciones?.some((rel) => targetIds.includes(rel.id_destino));
    const targetLinksToPower = item.relaciones?.some((rel) => rel.id_destino === other.id) ||
      linkedCharacter?.relaciones?.some((rel) => rel.id_destino === other.id);

    return powerLinksToTarget || targetLinksToPower;
  });

  const rawImages = getItemImages(item, wikiData);
  const itemImages = rawImages.length > 0 ? rawImages : (linkedCharacter ? getItemImages(linkedCharacter, wikiData) : []);
  const worldName = getDisplayName(item.mundo_id, wikiData);

  const canEdit = canUserEditItem(currentUser, item, wikiData);

  const handleStatChange = (id: string, field: keyof StatAttribute, val: any) => {
    setStats((prev) =>
      prev.map((st) => {
        if (st.id === id) {
          const updated = { ...st, [field]: val };
          if (field === 'tier') {
            updated.tierLabel = getTierDefaultLabel(val as TierLevel);
          }
          return updated;
        }
        return st;
      })
    );
  };

  const handleSave = () => {
    if (!onSaveItem) return;

    const updatedItem: WikiItem = {
      ...item,
      detalles: {
        ...(item.detalles || {}),
        alias,
        especie,
        alineamiento,
        equipamiento,
        ficha_atributos: JSON.stringify(stats),
      },
    };

    onSaveItem(updatedItem);
    setIsEditing(false);
    playSound('success');
  };

  const renderTierBadge = (tier: TierLevel, tierLabel?: string) => {
    const label = tierLabel || getTierDefaultLabel(tier);

    switch (tier) {
      case 'T1':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
            [T1] {label}
          </span>
        );
      case 'T2':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20 shrink-0">
            [T2] {label}
          </span>
        );
      case 'T3':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20 shrink-0">
            [T3] {label}
          </span>
        );
      case 'T4':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-purple-500/30 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/20 animate-pulse shrink-0">
            [T4] {label}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
            [{tier}] {label}
          </span>
        );
    }
  };

  const renderCategoryStats = (
    catKey: 'fisico' | 'combate' | 'mente_mistica',
    title: string,
    icon: React.ReactNode,
    colorTheme: {
      headerBg: string;
      headerText: string;
      barFill: string;
      borderColor: string;
    }
  ) => {
    const catStats = stats.filter((s) => s.category === catKey);

    return (
      <div className={`p-4 rounded-2xl bg-slate-900/80 border ${colorTheme.borderColor} shadow-lg space-y-4`}>
        {/* Category Header */}
        <div className={`flex items-center justify-between pb-2.5 border-b ${colorTheme.borderColor}`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${colorTheme.headerBg}`}>{icon}</div>
            <h3 className={`font-extrabold text-sm uppercase tracking-wider ${colorTheme.headerText}`}>
              {title}
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Escala 1 - 10</span>
        </div>

        {/* Attribute Rows */}
        <div className="space-y-4">
          {catStats.map((st) => (
            <div key={st.id} className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">{st.name}</span>
                  {renderTierBadge(st.tier, st.tierLabel)}
                </div>

                {/* Score Number */}
                <span className="text-xs font-extrabold font-mono text-slate-200 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                  {st.value} <span className="text-slate-500 text-[10px]">\ 10</span>
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-400 leading-snug">{st.description}</p>

              {/* Progress Bar / Slider */}
              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={st.value}
                      onChange={(e) => handleStatChange(st.id, 'value', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <select
                      value={st.tier}
                      onChange={(e) => handleStatChange(st.id, 'tier', e.target.value as TierLevel)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="T1">[T1] Terrenal</option>
                      <option value="T2">[T2] Sobrenatural</option>
                      <option value="T3">[T3] Cósmico</option>
                      <option value="T4">[T4] Anomalía</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={st.note || ''}
                    onChange={(e) => handleStatChange(st.id, 'note', e.target.value)}
                    placeholder="Nota o Modificador (ej. Sube a [T2] usando Haki)..."
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <div className="space-y-1 pt-1">
                  {/* Segmented Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-900 rounded-full p-0.5 border border-slate-800 flex items-center gap-0.5 overflow-hidden">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const isActive = idx < st.value;
                      return (
                        <div
                          key={idx}
                          className={`h-full flex-1 rounded-sm transition-all ${
                            isActive ? colorTheme.barFill : 'bg-slate-800/40'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Note / Condition if present */}
                  {st.note && (
                    <span className="text-[11px] font-medium text-amber-300/90 italic block pt-0.5">
                      ↳ {st.note}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                playSound('click');
                if (linkedCharacter && onNavigateTo) {
                  onClose();
                  onNavigateTo(linkedCharacter.id);
                } else {
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title={linkedCharacter ? `Volver a ${linkedCharacter.nombre}` : 'Volver'}
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>{linkedCharacter ? `Volver a ${linkedCharacter.nombre}` : 'Volver'}</span>
            </button>

            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hidden sm:block">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                  FICHA UNIVERSAL DE ROL
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {worldName}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-100">
                {item.nombre || item.id}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    handleSave();
                  } else {
                    setIsEditing(true);
                    playSound('click');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isEditing
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isEditing ? (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Ajustar Atributos</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                playSound('click');
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          
          {/* Character Top Overview Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            {itemImages.length > 0 && (
              <div className="md:col-span-3">
                <div className="w-full h-44 md:h-full min-h-[160px] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
                  <img
                    src={itemImages[0]}
                    alt={item.nombre}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            )}

            <div className={`${itemImages.length > 0 ? 'md:col-span-9' : 'md:col-span-12'} space-y-3`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Alias / Título</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="ej. Sombrero de Paja"
                      className="w-full bg-slate-900 text-xs text-slate-200 mt-0.5 px-1.5 py-0.5 rounded border border-slate-700"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                      {alias || 'Desconocido'}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Especie / Raza</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={especie}
                      onChange={(e) => setEspecie(e.target.value)}
                      placeholder="ej. Humano"
                      className="w-full bg-slate-900 text-xs text-slate-200 mt-0.5 px-1.5 py-0.5 rounded border border-slate-700"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                      {especie || 'Humano'}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Alineamiento</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={alineamiento}
                      onChange={(e) => setAlineamiento(e.target.value)}
                      placeholder="ej. Caótico Bueno"
                      className="w-full bg-slate-900 text-xs text-slate-200 mt-0.5 px-1.5 py-0.5 rounded border border-slate-700"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-cyan-300 mt-0.5 block truncate">
                      {alineamiento || 'Neutral'}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Equipamiento Key</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={equipamiento}
                      onChange={(e) => setEquipamiento(e.target.value)}
                      placeholder="ej. Daga, Sombrero de Paja"
                      className="w-full bg-slate-900 text-xs text-slate-200 mt-0.5 px-1.5 py-0.5 rounded border border-slate-700"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-amber-300 mt-0.5 block truncate">
                      {equipamiento || 'Sin equipamiento especial'}
                    </span>
                  )}
                </div>
              </div>

              {/* Short Description */}
              {item.contenido_lore && (
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <div className="text-xs text-slate-300 line-clamp-2">
                    <ReactMarkdown>{item.contenido_lore}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 📊 ATRIBUTOS BASE (3 CATEGORÍAS) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-widest">
                📊 ATRIBUTOS BASE (PLANTILLA UNIVERSAL)
              </h3>
            </div>

            {hasCharacterStats(item) || isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 🔴 CATEGORÍA 1: FÍSICO */}
                {renderCategoryStats('fisico', '🔴 1. Físico', <Flame className="w-4 h-4 text-rose-400" />, {
                  headerBg: 'bg-rose-500/10',
                  headerText: 'text-rose-400',
                  barFill: 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-sm shadow-rose-500/30',
                  borderColor: 'border-rose-500/20',
                })}

                {/* 🔵 CATEGORÍA 2: COMBATE */}
                {renderCategoryStats('combate', '🔵 2. Combate', <Swords className="w-4 h-4 text-sky-400" />, {
                  headerBg: 'bg-sky-500/10',
                  headerText: 'text-sky-400',
                  barFill: 'bg-gradient-to-r from-sky-600 to-sky-400 shadow-sm shadow-sky-500/30',
                  borderColor: 'border-sky-500/20',
                })}

                {/* 🟢 CATEGORÍA 3: MENTE Y MÍSTICA */}
                {renderCategoryStats(
                  'mente_mistica',
                  '🟢 3. Mente y Mística',
                  <Brain className="w-4 h-4 text-emerald-400" />,
                  {
                    headerBg: 'bg-emerald-500/10',
                    headerText: 'text-emerald-400',
                    barFill: 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-sm shadow-emerald-500/30',
                    borderColor: 'border-emerald-500/20',
                  }
                )}
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-3 shadow-inner">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 shadow-md">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-extrabold text-amber-200 uppercase tracking-wide">
                  Este personaje / NPC no tiene atributos establecidos
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Esta entidad no cuenta con estadísticas de rol asignadas en la base de datos JSON de Discord. Para que aparezcan sus niveles y barras de atributos, el bot debe enviarlas en la ficha del personaje.
                </p>
              </div>
            )}
          </div>

          {/* ⚡ Poderes & Magias Asociadas */}
          {linkedPowers.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Zap className="w-4 h-4" />
                <span>⚡ Poderes & Magias Vinculadas ({linkedPowers.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedPowers.map((pow) => (
                  <button
                    key={pow.id}
                    type="button"
                    onClick={() => {
                      if (onNavigateTo) {
                        onClose();
                        onNavigateTo(pow.id);
                      }
                      playSound('click');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{pow.nombre || pow.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}



        </div>

      </div>
    </div>
  );
};
