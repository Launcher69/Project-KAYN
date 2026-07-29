import { WikiItem, RelationItem } from '../types';

export function cleanText(text: string): string {
  if (!text) return '';
  const str = text.toString()
    .replace(/^(world_|npc_|pc_|lugar_|obj_|objeto_|faccion_|trama_)/i, '')
    .replace(/_/g, ' ');

  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getDisplayName(idOrName: string, wikiData: WikiItem[]): string {
  if (!idOrName) return '';
  
  // 1. Direct match by item ID
  const foundById = wikiData.find((i) => i.id === idOrName);
  if (foundById && foundById.nombre) return foundById.nombre;

  // 2. Look up by world item matching mundo_id or id
  const foundWorld = wikiData.find(
    (i) => (i.tipo === 'mundo' || i.tipo === 'world') && (i.mundo_id === idOrName || i.id === idOrName)
  );
  if (foundWorld && foundWorld.nombre) return foundWorld.nombre;

  return cleanText(idOrName);
}

export function getItemTypeBadgeColor(tipo: string): { bg: string; text: string; border: string; glow: string } {
  const t = (tipo || 'entidad').toLowerCase();
  switch (t) {
    case 'npc':
    case 'personaje':
    case 'pc':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        glow: 'shadow-emerald-500/20',
      };
    case 'lugar':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        glow: 'shadow-blue-500/20',
      };
    case 'objeto':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        glow: 'shadow-amber-500/20',
      };
    case 'faccion':
      return {
        bg: 'bg-purple-500/15',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        glow: 'shadow-purple-500/20',
      };
    case 'trama':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        glow: 'shadow-rose-500/20',
      };
    case 'mundo':
      return {
        bg: 'bg-cyan-500/15',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        glow: 'shadow-cyan-500/20',
      };
    case 'magia':
    case 'magias':
    case 'hechizo':
      return {
        bg: 'bg-fuchsia-500/15',
        text: 'text-fuchsia-400',
        border: 'border-fuchsia-500/30',
        glow: 'shadow-fuchsia-500/20',
      };
    case 'habilidad':
    case 'habilidades':
    case 'poder':
      return {
        bg: 'bg-teal-500/15',
        text: 'text-teal-400',
        border: 'border-teal-500/30',
        glow: 'shadow-teal-500/20',
      };
    default:
      return {
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30',
        glow: 'shadow-indigo-500/20',
      };
  }
}

export interface ParsedRelation {
  targetId: string;
  label: string;
  name: string;
  targetType?: string;
}

export function parseRelations(item: WikiItem, wikiData: WikiItem[]): ParsedRelation[] {
  let rawRelaciones: RelationItem[] = [];

  if (Array.isArray(item.relaciones)) {
    rawRelaciones = item.relaciones;
  } else if (item.relaciones && typeof item.relaciones === 'object') {
    Object.entries(item.relaciones).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (typeof v === 'object' && (v.id_destino || v.target_id)) {
            rawRelaciones.push(v);
          } else if (typeof v === 'string') {
            rawRelaciones.push({ id_destino: v, relacion: key });
          }
        });
      } else if (typeof val === 'string') {
        rawRelaciones.push({ id_destino: val, relacion: key });
      }
    });
  }

  const directRelations: ParsedRelation[] = rawRelaciones
    .map((r) => {
      if (typeof r === 'string') {
        const targetObj = wikiData.find((i) => i.id === r);
        return {
          targetId: r,
          label: 'Relacionado',
          name: getDisplayName(r, wikiData),
          targetType: targetObj?.tipo || 'entidad',
        };
      }
      const targetId = r.id_destino || r.target_id || '';
      const targetObj = wikiData.find((i) => i.id === targetId);
      return {
        targetId,
        label: cleanText(r.relacion || 'Vínculo'),
        name: getDisplayName(targetId, wikiData),
        targetType: targetObj?.tipo || 'entidad',
      };
    })
    .filter((r) => r.targetId !== '');

  return directRelations;
}

export function findBacklinks(item: WikiItem, wikiData: WikiItem[]): ParsedRelation[] {
  const directRelations = parseRelations(item, wikiData);
  const directTargetIds = new Set(directRelations.map((r) => r.targetId));

  return wikiData
    .filter((other) => {
      if (other.id === item.id || !other.relaciones) return false;
      if (directTargetIds.has(other.id)) return false;

      if (Array.isArray(other.relaciones)) {
        return other.relaciones.some((r: any) => (r.id_destino || r.target_id || r) === item.id);
      } else if (typeof other.relaciones === 'object') {
        return JSON.stringify(other.relaciones).includes(item.id);
      }
      return false;
    })
    .map((other) => ({
      targetId: other.id,
      label: `Mencionado en ${cleanText(other.tipo || 'Entidad')}`,
      name: other.nombre || other.id,
      targetType: other.tipo,
    }));
}
