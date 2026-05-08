{- 
  GENERALIZED N-QUEENS SOLVER (Haskell Implementation)
  
  PROBLEM:
  Place exactly C coins in every row, every column, and every diagonal 
  of an N x N grid. Standard N-Queens is the N=8, C=1 case.
  
  ALGORITHM: Min-Conflicts Local Search
  1. Generate an initial state that satisfies the row constraint (exactly C coins per row).
  2. While conflicts exist:
     a. Pick a random row containing a violation.
     b. Pick a random coin in that row.
     c. Evaluate all possible moves for that coin within its row.
     d. Move the coin to the column that results in the minimum total conflicts.
  3. If no solution is found after M iterations, restart with a new random board.
-}

import System.Random
import Data.Set (Set)
import qualified Data.Set as Set
import Data.Map.Strict (Map)
import qualified Data.Map.Strict as Map
import Control.Monad (foldM, replicateM)
import Data.List (foldl', minimumBy)
import Data.Ord (comparing)
import System.Environment (getArgs)

-- | Represents a position on the board (row, column)
type Pos = (Int, Int)

-- | State container for the board and its line occupation counts.
--   We avoid recalculating counts entirely every step by incremental updates.
data SolverState = SolverState {
    board         :: Set Pos,        -- Set of occupied positions (r, cl)
    colCounts     :: Map Int Int,    -- Mapping of column index to coin count
    majDiagCounts :: Map Int Int,    -- Mapping of (r - cl) to coin count
    minDiagCounts :: Map Int Int,    -- Mapping of (r + cl) to coin count
    n             :: Int,            -- Board dimension N
    c             :: Int             -- Target coins per line C
} deriving (Show)

-- | Creates a new, empty solver state for a given board configuration.
emptyState :: Int -> Int -> SolverState
emptyState nVal cVal = SolverState Set.empty Map.empty Map.empty Map.empty nVal cVal

-- | Increments or decrements count for the lines passing through a position.
--   A coin at (r, cl) affects its column and two diagonal IDs.
updateCounts :: Pos -> Int -> SolverState -> SolverState
updateCounts (r, cl) delta state = state {
    colCounts     = Map.insertWith (+) cl delta (colCounts state),
    majDiagCounts = Map.insertWith (+) (r - cl) delta (majDiagCounts state),
    minDiagCounts = Map.insertWith (+) (r + cl) delta (minDiagCounts state)
}

-- | Atomically adds a coin to the set and updates its line counts.
addCoin :: Pos -> SolverState -> SolverState
addCoin pos state = updateCounts pos 1 (state { board = Set.insert pos (board state) })

-- | Atomically removes a coin from the set and updates its line counts.
removeCoin :: Pos -> SolverState -> SolverState
removeCoin pos state = updateCounts pos (-1) (state { board = Set.delete pos (board state) })

-- | Core operation: Move a coin within its row to maintain the row constraint.
moveCoin :: Int -> Int -> Int -> SolverState -> SolverState
moveCoin r oldCol newCol state = 
    addCoin (r, newCol) $ removeCoin (r, oldCol) state

-- | Calculate total conflicts (over-limit counts) for a single cell.
--   A conflict is defined as the number of extra coins in a line beyond limit C.
getConflicts :: Pos -> SolverState -> Int
getConflicts (r, cl) state = 
    let colVal = Map.findWithDefault 0 cl (colCounts state)
        majVal = Map.findWithDefault 0 (r - cl) (majDiagCounts state)
        minVal = Map.findWithDefault 0 (r + cl) (minDiagCounts state)
        countLimit = c state
        sumExcess v = if v > countLimit then v - countLimit else 0
    in sumExcess colVal + sumExcess majVal + sumExcess minVal

-- | Sum of all line violations across the board.
--   Target is 0 conflicts.
getTotalConflicts :: SolverState -> Int
getTotalConflicts state = 
    let countLimit = c state
        sumExcess m = sum [v - countLimit | v <- Map.elems m, v > countLimit]
    in sumExcess (colCounts state) + 
       sumExcess (majDiagCounts state) + 
       sumExcess (minDiagCounts state)

-- | Simple Fisher-Yates implementation for random sampling
fisherYates :: [a] -> IO [a]
fisherYates xs = do
    let len = length xs
    let loop a i 
            | i >= len - 1 = return a
            | otherwise = do
                j <- randomRIO (i, len - 1)
                loop (swap a i j) (i + 1)
    loop xs 0
    where
        swap l i j
            | i == j    = l
            | otherwise = 
                let valI = l !! i
                    valJ = l !! j
                in replace l i valJ j valI
        replace l i vI j vJ = 
            let (before, atI:after) = splitAt i l
                (mid, atJ:end)      = splitAt (j - i - 1) after
            in before ++ [vI] ++ mid ++ [vJ] ++ end

-- | initialization: Start with Exactly C coins per row by placing coins 
--   in randomly selected columns for each row index.
initialAssignment :: Int -> Int -> IO SolverState
initialAssignment nVal cVal = do
    let startState = emptyState nVal cVal
    foldM (\state r -> do
        cols <- fisherYates [0..nVal-1]
        let selected = take cVal cols
        return $ foldl' (\s cl -> addCoin (r, cl) s) state selected
        ) startState [0..nVal-1]

-- | One step of local search: identify a potentially conflicting row and 
--   move one of its coins to the column that minimizes overall board tension.
searchStep :: Int -> SolverState -> IO SolverState
searchStep 0 state = return state -- Exhausted iterations
searchStep iterations state = do
    if getTotalConflicts state == 0 
        then return state -- DONE!
        else do
            -- Step 1: Choose a random row to improve
            r <- randomRIO (0, n state - 1)
            
            -- Step 2: identify coins and empty slots in this row
            let coinsInRow = [cl | cl <- [0..n state - 1], Set.member (r, cl) (board state)]
                emptyInRow = [cl | cl <- [0..n state - 1], not (Set.member (r, cl) (board state))]
            
            -- Step 3: Pick a random coin to potentially relocate
            cIdx <- randomRIO (0, length coinsInRow - 1)
            let oldCol = coinsInRow !! cIdx
            
            -- Step 4: Find the set of columns in this row that minimize conflicts.
            -- We track all tied "best" candidates to maintain randomness.
            let findBest [] candidates _ = return candidates
                findBest (newCol:rest) candidates minConf = do
                    let testState = moveCoin r oldCol newCol state
                        conf = getConflicts (r, newCol) testState
                    if conf < minConf 
                        then findBest rest [newCol] conf
                        else if conf == minConf 
                            then findBest rest (newCol:candidates) minConf
                            else findBest rest candidates minConf

            bestCandidates <- findBest emptyInRow [oldCol] (getConflicts (r, oldCol) state)
            
            -- Step 5: Commit to one of the best candidate columns
            bIdx <- randomRIO (0, length bestCandidates - 1)
            let targetCol = bestCandidates !! bIdx
            
            let nextState = if targetCol == oldCol then state else moveCoin r oldCol targetCol state
            searchStep (iterations - 1) nextState

-- | Master loop applying search with multiple restarts to escape local minima traps.
solve :: Int -> Int -> Int -> IO (Maybe SolverState)
solve nVal cVal restarts = do
    let maxIters = nVal * nVal * 100
    let loop 0 = return Nothing -- Exceeded restarts
        loop r = do
            startState <- initialAssignment nVal cVal
            result <- searchStep maxIters startState
            if getTotalConflicts result == 0 
                then return (Just result)
                else loop (r - 1)
    loop restarts

-- | Main Execution Entry
main :: IO ()
main = do
    args <- getArgs
    case args of
        (nStr:cStr:_) -> do
            let nV = read nStr
                cV = read cStr
            putStrLn $ "Finding solution for N=" ++ show nV ++ ", C=" ++ show cV ++ "..."
            result <- solve nV cV 50
            case result of
                Just s -> do
                    putStrLn "\n[SUCCESS] Solution found:"
                    printBoard s
                Nothing -> putStrLn "\n[FAILURE] No solution found within runtime limits."
        _ -> putStrLn "Usage: runghc solver.hs <N> <C>"

-- | Renders the square board to the console using 'o' for coins and '.' for empty spaces.
printBoard :: SolverState -> IO ()
printBoard s = do
    let nV = n s
    mapM_ (\r -> do
        let rowLine = [if Set.member (r, cl) (board s) then 'o' else '.' | cl <- [0..nV-1]]
        putStrLn (unwords rowLine)
        ) [0..nV-1]
