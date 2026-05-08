/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  DragEndEvent, 
  useDraggable, 
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { 
  Minus, Plus, Maximize, RotateCcw, 
  Undo2, Redo2, Play, Pause, Square,
  RefreshCcw, Dice5
} from 'lucide-react';
import { 
  BoardState, 
  getNeighborCount, 
  getExcessCount, 
  getRemainingCount, 
  getViolations,
} from './lib/gridUtils';
import { findSolution } from './lib/solver';

interface CellProps {
  r: number;
  cl: number;
  n: number;
  c: number;
  board: BoardState;
  violations: string[];
  hint: { type: 'add' | 'remove' | 'move'; pos?: string, from?: string, to?: string } | null;
  isHazardous: (r: number, cl: number) => boolean;
  showNeighbors: boolean;
  showExcess: boolean;
  showRemaining: boolean;
  justSolved: boolean;
  toggleCoin: (r: number, cl: number) => void;
  moveCoin: (from: string, to: string) => void;
  setHoveredPos: (pos: string | null) => void;
  setHint: (hint: any) => void;
}

const Cell: FC<CellProps> = ({ 
  r, cl, n, c, board, violations, hint, isHazardous, 
  showNeighbors, showExcess, showRemaining, justSolved, 
  toggleCoin, moveCoin, setHoveredPos, setHint 
}) => {
  const pos = `${r},${cl}`;
  const isSelected = board.has(pos);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: pos });
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: pos,
    disabled: !isSelected
  });

  const isViolation = violations.includes(pos);
  const isHintAdd = hint?.type === 'add' && hint?.pos === pos;
  const isHintRemove = hint?.type === 'remove' && hint?.pos === pos;
  const isHintMoveFrom = hint?.type === 'move' && hint?.from === pos;
  const isHintMoveTo = hint?.type === 'move' && hint?.to === pos;
  
  const handleHintClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isHintAdd) {
      toggleCoin(r, cl);
      setHint(null);
    } else if (isHintRemove) {
      toggleCoin(r, cl);
      setHint(null);
    } else if (isHintMoveFrom || isHintMoveTo) {
      // Execute the move immediately
      if (hint?.from && hint?.to) {
        moveCoin(hint.from, hint.to);
        setHint(null);
      }
    }
  };
  
  const isCellHazard = isHazardous(r, cl);
  const neighborCount = getNeighborCount(r, cl, n, board);
  const excessCount = getExcessCount(r, cl, c, board);
  const remainingCount = getRemainingCount(r, cl, c, board);
  const dynamicFontSize = Math.min(64, Math.max(14, (600 / n) * 0.35));

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100,
    cursor: 'grabbing'
  } : undefined;

  return (
    <div
      ref={setDroppableRef}
      onMouseEnter={() => setHoveredPos(pos)}
      onMouseLeave={() => setHoveredPos(null)}
      className={`border border-current/10 flex items-center justify-center transition-colors relative h-full w-full overflow-hidden p-0 m-0 box-border group aspect-square ${isOver ? 'bg-current/20' : 'hover:bg-current/10'}`}
    >
      {/* Hazard Overlay */}
      {isCellHazard && (
        <div className="absolute inset-0 bg-neutral-200/50 z-0 pointer-events-none" />
      )}

      {isSelected && (
        <motion.div 
          ref={setDraggableRef}
          {...listeners}
          {...attributes}
          style={style}
          onClick={(e) => { e.stopPropagation(); toggleCoin(r, cl); setHint(null); }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={justSolved ? {
            filter: ['invert(0)', 'invert(1)', 'invert(0)'],
            scale: 1,
            opacity: 1
          } : { scale: 1, opacity: 1, filter: 'invert(0)' }}
          transition={justSolved ? { 
            duration: 0.6,
            ease: "easeInOut",
            repeat: 1
          } : { duration: 0 }}
          className={`w-4/5 h-4/5 border-2 border-current rounded-full ${isViolation ? 'bg-min-bg' : 'bg-current'} transition-colors duration-300 flex items-center justify-center shadow-lg relative z-10 shrink-0 aspect-square cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-0' : ''}`} 
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
          
          {/* Hint Overlay for removals */}
          {(isHintRemove || isHintMoveFrom) && (
            <div 
              onClick={handleHintClick}
              className="absolute inset-0 flex items-center justify-center z-50 cursor-pointer"
            >
              <motion.span 
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                className="text-white font-black text-6xl pointer-events-none drop-shadow-[0_0_2px_rgba(0,0,0,1)]"
              >
                ×
              </motion.span>
            </div>
          )}
        </motion.div>
      )}

      {!isSelected && showRemaining && (
        <button 
          onClick={() => { toggleCoin(r, cl); setHint(null); }}
          className="w-full h-full flex items-center justify-center"
        >
          <span 
            style={{ fontSize: `${dynamicFontSize}px` }}
            className="font-medium opacity-40 leading-none group-hover:opacity-80 transition-opacity pointer-events-none"
          >
            {remainingCount}
          </span>
        </button>
      )}

          {/* Hint Overlay for additions */}
          {(isHintAdd || isHintMoveTo) && (
            <div 
              onClick={handleHintClick}
              className="absolute inset-0 flex items-center justify-center z-50 cursor-pointer pointer-events-auto"
            >
              <motion.span 
                animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                className="text-current font-black text-6xl pointer-events-none"
              >
                +
              </motion.span>
            </div>
          )}

      {!isSelected && !showRemaining && !isHintAdd && !isHintMoveTo && (
         <button 
          onClick={() => { toggleCoin(r, cl); setHint(null); }}
          className="w-full h-full"
        />
      )}
    </div>
  );
}

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

  const [zoom, setZoom] = useState<number>(1.0);
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [showExcess, setShowExcess] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [hint, setHint] = useState<{ type: 'add' | 'remove' | 'move'; pos?: string, from?: string, to?: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const violations = useMemo(() => getViolations(c, board), [board, c]);
  const isSolved = useMemo(() => board.size === (n * c) && violations.length === 0, [board.size, n, c, violations.length]);
  const isFullCount = useMemo(() => board.size === (n * c), [board.size, n, c]);
  const [justSolved, setJustSolved] = useState(false);
  const [lastActionPos, setLastActionPos] = useState<string | null>(null);

  // Celebration effect when solved (including manual moves)
  useEffect(() => {
    if (isSolved && board.size > 0) {
      setJustSolved(true);
      const timer = setTimeout(() => setJustSolved(false), 2000);
      return () => {
        clearTimeout(timer);
        setJustSolved(false);
      };
    } else {
      setJustSolved(false);
    }
  }, [isSolved, board.size]);

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
    
    // Minimal padding for maximum width usage
    const padding = 16;
    const availableWidth = windowWidth - padding;
    const availableHeight = windowHeight - padding;
    
    // Content target dimensions - board is primary actor
    const totalContentWidth = 900; 
    const totalContentHeight = 1400; 
    
    const scaleW = availableWidth / totalContentWidth;
    const scaleH = availableHeight / totalContentHeight;
    
    const isPortrait = windowHeight > windowWidth;
    
    let scale;
    if (isPortrait) {
      // Prioritize width on mobile
      scale = Math.min(scaleW, 1.4);
    } else {
      // Balanced fit for landscape
      scale = Math.min(scaleW, scaleH, 1.2);
    }

    setZoom(1.0);
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

    // Toggle: if hint is already active, clear it
    if (hint) {
      setHint(null);
      return;
    }

    const currentSize = board.size;
    const targetSize = n * c;

    // Strategy 1: If we have too few coins, prioritize adding.
    if (currentSize < targetSize) {
      const allAdditions: { pos: string, rem: number }[] = [];
      const rowCounts = new Array(n).fill(0);
      board.forEach(key => {
        const r = parseInt(key.split(',')[0]);
        rowCounts[r]++;
      });

      // Find ALL empty spots across the board that can take a coin
      for (let r = 0; r < n; r++) {
        for (let cl = 0; cl < n; cl++) {
          const pos = `${r},${cl}`;
          if (!board.has(pos)) {
            const rem = getRemainingCount(r, cl, c, board);
            // We only consider additions that don't violate ANY constraint immediately (rem >= 1).
            // However, we MUST prioritize rows that are under-full.
            const isUnderRow = rowCounts[r] < c;
            if (isUnderRow && rem >= 1) {
              allAdditions.push({ pos, rem });
            }
          }
        }
      }

      if (allAdditions.length > 0) {
        // Sort by rem desc (most safe spot), then randomly among best
        allAdditions.sort((a, b) => b.rem - a.rem);
        const best = allAdditions.filter(a => a.rem === allAdditions[0].rem);
        setHint({ type: 'add', pos: best[Math.floor(Math.random() * best.length)].pos });
        return;
      }

      // If no "safe" spots found (rem >= 1), use solution-based addition
      const solution = findSolution(n, c);
      if (solution) {
        const missing = [...solution].filter(key => !board.has(key));
        if (missing.length > 0) {
          // Double check: if we add a coin from solution, even if it violates, it's progress
          setHint({ type: 'add', pos: missing[Math.floor(Math.random() * missing.length)] });
          return;
        }
      }

      // Final fallback: just add anywhere in an under-full row
      for (let r = 0; r < n; r++) {
        if (rowCounts[r] < c) {
          for (let cl = 0; cl < n; cl++) {
            if (!board.has(`${r},${cl}`)) {
              setHint({ type: 'add', pos: `${r},${cl}` });
              return;
            }
          }
        }
      }
    }

    // Strategy 2: If we have too many coins, prioritize removing.
    if (currentSize > targetSize) {
      const allRemovals: { pos: string, excess: number }[] = [];
      const rowCounts = new Array(n).fill(0);
      board.forEach(key => {
        const r = parseInt(key.split(',')[0]);
        rowCounts[r]++;
      });

      board.forEach((pos: string) => {
        const [r, cl] = pos.split(',').map(Number);
        // Prioritize coins in rows that are over-full, OR any coin with excess
        if (rowCounts[r] > c || violations.includes(pos)) {
          allRemovals.push({ pos, excess: getExcessCount(r, cl, c, board) });
        }
      });

      if (allRemovals.length > 0) {
        // Sort by excess desc (most problematic coin first)
        allRemovals.sort((a, b) => b.excess - a.excess);
        const maxExcess = allRemovals[0].excess;
        const best = allRemovals.filter(r => r.excess === maxExcess);
        setHint({ type: 'remove', pos: best[Math.floor(Math.random() * best.length)].pos });
        return;
      }
    }

    // Strategy 3: Correct count but not solved (must move).
    if (currentSize === targetSize && !isSolved) {
      // Prioritize moves that reduce total conflicts
      const currentConflicts = violations.length;
      
      // Rank violation cells by their excess count before moving
      const violationCells = Array.from(violations).map((pos: string) => {
        const [r, cl] = pos.split(',').map(Number);
        return { pos, excess: getExcessCount(r, cl, c, board) };
      });
      
      // Sort by excess desc
      violationCells.sort((a, b) => b.excess - a.excess);

      const emptyCells: string[] = [];
      for (let r = 0; r < n; r++) {
        for (let cl = 0; cl < n; cl++) {
          const p = `${r},${cl}`;
          if (!board.has(p)) emptyCells.push(p);
        }
      }

      for (const fromObj of violationCells) {
        const from = fromObj.pos;
        // Temporarily remove 'from' to evaluate remaining counts accurately
        const tempBoard = new Set<string>(board);
        tempBoard.delete(from);

        // Try empty spots, prioritizing those that have positive remaining count AFTER subtraction
        const candidates = emptyCells.map((to: string) => {
          const [tr, tc] = to.split(',').map(Number);
          return { to, rem: getRemainingCount(tr, tc, c, tempBoard) };
        });

        // 1. First try moves that reduce violations and maintain row/col/diag limits (rem >= 1)
        for (const cand of candidates) {
          if (cand.rem >= 1) {
            const testBoard = new Set<string>(tempBoard);
            testBoard.add(cand.to);
            if (getViolations(c, testBoard).length < currentConflicts) {
              setHint({ type: 'move', from, to: cand.to });
              return;
            }
          }
        }

        // 2. Fallback: Any move that reduces total conflicts, even if it's still "dirty"
        for (const cand of candidates) {
          const testBoard = new Set<string>(tempBoard);
          testBoard.add(cand.to);
          if (getViolations(c, testBoard).length < currentConflicts) {
            setHint({ type: 'move', from, to: cand.to });
            return;
          }
        }
      }

      // Fallback: solution-based move
      const solution = findSolution(n, c);
      if (solution) {
        const boardWithExcess = Array.from(board).map((pos: string) => {
          const [r, cl] = pos.split(',').map(Number);
          return { pos, excess: getExcessCount(r, cl, c, board), isCorrect: solution.has(pos) };
        });
        
        // Prioritize removing the most "excessive" incorrect coin
        boardWithExcess.sort((a, b) => b.excess - a.excess);
        const fromPos = boardWithExcess.find(obj => !obj.isCorrect)?.pos;
        const toPos = [...solution].find(pos => !board.has(pos));
        
        if (fromPos && toPos) {
          setHint({ type: 'move', from: fromPos, to: toPos });
          return;
        }
      }

      // Final fallback: Any move within same row if possible
      for (const fromObj of violationCells) {
        const from = fromObj.pos;
        const [fr] = from.split(',').map(Number);
        for (const to of emptyCells) {
          if (parseInt(to.split(',')[0]) === fr) {
            setHint({ type: 'move', from, to });
            return;
          }
        }
      }
    }
  };

  const handleRandomBoard = () => {
    const newBoard = new Set<string>();
    for (let r = 0; r < n; r++) {
      const cols = Array.from({ length: n }, (_, i) => i);
      // Shuffle cols
      for (let i = cols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
      }
      // Pick first C columns
      for (let i = 0; i < c; i++) {
        newBoard.add(`${r},${cols[i]}`);
      }
    }
    pushToHistory(newBoard);
    setLastActionPos(null);
    setHint(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = active.id as string;
      const to = over.id as string;
      
      const newBoard = new Set(board);
      if (newBoard.has(from)) {
        newBoard.delete(from);
        newBoard.add(to);
        pushToHistory(newBoard);
        setLastActionPos(to);
        setHint(null);
      }
    }
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
    setHint(null);
  }, [board, pushToHistory]);

  const moveCoin = useCallback((from: string, to: string) => {
    const newBoard = new Set(board);
    if (newBoard.has(from)) {
      newBoard.delete(from);
      newBoard.add(to);
      setLastActionPos(to);
      pushToHistory(newBoard);
      setHint(null);
    }
  }, [board, pushToHistory]);

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
        className="w-full max-w-7xl mx-auto flex flex-col items-center gap-12 justify-center transition-transform duration-300 ease-out"
      >
        
        {/* Header & Controls Column */}
        <aside className="w-full max-w-2xl flex flex-col gap-8 shrink-0">
          <header className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 uppercase">COIN PLACEMENT</h1>
              <div className="flex items-center gap-3 opacity-40">
                <span className="text-[10px] font-black tracking-widest uppercase">Version 1.5.2</span>
                <button 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 hover:opacity-100 transition-opacity"
                >
                  <RefreshCcw size={10} />
                  <span className="text-[10px] font-black tracking-widest uppercase underline underline-offset-2">Update</span>
                </button>
              </div>
            </div>
          </header>

          <section className="space-y-6 py-6 border-y-2 border-current">
            <div className="flex items-center gap-4 w-full">
              <span className="text-[10px] md:text-sm font-black tracking-widest opacity-40 uppercase">Elapsed</span>
              <span className="text-3xl md:text-4xl leading-none tabular-nums font-black ml-auto">{formatTime(time)}</span>
              <div className="flex gap-1 ml-4">
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

            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">Number</span>
                <span className="text-3xl font-black tabular-nums">{n}</span>
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
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">Coins</span>
                <span className="text-3xl font-black tabular-nums">{c}</span>
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
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase">Zoom</span>
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
                <button onClick={fitToScreen} className="p-2 hover:bg-current/10 border-2 border-current transition-colors ml-2">
                  <Maximize size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-4">
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="w-[calc(50%-4px)] flex items-center justify-center gap-2 p-3 border-2 border-current hover:bg-current hover:text-min-bg disabled:opacity-20 disabled:pointer-events-none transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <Undo2 size={12} /> Undo
              </button>
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="w-[calc(50%-4px)] flex items-center justify-center gap-2 p-3 border-2 border-current hover:bg-current hover:text-min-bg disabled:opacity-20 disabled:pointer-events-none transition-all font-black text-[10px] uppercase tracking-widest"
              >
                Redo <Redo2 size={12} />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button 
                onClick={() => setShowAllHazards(!showAllHazards)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showAllHazards ? 'bg-neutral-800 text-neutral-100 border-neutral-800 shadow-inner' : 'border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'}`}
              >
                Affect
              </button>
              <button 
                onClick={() => setShowNeighbors(!showNeighbors)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showNeighbors ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Neighbors
              </button>
              <button 
                onClick={() => setShowExcess(!showExcess)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showExcess ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Excess
              </button>
              <button 
                onClick={() => setShowRemaining(!showRemaining)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest ${showRemaining ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Remaining
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button 
                disabled={isSolving}
                onClick={handleSolve}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${isSolving ? 'opacity-50 cursor-wait bg-min-ink text-min-bg' : 'border-min-ink text-min-ink hover:bg-min-ink/10'}`}
              >
                {isSolving ? '...' : 'Solve'}
              </button>
              <button 
                onClick={handleHint}
                disabled={isSolved || isSolving}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${isSolved || isSolving ? 'opacity-20 cursor-not-allowed border-current/20' : 'border-current text-current hover:bg-current/10'}`}
              >
                Hint
              </button>
              <button 
                onClick={handleRandomBoard}
                className="w-[calc(50%-4px)] flex items-center justify-center gap-2 p-3 border-2 border-min-ink text-min-ink hover:bg-min-ink/10 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                <Dice5 size={12} /> Random
              </button>
              <button 
                onClick={() => { pushToHistory(new Set()); setLastActionPos(null); setTime(0); setTimerActive(false); }}
                className="w-[calc(50%-4px)] flex items-center justify-center p-3 border-2 border-min-ink text-min-ink hover:bg-min-ink/10 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                Wipe
              </button>
            </div>
          </section>
        </aside>

        {/* Board Area */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full max-w-2xl px-4 mb-4">
            <div className="grid grid-cols-3 gap-1 border-2 border-current bg-min-bg shadow-sm overflow-hidden">
              <div className="flex flex-col items-center p-3 border-r-2 border-current last:border-r-0">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase mb-1">Valid</span>
                <span className="text-2xl font-black tabular-nums">{board.size - violations.length}</span>
              </div>
              <div className="flex flex-col items-center p-3 border-r-2 border-current last:border-r-0 bg-current/5">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase mb-1">Invalid</span>
                <span className="text-2xl font-black tabular-nums">{violations.length}</span>
              </div>
              <div className="flex flex-col items-center p-3 border-r-2 border-current last:border-r-0">
                <span className="text-[10px] font-black tracking-widest opacity-40 uppercase mb-1">Goal</span>
                <span className="text-2xl font-black tabular-nums">{n * c}</span>
              </div>
            </div>
          </div>
          <div className="w-full flex items-center justify-center min-h-[300px] touch-auto">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div 
                style={{ 
                  gridTemplateColumns: `repeat(${n}, 1fr)`,
                  width: `min(850px, 95vw)`,
                  height: `min(850px, 95vw)`
                }} 
                className="grid border-2 border-current bg-min-bg shadow-2xl relative overflow-hidden transition-all duration-300"
              >
                {gridCells.map(({ r, cl }) => (
                  <Cell 
                    key={`${r},${cl}`}
                    r={r}
                    cl={cl}
                    n={n}
                    c={c}
                    board={board}
                    violations={violations}
                    hint={hint}
                    lastActionPos={lastActionPos}
                    isHazardous={isHazardous}
                    showNeighbors={showNeighbors}
                    showExcess={showExcess}
                    showRemaining={showRemaining}
                    justSolved={justSolved}
                    toggleCoin={toggleCoin}
                    moveCoin={moveCoin}
                    setHoveredPos={setHoveredPos}
                    setHint={setHint}
                  />
                ))}
              </div>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}

