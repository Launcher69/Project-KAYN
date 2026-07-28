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
import { StatsOverview } from './components/StatsOverview';
import { WikiCard } from './components/WikiCard';
import { WikiGraph } from './components/WikiGraph';
import { TimelineView } from './components/TimelineView';
import { TableView } from './components/TableView';
import { DetailModal } from './components/DetailModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import { Layers, Plus, Globe } from 'lucide-react';
import { playSound } from './utils/soundEffects';

export default function App() {
  // Cargar datos desde localStorage como respaldo inicial
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

  // URL directa a tu archivo en GitHub Raw con anti-caché
  const GITHUB_RAW_URL = `https://raw.githubusercontent.com/launcher69/Project-KAYN/main/Web/public/wiki_database.json?t=${Date.now()}`;


  // Fetch ultra-rápido compatible con la política CORS de GitHub
  useEffect(() => {
    const fetchWikiDatabase = async () => {
      const timestamp = Date.now();
      
      // URLs con parámetro único de versión
      const GITHUB_RAW_URL = `https://raw.githubusercontent.com/launcher69/Project-KAYN/main/Web/public/wiki_database.json?v=${timestamp}`;
      const GITHUB_API_URL = `https://api.github.com/repos/launcher69/Project-KAYN/contents/Web/public/wiki_database.json?v=${timestamp}`;

      try {
        console.log('🔄 Solicitando datos en tiempo real...');

        // 1. Intento principal: GitHub Raw (petición simple sin cabeceras extra para evitar error CORS)
        const response = await fetch(GITHUB_RAW_URL);
        if (response.ok) {
          const parsed = await response.json();
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('✨ ¡Wiki cargada con éxito desde GitHub Raw!', parsed.length, 'elementos');
            setWikiData(parsed);
            return;
          }
        }

        // 2. Intento de respaldo: API REST de GitHub
        const apiRes = await fetch(GITHUB_API_URL);
        if (apiRes.ok) {
          const fileData = await apiRes.json();
          if (fileData && fileData.content) {
            const binaryString = atob(fileData.content.replace(/\s/g, ''));
            const bytes = new Uint8Array(binaryString.split('').map(c => c.charCodeAt(0)));
            const jsonText = new TextDecoder('utf-8').decode(bytes);
            const parsed = JSON.parse(jsonText);

            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('⚡ Wiki cargada desde la API de GitHub:', parsed.length, 'elementos');
              setWikiData(parsed);
              return;
            }
          }
        }
      } catch (err) {
        console.error('❌ Error al cargar datos dinámicos:', err);
      }
    };

    fetchWikiDatabase();
  }, []);


  // Guardar en localStorage cuando wikiData cambie
  useEffect(() => {
    try {
      localStorage.setItem('multiverse_wiki_data', JSON.stringify(wikiData));
    } catch {
      // Ignorar errores de espacio
    }
  }, [wikiData]);

  // Filtros y Estado de Vista
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

  // Extraer Mundos
  const worlds = [...new Set(wikiData.map((item) => item.mundo_id).filter(Boolean))];

  const getWorldDisplayName = (worldId: string) => {
    return getDisplayName(worldId, wikiData);
  };

  // Lógica de filtrado de elementos
  const filteredItems = wikiData.filter((item) => {
    // 1. Coincidencia de Mundo
    if (filter.world !== 'all' && item.mundo_id !== filter.world) {
      return false;
    }

    // 2. Coincidencia de Categoría
    if (filter.category !== 'todos') {
      const type = (item.tipo || 'entidad').toLowerCase();
      if (filter.category === 'npc') {
        if (!['npc', 'pc', 'personaje'].includes(type)) return false;
      } else if (type !== filter.category) {
        return false;
      }
    }

    // 3. Solo Favoritos
    if (filter.favoritesOnly && !item.isFavorite) {
      return false;
    }

    // 4. Coincidencia de Etiqueta (Tag)
    if (filter.tag) {
      const tags = item.etiquetas_discord || [];
      if (!tags.includes(filter.tag)) return false;
    }

    // 5. Búsqueda por Texto
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

  // Handler para conmutar Favoritos
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWikiData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
    );
    playSound('click');
  };

  // Handler para eliminar entidad
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de eliminar esta entidad del lore?')) {
      setWikiData((prev) => prev.filter((item) => item.id !== id));
      if (selectedModalId === id) setSelectedModalId(null);
      playSound('click');
    }
  };

  // Handler para guardar cambios desde el editor
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

      {/* Barra de Categorías */}
      <CategoryBar filter={filter} setFilter={setFilter} items={wikiData} />

      {/* Dashboard Resumen Estadísticas */}
      <StatsOverview items={wikiData} getWorldDisplayName={getWorldDisplayName} />

      {/* Contenido Principal según Modo de Vista */}
      <main className="pb-16">
        
        {/* VISTA DE TARJETAS */}
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

        {/* VISTA DE GRAFO INTERACTIVO */}
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

        {/* VISTA DE CRONOLOGÍA */}
        {viewMode === 'timeline' && (
          <TimelineView
            items={filteredItems}
            wikiData={wikiData}
            onOpenModal={(id) => setSelectedModalId(id)}
          />
        )}

        {/* VISTA DE TABLA */}
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

      {/* Modal de Detalle */}
      <DetailModal
        itemId={selectedModalId}
        wikiData={wikiData}
        onClose={() => setSelectedModalId(null)}
        onNavigateTo={(id) => setSelectedModalId(id)}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Modal de Editor de Entidad */}
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