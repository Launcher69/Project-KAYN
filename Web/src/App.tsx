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
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { Layers, Plus, Globe } from 'lucide-react';
import { playSound } from './utils/soundEffects';

export default function App() {
  // Load data from localStorage if available, or fall back to initial dataset
  const [wikiData, setWikiData] = useState<WikiItem[]>(() => {
    try {
      const saved = localStorage.getItem('multiverse_wiki_data');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_WIKI_DATA;
  });

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

  // Fetch wiki data: prioritize Cloudflare D1 /api/wiki-data first, then fallbacks
  const fetchWikiDatabase = async () => {
    const timestamp = Date.now();

    // 1. Try local Cloudflare D1 API first
    try {
      const d1Res = await fetch(`/api/wiki-data?t=${timestamp}`);
      if (d1Res.ok) {
        const d1Data = await d1Res.json();
        const items = Array.isArray(d1Data) ? d1Data : d1Data?.data;
        if (Array.isArray(items) && items.length > 0) {
          setWikiData(items);
          return;
        }
      }
    } catch (err) {
      console.warn('Cloudflare D1 /api/wiki-data fetch error, trying fallbacks:', err);
    }

    // 2. Try GitHub REST API
    try {
      const ghApiRes = await fetch(
        `https://api.github.com/repos/Launcher69/Project-KAYN/contents/Web/public/wiki_database.json?t=${timestamp}`
      );
      if (ghApiRes.ok) {
        const ghJson = await ghApiRes.json();
        if (ghJson.content && ghJson.encoding === 'base64') {
          const cleanBase64 = ghJson.content.replace(/\n/g, '');
          const binaryString = atob(cleanBase64);
          const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
          const decodedText = new TextDecoder('utf-8').decode(bytes);
          const parsedData = JSON.parse(decodedText);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setWikiData(parsedData);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('GitHub API fetch failed or rate limited:', err);
    }

    // 3. Fallbacks: Raw GitHub URL, CDN, Local File
    const fallbackUrls = [
      `https://raw.githubusercontent.com/Launcher69/Project-KAYN/main/Web/public/wiki_database.json?t=${timestamp}`,
      `https://cdn.jsdelivr.net/gh/Launcher69/Project-KAYN@main/Web/public/wiki_database.json?t=${timestamp}`,
      `/wiki_database.json?t=${timestamp}`,
    ];

    for (const url of fallbackUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          const dataArray = Array.isArray(body) ? body : body?.data;
          if (Array.isArray(dataArray) && dataArray.length > 0) {
            setWikiData(dataArray);
            return;
          }
        }
      } catch {
        // Fallback attempt failed
      }
    }
  };

  // Initial fetch and automatic periodic background synchronization (polling every 10s + focus trigger)
  useEffect(() => {
    fetchServerUsers();
    fetchWikiDatabase();

    // Auto sync every 10 seconds for real-time changes across mobile and PC
    const interval = setInterval(() => {
      fetchServerUsers();
      fetchWikiDatabase();
    }, 10000);

    // Auto sync when user switches back to the browser window/tab or unlocks screen
    const handleFocusOrVisibility = () => {
      if (!document.hidden) {
        fetchServerUsers();
        fetchWikiDatabase();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, []);

  // Save to localStorage when wikiData changes
  useEffect(() => {
    try {
      localStorage.setItem('multiverse_wiki_data', JSON.stringify(wikiData));
    } catch {
      // Ignore quota errors
    }
  }, [wikiData]);

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

  // Helper to check if world is allowed for a user
  const isWorldAllowedForUser = (worldId: string, user: User | null): boolean => {
    if (!user) return true;
    if (user.role === 'admin' || user.username.toLowerCase() === 'admin') return true;
    if (user.allowedWorldIds === null || user.allowedWorldIds === undefined) return true;

    const candidateKeys = new Set<string>([worldId]);
    const matchingWorld = wikiData.find(
      (i) => (i.tipo === 'mundo' || i.tipo === 'world') && (i.id === worldId || i.mundo_id === worldId)
    );
    if (matchingWorld) {
      if (matchingWorld.id) candidateKeys.add(matchingWorld.id);
      if (matchingWorld.mundo_id) candidateKeys.add(matchingWorld.mundo_id);
    }

    return user.allowedWorldIds.some((allowedId) => candidateKeys.has(allowedId));
  };

  // Extract worlds filtered by current user permissions
  const worlds = useMemo(() => {
    const allWorlds = [...new Set(wikiData.map((item) => item.mundo_id).filter(Boolean))];
    return allWorlds.filter((wId) => isWorldAllowedForUser(wId, currentUser));
  }, [wikiData, currentUser]);

  // If currently selected world filter is not allowed for active user, reset filter to 'all'
  useEffect(() => {
    if (filter.world !== 'all' && currentUser && !isWorldAllowedForUser(filter.world, currentUser)) {
      setFilter((prev) => ({ ...prev, world: 'all' }));
    }
  }, [filter.world, currentUser]);

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

  // Filter entities according to current user's world permissions
  const allowedWikiData = useMemo(() => {
    return wikiDataWithUserFavorites.filter((item) => {
      if (item.tipo === 'mundo') {
        return isWorldAllowedForUser(item.id, currentUser);
      }
      return isWorldAllowedForUser(item.mundo_id, currentUser);
    });
  }, [wikiDataWithUserFavorites, currentUser]);

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

  const handleUpdateUserPermissions = async (userId: string, allowedWorldIds: string[] | null) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedWorldIds }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
        return;
      }
    } catch (err) {
      console.warn('Backend update failed:', err);
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, allowedWorldIds } : u)));
  };

  const handleUpdateUserRole = async (userId: string, role: 'admin' | 'user') => {
    const allowedWorldIds = role === 'admin' ? null : [];
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, allowedWorldIds }),
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
      prev.map((u) => (u.id === userId ? { ...u, role, allowedWorldIds: role === 'admin' ? null : u.allowedWorldIds } : u))
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

    try {
      await fetch('/api/wiki-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [savedItem] }),
      });
    } catch (err) {
      console.warn('Failed to persist saved item to backend:', err);
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
            onOpenModal={(id) => setSelectedModalId(id)}
            onToggleFavorite={handleToggleFavorite}
            onEditItem={(i, e) => {
              e.stopPropagation();
              setItemToEdit(i);
              setIsEditorOpen(true);
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
      />

      {/* Item Editor / Creator Modal */}
      {isEditorOpen && (
        <ItemEditorModal
          itemToEdit={itemToEdit}
          wikiData={wikiData}
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

    </div>
  );
}
