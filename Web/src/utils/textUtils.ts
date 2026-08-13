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
    case 'poderes':
    case 'sistema_poder':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        glow: 'shadow-amber-500/20',
      };
    case 'ficha':
    case 'fichas':
    case 'ficha_personaje':
    case 'expediente':
    case 'sheet':
      return {
        bg: 'bg-cyan-500/15',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        glow: 'shadow-cyan-500/20',
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

export function getItemImages(item: WikiItem, wikiData: WikiItem[]): string[] {
  if (item.imagenes && item.imagenes.length > 0 && item.imagenes.some((img) => img && img.trim().length > 0)) {
    return item.imagenes.filter((img) => img && img.trim().length > 0);
  }

  // Fallback to world image if item doesn't have any valid images
  if (item.mundo_id) {
    const worldItem = wikiData.find(
      (i) => (i.tipo === 'mundo' || i.tipo === 'world') && (i.id === item.mundo_id || i.mundo_id === item.mundo_id)
    );
    if (worldItem && worldItem.imagenes && worldItem.imagenes.length > 0) {
      return worldItem.imagenes.filter((img) => img && img.trim().length > 0);
    }
  }

  return [];
}

/**
 * Transforms raw tabbed or unformatted Magic / Power / Skill text into beautifully formatted Markdown.
 */
export type TierLevel = 'T1' | 'T2' | 'T3' | 'T4';

export interface StatAttribute {
  id: string;
  name: string;
  description: string;
  category: 'fisico' | 'combate' | 'mente_mistica';
  value: number; // 1 to 10
  tier: TierLevel; // T1, T2, T3, T4
  tierLabel?: string;
  note?: string;
}

export function getTierDefaultLabel(tier: TierLevel): string {
  switch (tier) {
    case 'T1':
      return 'Terrenal';
    case 'T2':
      return 'Sobrenatural';
    case 'T3':
      return 'Cósmico / Divino';
    case 'T4':
      return 'Anomalía';
    default:
      return 'Terrenal';
  }
}

export function getUniversalDefaultStats(): StatAttribute[] {
  return [
    // 🔴 FÍSICO
    {
      id: 'fuerza',
      name: 'Fuerza',
      description: 'Potencia muscular, capacidad de carga y daño físico bruto.',
      category: 'fisico',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },
    {
      id: 'resistencia',
      name: 'Resistencia',
      description: 'Aguantar impactos, salud, dureza física y tolerancia al dolor/cansancio.',
      category: 'fisico',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },
    {
      id: 'destreza',
      name: 'Destreza',
      description: 'Velocidad de reacción, reflejos, esquiva, agilidad y coordinación.',
      category: 'fisico',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },

    // 🔵 COMBATE
    {
      id: 'combate_cuerpo',
      name: 'Combate Cuerpo a Cuerpo',
      description: 'Artes marciales, pelea callejera y uso de armas blancas.',
      category: 'combate',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },
    {
      id: 'combate_distancia',
      name: 'Combate a Distancia',
      description: 'Puntería con proyectiles, armas de fuego o disparos de energía.',
      category: 'combate',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },

    // 🟢 MENTE Y MÍSTICA
    {
      id: 'inteligencia',
      name: 'Inteligencia',
      description: 'Razonamiento lógico, ciencia, estrategia e ingeniería.',
      category: 'mente_mistica',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },
    {
      id: 'magia_ocultismo',
      name: 'Magia / Ocultismo',
      description: 'Control arcano, energía espiritual, conjuros y poder místico.',
      category: 'mente_mistica',
      value: 5,
      tier: 'T1',
      tierLabel: 'Terrenal',
      note: '',
    },
  ];
}

export function hasCharacterStats(item: WikiItem): boolean {
  if (!item || !item.detalles) return false;

  if (item.detalles.ficha_atributos) {
    try {
      const raw = typeof item.detalles.ficha_atributos === 'string'
        ? JSON.parse(item.detalles.ficha_atributos)
        : item.detalles.ficha_atributos;
      if (Array.isArray(raw) && raw.length > 0) return true;
    } catch (e) {
      // fallback
    }
  }

  const statKeys = [
    'fuerza', 'resistencia', 'destreza', 'combate',
    'inteligencia', 'magia', 'ocultismo'
  ];

  return Object.keys(item.detalles).some((key) => {
    const lk = key.toLowerCase().trim();
    return statKeys.some((sk) => lk.includes(sk));
  });
}

/**
 * Parses character sheet attributes from WikiItem details or text.
 */
export function parseCharacterStats(item: WikiItem): StatAttribute[] {
  const defaultStats = getUniversalDefaultStats();

  // If item has stored JSON stats in detalles.ficha_atributos
  if (item.detalles && item.detalles.ficha_atributos) {
    try {
      const raw = typeof item.detalles.ficha_atributos === 'string'
        ? JSON.parse(item.detalles.ficha_atributos)
        : item.detalles.ficha_atributos;
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((st: any) => ({
          ...st,
          tierLabel: st.tierLabel || getTierDefaultLabel(st.tier || 'T1'),
        }));
      }
    } catch (e) {
      // fallback
    }
  }

  // Parse from details map if individual stat keys exist (e.g. Fuerza: "9 / 10 - [T2] Sobrenatural")
  if (item.detalles) {
    const updated = defaultStats.map((stat) => {
      // Find matching key in detalles
      const matchingEntry = Object.entries(item.detalles!).find(([k]) => {
        const lk = k.toLowerCase().replace(/_/g, ' ');
        const statNameLower = stat.name.toLowerCase();
        return lk.includes(statNameLower) || statNameLower.includes(lk);
      });

      if (matchingEntry) {
        const valStr = String(matchingEntry[1]);
        // Extract 1-10 number
        const valMatch = valStr.match(/(\d+)\s*\/\s*10/);
        let numVal = stat.value;
        if (valMatch) {
          numVal = Math.min(10, Math.max(1, parseInt(valMatch[1], 10)));
        }

        // Extract Tier [T1-T4]
        const tierMatch = valStr.match(/\[(T[1-4])\]/i);
        let tierVal: TierLevel = stat.tier;
        if (tierMatch) {
          tierVal = tierMatch[1].toUpperCase() as TierLevel;
        }

        // Extract Note or Label
        let noteStr = valStr;
        if (valStr.includes('—')) {
          noteStr = valStr.split('—')[1]?.trim() || '';
        } else if (valStr.includes('-')) {
          noteStr = valStr.split('-')[1]?.trim() || '';
        }

        return {
          ...stat,
          value: numVal,
          tier: tierVal,
          tierLabel: getTierDefaultLabel(tierVal),
          note: noteStr,
        };
      }

      return stat;
    });

    return updated;
  }

  return defaultStats;
}

/**
 * Transforms raw tabbed or unformatted Magic / Power / Skill text into beautifully formatted Markdown.
 */
export function formatMagicTextToMarkdown(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  const resultLines: string[] = [];
  let pendingSkillName = '';

  const isRankLine = (line: string) => /^(rango|nivel|rank|tier)\s*\d+/i.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If line is a header like Rango 0, Rango 1, Rango 2, 3 y 4
    if (isRankLine(line)) {
      if (pendingSkillName) {
        resultLines.push(`* **${pendingSkillName}**`);
        pendingSkillName = '';
      }
      resultLines.push(`\n### ⚡ ${line}`);
      continue;
    }

    // Check if line already has markdown formatting
    if (line.startsWith('#') || line.startsWith('* ') || line.startsWith('- ')) {
      if (pendingSkillName) {
        resultLines.push(`* **${pendingSkillName}**`);
        pendingSkillName = '';
      }
      resultLines.push(line);
      continue;
    }

    // Check if line has key-value pair separated by colon (e.g. "Conexión: El usuario...")
    if (line.includes(':') && !line.startsWith('http')) {
      const parts = line.split(':');
      const title = parts[0].trim();
      const desc = parts.slice(1).join(':').trim();
      if (pendingSkillName) {
        resultLines.push(`* **${pendingSkillName}**`);
        pendingSkillName = '';
      }
      resultLines.push(`* **${title}**: ${desc}`);
      continue;
    }

    // If we have a pending skill name from previous line, this line is its description
    if (pendingSkillName) {
      resultLines.push(`* **${pendingSkillName}**: ${line}`);
      pendingSkillName = '';
      continue;
    }

    // Lookahead: is next line a description, or is this line a skill title?
    if (i < lines.length - 1 && !isRankLine(lines[i + 1]) && !lines[i + 1].startsWith('*') && !lines[i + 1].startsWith('-') && line.length < 50) {
      pendingSkillName = line;
    } else {
      resultLines.push(line);
    }
  }

  if (pendingSkillName) {
    resultLines.push(`* **${pendingSkillName}**`);
  }

  return resultLines.join('\n').trim();
}



