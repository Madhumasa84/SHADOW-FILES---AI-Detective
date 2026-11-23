export type SudokuDifficulty = 'novice' | 'detective' | 'mastermind';

export interface SudokuMoveSnapshot {
  values: number[];
  notes: number[][];
}

export interface SudokuHint {
  index: number;
  row: number;
  col: number;
  value: number;
  technique: 'Naked Single' | 'Hidden Single (Row)' | 'Hidden Single (Column)' | 'Hidden Single (Box)' | 'Vault Deduction';
  reason: string;
}

export interface SudokuState {
  difficulty: SudokuDifficulty;
  solution: number[];
  given: boolean[];
  values: number[];
  notes: number[][];
  mistakes: number;
  hintsUsed: number;
  history: SudokuMoveSnapshot[];
  status: 'playing' | 'won';
}

const TARGET_CLUES: Record<SudokuDifficulty, number> = {
  novice: 42,
  detective: 34,
  mastermind: 27,
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function getSudokuRow(index: number): number {
  return Math.floor(index / 9);
}

export function getSudokuCol(index: number): number {
  return index % 9;
}

export function getSudokuBox(index: number): number {
  const r = Math.floor(index / 9);
  const c = index % 9;
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function isPlacementValid(grid: number[], index: number, val: number): boolean {
  const r = Math.floor(index / 9);
  const c = index % 9;
  for (let i = 0; i < 9; i++) {
    const rowIdx = r * 9 + i;
    if (rowIdx !== index && grid[rowIdx] === val) return false;
    const colIdx = i * 9 + c;
    if (colIdx !== index && grid[colIdx] === val) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const boxIdx = (br + dr) * 9 + (bc + dc);
      if (boxIdx !== index && grid[boxIdx] === val) return false;
    }
  }
  return true;
}

export function getCellCandidates(grid: number[], index: number): number[] {
  if (grid[index] !== 0) return [];
  const used = new Uint8Array(10);
  const r = Math.floor(index / 9);
  const c = index % 9;
  for (let i = 0; i < 9; i++) {
    used[grid[r * 9 + i]] = 1;
    used[grid[i * 9 + c]] = 1;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      used[grid[(br + dr) * 9 + (bc + dc)]] = 1;
    }
  }
  const out: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used[n]) out.push(n);
  }
  return out;
}

function generateCompleteGrid(): number[] {
  const grid = new Array<number>(81).fill(0);

  // Fill diagonal 3x3 boxes randomly first for speed and diversity
  for (let box = 0; box < 9; box += 4) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let k = 0;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        grid[(br + dr) * 9 + (bc + dc)] = digits[k++];
      }
    }
  }

  function fill(pos: number): boolean {
    if (pos === 81) return true;
    if (grid[pos] !== 0) return fill(pos + 1);
    const candidates = shuffle(getCellCandidates(grid, pos));
    for (const val of candidates) {
      grid[pos] = val;
      if (fill(pos + 1)) return true;
      grid[pos] = 0;
    }
    return false;
  }

  fill(0);
  return grid;
}

export function countSudokuSolutions(puzzle: number[], limit = 2): number {
  const grid = [...puzzle];
  let count = 0;

  function solve(): void {
    if (count >= limit) return;
    // Choose empty cell with Minimum Remaining Values (MRV)
    let bestIdx = -1;
    let bestCands: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) {
        const cands = getCellCandidates(grid, i);
        if (cands.length === 0) return;
        if (bestCands === null || cands.length < bestCands.length) {
          bestIdx = i;
          bestCands = cands;
          if (cands.length === 1) break;
        }
      }
    }

    if (bestIdx === -1) {
      count += 1;
      return;
    }

    for (const val of bestCands!) {
      grid[bestIdx] = val;
      solve();
      grid[bestIdx] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

export function createSudokuPuzzle(difficulty: SudokuDifficulty): SudokuState {
  const solution = generateCompleteGrid();
  const values = [...solution];
  const targetClues = TARGET_CLUES[difficulty];

  // Try removing pairs symmetrically (and center cell) while preserving uniqueness
  const halfIndices: number[] = [];
  for (let i = 0; i <= 40; i++) halfIndices.push(i);
  const order = shuffle(halfIndices);

  let remainingClues = 81;
  for (const idx of order) {
    if (remainingClues <= targetClues) break;
    const mirror = 80 - idx;
    const prevA = values[idx];
    const prevB = values[mirror];
    if (prevA === 0) continue;

    values[idx] = 0;
    if (mirror !== idx) values[mirror] = 0;

    if (countSudokuSolutions(values, 2) === 1) {
      remainingClues -= mirror === idx ? 1 : 2;
    } else {
      values[idx] = prevA;
      values[mirror] = prevB;
    }
  }

  // Fine-tune with single removals if still above target
  if (remainingClues > targetClues) {
    const singles = shuffle(Array.from({ length: 81 }, (_, i) => i));
    for (const idx of singles) {
      if (remainingClues <= targetClues) break;
      if (values[idx] === 0) continue;
      const prev = values[idx];
      values[idx] = 0;
      if (countSudokuSolutions(values, 2) === 1) {
        remainingClues -= 1;
      } else {
        values[idx] = prev;
      }
    }
  }

  const given = values.map((v) => v !== 0);
  const notes = Array.from({ length: 81 }, () => [] as number[]);

  return {
    difficulty,
    solution,
    given,
    values,
    notes,
    mistakes: 0,
    hintsUsed: 0,
    history: [],
    status: 'playing',
  };
}

export function getSudokuConflicts(values: number[]): Set<number> {
  const conflicts = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const val = values[i];
    if (val === 0) continue;
    if (!isPlacementValid(values, i, val)) {
      conflicts.add(i);
    }
  }
  return conflicts;
}

function isSolved(values: number[], solution: number[]): boolean {
  for (let i = 0; i < 81; i++) {
    if (values[i] !== solution[i]) return false;
  }
  return true;
}

function clearPeerNotes(notes: number[][], index: number, val: number): number[][] {
  const r = Math.floor(index / 9);
  const c = index % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  return notes.map((cellNotes, idx) => {
    if (idx === index) return [];
    const cr = Math.floor(idx / 9);
    const cc = idx % 9;
    const samePeer =
      cr === r || cc === c || (cr >= br && cr < br + 3 && cc >= bc && cc < bc + 3);
    if (!samePeer) return cellNotes;
    if (!cellNotes.includes(val)) return cellNotes;
    return cellNotes.filter((n) => n !== val);
  });
}

export function setSudokuCell(state: SudokuState, index: number, value: number): SudokuState {
  if (state.status !== 'playing') return state;
  if (index < 0 || index >= 81 || state.given[index]) return state;
  if (state.values[index] === value) return state;

  const snapshot: SudokuMoveSnapshot = {
    values: [...state.values],
    notes: state.notes.map((n) => [...n]),
  };

  const nextValues = [...state.values];
  nextValues[index] = value;

  let nextNotes = state.notes.map((n) => [...n]);
  if (value !== 0) {
    nextNotes = clearPeerNotes(nextNotes, index, value);
  }

  const isMistake = value !== 0 && value !== state.solution[index];
  const won = isSolved(nextValues, state.solution);

  return {
    ...state,
    values: nextValues,
    notes: nextNotes,
    mistakes: state.mistakes + (isMistake ? 1 : 0),
    history: [...state.history.slice(-40), snapshot],
    status: won ? 'won' : 'playing',
  };
}

export function toggleSudokuNote(state: SudokuState, index: number, digit: number): SudokuState {
  if (state.status !== 'playing') return state;
  if (index < 0 || index >= 81 || state.given[index] || state.values[index] !== 0) return state;
  if (digit < 1 || digit > 9) return state;

  const snapshot: SudokuMoveSnapshot = {
    values: [...state.values],
    notes: state.notes.map((n) => [...n]),
  };

  const nextNotes = state.notes.map((n) => [...n]);
  const cur = nextNotes[index];
  nextNotes[index] = cur.includes(digit)
    ? cur.filter((d) => d !== digit)
    : [...cur, digit].sort((a, b) => a - b);

  return {
    ...state,
    notes: nextNotes,
    history: [...state.history.slice(-40), snapshot],
  };
}

export function undoSudokuMove(state: SudokuState): SudokuState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    ...state,
    values: prev.values,
    notes: prev.notes,
    history: state.history.slice(0, -1),
    status: 'playing',
  };
}

export function findSudokuHint(state: SudokuState): SudokuHint | null {
  if (state.status !== 'playing') return null;

  // First check if player has an incorrect digit placed; if so, advise fixing it
  for (let i = 0; i < 81; i++) {
    if (state.values[i] !== 0 && state.values[i] !== state.solution[i]) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      return {
        index: i,
        row,
        col,
        value: state.solution[i],
        technique: 'Vault Deduction',
        reason: `Row ${row + 1}, Column ${col + 1} conflicts with the unique solution — it must be ${state.solution[i]}.`,
      };
    }
  }

  // 1. Naked Single: empty cell with exactly one legal candidate
  for (let i = 0; i < 81; i++) {
    if (state.values[i] !== 0) continue;
    const cands = getCellCandidates(state.values, i);
    if (cands.length === 1) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      return {
        index: i,
        row,
        col,
        value: cands[0],
        technique: 'Naked Single',
        reason: `R${row + 1}C${col + 1} has only one legal candidate remaining: ${cands[0]}.`,
      };
    }
  }

  // 2. Hidden Single in Row
  for (let r = 0; r < 9; r++) {
    for (let digit = 1; digit <= 9; digit++) {
      let count = 0;
      let target = -1;
      let alreadyPresent = false;
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        if (state.values[idx] === digit) {
          alreadyPresent = true;
          break;
        }
        if (state.values[idx] === 0 && isPlacementValid(state.values, idx, digit)) {
          count += 1;
          target = idx;
        }
      }
      if (!alreadyPresent && count === 1 && target !== -1) {
        const col = target % 9;
        return {
          index: target,
          row: r,
          col,
          value: digit,
          technique: 'Hidden Single (Row)',
          reason: `In Row ${r + 1}, digit ${digit} can only fit at Column ${col + 1}.`,
        };
      }
    }
  }

  // 3. Hidden Single in Column
  for (let c = 0; c < 9; c++) {
    for (let digit = 1; digit <= 9; digit++) {
      let count = 0;
      let target = -1;
      let alreadyPresent = false;
      for (let r = 0; r < 9; r++) {
        const idx = r * 9 + c;
        if (state.values[idx] === digit) {
          alreadyPresent = true;
          break;
        }
        if (state.values[idx] === 0 && isPlacementValid(state.values, idx, digit)) {
          count += 1;
          target = idx;
        }
      }
      if (!alreadyPresent && count === 1 && target !== -1) {
        const row = Math.floor(target / 9);
        return {
          index: target,
          row,
          col: c,
          value: digit,
          technique: 'Hidden Single (Column)',
          reason: `In Column ${c + 1}, digit ${digit} can only fit in Row ${row + 1}.`,
        };
      }
    }
  }

  // 4. Hidden Single in 3x3 Box
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    for (let digit = 1; digit <= 9; digit++) {
      let count = 0;
      let target = -1;
      let alreadyPresent = false;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const idx = (br + dr) * 9 + (bc + dc);
          if (state.values[idx] === digit) {
            alreadyPresent = true;
            break;
          }
          if (state.values[idx] === 0 && isPlacementValid(state.values, idx, digit)) {
            count += 1;
            target = idx;
          }
        }
        if (alreadyPresent) break;
      }
      if (!alreadyPresent && count === 1 && target !== -1) {
        const row = Math.floor(target / 9);
        const col = target % 9;
        return {
          index: target,
          row,
          col,
          value: digit,
          technique: 'Hidden Single (Box)',
          reason: `In Box ${b + 1}, digit ${digit} has only one legal cell: R${row + 1}C${col + 1}.`,
        };
      }
    }
  }

  // 5. Fallback: pick most constrained empty cell and reveal via unique solution
  let bestIdx = -1;
  let minCands = 10;
  for (let i = 0; i < 81; i++) {
    if (state.values[i] !== 0) continue;
    const c = getCellCandidates(state.values, i).length;
    if (c < minCands) {
      minCands = c;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const row = Math.floor(bestIdx / 9);
  const col = bestIdx % 9;
  return {
    index: bestIdx,
    row,
    col,
    value: state.solution[bestIdx],
    technique: 'Vault Deduction',
    reason: `Advanced chain elimination locks R${row + 1}C${col + 1} to ${state.solution[bestIdx]}.`,
  };
}
