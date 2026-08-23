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

/**
 * Parses Anaerobic Activity Time from Kinexon CSV exports.
 * Supports timestamp strings like "00:07:34" or "00:11:08" or "07:34",
 * as well as raw numeric values.
 * Reads first 2 as hours, next 2 as minutes, next 2 as seconds.
 * Converts to minutes rounded to nearest whole minute.
 */
export function parseAnaerobicTimeToMinutes(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (!str) return null;

  // Handle timestamp strings with colons, e.g., "00:07:34", "00:11:08", "07:34"
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => p.trim());
    if (parts.length === 3) {
      // Format: HH:MM:SS (Hours:Minutes:Seconds)
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const s = parseInt(parts[2], 10) || 0;
      const totalSecs = h * 3600 + m * 60 + s;
      if (totalSecs === 0) return 0;
      return Math.round(totalSecs / 60) || 1;
    } else if (parts.length === 2) {
      // Format: MM:SS (Minutes:Seconds)
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      const totalSecs = m * 60 + s;
      if (totalSecs === 0) return 0;
      return Math.round(totalSecs / 60) || 1;
    }
  }

  // Handle numeric value
  const num = parseFloat(str.replace(/,/g, ''));
  if (isNaN(num)) return null;

  // If passed as raw seconds (> 120), convert to minutes
  if (num > 120) {
    return Math.round(num / 60) || 1;
  }

  return Math.round(num);
}

