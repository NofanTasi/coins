import { findSolution } from '../src/lib/solver';
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

async function run() {
  let output = 'Generalized N-Queens Solutions (C coins per line)\n';
  output += '===============================================\n\n';

  for (let n = 1; n <= 16; n++) {
    for (let c = 1; c <= n; c++) {
      if (n === 2 && c === 1) continue;
      if (n === 3 && c === 1) continue;
      
      console.log(`Solving N=${n}, C=${c}...`);
      const start = Date.now();
      const sol = findSolution(n, c);
      const end = Date.now();
      
      output += `Solution for (${n}, ${c}) [Time: ${end - start}ms]:\n`;
      if (sol) {
        output += boardToString(n, sol);
      } else {
        output += 'No solution found.\n';
      }
      output += '\n';
    }
  }

  fs.writeFileSync('SOLUTIONS.txt', output);
  console.log('Finished. Results saved to SOLUTIONS.txt');
}

run();
