/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { WikiItem, ViewMode, FilterState, SortOption, User } from './types';
import { INITIAL_WIKI_DATA } from './data/initialWikiData';
import { getDisplayName } from './utils/textUtils';
import { Navbar } from './components/Navbar';
import { CategoryBar } from './components/CategoryBar';
import { WikiCard } from './components/WikiCard';
import { WikiGraph } from './components/WikiGraph';
import { TimelineView } from './components/TimelineView';
import { TableView } from './components/TableView';
import { DetailModal } from './components/DetailModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import { CharacterSheetModal } from './components/CharacterSheetModal';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { Layers, Plus, Globe, Check, AlertCircle } from 'lucide-react';
import { playSound } from './utils/soundEffects';
import { sendDiscordLog } from './utils/discordLogger';
import { canUserEditItem, canUserEditWorld, canUserViewWorld } from './utils/permissions';

export default function App() {
  // wikiData siempre se carga directamente del JSON en vivo (sin caché de localStorage)
  const [wikiData, setWikiData] = useState<WikiItem[]>([]);

  // User Authentication & User Persistence
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('multiverse_wiki_users');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('multiverse_wiki_current_user_id');
    } catch {
      return null;
    }
  });

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [characterSheetItemToEdit, setCharacterSheetItemToEdit] = useState<WikiItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 4500);
  };

  // Fetch users from server to sync persistent permissions & admin changes
  const fetchServerUsers = async () => {
    try {
      const res = await fetch(`/api/users?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      }
    } catch (err) {
      console.warn('Backend users API not available, using local cache:', err);
    }
  };

  // Fetch wiki data: jsDelivr ultra-fast loader with local fallback
  const fetchWikiDatabase = async () => {
    const timestamp = Date.now();
    const JSDELIVR_URL = `https://cdn.jsdelivr.net/gh/Launcher69/Project-KAYN@main/Web/public/wiki_database.json?v=${timestamp}`;
    const LOCAL_URL = `/wiki_database.json?v=${timestamp}`;

    try {
      console.log('🔄 Solicitando datos actualizados a jsDelivr...');
      const response = await fetch(JSDELIVR_URL);
      if (response.ok) {
        const parsed = await response.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('⚡ Wiki cargada al instante desde jsDelivr:', parsed.length, 'elementos');
          setWikiData(parsed);
          return;
        }
      }

      const localRes = await fetch(LOCAL_URL);
      if (localRes.ok) {
        const parsed = await localRes.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWikiData(parsed);
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ Error al cargar datos dinámicos:', err);
    }
  };

  // Carga dinámicamente el JSON en vivo sin guardar ni leer de localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('multiverse_wiki_data');
    } catch {}

    fetchServerUsers();

    const fetchWikiDatabaseEffect = async () => {
      const timestamp = Date.now();
      const JSDELIVR_URL = `https://cdn.jsdelivr.net/gh/Launcher69/Project-KAYN@main/Web/public/wiki_database.json?v=${timestamp}`;
      const GITHUB_API_URL = `https://api.github.com/repos/Launcher69/Project-KAYN/contents/Web/public/wiki_database.json?t=${timestamp}`;

      try {
        // 1. Intentar servidor local / API Cloudflare primero
        const localApiRes = await fetch(`/api/wiki-data?t=${timestamp}`);
        if (localApiRes.ok) {
          const apiJson = await localApiRes.json();
          if (apiJson.success && Array.isArray(apiJson.data) && apiJson.data.length > 0) {
            setWikiData(apiJson.data);
            return;
          }
        }

        // 2. Intentar API REST de GitHub (0s de retraso, bypass a la caché CDN de 5 min)
        try {
          const ghApiRes = await fetch(GITHUB_API_URL, {
            headers: { 'Cache-Control': 'no-cache, no-store', 'User-Agent': 'WikiApp' },
          });
          if (ghApiRes.ok) {
            const ghJson = await ghApiRes.json();
            if (ghJson.content && ghJson.encoding === 'base64') {
              const cleanBase64 = ghJson.content.replace(/\n/g, '');
              const binaryBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
              const decodedText = new TextDecoder('utf-8').decode(binaryBytes);
              const parsed = JSON.parse(decodedText);
              const dataArray = Array.isArray(parsed) ? parsed : parsed?.data;
              if (Array.isArray(dataArray) && dataArray.length > 0) {
                setWikiData(dataArray);
                return;
              }
            }
          }
        } catch (ghErr) {
          console.warn('GitHub REST API fetch fallback warning:', ghErr);
        }

        // 3. Fallback a jsDelivr CDN
        const response = await fetch(JSDELIVR_URL);
        if (response.ok) {
          const parsed = await response.json();
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWikiData(parsed);
            return;
          }
        }

        // 4. Último recurso absoluto si todo lo demás falla (sin conexión): INITIAL_WIKI_DATA
        setWikiData(INITIAL_WIKI_DATA);
      } catch (err) {
        console.warn('⚠️ Error al cargar datos dinámicos, usando fallback inicial:', err);
        setWikiData(INITIAL_WIKI_DATA);
      }
    };

    fetchWikiDatabaseEffect();
  }, []);

  // Save users to localStorage as backup
  useEffect(() => {
    try {
      localStorage.setItem('multiverse_wiki_users', JSON.stringify(users));
    } catch {
      // Quota error
    }
  }, [users]);

  // Save currentUserId to localStorage
  useEffect(() => {
    try {
      if (currentUserId) {
        localStorage.setItem('multiverse_wiki_current_user_id', currentUserId);
      } else {
        localStorage.removeItem('multiverse_wiki_current_user_id');
      }
    } catch {
      // Quota error
    }
  }, [currentUserId]);

  const guestUser = useMemo<User>(() => {
    return (
      users.find((u) => u.username.toLowerCase() === 'invitado' || u.role === 'guest') || {
        id: 'user_invitado',
        username: 'Invitado',
        password: '',
        role: 'guest',
        allowedWorldIds: [],
        favorites: [],
        avatarColor: 'bg-slate-600',
        createdAt: new Date().toISOString(),
      }
    );
  }, [users]);

  const currentUser = useMemo<User>(() => {
    if (currentUserId) {
      const found = users.find((u) => u.id === currentUserId);
      if (found) return found;
    }
    return guestUser;
  }, [users, currentUserId, guestUser]);

  // Log page access to Discord Webhook (once per browser session per user)
  useEffect(() => {
    if (currentUser && currentUser.username) {
      const loggedKey = `discord_logged_${currentUser.id}`;
      try {
        if (!sessionStorage.getItem(loggedKey)) {
          sessionStorage.setItem(loggedKey, 'true');
          sendDiscordLog({
            username: currentUser.username,
            role: currentUser.role,
            avatarUrl: currentUser.avatarUrl,
            eventType: 'entry',
          });
        }
      } catch {
        // Ignore session storage errors
      }
    }
  }, [currentUser]);

  // Filter & View State
  const [filter, setFilter] = useState<FilterState>(() => {
    let initialSortBy: SortOption = 'name_asc';
    try {
      const savedSort = localStorage.getItem('multiverse_wiki_sortby');
      if (savedSort) {
        initialSortBy = savedSort as SortOption;
      }
    } catch {
      // Ignore
    }
    return {
      search: '',
      world: 'all',
      category: 'todos',
      tag: '',
      favoritesOnly: false,
      sortBy: initialSortBy,
    };
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const savedView = localStorage.getItem('multiverse_wiki_viewmode');
      if (savedView) {
        return savedView as ViewMode;
      }
    } catch {
      // Ignore
    }
    return 'cards';
  });

  // Save filter preferences to localStorage
  useEffect(() => {
    try {
      if (filter.sortBy) {
        localStorage.setItem('multiverse_wiki_sortby', filter.sortBy);
      }
    } catch {
      // Ignore
    }
  }, [filter.sortBy]);

  useEffect(() => {
    try {
      if (viewMode) {
        localStorage.setItem('multiverse_wiki_viewmode', viewMode);
      }
    } catch {
      // Ignore
    }
  }, [viewMode]);
  const [selectedModalId, setSelectedModalId] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<WikiItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Extract worlds viewable by current user
  const worlds = useMemo(() => {
    const allWorlds = [...new Set(wikiData.map((item) => item.mundo_id).filter(Boolean))];
    return allWorlds.filter((wId) => canUserViewWorld(currentUser, wId, wikiData));
  }, [wikiData, currentUser]);

  // If currently selected world filter is not viewable for active user, reset filter to 'all'
  useEffect(() => {
    if (filter.world !== 'all') {
      if (currentUser && !canUserViewWorld(currentUser, filter.world, wikiData)) {
        setFilter((prev) => ({ ...prev, world: 'all' }));
      }
      if (filter.category === 'mundo') {
        setFilter((prev) => ({ ...prev, category: 'todos' }));
      }
    }
  }, [filter.world, filter.category, currentUser, wikiData]);

  const getWorldDisplayName = (worldId: string) => {
    return getDisplayName(worldId, wikiData);
  };

  // Map user favorites onto wikiData items for dynamic UI display
  const wikiDataWithUserFavorites = useMemo(() => {
    return wikiData.map((item) => ({
      ...item,
      isFavorite: currentUser
        ? currentUser.favorites.includes(item.id)
        : Boolean(item.isFavorite),
    }));
  }, [wikiData, currentUser]);

  // Filter entities according to current user's view permissions
  const allowedWikiData = useMemo(() => {
    return wikiDataWithUserFavorites.filter((item) => {
      const targetWorldId = item.tipo === 'mundo' ? item.id : item.mundo_id;
      return canUserViewWorld(currentUser, targetWorldId, wikiData);
    });
  }, [wikiDataWithUserFavorites, currentUser, wikiData]);

  // Items scoped to selected world (or all) for CategoryBar counters
  const itemsByWorld = filter.world === 'all'
    ? allowedWikiData
    : allowedWikiData.filter((item) => item.mundo_id === filter.world || (item.tipo === 'mundo' && item.id === filter.world));

  // Filter & sort items logic
  const filteredItems = allowedWikiData
    .filter((item) => {
      // 1. World match
      if (filter.world !== 'all' && item.mundo_id !== filter.world && item.id !== filter.world) {
        return false;
      }

      // 2. Category match
      if (filter.category !== 'todos') {
        const type = (item.tipo || 'entidad').toLowerCase();
        if (filter.category === 'npc') {
          if (!['npc', 'pc', 'personaje'].includes(type)) return false;
        } else if (filter.category === 'poder') {
          if (!['poder', 'poderes', 'habilidad', 'habilidades', 'sistema_poder', 'magia', 'magias', 'hechizo'].includes(type)) return false;
        } else if (filter.category === 'ficha') {
          if (!['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes(type)) return false;
        } else if (type !== filter.category) {
          return false;
        }
      }

      // 3. Favorites only
      if (filter.favoritesOnly && !item.isFavorite) {
        return false;
      }

      // 4. Tag match
      if (filter.tag) {
        const tags = item.etiquetas_discord || [];
        if (!tags.includes(filter.tag)) return false;
      }

      // 5. Search text match
      if (filter.search.trim()) {
        const query = filter.search.toLowerCase().trim();
        const name = (item.nombre || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        const type = (item.tipo || '').toLowerCase();
        const lore = (item.contenido_lore || '').toLowerCase();
        const tagsStr = (item.etiquetas_discord || []).join(' ').toLowerCase();

        return (
          name.includes(query) ||
          id.includes(query) ||
          type.includes(query) ||
          lore.includes(query) ||
          tagsStr.includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      const sortBy = filter.sortBy || 'name_asc';
      if (sortBy === 'name_asc') {
        return (a.nombre || a.id).localeCompare(b.nombre || b.id, 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return (b.nombre || b.id).localeCompare(a.nombre || a.id, 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'type') {
        return (a.tipo || '').localeCompare(b.tipo || '', 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'relations_desc') {
        const getRelCount = (item: WikiItem) => {
          if (Array.isArray(item.relaciones)) return item.relaciones.length;
          if (item.relaciones && typeof item.relaciones === 'object') return Object.keys(item.relaciones).length;
          return 0;
        };
        return getRelCount(b) - getRelCount(a);
      }
      return 0;
    });

  // User Favorite toggle handler (Per User account)
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      // Prompt user to login/register to save favorites
      setIsAuthOpen(true);
      return;
    }

    const isFav = currentUser.favorites.includes(id);
    const updatedFavs = isFav
      ? currentUser.favorites.filter((favId) => favId !== id)
      : [...currentUser.favorites, id];

    const updatedUser: User = { ...currentUser, favorites: updatedFavs };
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    playSound('click');

    try {
      await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites: updatedFavs }),
      });
    } catch (err) {
      console.warn('Failed to persist favorites to backend:', err);
    }
  };

  // User auth actions
  const handleRegisterUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    try {
      await fetch(`/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
    } catch (err) {
      console.warn('Failed to update user on server:', err);
    }
  };

  const handleUpdateUserPermissions = async (
    userId: string,
    viewableWorldIds: string[] | null,
    editableWorldIds: string[] | null
  ) => {
    const updates = {
      viewableWorldIds,
      editableWorldIds,
      allowedWorldIds: editableWorldIds,
    };

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
        return;
      }
    } catch (err) {
      console.warn('Backend update failed:', err);
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, viewableWorldIds, editableWorldIds, allowedWorldIds: editableWorldIds }
          : u
      )
    );
  };

  const handleUpdateUserRole = async (userId: string, role: 'admin' | 'user') => {
    const allowedWorldIds = role === 'admin' ? null : [];
    const viewableWorldIds = role === 'admin' ? null : [];
    const editableWorldIds = role === 'admin' ? null : [];
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, allowedWorldIds, viewableWorldIds, editableWorldIds }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
        return;
      }
    } catch (err) {
      console.warn('Backend update role failed:', err);
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              role,
              allowedWorldIds: role === 'admin' ? null : u.allowedWorldIds,
              viewableWorldIds: role === 'admin' ? null : u.viewableWorldIds,
              editableWorldIds: role === 'admin' ? null : u.editableWorldIds,
            }
          : u
      )
    );
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        if (currentUserId === userId) {
          setCurrentUserId(null);
        }
        return;
      }
    } catch (err) {
      console.warn('Backend delete failed:', err);
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleRegisterUserByAdmin = async (newUser: User) => {
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser.username, password: newUser.password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUsers((prev) => [...prev, data.user]);
        return;
      }
    } catch (err) {
      console.warn('Backend register failed:', err);
    }
    setUsers((prev) => [...prev, newUser]);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
  };

  // Delete item handler
  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetItem = wikiData.find((item) => item.id === id);
    if (!canUserEditItem(currentUser, targetItem, wikiData)) {
      alert('🔒 Solo un administrador o usuario autorizado para este mundo puede eliminar contenido.');
      return;
    }

    if (window.confirm('¿Estás seguro de eliminar esta entidad del lore?')) {
      const updated = wikiData.filter((item) => item.id !== id);
      setWikiData(updated);
      if (selectedModalId === id) setSelectedModalId(null);
      playSound('click');

      try {
        await fetch('/api/wiki-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updated }),
        });
      } catch (err) {
        console.warn('Failed to delete item on backend:', err);
      }
    }
  };

  // Save new/edited item
  const handleSaveItem = async (savedItem: WikiItem) => {
    if (!canUserEditItem(currentUser, savedItem, wikiData)) {
      alert('🔒 No tienes permisos para modificar o guardar elementos en este mundo.');
      return;
    }
    // 1. Prepare exact payload format specified by Discord Bot API
    const discordPayload = {
      id: savedItem.id,
      tipo: savedItem.tipo,
      nombre: savedItem.nombre,
      mundo_id: savedItem.mundo_id,
      relaciones: savedItem.relaciones || [],
      detalles: savedItem.detalles || {},
      contenido_lore: savedItem.contenido_lore || '',
      url_discord: savedItem.url_discord || '',
    };

    let updated: WikiItem[] = [];
    setWikiData((prev) => {
      const exists = prev.some((i) => i.id === savedItem.id);
      if (exists) {
        updated = prev.map((i) => (i.id === savedItem.id ? savedItem : i));
      } else {
        updated = [savedItem, ...prev];
      }
      return updated;
    });

    setIsEditorOpen(false);
    setItemToEdit(null);

    // Save to local wiki-data backend cache
    try {
      await fetch('/api/wiki-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updated }),
      });
    } catch (err) {
      console.warn('Failed to persist saved item to local backend:', err);
    }

    // If no url_discord provided, saved successfully on Web without contacting Discord bot
    if (!savedItem.url_discord || savedItem.url_discord.trim() === '') {
      showToast('Entidad guardada correctamente en la Web', 'success');
      playSound('success');
      return;
    }

    // Call Discord Bot server on Render (via Express proxy for CORS/Cold-start reliability)
    try {
      let botResponse;
      try {
        botResponse = await fetch('/api/edit-discord-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });
        if (!botResponse.ok && botResponse.status === 404) {
          throw new Error('Proxy 404');
        }
      } catch (proxyErr) {
        // Fallback to direct client fetch if proxy fails or returns 404
        botResponse = await fetch('https://wiki-bot-discord.onrender.com/api/edit-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });
      }

      let resData: any = {};
      try {
        resData = await botResponse.json();
      } catch {
        resData = { success: false, error: 'Respuesta no válida del servidor.' };
      }

      if (botResponse.ok && resData.success) {
        showToast('Ficha actualizada en Discord y Web', 'success');
        playSound('success');
        fetchWikiDatabase();
      } else {
        showToast(`Guardado en Web (Discord: ${resData.error || resData.message || 'Sin actualización'})`, 'success');
        playSound('success');
      }
    } catch (err: any) {
      console.error('Error enviando datos al Bot de Discord:', err);
      showToast('Guardado en Web correctamente', 'success');
      playSound('success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Navbar Header */}
      <Navbar
        filter={filter}
        setFilter={setFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        worlds={worlds}
        getWorldDisplayName={getWorldDisplayName}
        onOpenNewItem={() => {
          setItemToEdit(null);
          setIsEditorOpen(true);
        }}
        totalCount={wikiData.length}
        filteredCount={filteredItems.length}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdminModal={() => setIsAdminOpen(true)}
        onLogout={handleLogout}
      />

      {/* Category Bar */}
      <CategoryBar filter={filter} setFilter={setFilter} items={itemsByWorld} />


      {/* Main Content Views */}
      <main className="pb-16">
        
        {/* CARDS GRID VIEW */}
        {viewMode === 'cards' && (
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredItems.map((item, index) => (
                  <WikiCard
                    key={item.id}
                    item={item}
                    wikiData={wikiData}
                    onOpenModal={(id) => setSelectedModalId(id)}
                    onToggleFavorite={handleToggleFavorite}
                    onEditItem={(i, e) => {
                      e.stopPropagation();
                      if (!canUserEditItem(currentUser, i, wikiData)) {
                        alert('🔒 Solo los administradores o usuarios asignados a este mundo pueden modificar esta entidad.');
                        return;
                      }
                      setItemToEdit(i);
                      setIsEditorOpen(true);
                    }}
                    onDeleteItem={handleDeleteItem}
                    onSelectTag={(tag) => setFilter((prev) => ({ ...prev, tag }))}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 max-w-lg mx-auto space-y-4">
                <div className="p-4 rounded-full bg-slate-800/60 w-16 h-16 mx-auto flex items-center justify-center text-slate-500">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-200">No se encontraron entidades</h3>
                <p className="text-xs text-slate-400">
                  Intenta cambiar tus términos de búsqueda o ajustar los filtros seleccionados.
                </p>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, search: '', world: 'all', category: 'todos', tag: '', favoritesOnly: false }))}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                >
                  Restablecer Filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* GRAPH VIEW */}
        {viewMode === 'graph' && (
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
            <WikiGraph
              items={filteredItems}
              wikiData={wikiData}
              searchQuery={filter.search}
              selectedWorld={filter.world}
              onOpenModal={(id) => setSelectedModalId(id)}
            />
          </div>
        )}

        {/* TIMELINE VIEW */}
        {viewMode === 'timeline' && (
          <TimelineView
            items={filteredItems}
            wikiData={wikiData}
            onOpenModal={(id) => setSelectedModalId(id)}
          />
        )}

        {/* TABLE VIEW */}
        {viewMode === 'table' && (
          <TableView
            items={filteredItems}
            wikiData={wikiData}
            currentUser={currentUser}
            onOpenModal={(id) => setSelectedModalId(id)}
            onToggleFavorite={handleToggleFavorite}
            onEditItem={(i, e) => {
              e.stopPropagation();
              if (!canUserEditItem(currentUser, i, wikiData)) {
                alert('🔒 Solo los administradores o usuarios asignados a este mundo pueden modificar esta entidad.');
                return;
              }
              const isFicha = ['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes((i.tipo || '').toLowerCase());
              if (isFicha) {
                setCharacterSheetItemToEdit(i);
              } else {
                setItemToEdit(i);
                setIsEditorOpen(true);
              }
            }}
            onDeleteItem={handleDeleteItem}
          />
        )}

      </main>

      {/* Detail Viewer Modal */}
      <DetailModal
        itemId={selectedModalId}
        wikiData={wikiData}
        onClose={() => setSelectedModalId(null)}
        onNavigateTo={(id) => setSelectedModalId(id)}
        onToggleFavorite={handleToggleFavorite}
        onSaveItem={handleSaveItem}
        onEditItem={(itemToEdit) => {
          setSelectedModalId(null);
          const isFicha = ['ficha', 'fichas', 'ficha_personaje', 'expediente', 'sheet'].includes((itemToEdit.tipo || '').toLowerCase());
          if (isFicha) {
            setCharacterSheetItemToEdit(itemToEdit);
          } else {
            setItemToEdit(itemToEdit);
            setIsEditorOpen(true);
          }
        }}
        currentUser={currentUser}
      />

      {/* Character / Role Sheet Attribute Editor Modal (opened from Table view) */}
      {characterSheetItemToEdit && (
        <CharacterSheetModal
          item={characterSheetItemToEdit}
          isOpen={!!characterSheetItemToEdit}
          initialIsEditing={true}
          onClose={() => setCharacterSheetItemToEdit(null)}
          onSaveItem={(updated) => {
            handleSaveItem(updated);
            setCharacterSheetItemToEdit(null);
          }}
          currentUser={currentUser}
          wikiData={wikiData}
          onNavigateTo={(id) => setSelectedModalId(id)}
        />
      )}


      {/* Item Editor / Creator Modal */}
      {isEditorOpen && (
        <ItemEditorModal
          itemToEdit={itemToEdit}
          wikiData={wikiData}
          currentUser={currentUser}
          onSave={handleSaveItem}
          onClose={() => {
            setIsEditorOpen(false);
            setItemToEdit(null);
          }}
        />
      )}

      {/* User Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUserId(user.id);
          setIsAuthOpen(false);
        }}
        users={users}
        onRegisterUser={handleRegisterUser}
      />

      {/* User Settings Modal */}
      {currentUser && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
          onUpdateUser={handleUpdateUser}
        />
      )}

      {/* Admin User & World Permissions Modal */}
      {currentUser && (currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'admin') && (
        <AdminUsersModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          users={users}
          wikiData={wikiData}
          onUpdateUserPermissions={handleUpdateUserPermissions}
          onUpdateUserRole={handleUpdateUserRole}
          onDeleteUser={handleDeleteUser}
          onRegisterUserByAdmin={handleRegisterUserByAdmin}
        />
      )}

      {/* Toast Notification Popup */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl shadow-black animate-in slide-in-from-bottom-5 fade-in duration-200">
          {toast.type === 'success' ? (
            <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Check className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <span className="text-xs font-bold text-slate-100">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
