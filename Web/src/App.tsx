/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WikiItem, ViewMode, FilterState } from './types';
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

  // Fetch wiki_database.json dynamically on startup from GitHub (direct/raw & CDN) with local fallbacks
  useEffect(() => {
    const fetchWikiDatabase = async () => {
      const timestamp = Date.now();
      const endpoints = [
        // 1. Direct raw GitHub URL (updates immediately)
        `https://raw.githubusercontent.com/Launcher69/Project-KAYN/main/Web/public/wiki_database.json?t=${timestamp}`,
        // 2. jsDelivr CDN URL (GitHub mirror)
        `https://cdn.jsdelivr.net/gh/Launcher69/Project-KAYN@main/Web/public/wiki_database.json?t=${timestamp}`,
        // 3. Local server API
        `/api/wiki-data?t=${timestamp}`,
        // 4. Local static asset
        `/wiki_database.json?t=${timestamp}`,
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const body = await res.json();
            const dataArray = Array.isArray(body) ? body : body?.data;
            if (Array.isArray(dataArray) && dataArray.length > 0) {
              setWikiData(dataArray);
              console.log(`Wiki database loaded successfully from: ${url}`);
              return;
            }
          }
        } catch (err) {
          console.warn(`Attempt failed for ${url}:`, err);
        }
      }
    };

    fetchWikiDatabase();
  }, []);

  // Save to localStorage when wikiData changes
  useEffect(() => {
    try {
      localStorage.setItem('multiverse_wiki_data', JSON.stringify(wikiData));
    } catch {
      // Ignore quota errors
    }
  }, [wikiData]);

  // Filter & View State
  const [filter, setFilter] = useState<FilterState>({
    search: '',
    world: 'all',
    category: 'todos',
    tag: '',
    favoritesOnly: false,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedModalId, setSelectedModalId] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<WikiItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Extract worlds
  const worlds = [...new Set(wikiData.map((item) => item.mundo_id).filter(Boolean))];

  const getWorldDisplayName = (worldId: string) => {
    return getDisplayName(worldId, wikiData);
  };

  // Items scoped to selected world (or all) for CategoryBar and StatsOverview counters
  const itemsByWorld = filter.world === 'all'
    ? wikiData
    : wikiData.filter((item) => item.mundo_id === filter.world || (item.tipo === 'mundo' && item.id === filter.world));

  // Filter items logic
  const filteredItems = wikiData.filter((item) => {

    // 1. World match
    if (filter.world !== 'all' && item.mundo_id !== filter.world) {
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
  });

  // Favorite toggle handler
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWikiData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
    );
    playSound('click');
  };

  // Delete item handler
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de eliminar esta entidad del lore?')) {
      setWikiData((prev) => prev.filter((item) => item.id !== id));
      if (selectedModalId === id) setSelectedModalId(null);
      playSound('click');
    }
  };

  // Save new/edited item
  const handleSaveItem = (savedItem: WikiItem) => {
    setWikiData((prev) => {
      const exists = prev.some((i) => i.id === savedItem.id);
      if (exists) {
        return prev.map((i) => (i.id === savedItem.id ? savedItem : i));
      } else {
        return [savedItem, ...prev];
      }
    });
    setIsEditorOpen(false);
    setItemToEdit(null);
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
                  onClick={() => setFilter({ search: '', world: 'all', category: 'todos', tag: '', favoritesOnly: false })}
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

    </div>
  );
}
