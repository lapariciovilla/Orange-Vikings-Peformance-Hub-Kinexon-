import { Player, PlayerSessionRecord, SessionMeta, CoachSettings, RPEEntry } from '../types';

export const INITIAL_ROSTER: Player[] = [
  {
    id: 'p1',
    number: '#1',
    displayName: 'Eiji Hayashi',
    position: 'Small Forward',
    aliases: ['Eiji Hayashi', 'Hayashi Eiji'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p2',
    number: '#2',
    displayName: 'Takumi Furuno',
    position: 'Point Guard',
    aliases: ['Takumi Furuno', 'Furuno Takumi'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p3',
    number: '#3',
    displayName: 'Michael Parker',
    position: 'Center',
    aliases: ['Michael Parker', 'Mike Parker'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p4',
    number: '#8',
    displayName: 'Ryuji Aoki',
    position: 'Forward',
    aliases: ['Ryuji Aoki', 'Aoki Ryuji'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p5',
    number: '#11',
    displayName: 'Nemanja Radovic',
    position: 'Center',
    aliases: ['Nemanja Radovic', 'Radovic Nemanja'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p6',
    number: '#13',
    displayName: 'Yoshihiko Toshino',
    position: 'Forward',
    aliases: ['Yoshihiko Toshino', 'Toshino Yoshihiko'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p7',
    number: '#14',
    displayName: 'Takamichi Kodama',
    position: 'Point Guard',
    aliases: ['Takamichi Kodama', 'Kodama Takamichi', 'Takayuki Kodama'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p8',
    number: '#16',
    displayName: 'Matt Haarms',
    position: 'Center',
    aliases: ['Matt Haarms', 'Matt Harms', 'Haarms Matt'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p9',
    number: '#17',
    displayName: 'Riki Takeuchi',
    position: 'Forward',
    aliases: ['Riki Takeuchi', 'Takeuchi Riki'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p10',
    number: '#44',
    displayName: 'Shaquille Hines',
    position: 'Forward',
    aliases: ['Shaquille Hines', 'Shaquille Hinds', 'Hines Shaquille'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p11',
    number: '#50',
    displayName: 'Mitchell Watt',
    position: 'Center',
    aliases: ['Mitchell Watt', 'Watt Mitchell', 'Mitch Watt'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p12',
    number: '#65',
    displayName: 'Shogo Tamaki',
    position: 'Center',
    aliases: ['Shogo Tamaki', 'Tamaki Shogo'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
  {
    id: 'p13',
    number: '#78',
    displayName: 'Ryo Tawatari',
    position: 'Point Guard',
    aliases: ['Ryo Tawatari', 'Tawatari Ryo'],
    status: 'ACTIVE',
    isConfirmed: true,
  },
];

export const INITIAL_SESSIONS_META: SessionMeta[] = [];

export const INITIAL_PLAYER_RECORDS: PlayerSessionRecord[] = [];

export const DEFAULT_SETTINGS: CoachSettings = {
  yellow_threshold_pct: 15,
  red_threshold_pct: 30,
  min_sessions_for_baseline: 3,
};

export const INITIAL_RPE_ENTRIES: RPEEntry[] = [];

// Sample CSV export content that coach Luis can copy/download to test Kinexon CSV import with all 8 core metrics
export const SAMPLE_KINEXON_CSV_CONTENT = `Player Name,Jersey #,Distance (m),Accumulated Accel Load,Accumulated Accel Load / min,Anaerobic Activity Time,Deceleration Load,Deceleration Load / min,Jump Load,Mechanical Load
Ryuji Aoki,8,7120,148.0,1.85,00:07:34,122.5,1.53,36,910.0
Nemanja Radovic,11,5410,96.2,1.20,00:11:08,84.1,1.05,45,720.5
Matt Haarms,16,5890,108.4,1.35,00:04:40,94.0,1.18,58,830.0
Takamichi Kodama,14,6526,138.0,1.72,00:05:10,112.9,1.41,28,845.2
Takumi Furuno,2,4999,105.4,1.32,00:03:50,88.1,1.10,19,650.0
Yoshihiko Toshino,13,4031,84.2,1.05,00:03:00,71.0,0.89,15,520.3
Eiji Hayashi,1,5003,108.9,1.36,00:04:05,91.3,1.14,25,665.8
Riki Takeuchi,17,4148,87.6,1.09,00:03:15,73.5,0.92,18,542.1
Shaquille Hines,44,5890,121.5,1.52,00:04:50,104.2,1.30,38,788.6
Mitchell Watt,50,5110,89.5,1.12,00:03:25,76.2,0.95,36,695.2
Shogo Tamaki,65,4724,98.1,1.23,00:03:40,82.4,1.03,22,610.1
Ryo Tawatari,78,4823,101.2,1.26,00:03:45,85.6,1.07,21,631.5
Michael Parker,3,5430,115.0,1.44,00:04:20,96.8,1.21,31,732.0
`;
