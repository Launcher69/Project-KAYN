import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Share2,
  GitCommit,
  Table,
  Star,
  Globe,
  Search,
  X,
  ArrowUpDown,
  ChevronDown,
  User as UserIcon,
  Settings,
  LogOut,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { ViewMode, FilterState, SortOption, User } from '../types';
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
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onOpenAdminModal?: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  filter,
  setFilter,
  viewMode,
  setViewMode,
  worlds,
  getWorldDisplayName,
  onOpenNewItem,
  totalCount,
  filteredCount,
  currentUser,
  onOpenAuth,
  onOpenSettings,
  onOpenAdminModal,
  onLogout,
}) => {
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isWorldDropdownOpen, setIsWorldDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const worldDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(target)) {
        setIsViewDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortDropdownOpen(false);
      }
      if (worldDropdownRef.current && !worldDropdownRef.current.contains(target)) {
        setIsWorldDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const viewOptions = [
    { mode: 'cards' as ViewMode, label: 'Fichas', icon: LayoutGrid },
    { mode: 'graph' as ViewMode, label: 'Grafo', icon: Share2 },
    { mode: 'timeline' as ViewMode, label: 'Tramas', icon: GitCommit },
    { mode: 'table' as ViewMode, label: 'Tabla', icon: Table },
  ];

  const currentViewOption = viewOptions.find(o => o.mode === viewMode) || viewOptions[0];
  const CurrentViewIcon = currentViewOption.icon;

  const sortOptions: { id: SortOption; label: string; iconStr: string }[] = [
    { id: 'name_asc', label: 'Nombre (A - Z)', iconStr: '🔤' },
    { id: 'name_desc', label: 'Nombre (Z - A)', iconStr: '🔤' },
    { id: 'type', label: 'Tipo de Entidad', iconStr: '🏷️' },
    { id: 'relations_desc', label: 'Más Relaciones', iconStr: '🔗' },
  ];

  const currentSortOption = sortOptions.find(s => s.id === (filter.sortBy || 'name_asc')) || sortOptions[0];

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

          {/* Custom World Selector Dropdown */}
          <div className="relative w-full sm:w-auto sm:min-w-[170px] shrink-0" ref={worldDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsWorldDropdownOpen(prev => !prev);
                playSound('click');
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800/80 text-indigo-300 rounded-xl text-xs font-semibold border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer shadow-sm"
              title="Filtrar por mundo"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {filter.world === 'all' ? 'Todos los Mundos' : getWorldDisplayName(filter.world)}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isWorldDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWorldDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-full sm:w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl z-[100] overflow-hidden py-1 divide-y divide-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setFilter(prev => ({ ...prev, world: 'all' }));
                    setIsWorldDropdownOpen(false);
                    playSound('click');
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                    filter.world === 'all'
                      ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span>🌍</span>
                  <span>Todos los Mundos</span>
                </button>

                {worlds.map((w) => {
                  const isActive = filter.world === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setFilter(prev => ({ ...prev, world: w }));
                        setIsWorldDropdownOpen(false);
                        playSound('click');
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <span>🌌</span>
                      <span className="truncate">{getWorldDisplayName(w)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          
          {/* Action Buttons (Filters & Sorting) */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Custom Sort Selector Dropdown */}
            <div className="relative shrink-0" ref={sortDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortDropdownOpen(prev => !prev);
                  playSound('click');
                }}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800/80 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer shadow-sm"
                title="Ordenar entidades"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>{currentSortOption.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl z-[100] overflow-hidden py-1 divide-y divide-slate-800/80">
                  {sortOptions.map((opt) => {
                    const isActive = (filter.sortBy || 'name_asc') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFilter(prev => ({ ...prev, sortBy: opt.id }));
                          setIsSortDropdownOpen(false);
                          playSound('click');
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <span className="text-xs">{opt.iconStr}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Favorites Toggle Button */}
            <button
              onClick={() => {
                setFilter(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }));
                playSound('click');
              }}
              className={`p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                filter.favoritesOnly
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
              }`}
              title="Mostrar solo favoritos"
            >
              <Star className={`w-4 h-4 ${filter.favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

          </div>

          {/* View Mode Dropdown */}
          <div className="relative shrink-0" ref={viewDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsViewDropdownOpen(prev => !prev);
                playSound('click');
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer"
              title="Cambiar modo de vista"
            >
              <CurrentViewIcon className="w-3.5 h-3.5 text-white" />
              <span>{currentViewOption.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-indigo-200 transition-transform duration-200 ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isViewDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl z-[100] overflow-hidden py-1 divide-y divide-slate-800/80">
                {viewOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = viewMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => {
                        setViewMode(opt.mode);
                        setIsViewDropdownOpen(false);
                        playSound('click');
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Profile Avatar Circle Dropdown */}
          <div className="relative shrink-0" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileDropdownOpen(prev => !prev);
                playSound('click');
              }}
              className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 border border-slate-700 hover:border-indigo-500/80 shadow-md transition-all cursor-pointer overflow-hidden group"
              title={currentUser ? `Perfil de @${currentUser.username}` : 'Iniciar sesión'}
            >
              {currentUser ? (
                currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className={`w-full h-full ${currentUser.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white font-bold text-xs uppercase group-hover:scale-105 transition-transform`}>
                    {currentUser.username.slice(0, 2)}
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:bg-indigo-600/30 transition-all">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl z-[100] overflow-hidden divide-y divide-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                {currentUser ? (
                  <>
                    {/* User Profile Header */}
                    <div className="px-3 py-2.5 bg-slate-950/60">
                      <div className="flex items-center gap-2.5">
                        {currentUser.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt={currentUser.username}
                            className="w-7 h-7 rounded-full object-cover shrink-0 shadow-inner border border-slate-700"
                          />
                        ) : (
                          <div className={`w-7 h-7 rounded-full ${currentUser.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white font-bold text-[11px] uppercase shrink-0 shadow-inner`}>
                            {currentUser.username.slice(0, 2)}
                          </div>
                        )}
                        <div className="overflow-hidden min-w-0">
                          <p className="text-xs font-bold text-white truncate">@{currentUser.username}</p>
                          {currentUser.username.toLowerCase() === 'invitado' ? (
                            <p className="text-[10px] text-amber-300 font-medium">Modo Invitado</p>
                          ) : currentUser.role === 'admin' ? (
                            <p className="text-[10px] text-indigo-400 font-medium">Administrador</p>
                          ) : (
                            <p className="text-[10px] text-slate-400">Usuario registrado</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Menu Options */}
                    <div className="py-1">
                      {(currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'admin') && onOpenAdminModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onOpenAdminModal();
                            playSound('click');
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold w-full text-left text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Panel de Permisos</span>
                        </button>
                      )}

                      {currentUser.username.toLowerCase() === 'invitado' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onOpenAuth();
                            playSound('click');
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold w-full text-left text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Iniciar Sesión</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          onOpenSettings();
                          playSound('click');
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium w-full text-left text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Configuración</span>
                      </button>

                      {currentUser.username.toLowerCase() !== 'invitado' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onLogout();
                            playSound('click');
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium w-full text-left text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Cerrar Sesión</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onOpenAuth();
                        playSound('click');
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold w-full text-left text-indigo-300 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Iniciar Sesión / Registrarse</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
