// IRON FLEET — 10x10 Naval Tactics with Bayesian Probability-Density AI

export const BS_SIZE = 10;

export interface ShipSpec {
  id: string;
  name: string;
  length: number;
}

export const FLEET_SPECS: ShipSpec[] = [
  { id: 'carrier', name: 'Dreadnought', length: 5 },
  { id: 'battleship', name: 'Ironclad', length: 4 },
  { id: 'cruiser', name: 'Vanguard', length: 3 },
  { id: 'submarine', name: 'Shadow Sub', length: 3 },
  { id: 'destroyer', name: 'Corsair', length: 2 },
];

export interface PlacedShip extends ShipSpec {
  row: number;
  col: number;
  horizontal: boolean;
  cells: Array<[number, number]>;
  hits: number;
  sunk: boolean;
}

export type ShotResult = 'empty' | 'miss' | 'hit' | 'sunk';
export type BattleshipDifficulty = 'ensign' | 'commander' | 'admiral';

export interface BattleshipState {
  playerShips: PlacedShip[];
  aiShips: PlacedShip[];
  playerShots: ShotResult[][]; // shots fired BY player ON AI board
  aiShots: ShotResult[][];     // shots fired BY AI ON player board
  turn: 'player' | 'ai';
  winner: 'player' | 'ai' | null;
  lastEvent: string;
  shotsFired: number;
  hitsLanded: number;
}

function emptyGrid(): ShotResult[][] {
  return Array.from({ length: BS_SIZE }, () => Array<ShotResult>(BS_SIZE).fill('empty'));
}

export function canPlaceShip(
  ships: PlacedShip[],
  row: number,
  col: number,
  length: number,
  horizontal: boolean
): boolean {
  const occupied = new Set<string>();
  for (const s of ships) {
    for (const [r, c] of s.cells) occupied.add(`${r},${c}`);
  }
  for (let i = 0; i < length; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r < 0 || r >= BS_SIZE || c < 0 || c >= BS_SIZE) return false;
    if (occupied.has(`${r},${c}`)) return false;
  }
  return true;
}

export function generateRandomFleet(rng: () => number = Math.random): PlacedShip[] {
  const ships: PlacedShip[] = [];
  for (const spec of FLEET_SPECS) {
    let placed = false;
    for (let attempt = 0; attempt < 250 && !placed; attempt++) {
      const horizontal = rng() < 0.5;
      const maxR = horizontal ? BS_SIZE : BS_SIZE - spec.length + 1;
      const maxC = horizontal ? BS_SIZE - spec.length + 1 : BS_SIZE;
      const row = Math.floor(rng() * maxR);
      const col = Math.floor(rng() * maxC);
      if (canPlaceShip(ships, row, col, spec.length, horizontal)) {
        const cells: Array<[number, number]> = [];
        for (let i = 0; i < spec.length; i++) {
          cells.push([horizontal ? row : row + i, horizontal ? col + i : col]);
        }
        ships.push({ ...spec, row, col, horizontal, cells, hits: 0, sunk: false });
        placed = true;
      }
    }
  }
  return ships;
}

export function createInitialBattleshipState(
  rng: () => number = Math.random
): BattleshipState {
  return {
    playerShips: generateRandomFleet(rng),
    aiShips: generateRandomFleet(rng),
    playerShots: emptyGrid(),
    aiShots: emptyGrid(),
    turn: 'player',
    winner: null,
    lastEvent: 'Select coordinates on the Enemy Sonar Grid to fire.',
    shotsFired: 0,
    hitsLanded: 0,
  };
}

function coordLabel(r: number, c: number): string {
  return `${String.fromCharCode(65 + r)}${c + 1}`;
}

export function firePlayerShot(
  state: BattleshipState,
  row: number,
  col: number
): { state: BattleshipState; result: ShotResult; sunkShipName?: string } {
  if (state.winner || state.turn !== 'player') return { state, result: 'empty' };
  if (state.playerShots[row][col] !== 'empty') return { state, result: 'empty' };

  const playerShots = state.playerShots.map((r) => r.slice());
  const aiShips = state.aiShips.map((s) => ({ ...s, cells: s.cells.slice() }));

  let hitShip: PlacedShip | null = null;
  for (const s of aiShips) {
    if (s.cells.some(([sr, sc]) => sr === row && sc === col)) {
      hitShip = s;
      break;
    }
  }

  let result: ShotResult = 'miss';
  let sunkShipName: string | undefined;
  let lastEvent = `Salvo at ${coordLabel(row, col)} — Splash in open water.`;

  if (hitShip) {
    hitShip.hits += 1;
    if (hitShip.hits >= hitShip.length) {
      hitShip.sunk = true;
      for (const [sr, sc] of hitShip.cells) {
        playerShots[sr][sc] = 'sunk';
      }
      result = 'sunk';
      sunkShipName = hitShip.name;
      lastEvent = `Direct hit at ${coordLabel(row, col)} — Enemy ${hitShip.name} sunk!`;
    } else {
      playerShots[row][col] = 'hit';
      result = 'hit';
      lastEvent = `Direct hit confirmed at ${coordLabel(row, col)}!`;
    }
  } else {
    playerShots[row][col] = 'miss';
  }

  const allSunk = aiShips.every((s) => s.sunk);
  const next: BattleshipState = {
    ...state,
    aiShips,
    playerShots,
    turn: allSunk ? 'player' : 'ai',
    winner: allSunk ? 'player' : null,
    lastEvent: allSunk ? 'All enemy vessels neutralized — Victory!' : lastEvent,
    shotsFired: state.shotsFired + 1,
    hitsLanded: state.hitsLanded + (hitShip ? 1 : 0),
  };

  return { state: next, result, sunkShipName };
}

/**
 * Computes exact Bayesian Probability Density across every un-shot cell on the target board
 * given the lengths of all still-afloat ships and any unsunk hit clusters.
 */
export function computeProbabilityHeatmap(
  shots: ShotResult[][],
  remainingShips: PlacedShip[]
): number[][] {
  const heat = Array.from({ length: BS_SIZE }, () => Array<number>(BS_SIZE).fill(0));
  const afloatLengths = remainingShips.filter((s) => !s.sunk).map((s) => s.length);

  for (const len of afloatLengths) {
    for (const horizontal of [true, false]) {
      const maxR = horizontal ? BS_SIZE : BS_SIZE - len + 1;
      const maxC = horizontal ? BS_SIZE - len + 1 : BS_SIZE;

      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) {
          let valid = true;
          let hitMatches = 0;
          for (let i = 0; i < len; i++) {
            const cr = horizontal ? r : r + i;
            const cc = horizontal ? c + i : c;
            const cell = shots[cr][cc];
            if (cell === 'miss' || cell === 'sunk') {
              valid = false;
              break;
            }
            if (cell === 'hit') hitMatches++;
          }
          if (!valid) continue;

          // Placements intersecting live unsunk hits carry exponentially higher weight
          const weight = hitMatches > 0 ? 1 + hitMatches * 22 : 1;
          for (let i = 0; i < len; i++) {
            const cr = horizontal ? r : r + i;
            const cc = horizontal ? c + i : c;
            if (shots[cr][cc] === 'empty') {
              heat[cr][cc] += weight;
            }
          }
        }
      }
    }
  }
  return heat;
}

export function chooseBattleshipAIShot(
  state: BattleshipState,
  difficulty: BattleshipDifficulty = 'commander',
  rng: () => number = Math.random
): [number, number] {
  const open: Array<[number, number]> = [];
  for (let r = 0; r < BS_SIZE; r++) {
    for (let c = 0; c < BS_SIZE; c++) {
      if (state.aiShots[r][c] === 'empty') open.push([r, c]);
    }
  }
  if (open.length === 0) return [0, 0];

  if (difficulty === 'ensign' && rng() < 0.45) {
    return open[Math.floor(rng() * open.length)];
  }

  const heat = computeProbabilityHeatmap(state.aiShots, state.playerShips);
  let bestScore = -1;
  let bestCells: Array<[number, number]> = [];

  for (const [r, c] of open) {
    const h = heat[r][c];
    // Admiral uses checkerboard parity bonus when hunting
    const parityBonus = difficulty === 'admiral' && (r + c) % 2 === 0 ? 0.35 : 0;
    const score = h + parityBonus;
    if (score > bestScore + 1e-6) {
      bestScore = score;
      bestCells = [[r, c]];
    } else if (Math.abs(score - bestScore) <= 1e-6) {
      bestCells.push([r, c]);
    }
  }

  return bestCells[Math.floor(rng() * bestCells.length)];
}

export function executeAIShot(
  state: BattleshipState,
  difficulty: BattleshipDifficulty = 'commander',
  rng: () => number = Math.random
): { state: BattleshipState; result: ShotResult; coord: [number, number] } {
  if (state.winner || state.turn !== 'ai') {
    return { state, result: 'empty', coord: [0, 0] };
  }
  const [row, col] = chooseBattleshipAIShot(state, difficulty, rng);
  const aiShots = state.aiShots.map((r) => r.slice());
  const playerShips = state.playerShips.map((s) => ({ ...s, cells: s.cells.slice() }));

  let hitShip: PlacedShip | null = null;
  for (const s of playerShips) {
    if (s.cells.some(([sr, sc]) => sr === row && sc === col)) {
      hitShip = s;
      break;
    }
  }

  let result: ShotResult = 'miss';
  let lastEvent = `Enemy fired at ${coordLabel(row, col)} — Missed.`;

  if (hitShip) {
    hitShip.hits += 1;
    if (hitShip.hits >= hitShip.length) {
      hitShip.sunk = true;
      for (const [sr, sc] of hitShip.cells) {
        aiShots[sr][sc] = 'sunk';
      }
      result = 'sunk';
      lastEvent = `Enemy hit ${coordLabel(row, col)} — Your ${hitShip.name} was sunk!`;
    } else {
      aiShots[row][col] = 'hit';
      result = 'hit';
      lastEvent = `Enemy struck your fleet at ${coordLabel(row, col)}!`;
    }
  } else {
    aiShots[row][col] = 'miss';
  }

  const allPlayerSunk = playerShips.every((s) => s.sunk);
  return {
    coord: [row, col],
    result,
    state: {
      ...state,
      playerShips,
      aiShots,
      turn: allPlayerSunk ? 'ai' : 'player',
      winner: allPlayerSunk ? 'ai' : null,
      lastEvent: allPlayerSunk ? 'Your entire fleet was lost.' : lastEvent,
    },
  };
}
