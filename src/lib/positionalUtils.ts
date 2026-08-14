export type PositionalGroup = 'POINT GUARDS' | 'FORWARDS' | 'CENTERS';

/**
 * Classify athlete into Positional Group for Ehime Orange Vikings.
 * Official Roster Groups:
 * POINT GUARDS: Furuno (#2), Kodama (#14), Tawatari (#78)
 * FORWARDS: Hayashi (#1), Aoki (#8), Toshino (#13), Takeuchi (#17), Hines (#44)
 * CENTERS: Parker (#3), Radovic (#11), Haarms (#16), Watt (#50), Tamaki (#65)
 */
export function getPositionalGroup(player: {
  id?: string;
  number?: string;
  player_number?: string;
  displayName?: string;
  player_name?: string;
  position?: string;
}): PositionalGroup {
  const num = (player.number || player.player_number || '').replace(/[^0-9]/g, '');
  const name = (player.displayName || player.player_name || '').toLowerCase();

  // POINT GUARDS: Furuno (#2), Kodama (#14), Tawatari (#78)
  if (
    num === '2' || num === '14' || num === '78' ||
    name.includes('furuno') || name.includes('kodama') || name.includes('tawatari') ||
    player.id === 'p2' || player.id === 'p7' || player.id === 'p13'
  ) {
    return 'POINT GUARDS';
  }

  // CENTERS: Parker (#3), Radovic (#11), Haarms (#16), Watt (#50), Tamaki (#65)
  if (
    num === '3' || num === '11' || num === '16' || num === '50' || num === '65' ||
    name.includes('parker') || name.includes('radovic') || name.includes('haarms') ||
    name.includes('watt') || name.includes('tamaki') ||
    player.id === 'p3' || player.id === 'p5' || player.id === 'p8' || player.id === 'p11' || player.id === 'p12'
  ) {
    return 'CENTERS';
  }

  // FORWARDS: Hayashi (#1), Aoki (#8), Toshino (#13), Takeuchi (#17), Hines (#44)
  if (
    num === '1' || num === '8' || num === '13' || num === '17' || num === '44' ||
    name.includes('hayashi') || name.includes('aoki') || name.includes('toshino') ||
    name.includes('takeuchi') || name.includes('hines') ||
    player.id === 'p1' || player.id === 'p4' || player.id === 'p6' || player.id === 'p9' || player.id === 'p10'
  ) {
    return 'FORWARDS';
  }

  // Fallback if needed
  const pos = (player.position || '').toUpperCase();
  if (pos.includes('PG')) return 'POINT GUARDS';
  if (pos.includes('C')) return 'CENTERS';
  return 'FORWARDS';
}

/**
 * Formats any numerical value as a rounded whole number.
 * NEVER display decimals.
 */
export function formatWholeNumber(val: number | null | undefined, fallback = '0'): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return Math.round(val).toLocaleString();
}
