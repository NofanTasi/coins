/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Minus, Plus, Maximize, RotateCcw, 
  Undo2, Redo2, Play, Pause, Square,
  Zap, ZapOff
} from 'lucide-react';
import { 
  BoardState, 
  getNeighborCount, 
  getExcessCount, 
  getRemainingCount, 
  getViolations,
} from './lib/gridUtils';
import { findSolution, solveBacktrack } from './lib/solver';

export default function App() {
  const [n, setN] = useState<number>(5);
  const [c, setC] = useState<number>(3);
  const [board, setBoard] = useState<BoardState>(new Set());
  
  // History for Undo/Redo
  const [history, setHistory] = useState<BoardState[]>([new Set()]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Timer state
  const [time, setTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hazards state
  const [hoveredPos, setHoveredPos] = useState<string | null>(null);
  const [showAllHazards, setShowAllHazards] = useState(false);

  const [zoom, setZoom] = useState<number>(1);
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [showExcess, setShowExcess] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [hint, setHint] = useState<{ type: 'add' | 'remove'; pos: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const violations = useMemo(() => getViolations(c, board), [board, c]);
  const isSolved = useMemo(() => board.size === (n * c) && violations.length === 0, [board.size, n, c, violations.length]);
  const [justSolved, setJustSolved] = useState(false);
  const [lastActionPos, setLastActionPos] = useState<string | null>(null);

  // Celebration effect when solved
  useEffect(() => {
    if (isSolved) {
      setJustSolved(true);
      // Auto-turn off justSolved after animation finishes
      const timer = setTimeout(() => setJustSolved(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSolved]);

  // Timer effect
  useEffect(() => {
    if (timerActive && !isSolved) {
      timerRef.current = setInterval(() => {
        setTime(t => t + 10);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, isSolved]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const msecs = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
  };

  // History Helper
  const pushToHistory = useCallback((newBoard: BoardState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(new Set(newBoard));
    // Limit history size to 100
    if (newHistory.length > 100) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setBoard(newBoard);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setBoard(new Set(prev));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setBoard(new Set(next));
    }
  }, [history, historyIndex]);

  useEffect(() => {
    if (isSolved && timerActive) {
      setTimerActive(false);
    }
  }, [isSolved, timerActive]);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    
    // Minor resize debounce for mobile address bar
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const padding = 20;
    const availableWidth = windowWidth - padding;
    const availableHeight = windowHeight - padding;
    
    // Base dimensions for content
    const totalContentWidth = 900; 
    const totalContentHeight = 1600; 
    
    const scaleW = availableWidth / totalContentWidth;
    const scaleH = availableHeight / totalContentHeight;
    
    const isPortrait = windowHeight > windowWidth;
    
    let scale;
    if (isPortrait) {
      scale = Math.min(scaleW, 1.2);
    } else {
      scale = Math.min(scaleW, scaleH, 1.1);
    }

    setZoom(Math.max(0.3, scale));
  }, []);

  const handleSolve = () => {
    setIsSolving(true);
    setJustSolved(false);
    setHint(null);
    setTimeout(() => {
      const solution = findSolution(n, c);
      if (solution) {
        pushToHistory(solution);
        setLastActionPos(null);
      } else {
        alert(`No complete solution found for N=${n}, C=${c}`);
      }
      setIsSolving(false);
    }, 50);
  };

  const handleHint = () => {
    if (isSolving) return;

    // 1. Try to find a solution that includes everything CURRENTLY on the board
    const solutionFromCurrent = solveBacktrack(n, c, board);
    
    if (solutionFromCurrent) {
      // Current path is viable. Suggest adding one of the missing coins from THIS solution.
      const missing = [...solutionFromCurrent].filter(key => !board.has(key));
      if (missing.length > 0) {
        setHint({ type: 'add', pos: missing[Math.floor(Math.random() * missing.length)] });
      }
    } else {
      // Current path is a DEAD END (contradictions or too many coins).
      // Find ANY valid solution for this N/C level as a template.
      const anySolution = findSolution(n, c) || solveBacktrack(n, c);
      if (anySolution) {
        // 1. Identify coins that are on board but shouldn't be in THAT solution
        const surplus = [...board].filter(key => !anySolution.has(key));
        if (surplus.length > 0) {
          // Important: Sort surplus by conflict score descending to suggest the "worst" coin first
          surplus.sort((a, b) => {
            const [rA, clA] = a.split(',').map(Number);
            const [rB, clB] = b.split(',').map(Number);
            return getExcessCount(rB, clB, c, board) - getExcessCount(rA, clA, c, board);
          });
          setHint({ type: 'remove', pos: surplus[0] });
        } else {
          // 2. Identify coins that are missing compared to our target solution
          const missing = [...anySolution].filter(key => !board.has(key));
          if (missing.length > 0) {
            setHint({ type: 'add', pos: missing[Math.floor(Math.random() * missing.length)] });
          }
        }
      }
    }
    
    // Auto-hide hint after delay
    setTimeout(() => setHint(null), 3500);
  };

  // Initial fit and window resize
  useEffect(() => {
    fitToScreen();
    
    // Only auto-refit on orientation change to be less intrusive
    const handleOrientationChange = () => {
      // Small timeout to allow browser to settle dimensions
      setTimeout(fitToScreen, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, [fitToScreen]);

  // Re-fit when N changes significantly
  useEffect(() => {
    fitToScreen();
  }, [n, fitToScreen]);

  const toggleCoin = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;
    const newBoard = new Set(board);
    if (board.has(key)) {
      newBoard.delete(key);
    } else {
      newBoard.add(key);
      setLastActionPos(key);
    }
    pushToHistory(newBoard);
    setJustSolved(false);
  }, [board, pushToHistory, timerActive, time]);

  const hazardSources = useMemo(() => {
    if (showAllHazards && hoveredPos) {
      return [hoveredPos];
    }
    return [];
  }, [showAllHazards, hoveredPos]);

  const isHazardous = useCallback((r: number, cl: number) => {
    if (hazardSources.length === 0) return false;
    
    for (const source of hazardSources) {
      const [sr, scl] = source.split(',').map(Number);
      if (r === sr && cl === scl) continue; // Don't highlight the source cell itself as a hazard area
      
      const isSameRow = r === sr;
      const isSameCol = cl === scl;
      const isSameDiag = Math.abs(r - sr) === Math.abs(cl - scl);
      
      if (isSameRow || isSameCol || isSameDiag) return true;
    }
    return false;
  }, [hazardSources]);

  const gridCells = useMemo(() => {
    const cells = [];
    for (let r = 0; r < n; r++) {
      for (let cl = 0; cl < n; cl++) {
        cells.push({ r, cl });
      }
    }
    return cells;
  }, [n]);

  return (
    <div className="min-h-screen bg-min-bg text-current select-none transition-colors duration-500 overflow-x-hidden pt-8 pb-24 px-4 md:px-8">
      <div 
        ref={containerRef}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        className="w-full max-w-4xl mx-auto flex flex-col gap-12 items-center transition-transform duration-300 ease-out"
      >
        
        {/* Header & Controls Column */}
        <aside className="w-full flex flex-col gap-8 shrink-0">
          <header className="mb-0">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 uppercase">COIN PLACEMENT</h1>
          </header>

          <section className="grid grid-cols-3 lg:grid-cols-1 gap-4 py-6 border-y-2 border-current">
            <div className="flex flex-col items-start border-r-2 lg:border-r-0 lg:border-b-2 border-current/20 pb-0 lg:pb-4 pr-4 lg:pr-0">
              <span className="opacity-40 text-[10px] md:text-xs tracking-[0.2em] mb-1 font-black italic">VALID</span>
              <span className="text-4xl md:text-5xl leading-none tabular-nums font-black">{board.size - violations.length}</span>
            </div>
            <div className="flex flex-col items-start border-r-2 lg:border-r-0 lg:border-b-2 border-current/20 pb-0 lg:pb-4 pr-4 lg:pr-0">
              <span className="opacity-40 text-[10px] md:text-xs tracking-[0.2em] mb-1 font-black italic">EXCESS</span>
              <span className="text-4xl md:text-5xl leading-none tabular-nums font-black">{violations.length}</span>
            </div>
            <div className={`flex flex-col items-end lg:items-start transition-all pt-0 lg:pt-4 ${isSolved ? 'text-neutral-900 scale-105 origin-right lg:origin-left' : 'opacity-40'}`}>
              <span className="text-[10px] md:text-xs tracking-[0.2em] mb-1 font-black italic">{isSolved ? 'SOLVED' : 'STATUS'}</span>
              <span className="text-4xl md:text-5xl leading-none tabular-nums font-black">{isSolved ? 'OK' : '-'}</span>
            </div>
            <div className="flex flex-col items-start col-span-3 pt-4">
              <span className="opacity-40 text-[10px] md:text-xs tracking-[0.2em] mb-2 font-black italic">TIMER</span>
              <div className="flex items-center gap-4 w-full">
                <span className="text-3xl md:text-4xl leading-none tabular-nums font-black">{formatTime(time)}</span>
                <div className="flex gap-1 ml-auto">
                  <button 
                    onClick={() => setTimerActive(!timerActive)}
                    className="p-2 border-2 border-current hover:bg-current hover:text-min-bg transition-colors"
                  >
                    {timerActive ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button 
                    onClick={() => { setTimerActive(false); setTime(0); }}
                    className="p-2 border-2 border-current hover:bg-current hover:text-min-bg transition-colors"
                  >
                    <Square size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">BOARD SIZE (N)</span>
                <span className="text-2xl font-black tabular-nums">{n}</span>
              </div>
              <input 
                type="range" min="2" max="32" value={n} 
                onChange={(e) => { 
                  const val = parseInt(e.target.value);
                  setN(val); 
                  pushToHistory(new Set()); 
                  setTime(0);
                  setTimerActive(false);
                }}
                className="w-full h-8 cursor-pointer"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">COINS PER LINE (C)</span>
                <span className="text-2xl font-black tabular-nums">{c}</span>
              </div>
              <input 
                type="range" min="1" max={n} value={c} 
                onChange={(e) => { 
                  const val = parseInt(e.target.value);
                  setC(val); 
                  pushToHistory(new Set());
                  setTime(0);
                  setTimerActive(false);
                }}
                className="w-full h-8 cursor-pointer"
              />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">ZOOM</span>
                <span className="text-sm font-black tabular-nums">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <Minus size={14} className="opacity-40" />
                <input 
                  type="range" min="0.5" max="3" step="0.1" value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-8 cursor-pointer"
                />
                <Plus size={14} className="opacity-40" />
                <button onClick={fitToScreen} className="p-2 hover:bg-current/10 border-2 border-current transition-colors">
                  <Maximize size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-4">
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="flex items-center justify-center gap-2 p-3 border-2 border-current hover:bg-current hover:text-min-bg disabled:opacity-20 disabled:pointer-events-none transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <Undo2 size={12} /> Undo
              </button>
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="flex items-center justify-center gap-2 p-3 border-2 border-current hover:bg-current hover:text-min-bg disabled:opacity-20 disabled:pointer-events-none transition-all font-black text-[10px] uppercase tracking-widest"
              >
                Redo <Redo2 size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setShowAllHazards(!showAllHazards)}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showAllHazards ? 'bg-neutral-800 text-neutral-100 border-neutral-800 shadow-inner' : 'border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'}`}
              >
                Overlap
              </button>
              <button 
                onClick={() => setShowNeighbors(!showNeighbors)}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showNeighbors ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Neighbors
              </button>
              <button 
                onClick={() => setShowExcess(!showExcess)}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showExcess ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Excess
              </button>
              <button 
                onClick={() => setShowRemaining(!showRemaining)}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showRemaining ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Remaining
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <button 
                disabled={isSolving}
                onClick={handleSolve}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${isSolving ? 'opacity-50 cursor-wait bg-min-ink text-min-bg' : 'border-min-ink text-min-ink hover:bg-min-ink/10'}`}
              >
                {isSolving ? '...' : 'Solve'}
              </button>
              <button 
                onClick={handleHint}
                disabled={isSolved || isSolving}
                className={`flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${isSolved || isSolving ? 'opacity-20 cursor-not-allowed border-current/20' : 'border-current text-current hover:bg-current/10'}`}
              >
                Hint
              </button>
              <button 
                onClick={() => { pushToHistory(new Set()); setLastActionPos(null); setTime(0); setTimerActive(false); }}
                className="flex items-center justify-center p-3 border-2 border-min-ink text-min-ink hover:bg-min-ink/10 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                Wipe
              </button>
            </div>
          </section>
        </aside>

        {/* Board Area */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex items-center justify-center min-h-[300px] touch-auto">
            <div 
              style={{ 
                gridTemplateColumns: `repeat(${n}, 1fr)`,
                width: `min(850px, 95vw)`,
                height: `min(850px, 95vw)`
              }} 
              className="grid border-2 border-current bg-min-bg shadow-2xl relative overflow-hidden transition-all duration-300"
            >
              {gridCells.map(({ r, cl }) => {
                const isSelected = board.has(`${r},${cl}`);
                const isViolation = violations.includes(`${r},${cl}`);
                const isHint = hint?.pos === `${r},${cl}`;
                const isLastCoin = lastActionPos === `${r},${cl}`;
                const isCellHazard = isHazardous(r, cl);
                const neighborCount = getNeighborCount(r, cl, n, board);
                const excessCount = getExcessCount(r, cl, c, board);
                const remainingCount = getRemainingCount(r, cl, c, board);
                const dynamicFontSize = Math.min(64, Math.max(14, (600 / n) * 0.35));
                
                return (
                  <button
                    key={`${r},${cl}`}
                    onClick={() => { toggleCoin(r, cl); setHint(null); }}
                    onMouseEnter={() => setHoveredPos(`${r},${cl}`)}
                    onMouseLeave={() => setHoveredPos(null)}
                    className="border border-current/10 flex items-center justify-center hover:bg-current/10 transition-colors relative h-full w-full overflow-hidden p-0 m-0 box-border group aspect-square"
                  >
                    {/* Hazard Overlay */}
                    {isCellHazard && (
                      <div className="absolute inset-0 bg-neutral-200/50 z-0 pointer-events-none" />
                    )}
                    {isSelected && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={justSolved ? {
                          filter: ['invert(0)', 'invert(1)', 'invert(0)', 'invert(1)', 'invert(0)', 'invert(1)', 'invert(0)'],
                          scale: [1, 1.15, 1, 1.15, 1, 1.15, 1],
                          opacity: 1
                        } : { scale: 1, opacity: 1, filter: 'invert(0)' }}
                        transition={justSolved ? { 
                          duration: 3,
                          ease: "easeInOut",
                          times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]
                        } : { duration: 0.15 }}
                        className={`w-4/5 h-4/5 border-2 border-current rounded-full ${isViolation ? 'bg-min-bg' : 'bg-current'} transition-colors duration-300 flex items-center justify-center shadow-lg relative z-10 shrink-0 aspect-square`} 
                      >
                        {isSelected && !isViolation && showNeighbors && (
                          <span 
                            style={{ fontSize: `${dynamicFontSize}px` }}
                            className="font-medium leading-none text-black pointer-events-none"
                          >
                            {neighborCount}
                          </span>
                        )}
                        {isSelected && isViolation && showExcess && (
                          <span 
                            style={{ fontSize: `${dynamicFontSize}px` }}
                            className="text-current font-medium leading-none pointer-events-none"
                          >
                            {excessCount}
                          </span>
                        )}
                        {isHint && hint.type === 'remove' && (
                          <motion.span 
                            animate={{ opacity: [1, 0, 1], scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center text-neutral-900 font-black text-6xl drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-50 pointer-events-none"
                          >
                            ×
                          </motion.span>
                        )}
                      </motion.div>
                    )}
                    {!isSelected && showRemaining && (
                      <span 
                        style={{ fontSize: `${dynamicFontSize}px` }}
                        className="font-medium opacity-40 leading-none group-hover:opacity-80 transition-opacity pointer-events-none"
                      >
                        {remainingCount}
                      </span>
                    )}
                    {!isSelected && isHint && hint.type === 'add' && (
                      <motion.span 
                        animate={{ opacity: [0, 1, 0.5], scale: [0.5, 1.2, 1] }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center text-neutral-900 font-black text-7xl drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
                      >
                        +
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

