// Persistent localStorage records for the 10 new smart Noir games

export interface ExtraGameRecord {
  wins: number;
  losses: number;
  draws: number;
  bestScore: number;
  bestTimeSec: number | null;
  streak: number;
  bestStreak: number;
}

export type ExtraGameId =
  | 'connect4'
  | 'reversi'
  | 'checkers'
  | 'battleship'
  | 'gomoku'
  | 'sudoku'
  | 'minesweeper'
  | 'cipher'
  | 'breakout'
  | 'pong';

export type ExtraGamesRecordsMap = Record<ExtraGameId, ExtraGameRecord>;

const STORAGE_KEY = 'midnight_noir_extra_games_records_v1';

const EMPTY_RECORD: ExtraGameRecord = {
  wins: 0,
  losses: 0,
  draws: 0,
  bestScore: 0,
  bestTimeSec: null,
  streak: 0,
  bestStreak: 0,
};

const ALL_EXTRA_IDS: ExtraGameId[] = [
  'connect4',
  'reversi',
  'checkers',
  'battleship',
  'gomoku',
  'sudoku',
  'minesweeper',
  'cipher',
  'breakout',
  'pong',
];

export function createEmptyExtraRecords(): ExtraGamesRecordsMap {
  return {
    connect4: { ...EMPTY_RECORD },
    reversi: { ...EMPTY_RECORD },
    checkers: { ...EMPTY_RECORD },
    battleship: { ...EMPTY_RECORD },
    gomoku: { ...EMPTY_RECORD },
    sudoku: { ...EMPTY_RECORD },
    minesweeper: { ...EMPTY_RECORD },
    cipher: { ...EMPTY_RECORD },
    breakout: { ...EMPTY_RECORD },
    pong: { ...EMPTY_RECORD },
  };
}

export function loadAllExtraRecords(): ExtraGamesRecordsMap {
  const base = createEmptyExtraRecords();
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ExtraGameId, Partial<ExtraGameRecord>>>;
    for (const id of ALL_EXTRA_IDS) {
      const rec = parsed[id];
      if (!rec) continue;
      base[id] = {
        wins: typeof rec.wins === 'number' ? rec.wins : 0,
        losses: typeof rec.losses === 'number' ? rec.losses : 0,
        draws: typeof rec.draws === 'number' ? rec.draws : 0,
        bestScore: typeof rec.bestScore === 'number' ? rec.bestScore : 0,
        bestTimeSec: typeof rec.bestTimeSec === 'number' ? rec.bestTimeSec : null,
        streak: typeof rec.streak === 'number' ? rec.streak : 0,
        bestStreak: typeof rec.bestStreak === 'number' ? rec.bestStreak : 0,
      };
    }
    return base;
  } catch {
    return base;
  }
}

export function loadExtraRecord(id: ExtraGameId): ExtraGameRecord {
  return loadAllExtraRecords()[id];
}

export function saveExtraGameOutcome(
  id: ExtraGameId,
  update: {
    outcome?: 'win' | 'loss' | 'draw';
    score?: number;
    timeSec?: number;
  }
): ExtraGameRecord {
  const all = loadAllExtraRecords();
  const cur = { ...all[id] };

  if (update.outcome === 'win') {
    cur.wins += 1;
    cur.streak += 1;
    cur.bestStreak = Math.max(cur.bestStreak, cur.streak);
  } else if (update.outcome === 'loss') {
    cur.losses += 1;
    cur.streak = 0;
  } else if (update.outcome === 'draw') {
    cur.draws += 1;
  }

  if (typeof update.score === 'number' && update.score > cur.bestScore) {
    cur.bestScore = update.score;
  }

  if (
    typeof update.timeSec === 'number' &&
    update.timeSec > 0 &&
    (cur.bestTimeSec === null || update.timeSec < cur.bestTimeSec)
  ) {
    cur.bestTimeSec = update.timeSec;
  }

  all[id] = cur;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage quota errors
    }
  }
  return cur;
}
