import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { WikiItem } from '../types';
import {
  getDisplayName,
  getItemTypeBadgeColor,
  parseRelations,
  findBacklinks,
  cleanText,
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
} from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface DetailModalProps {
  itemId: string | null;
  wikiData: WikiItem[];
  onClose: () => void;
  onNavigateTo: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  itemId,
  wikiData,
  onClose,
  onNavigateTo,
  onToggleFavorite,
}) => {
  if (!itemId) return null;

  // History stack for modal internal navigation
  const [historyStack, setHistoryStack] = useState<string[]>([itemId]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Sync when initial itemId changes from outside
  useEffect(() => {
    if (itemId && historyStack[historyIndex] !== itemId) {
      setHistoryStack([itemId]);
      setHistoryIndex(0);
    }
  }, [itemId]);

  const currentId = historyStack[historyIndex] || itemId;
  const item = wikiData.find((i) => i.id === currentId);

  if (!item) return null;

  const badgeColors = getItemTypeBadgeColor(item.tipo);
  const worldName = getDisplayName(item.mundo_id, wikiData);
  const hasImages = item.imagenes && item.imagenes.length > 0;
  const [activeImage, setActiveImage] = useState<string>(hasImages ? item.imagenes![0] : '');

  // Update active image when current item changes
  useEffect(() => {
    if (item.imagenes && item.imagenes.length > 0) {
      setActiveImage(item.imagenes[0]);
    } else {
      setActiveImage('');
    }
  }, [currentId]);

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

  const isCharacter = ['npc', 'pc', 'personaje'].includes((item.tipo || '').toLowerCase());
  const sectionTitle = isCharacter ? '📖 Biografía y Historia' : '📖 Descripción Detallada';

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
              className={`hidden sm:flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
            >
              {(item.tipo || 'entidad').toUpperCase()}
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
                    src={activeImage || item.imagenes![0]}
                    alt={item.nombre || item.id}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Gallery Thumbnails */}
                {item.imagenes!.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {item.imagenes!.map((img, idx) => (
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

              {/* Attributes Grid */}
              {item.detalles && Object.keys(item.detalles).length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                  {Object.entries(item.detalles).map(([k, v]) => (
                    <div key={k} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        {cleanText(k)}
                      </span>
                      <span className="text-xs font-medium text-slate-200 mt-0.5 block">
                        {Array.isArray(v) ? v.join(', ') : String(v)}
                      </span>
                    </div>
                  ))}
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
                    h3: ({ children }) => (
                      <div className="mt-6 mb-3 pt-3 border-t border-slate-800/80">
                        <h3 className="text-xs sm:text-sm font-bold text-indigo-300 border-l-4 border-indigo-500 pl-3 py-1 flex items-center gap-2 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent rounded-r-xl shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{children}</span>
                        </h3>
                      </div>
                    ),
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
                      <ul className="space-y-1.5 my-3 pl-0">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1.5 my-3 text-slate-300 pl-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-xs text-slate-300 bg-slate-900/50 border border-slate-800/70 px-3 py-1.5 rounded-xl">
                        <span className="text-indigo-400 font-bold mt-0.5">•</span>
                        <div className="flex-1">{children}</div>
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-indigo-200 bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20">
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
    </div>
  );
};
