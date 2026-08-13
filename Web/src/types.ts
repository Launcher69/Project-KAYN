export type CategoryType = 'todos' | 'npc' | 'lugar' | 'objeto' | 'faccion' | 'trama' | 'mundo' | string;

export interface RelationItem {
  id_destino?: string;
  target_id?: string;
  relacion?: string;
  [key: string]: any;
}

export type RelationsData = RelationItem[] | Record<string, any>;

export interface WikiItem {
  id: string;
  tipo: string; // npc, lugar, objeto, faccion, trama, mundo
  nombre: string;
  mundo_id: string;
  relaciones?: RelationsData;
  detalles?: Record<string, string | string[] | number | boolean>;
  etiquetas_discord?: string[];
  contenido_lore?: string;
  imagenes?: string[];
  url_discord?: string;
  isFavorite?: boolean;
  createdAt?: string;
}

export type ViewMode = 'cards' | 'graph' | 'timeline' | 'table';

export type SortOption = 'name_asc' | 'name_desc' | 'type' | 'relations_desc';

export interface FilterState {
  search: string;
  world: string;
  category: CategoryType;
  tag: string;
  favoritesOnly: boolean;
  sortBy: SortOption;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role?: 'admin' | 'user' | 'guest';
  avatarUrl?: string;
  avatarColor?: string;
  allowedWorldIds?: string[] | null; // Legacy / Fallback field
  viewableWorldIds?: string[] | null; // Worlds the user can VIEW (null = all worlds)
  editableWorldIds?: string[] | null; // Worlds the user can EDIT (null = all allowed worlds)
  favorites: string[]; // List of WikiItem IDs marked as favorites
  createdAt: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedEntities?: string[];
}
