export type CategoryType = 'todos' | 'npc' | 'lugar' | 'objeto' | 'faccion' | 'trama' | 'mundo';

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

export interface FilterState {
  search: string;
  world: string;
  category: CategoryType;
  tag: string;
  favoritesOnly: boolean;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedEntities?: string[];
}
