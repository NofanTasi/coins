import { solveBacktrack } from '../src/lib/solver';
import * as fs from 'fs';

function boardToString(n: number, board: Set<string>): string {
  let res = '';
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) {
      row += board.has(`${r},${c}`) ? 'o ' : '. ';
    }
    res += row.trim() + '\n';
  }
  return res;
}

function findAllSolutions(n: number, c: number): Set<string>[] {
  const all: Set<string>[] = [];
  const board = new Set<string>();
  const rows = new Array(n).fill(0);
  const cols = new Array(n).fill(0);
  const major = new Map<number, number>();
  const minor = new Map<number, number>();

  function backtrack(index: number) {
    if (board.size === n * c) {
      all.push(new Set(board));
      return;
    }
    if (index >= n * n) return;

    const r = Math.floor(index / n);
    const cl = index % n;

    // Try placing
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
      board.delete(pos);
      rows[r]--;
      cols[cl]--;
      major.set(mK, mC);
      minor.set(miK, miC);
    }

    // Try skipping
    if (rows[r] + (n - (cl + 1)) >= c) {
      backtrack(index + 1);
    }
  }

  backtrack(0);
  return all;
}

async function run() {
  let output = 'ALL SOLUTIONS FOR SMALL N\n=========================\n\n';

  for (let n = 2; n <= 4; n++) {
    for (let c = 1; c < n; c++) {
      console.log(`Generating all for (${n}, ${c})...`);
      const sols = findAllSolutions(n, c);
      output += `(${n}, ${c}): Found ${sols.length} solutions\n`;
      sols.forEach((s, i) => {
        output += `Solution #${i + 1}:\n${boardToString(n, s)}\n`;
      });
      output += '------------------------\n\n';
    }
  }

  fs.writeFileSync('ALL_SMALL_SOLUTIONS.txt', output);
  console.log('Done.');
}

run();
