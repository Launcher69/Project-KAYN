import { User, WikiItem } from '../types';

export type WorldPermissionLevel = 'none' | 'view' | 'edit';

/**
 * Helper to check if a user can VIEW a specific world and its contents.
 * - Admin users CAN view everything.
 * - Guest/Normal users with viewableWorldIds (or fallback allowedWorldIds) === null CAN view everything.
 * - Guest/Normal users with viewableWorldIds array CAN ONLY view items in allowed worlds.
 */
export function canUserViewWorld(
  user: User | null | undefined,
  worldId: string | null | undefined,
  wikiData: WikiItem[] = []
): boolean {
  if (!user) return true;
  if (user.role === 'admin' || user.username?.toLowerCase() === 'admin') return true;

  if (!worldId) return false;

  // Fallback to allowedWorldIds if viewableWorldIds is undefined
  const viewableList = user.viewableWorldIds !== undefined ? user.viewableWorldIds : user.allowedWorldIds;

  if (viewableList === null || viewableList === undefined) {
    return true; // Unrestricted viewing
  }

  if (!Array.isArray(viewableList) || viewableList.length === 0) {
    return false;
  }

  const target = worldId.toLowerCase().trim();
  const allowedNormalized = viewableList.map((w) => w.toLowerCase().trim());

  if (allowedNormalized.includes('all') || allowedNormalized.includes('*')) {
    return true;
  }

  const candidateKeys = new Set<string>([target]);
  if (!target.startsWith('mundo_')) candidateKeys.add(`mundo_${target}`);
  if (target.startsWith('mundo_')) candidateKeys.add(target.replace('mundo_', ''));

  const matchingWorld = wikiData.find(
    (i) => (i.tipo === 'mundo' || i.tipo === 'world') && (i.id === worldId || i.mundo_id === worldId)
  );
  if (matchingWorld) {
    if (matchingWorld.id) candidateKeys.add(matchingWorld.id.toLowerCase());
    if (matchingWorld.mundo_id) candidateKeys.add(matchingWorld.mundo_id.toLowerCase());
    if (matchingWorld.nombre) candidateKeys.add(matchingWorld.nombre.toLowerCase());
  }

  return allowedNormalized.some((w) => {
    if (!w) return false;
    return candidateKeys.has(w) || Array.from(candidateKeys).some((ck) => ck === w || ck.includes(w) || w.includes(ck));
  });
}

/**
 * Check if a user has EDITING rights for a specific world ID.
 */
export function canUserEditWorld(
  user: User | null | undefined,
  worldId: string | null | undefined,
  wikiData: WikiItem[] = []
): boolean {
  if (!user || user.role === 'guest') return false;
  if (user.role === 'admin' || user.username?.toLowerCase() === 'admin') return true;

  if (!worldId) return false;

  // Fallback to allowedWorldIds if editableWorldIds is undefined
  const editableList = user.editableWorldIds !== undefined ? user.editableWorldIds : user.allowedWorldIds;

  if (editableList === null || editableList === undefined) {
    return true; // Unrestricted editing
  }

  if (!Array.isArray(editableList) || editableList.length === 0) {
    return false;
  }

  const target = worldId.toLowerCase().trim();
  const allowedNormalized = editableList.map((w) => w.toLowerCase().trim());

  if (allowedNormalized.includes('all') || allowedNormalized.includes('*')) {
    return true;
  }

  const candidateKeys = new Set<string>([target]);
  if (!target.startsWith('mundo_')) candidateKeys.add(`mundo_${target}`);
  if (target.startsWith('mundo_')) candidateKeys.add(target.replace('mundo_', ''));

  const matchingWorld = wikiData.find(
    (i) => (i.tipo === 'mundo' || i.tipo === 'world') && (i.id === worldId || i.mundo_id === worldId)
  );
  if (matchingWorld) {
    if (matchingWorld.id) candidateKeys.add(matchingWorld.id.toLowerCase());
    if (matchingWorld.mundo_id) candidateKeys.add(matchingWorld.mundo_id.toLowerCase());
    if (matchingWorld.nombre) candidateKeys.add(matchingWorld.nombre.toLowerCase());
  }

  return allowedNormalized.some((w) => {
    if (!w) return false;
    return candidateKeys.has(w) || Array.from(candidateKeys).some((ck) => ck === w || ck.includes(w) || w.includes(ck));
  });
}

/**
 * Helper to check if a user has permissions to edit/delete a specific WikiItem.
 */
export function canUserEditItem(
  user: User | null | undefined,
  item: WikiItem | null | undefined,
  wikiData: WikiItem[] = []
): boolean {
  if (!user || user.role === 'guest') return false;
  if (user.role === 'admin' || user.username?.toLowerCase() === 'admin') return true;
  if (!item) return false;

  const targetWorldId = item.tipo === 'mundo' ? item.id : item.mundo_id;
  return canUserEditWorld(user, targetWorldId, wikiData);
}

/**
 * Get the explicit permission level ('none' | 'view' | 'edit') for a user in a world.
 */
export function getWorldPermissionLevel(
  user: User | null | undefined,
  worldId: string | null | undefined,
  wikiData: WikiItem[] = []
): WorldPermissionLevel {
  if (!user) return 'none';
  if (user.role === 'admin' || user.username?.toLowerCase() === 'admin') return 'edit';
  if (!worldId) return 'none';

  if (canUserEditWorld(user, worldId, wikiData)) return 'edit';
  if (canUserViewWorld(user, worldId, wikiData)) return 'view';
  return 'none';
}
