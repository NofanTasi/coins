import { findSolution } from '../src/lib/solver';
import * as fs from 'fs';

async function run() {
  const tests = [
    { n: 24, c: 1 },
    { n: 24, c: 12 },
    { n: 32, c: 4 },
    { n: 32, c: 16 },
    { n: 64, c: 2 },
    { n: 64, c: 32 },
    { n: 100, c: 50 }
  ];

  let output = "STRESS TEST RESULTS\n===================\n\n";

  for (const { n, c } of tests) {
    console.log(`Testing (N=${n}, C=${c})...`);
    const start = Date.now();
    const sol = findSolution(n, c);
    const end = Date.now();
    
    if (sol) {
      output += `(N=${n}, C=${c}): FOUND in ${end - start}ms\n`;
    } else {
      output += `(N=${n}, C=${c}): FAILED to find solution in allotted restarts\n`;
    }
  }

  fs.writeFileSync('STRESS_TEST.txt', output);
  console.log("Stress test complete. Results in STRESS_TEST.txt");
}

run();
