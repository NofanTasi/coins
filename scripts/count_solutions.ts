import { solveBacktrack } from '../src/lib/solver';
import * as fs from 'fs';

/**
 * Counts all unique solutions for a given N and C.
 * Note: This implements full backtracking without symmetry breaking 
 * to give the raw mathematical count.
 */
function countAllSolutions(n: number, c: number): number {
  let total = 0;
  const board = new Set<string>();
  const rows = new Array(n).fill(0);
  const cols = new Array(n).fill(0);
  const major = new Map<number, number>();
  const minor = new Map<number, number>();

  function backtrack(index: number) {
    if (board.size === n * c) {
      total++;
      return;
    }
    if (index >= n * n) return;

    const r = Math.floor(index / n);
    const cl = index % n;

    // 1. Try placing
    const rC = rows[r];
    const cC = cols[cl];
    const mK = r - cl;
    const miK = r + cl;
    const mC = major.get(mK) || 0;
    const miC = minor.get(miK) || 0;

    if (rC < c && cC < c && mC < c && miC < c) {
      const pos = `${r},${cl}`;
      board.add(pos);
      rows[r]++;
      cols[cl]++;
      major.set(mK, mC + 1);
      minor.set(miK, miC + 1);

      backtrack(index + 1);

      // Backtrack
      board.delete(pos);
      rows[r]--;
      cols[cl]--;
      major.set(mK, mC);
      minor.set(miK, miC);
    }

    // 2. Try skipping
    // Pruning: if remaining cells in row aren't enough to reach C
    if (rows[r] + (n - (cl + 1)) >= c) {
      backtrack(index + 1);
    }
  }

  backtrack(0);
  return total;
}

async function run() {
  const dataset = [
    { n: 3, c: 2 },
    { n: 4, c: 1 },
    { n: 4, c: 2 },
    { n: 5, c: 1 },
    { n: 5, c: 2 },
    { n: 6, c: 1 },
    { n: 8, c: 1 }
  ];

  let res = "SOLUTION COUNTS\n===============\n";
  for (const item of dataset) {
    console.log(`Counting for (${item.n}, ${item.c})...`);
    const count = countAllSolutions(item.n, item.c);
    res += `(${item.n}, ${item.c}): ${count} solutions\n`;
  }

  fs.writeFileSync('COUNTS.txt', res);
  console.log("Counts saved to COUNTS.txt");
}

run();
