import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { WikiItem } from '../types';
import {
  getDisplayName,
  getItemTypeBadgeColor,
  parseRelations,
  findBacklinks,
  cleanText,
  getItemImages,
  formatMagicTextToMarkdown,
  parseCharacterStats,
  getTierDefaultLabel,
} from '../utils/textUtils';
import {
  X,
  Globe,
  Star,
  ExternalLink,
  BookOpen,
  Network,
  Scroll,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Compass,
  Sparkles,
  Zap,
  FileText,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Sliders,
  UserCheck,
  Lock,
} from 'lucide-react';
import { playSound } from '../utils/soundEffects';
import { CharacterSheetModal } from './CharacterSheetModal';
import { User } from '../types';
import { canUserEditItem } from '../utils/permissions';

interface DetailModalProps {
  itemId: string | null;
  wikiData: WikiItem[];
  onClose: () => void;
  onNavigateTo: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSaveItem?: (item: WikiItem) => void;
  onEditItem?: (item: WikiItem) => void;
  currentUser?: User | null;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  itemId,
  wikiData,
  onClose,
  onNavigateTo,
  onToggleFavorite,
  onSaveItem,
  onEditItem,
  currentUser,
}) => {
  // History stack for modal internal navigation
  const [historyStack, setHistoryStack] = useState<string[]>(itemId ? [itemId] : []);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [activeImage, setActiveImage] = useState<string>('');

  // Sync when initial itemId changes from outside
  useEffect(() => {
    if (itemId && historyStack[historyIndex] !== itemId) {
      setHistoryStack([itemId]);
      setHistoryIndex(0);
    }
  }, [itemId]);

  const currentId = historyStack[historyIndex] || itemId;
  const item = wikiData.find((i) => i.id === currentId);

  // Update active image when current item changes
  useEffect(() => {
    if (item) {
      const imgs = getItemImages(item, wikiData);
      if (imgs.length > 0) {
        setActiveImage(imgs[0]);
      } else {
        setActiveImage('');
      }
    }
  }, [currentId, wikiData, item]);

  const itemType = (item?.tipo || '').toLowerCase();
  const isFicha = ['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes(itemType);
  const isPower = ['poder', 'poderes', 'habilidad', 'habilidades', 'sistema_poder', 'magia', 'magias', 'hechizo'].includes(itemType);
  const isCharacter = ['npc', 'pc', 'personaje'].includes(itemType);

  // Find linked character if current item is a sheet/ficha
  const linkedCharacter = (item && isFicha)
    ? wikiData.find((other) => {
        const otherType = (other.tipo || '').toLowerCase();
        const isOtherChar = ['npc', 'pc', 'personaje'].includes(otherType);
        if (!isOtherChar) return false;
        const otherLinksToMe = other.relaciones?.some((rel) => rel.id_destino === item.id);
        const meLinkToOther = item.relaciones?.some((rel) => rel.id_destino === other.id);
        return otherLinksToMe || meLinkToOther;
      })
    : null;

  // Find linked sheet item if current item is a character
  const linkedSheet = (item && isCharacter && !isFicha)
    ? wikiData.find((other) => {
        const otherType = (other.tipo || '').toLowerCase();
        const isOtherFicha = ['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes(otherType);
        if (!isOtherFicha) return false;
        const otherLinksToMe = other.relaciones?.some((rel) => rel.id_destino === item.id);
        const meLinkToOther = item.relaciones?.some((rel) => rel.id_destino === other.id);
        return otherLinksToMe || meLinkToOther;
      })
    : null;

  // Auto-open interactive character sheet modal directly when opening a ficha item,
  // and switch background view to linked character if available so the background detail view is full of rich content.
  useEffect(() => {
    if (isFicha) {
      if (linkedCharacter) {
        const newStack = [...historyStack];
        newStack[historyIndex] = linkedCharacter.id;
        setHistoryStack(newStack);
        onNavigateTo(linkedCharacter.id);
      }
      setIsSheetModalOpen(true);
    }
  }, [currentId, isFicha, linkedCharacter]);

  if (!itemId || !item) return null;

  const canEdit = canUserEditItem(currentUser, item, wikiData);
  const badgeColors = getItemTypeBadgeColor(item.tipo);
  const worldName = getDisplayName(item.mundo_id, wikiData);
  const itemImages = getItemImages(item, wikiData);
  const hasImages = itemImages.length > 0;


  const handleInternalNavigate = (targetId: string) => {
    // Truncate future history if navigated from middle
    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(targetId);
    setHistoryStack(newStack);
    setHistoryIndex(newStack.length - 1);
    onNavigateTo(targetId);
    playSound('click');
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onNavigateTo(historyStack[prevIndex]);
      playSound('click');
    }
  };

  const handleGoForward = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onNavigateTo(historyStack[nextIndex]);
      playSound('click');
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(item.id);
    setCopiedId(true);
    playSound('success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Parse direct relations and backlinks
  const directConnections = parseRelations(item, wikiData);
  const backlinks = findBacklinks(item, wikiData);

  // Group connections into Tramas vs General
  const tramaConnections = directConnections.filter(
    (c) => c.targetType === 'trama' || c.label.toLowerCase().includes('trama')
  );
  const otherConnections = directConnections.filter(
    (c) => c.targetType !== 'trama' && !c.label.toLowerCase().includes('trama')
  );

  // Clean lore text from duplicate headers
  let cleanLoreText = (item.contenido_lore || '').replace(/!\[.*?\]\(.*?\)/g, '');
  cleanLoreText = cleanLoreText.replace(
    /^\s*(?:#+\s*)?(?:Biograf[ií]a(?:\s+y\s+[Tr|tr]asfondo)?|Descripci[oó]n)\s*\n+/i,
    ''
  );

  const activeSheetItem = isFicha ? item : (linkedSheet || item);

  // Auto-format magic/ranks if power or if unformatted rank lines are present
  if (isPower || /rango\s*\d+/i.test(cleanLoreText)) {
    cleanLoreText = formatMagicTextToMarkdown(cleanLoreText);
  }

  let sectionTitle = '📖 Descripción Detallada';
  if (isPower) {
    sectionTitle = '⚡ Funcionamiento & Mecánicas del Poder';
  } else if (isFicha) {
    sectionTitle = '📋 Expediente & Trasfondo de la Ficha';
  } else if (isCharacter) {
    sectionTitle = '📖 Biografía e Historia';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 bg-slate-900/95 border-b border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between backdrop-blur-md gap-2 sm:gap-4">
          
          {/* Navigation Controls & Type/World Info */}
          <div className="flex items-center gap-3 overflow-hidden">
            
            {/* History Back / Forward */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 shrink-0">
              <button
                onClick={handleGoBack}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                title="Volver atras"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoForward}
                disabled={historyIndex >= historyStack.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                title="Avanzar"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <span
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
            >
              {isPower && <Zap className="w-3.5 h-3.5 text-amber-400" />}
              {isFicha && <FileText className="w-3.5 h-3.5 text-cyan-400" />}
              <span>
                {isPower
                  ? '⚡ PODER / HABILIDAD'
                  : isFicha
                  ? '📋 FICHA DE PERSONAJE'
                  : (item.tipo || 'entidad').toUpperCase()}
              </span>
            </span>

            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{worldName}</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Copy ID Button */}
            <button
              onClick={handleCopyId}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-medium border border-slate-700/50 flex items-center gap-1.5 transition-colors"
              title="Copiar ID único de Discord"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden md:inline font-mono text-[11px]">{item.id}</span>
            </button>

            {/* Favorite Button */}
            <button
              onClick={(e) => onToggleFavorite(item.id, e)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
              title={item.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Discord Link */}
            {item.url_discord && (
              <a
                href={item.url_discord}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                title="Abrir canal en Discord"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Close Button */}
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
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Breadcrumb Trail */}
          {historyStack.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-semibold text-slate-500 shrink-0">Historial:</span>
              {historyStack.map((histId, idx) => {
                const histItem = wikiData.find((i) => i.id === histId);
                const isCurrent = idx === historyIndex;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                    <button
                      onClick={() => {
                        setHistoryIndex(idx);
                        onNavigateTo(histId);
                        playSound('click');
                      }}
                      className={`truncate max-w-[140px] px-2 py-0.5 rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-bold'
                          : 'hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {histItem?.nombre || histId}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div className={`grid grid-cols-1 ${hasImages ? 'lg:grid-cols-12' : ''} gap-6`}>
            
            {/* Left Media Gallery Column */}
            {hasImages && (
              <div className="lg:col-span-5 space-y-3">
                <div className="relative w-full h-72 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                  <img
                    src={activeImage || itemImages[0]}
                    alt={item.nombre || item.id}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Gallery Thumbnails */}
                {itemImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {itemImages.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Thumb ${idx}`}
                        referrerPolicy="no-referrer"
                        onClick={() => setActiveImage(img)}
                        className={`w-14 h-14 rounded-xl object-cover border cursor-pointer transition-all ${
                          activeImage === img
                            ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20'
                            : 'border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Right Info Column */}
            <div className={`${hasImages ? 'lg:col-span-7' : 'w-full'} space-y-5`}>
              
              {/* Title & Tags */}
              <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-100">
                  {item.nombre || item.id}
                </h1>

                {item.etiquetas_discord && item.etiquetas_discord.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {item.etiquetas_discord.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Attributes Grid for Poderes, Fichas or General Entities */}
              {item.detalles && Object.keys(item.detalles).length > 0 && (
                <div className="space-y-3">
                  {/* Specialized Section Header */}
                  {isPower && (
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <Zap className="w-4 h-4" />
                      <span>Ficha Técnica & Parámetros del Poder</span>
                    </div>
                  )}
                  {isFicha && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                        <FileText className="w-4 h-4" />
                        <span>Expediente de Personaje & Ficha</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSheetModalOpen(true);
                          playSound('click');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                        <span>📊 Ver Ficha Interactivas (Stats & Tiers)</span>
                      </button>
                    </div>
                  )}

                  {(isFicha || isCharacter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSheetModalOpen(true);
                        playSound('click');
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>📊 Abrir Ficha de Rol Interactiva (Atributos Base 1-10 & Tiers)</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">

                    {Object.entries(item.detalles).map(([k, v]) => {
                      const lowerKey = k.toLowerCase();
                      if (lowerKey === 'ficha_atributos' || lowerKey.includes('ficha_atributos')) return null;
                      const valStr = Array.isArray(v) ? v.join(', ') : String(v);

                      // Check if key is a Limitation for Powers
                      if (isPower && (lowerKey.includes('limitaci') || lowerKey.includes('debilid') || lowerKey.includes('contrapartida') || lowerKey.includes('riesgo'))) {
                        return (
                          <div key={k} className="col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                                {cleanText(k)}
                              </span>
                              <span className="text-xs font-medium mt-0.5 block leading-relaxed">
                                {valStr}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Check if key is Equipment for Fichas
                      if (isFicha && (lowerKey.includes('equip') || lowerKey.includes('inventario') || lowerKey.includes('arma'))) {
                        return (
                          <div key={k} className="col-span-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-2.5 text-cyan-200">
                            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 block">
                                {cleanText(k)}
                              </span>
                              <span className="text-xs font-medium mt-0.5 block leading-relaxed">
                                {valStr}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Standard Card
                      return (
                        <div key={k} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/50">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                            {cleanText(k)}
                          </span>
                          <span className="text-xs font-medium text-slate-200 mt-0.5 block">
                            {valStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Lore / Biografía Markdown Section */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>{sectionTitle}</span>
            </h3>

            {cleanLoreText.trim() ? (
              <div className="text-xs text-slate-300 leading-relaxed max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <div className="mt-6 mb-3 pt-3 border-t border-slate-800/80">
                        <h1 className="text-sm sm:text-base font-bold text-indigo-300 border-l-4 border-indigo-500 pl-3 py-1 flex items-center gap-2 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent rounded-r-xl">
                          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{children}</span>
                        </h1>
                      </div>
                    ),
                    h2: ({ children }) => (
                      <div className="mt-6 mb-3 pt-3 border-t border-slate-800/80">
                        <h2 className="text-sm sm:text-base font-bold text-indigo-300 border-l-4 border-indigo-500 pl-3 py-1 flex items-center gap-2 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent rounded-r-xl">
                          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{children}</span>
                        </h2>
                      </div>
                    ),
                    h3: ({ children }) => {
                      const textContent = String(children || '');
                      const isRankHeading = /rango|nivel|rank|tier|⚡/i.test(textContent);

                      if (isRankHeading) {
                        return (
                          <div className="mt-6 mb-3 pt-2">
                            <h3 className="text-xs sm:text-sm font-extrabold text-amber-300 border-l-4 border-amber-500 pl-3 py-1.5 flex items-center gap-2 bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-slate-900/80 rounded-r-xl border-y border-r border-amber-500/20 shadow-md shadow-amber-950/30">
                              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="uppercase tracking-wide">{children}</span>
                            </h3>
                          </div>
                        );
                      }

                      return (
                        <div className="mt-6 mb-3 pt-3 border-t border-slate-800/80">
                          <h3 className="text-xs sm:text-sm font-bold text-indigo-300 border-l-4 border-indigo-500 pl-3 py-1 flex items-center gap-2 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent rounded-r-xl shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{children}</span>
                          </h3>
                        </div>
                      );
                    },
                    h4: ({ children }) => (
                      <h4 className="text-xs font-bold text-purple-300 border-l-2 border-purple-400 pl-2.5 py-0.5 mt-4 mb-2 bg-slate-900/50 rounded-r-md">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-3 text-xs text-slate-300 leading-relaxed font-normal">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-2 my-3 pl-0">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1.5 my-3 text-slate-300 pl-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className={`flex items-start gap-2.5 text-xs text-slate-200 border px-3 py-2 rounded-xl transition-all ${
                        isPower
                          ? 'bg-slate-900/80 border-slate-800 hover:border-amber-500/30'
                          : 'bg-slate-900/50 border-slate-800/70'
                      }`}>
                        {isPower ? (
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <span className="text-indigo-400 font-bold mt-0.5">•</span>
                        )}
                        <div className="flex-1 leading-relaxed">{children}</div>
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className={`font-semibold px-1.5 py-0.5 rounded border text-xs inline-block my-0.5 ${
                        isPower
                          ? 'text-amber-200 bg-amber-500/15 border-amber-500/30 font-bold'
                          : 'text-indigo-200 bg-indigo-500/10 border-indigo-500/20'
                      }`}>
                        {children}
                      </strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-purple-500/60 pl-3 italic text-purple-200/90 bg-purple-950/20 p-3 rounded-r-xl my-3 text-xs">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-[11px] px-1.5 py-0.5 rounded">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {cleanLoreText}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs italic text-slate-500 bg-slate-900/60 p-3 rounded-xl">
                Sin contenido detallado registrado aún.
              </p>
            )}
          </div>

          {/* Direct Connections Section */}
          {otherConnections.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                <span>🔗 Conexiones &amp; Vínculos Directos ({otherConnections.length})</span>
              </h3>

              <div className="flex flex-wrap gap-2">
                {otherConnections.map((conn) => (
                  <button
                    key={conn.targetId}
                    onClick={() => handleInternalNavigate(conn.targetId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-200 text-xs transition-all group"
                  >
                    <span className="text-purple-400 font-bold">{conn.label}:</span>
                    <span className="font-semibold group-hover:text-purple-300">{conn.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connected Tramas Section */}
          {tramaConnections.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <Scroll className="w-4 h-4 text-rose-400" />
                <span>📜 Arcos de Trama Asociados ({tramaConnections.length})</span>
              </h3>

              <div className="flex flex-wrap gap-2">
                {tramaConnections.map((conn) => (
                  <button
                    key={conn.targetId}
                    onClick={() => handleInternalNavigate(conn.targetId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500/30 hover:border-rose-500/60 text-slate-200 text-xs transition-all group"
                  >
                    <span className="text-rose-400 font-bold">{conn.label}:</span>
                    <span className="font-semibold group-hover:text-rose-300">{conn.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks / Reverse Mentions */}
          {backlinks.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <span>🔄 Menciones Inversas ({backlinks.length})</span>
              </h3>

              <div className="flex flex-wrap gap-2">
                {backlinks.map((link) => (
                  <button
                    key={link.targetId}
                    onClick={() => handleInternalNavigate(link.targetId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-200 text-xs transition-all group"
                  >
                    <span className="text-cyan-400 font-semibold">{link.label}:</span>
                    <span className="font-semibold group-hover:text-cyan-300">{link.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      <CharacterSheetModal
        item={activeSheetItem}
        isOpen={isSheetModalOpen}
        onClose={() => {
          setIsSheetModalOpen(false);
          if (isFicha && !linkedCharacter) {
            onClose();
          }
        }}
        onSaveItem={onSaveItem}
        currentUser={currentUser}
        wikiData={wikiData}
        onNavigateTo={(targetId) => {
          setIsSheetModalOpen(false);
          handleInternalNavigate(targetId);
        }}
      />
    </div>
  );
};


