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
  RefreshCcw
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
  isHazardous: (r: number, cl: number) => boolean;
  showNeighbors: boolean;
  showExcess: boolean;
  showRemaining: boolean;
  justSolved: boolean;
  toggleCoin: (r: number, cl: number) => void;
  moveCoin: (from: string, to: string) => void;
  setHoveredPos: (pos: string | null) => void;
}

const Cell: FC<CellProps> = ({ 
  r, cl, n, c, board, violations, isHazardous, 
  showNeighbors, showExcess, showRemaining, justSolved, 
  toggleCoin, moveCoin, setHoveredPos 
}) => {
  const pos = `${r},${cl}`;
  const isSelected = board.has(pos);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: pos });
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: pos,
    disabled: !isSelected
  });

  const isViolation = violations.includes(pos);
  
  const isCellHazard = isHazardous(r, cl);
  const neighborCount = getNeighborCount(r, cl, n, board, c);
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
          onClick={(e) => { e.stopPropagation(); toggleCoin(r, cl); }}
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
          className={`w-4/5 h-4/5 border-2 border-current rounded-full ${isViolation ? 'bg-min-bg' : 'bg-current'} transition-colors duration-300 flex items-center justify-center shadow-lg relative z-10 shrink-0 aspect-square cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-0' : ''}`} 
        >
          {isSelected && !isViolation && showNeighbors && (
            <span 
              style={{ fontSize: `${dynamicFontSize}px` }}
              className="font-bold leading-none text-black pointer-events-none"
            >
              {neighborCount}
            </span>
          )}
          {isSelected && isViolation && showExcess && (
            <span 
              style={{ fontSize: `${dynamicFontSize}px` }}
              className="text-current font-bold leading-none pointer-events-none"
            >
              {excessCount}
            </span>
          )}
        </motion.div>
      )}

      {!isSelected && showRemaining && (
        <button 
          onClick={() => { toggleCoin(r, cl); }}
          className="w-full h-full flex items-center justify-center"
        >
          <span 
            style={{ fontSize: `${dynamicFontSize}px` }}
            className="font-bold opacity-40 leading-none group-hover:opacity-80 transition-opacity pointer-events-none"
          >
            {remainingCount}
          </span>
        </button>
      )}

      {!isSelected && !showRemaining && (
         <button 
          onClick={() => { toggleCoin(r, cl); }}
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
  }, [board, pushToHistory]);

  const moveCoin = useCallback((from: string, to: string) => {
    const newBoard = new Set(board);
    if (newBoard.has(from)) {
      newBoard.delete(from);
      newBoard.add(to);
      setLastActionPos(to);
      pushToHistory(newBoard);
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
          <header className="flex flex-col items-center justify-center text-center">
            <div className="flex flex-col items-center">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-2 uppercase text-center">COIN PLACEMENT</h1>
              <div className="flex items-center justify-center gap-3 opacity-40">
                <span className="text-[10px] font-bold tracking-widest uppercase">Version 1.6.10</span>
                <button 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 hover:opacity-100 transition-opacity"
                >
                  <RefreshCcw size={10} />
                  <span className="text-[10px] font-bold tracking-widest uppercase underline underline-offset-2">Update</span>
                </button>
              </div>
            </div>
          </header>

          <section className="space-y-6 py-6 border-y-2 border-current">
            <div className="space-y-4">
              <div className="flex items-center justify-center text-center">
                <span className="text-xl font-bold tracking-tight uppercase">NUMBER : {n}</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { 
                    const val = Math.max(2, n - 1);
                    setN(val);
                    if (c > val) setC(val);
                    pushToHistory(new Set()); setTime(0); setTimerActive(false);
                  }}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="range" min="2" max="32" value={n} 
                  onChange={(e) => { 
                    const val = parseInt(e.target.value);
                    setN(val); 
                    if (c > val) setC(val);
                    pushToHistory(new Set()); 
                    setTime(0);
                    setTimerActive(false);
                  }}
                  className="w-full h-8 cursor-pointer"
                />
                <button 
                  onClick={() => { 
                    const val = Math.min(32, n + 1);
                    setN(val); 
                    pushToHistory(new Set()); setTime(0); setTimerActive(false);
                  }}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center text-center">
                <span className="text-xl font-bold tracking-tight uppercase">COINS : {c}</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const val = Math.max(1, c - 1);
                    setC(val);
                    pushToHistory(new Set()); setTime(0); setTimerActive(false);
                  }}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Minus size={16} />
                </button>
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
                <button 
                  onClick={() => {
                    const val = Math.min(n, c + 1);
                    setC(val);
                    pushToHistory(new Set()); setTime(0); setTimerActive(false);
                  }}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 text-center">
                <button onClick={fitToScreen} className="p-2 border-2 border-current transition-colors">
                  <Maximize size={16} />
                </button>
                <span className="text-xl font-bold tracking-tight uppercase">ZOOM : {Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="range" min="0.5" max="3" step="0.1" value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-8 cursor-pointer"
                />
                <button 
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-4">
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="w-[calc(50%-4px)] flex items-center justify-center gap-2 p-4 border-2 border-current disabled:opacity-20 disabled:pointer-events-none transition-all font-bold text-xl uppercase tracking-widest"
              >
                <Undo2 size={20} /> Undo
              </button>
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="w-[calc(50%-4px)] flex items-center justify-center gap-2 p-4 border-2 border-current disabled:opacity-20 disabled:pointer-events-none transition-all font-bold text-xl uppercase tracking-widest"
              >
                Redo <Redo2 size={20} />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button 
                onClick={() => setShowAllHazards(!showAllHazards)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 transition-all font-bold text-xl uppercase tracking-widest ${showAllHazards ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Hover
              </button>
              <button 
                onClick={() => setShowNeighbors(!showNeighbors)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 transition-all font-bold text-xl uppercase tracking-widest ${showNeighbors ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Neighbors
              </button>
              <button 
                onClick={() => setShowExcess(!showExcess)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 transition-all font-bold text-xl uppercase tracking-widest ${showExcess ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Excess
              </button>
              <button 
                onClick={() => setShowRemaining(!showRemaining)}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 transition-all font-bold text-xl uppercase tracking-widest ${showRemaining ? 'bg-min-ink text-min-bg border-min-ink shadow-inner' : 'border-min-ink/30 text-min-ink hover:bg-min-ink/5'}`}
              >
                Remaining
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button 
                disabled={isSolving}
                onClick={handleSolve}
                className={`w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 transition-all font-bold text-xl uppercase tracking-widest shadow-sm ${isSolving ? 'opacity-50 cursor-wait bg-min-ink text-min-bg' : 'border-min-ink text-min-ink hover:bg-min-ink/10'}`}
              >
                {isSolving ? '...' : 'Solve'}
              </button>
              <button 
                onClick={() => { pushToHistory(new Set()); setLastActionPos(null); setTime(0); setTimerActive(false); }}
                className="w-[calc(50%-4px)] flex items-center justify-center p-4 border-2 border-min-ink text-min-ink hover:bg-min-ink/10 transition-all font-bold text-xl uppercase tracking-widest shadow-sm"
              >
                Wipe
              </button>
            </div>
          </section>
        </aside>

        {/* Board Area */}
        <div className="w-full flex flex-col items-center">
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
                    isHazardous={isHazardous}
                    showNeighbors={showNeighbors}
                    showExcess={showExcess}
                    showRemaining={showRemaining}
                    justSolved={justSolved}
                    toggleCoin={toggleCoin}
                    moveCoin={moveCoin}
                    setHoveredPos={setHoveredPos}
                  />
                ))}
              </div>
            </DndContext>
          </div>

          <div className="w-full max-w-2xl mt-12 pt-8 border-t-2 border-current">
            <div className="grid grid-cols-3 gap-2 w-full mb-8">
              <div className="flex items-center justify-center p-4 border-2 border-current font-bold text-xl uppercase tracking-widest bg-min-bg shadow-sm">
                VALID : {board.size - violations.length}
              </div>
              <div className="flex items-center justify-center p-4 border-2 border-current font-bold text-xl uppercase tracking-widest bg-min-bg shadow-sm">
                INVALID : {violations.length}
              </div>
              <div className="flex items-center justify-center p-4 border-2 border-current font-bold text-xl uppercase tracking-widest bg-min-bg shadow-sm">
                GOAL : {n * c}
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 w-full text-center">
              <span className="text-xl font-bold tracking-tight uppercase">ELAPSED : {formatTime(time)}</span>
              <div className="flex gap-2 justify-center">
                <button 
                  onClick={() => setTimerActive(!timerActive)}
                  className="p-2 border-2 border-current transition-colors"
                >
                  {timerActive ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button 
                  onClick={() => { setTimerActive(false); setTime(0); }}
                  className="p-2 border-2 border-current transition-colors"
                >
                  <Square size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

