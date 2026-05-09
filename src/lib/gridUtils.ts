export type BoardState = Set<string>;

export const getNeighbors = (r: number, c: number, n: number): string[] => {
  const neighbors: string[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
        neighbors.push(`${nr},${nc}`);
      }
    }
  }
  return neighbors;
};

export const getNeighborCount = (r: number, cl: number, _n: number, board: BoardState, cLimit: number): number => {
  const violationArray = getViolations(cLimit, board);
  const violations = new Set(violationArray);
  const validBoard = new Set([...board].filter(pos => !violations.has(pos)));
  
  const activeLines = getActiveLines(validBoard);
  const isSelected = validBoard.has(`${r},${cl}`) ? 1 : 0;
  
  const rCount = activeLines.rows.get(r) || 0;
  const cCount = activeLines.cols.get(cl) || 0;
  const majCount = activeLines.majorDiags.get(r - cl) || 0;
  const minCount = activeLines.minorDiags.get(r + cl) || 0;
  
  return (rCount + cCount + majCount + minCount) - (4 * isSelected);
};

export const getExcessCount = (r: number, cl: number, cLimit: number, board: BoardState): number => {
  return getLinearExcess(r, cl, cLimit, board);
};

export const getRemainingCount = (r: number, cl: number, cLimit: number, board: BoardState): number => {
  return getLinearRemaining(r, cl, cLimit, board);
};

export const getActiveLines = (board: BoardState) => {
  const rows = new Map<number, number>();
  const cols = new Map<number, number>();
  const majorDiags = new Map<number, number>();
  const minorDiags = new Map<number, number>();

  board.forEach(key => {
    const [r, cl] = key.split(',').map(Number);
    rows.set(r, (rows.get(r) || 0) + 1);
    cols.set(cl, (cols.get(cl) || 0) + 1);
    majorDiags.set(r - cl, (majorDiags.get(r - cl) || 0) + 1);
    minorDiags.set(r + cl, (minorDiags.get(r + cl) || 0) + 1);
  });

  return { rows, cols, majorDiags, minorDiags };
};

export const getViolations = (cLimit: number, board: BoardState): string[] => {
  const activeLines = getActiveLines(board);
  return Array.from(board).filter(key => {
    const [r, cl] = key.split(',').map(Number);
    return (
      (activeLines.rows.get(r) || 0) > cLimit ||
      (activeLines.cols.get(cl) || 0) > cLimit ||
      (activeLines.majorDiags.get(r - cl) || 0) > cLimit ||
      (activeLines.minorDiags.get(r + cl) || 0) > cLimit
    );
  });
};

export const getLinearExcess = (r: number, cl: number, cLimit: number, board: BoardState) => {
  const activeLines = getActiveLines(board);
  const rCount = activeLines.rows.get(r) || 0;
  const cCount = activeLines.cols.get(cl) || 0;
  const majCount = activeLines.majorDiags.get(r - cl) || 0;
  const minCount = activeLines.minorDiags.get(r + cl) || 0;
  
  const rExcess = Math.max(0, rCount - cLimit);
  const cExcess = Math.max(0, cCount - cLimit);
  const majExcess = Math.max(0, majCount - cLimit);
  const minExcess = Math.max(0, minCount - cLimit);
  
  return rExcess + cExcess + majExcess + minExcess;
};

export const getLinearRemaining = (r: number, cl: number, cLimit: number, board: BoardState) => {
  const activeLines = getActiveLines(board);
  const rLeft = cLimit - (activeLines.rows.get(r) || 0);
  const cLeft = cLimit - (activeLines.cols.get(cl) || 0);
  const majLeft = cLimit - (activeLines.majorDiags.get(r - cl) || 0);
  const minLeft = cLimit - (activeLines.minorDiags.get(r + cl) || 0);
  
  return Math.max(0, Math.min(rLeft, cLeft, majLeft, minLeft));
};
