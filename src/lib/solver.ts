import { BoardState } from './gridUtils';

/**
 * Advanced solver using Min-Conflicts heuristic for Generalized N-Queens (C coins per line).
 */
export function findSolution(n: number, c: number): BoardState | null {
  // Edge cases where N*C might not be possible (though user said apart from (2,1) and (3,1))
  if (n === 2 && c === 1) return null;
  if (n === 3 && c === 1) return null;

  const MAX_RESTARTS = 30; // Increased for better robustness
  const MAX_ITERATIONS = n * n * 50;

  for (let restart = 0; restart < MAX_RESTARTS; restart++) {
    // 1. Initial Assignment: Exactly C coins per row, distributed randomly in columns
    const board = new Set<string>();
    const colCounts = new Array(n).fill(0);
    const majDiagCounts = new Map<number, number>();
    const minDiagCounts = new Map<number, number>();

    const updateCounts = (r: number, cl: number, delta: number) => {
      colCounts[cl] += delta;
      majDiagCounts.set(r - cl, (majDiagCounts.get(r - cl) || 0) + delta);
      minDiagCounts.set(r + cl, (minDiagCounts.get(r + cl) || 0) + delta);
    };

    // Random but distinct initial placement per row
    for (let r = 0; r < n; r++) {
      const cols = Array.from({ length: n }, (_, i) => i);
      // Shuffle columns
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
      }
      // Place C coins
      for (let i = 0; i < c; i++) {
        const cl = cols[i];
        board.add(`${r},${cl}`);
        updateCounts(r, cl, 1);
      }
    }

    const getConflicts = (r: number, cl: number) => {
      // Conflict is how much the lines EXCEED the limit C
      const rc = colCounts[cl];
      const mc = majDiagCounts.get(r - cl) || 0;
      const nc = minDiagCounts.get(r + cl) || 0;
      
      let sum = 0;
      if (rc > c) sum += (rc - c);
      if (mc > c) sum += (mc - c);
      if (nc > c) sum += (nc - c);
      return sum;
    };

    const getTotalConflicts = () => {
      let total = 0;
      // We only need to check col and diags since row is always C
      for (let i = 0; i < n; i++) if (colCounts[i] > c) total += (colCounts[i] - c);
      majDiagCounts.forEach(val => { if (val > c) total += (val - c); });
      minDiagCounts.forEach(val => { if (val > c) total += (val - c); });
      return total;
    };

    // 2. Iterative Repair (Min-Conflicts)
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const currentTotal = getTotalConflicts();
      if (currentTotal === 0) return board;

      // Pick a random row
      const r = Math.floor(Math.random() * n);
      
      // Find all coins in this row
      const coinsInRow: number[] = [];
      const emptyInRow: number[] = [];
      for (let cl = 0; cl < n; cl++) {
        if (board.has(`${r},${cl}`)) coinsInRow.push(cl);
        else emptyInRow.push(cl);
      }

      // Pick a random coin in this row
      const oldCol = coinsInRow[Math.floor(Math.random() * coinsInRow.length)];
      
      // Find best column to swap it to in the same row
      let bestCols: number[] = [oldCol];
      let minConf = getConflicts(r, oldCol);

      // Try moving the coin to every empty column in this row
      for (const newCol of emptyInRow) {
        // Temporarily move
        updateCounts(r, oldCol, -1);
        updateCounts(r, newCol, 1);
        
        const conf = getConflicts(r, newCol);
        
        if (conf < minConf) {
          minConf = conf;
          bestCols = [newCol];
        } else if (conf === minConf) {
          bestCols.push(newCol);
        }
        
        // Move back
        updateCounts(r, newCol, -1);
        updateCounts(r, oldCol, 1);
      }

      // Execute the best move
      const targetCol = bestCols[Math.floor(Math.random() * bestCols.length)];
      if (targetCol !== oldCol) {
        board.delete(`${r},${oldCol}`);
        updateCounts(r, oldCol, -1);
        board.add(`${r},${targetCol}`);
        updateCounts(r, targetCol, 1);
      }
    }
  }

  return null;
}

