{- 
  GENERALIZED N-QUEENS SOLVER (Haskell Implementation)
  
  Mimicking solver.jl exactly:
  1. Initialization: Exactly C coins per row (Satisfying row constraint).
  2. Local Search: Min-Conflicts heuristic to resolve column and diagonal collisions.
  3. Incremental State: Track counts in Maps for O(1) conflict lookups.
-}

import System.Random
import System.Environment (getArgs)
import Data.Set (Set)
import qualified Data.Set as Set
import Data.Map.Strict (Map)
import qualified Data.Map.Strict as Map
import Control.Monad (foldM, forM_)
import Data.List (foldl')
import Data.Time.Clock (getCurrentTime, diffUTCTime)
import Text.Printf (printf)

-- | Solver State
data SolverState = SolverState {
    board         :: Set (Int, Int),
    colCounts     :: Map Int Int,
    majDiagCounts :: Map Int Int,
    minDiagCounts :: Map Int Int,
    n             :: Int,
    c             :: Int
} deriving (Show)

-- | Initial empty state
emptyState :: Int -> Int -> SolverState
emptyState nVal cVal = SolverState Set.empty Map.empty Map.empty Map.empty nVal cVal

-- | Update counts for line directions
updateCounts :: (Int, Int) -> Int -> SolverState -> SolverState
updateCounts (r, cl) delta state = state {
    colCounts     = Map.insertWith (+) cl delta (colCounts state),
    majDiagCounts = Map.insertWith (+) (r - cl) delta (majDiagCounts state),
    minDiagCounts = Map.insertWith (+) (r + cl) delta (minDiagCounts state)
}

-- | Add coin to board
addCoin :: (Int, Int) -> SolverState -> SolverState
addCoin pos state = updateCounts pos 1 (state { board = Set.insert pos (board state) })

-- | Remove coin from board
removeCoin :: (Int, Int) -> SolverState -> SolverState
removeCoin pos state = updateCounts pos (-1) (state { board = Set.delete pos (board state) })

-- | Move coin in row
moveCoin :: Int -> Int -> Int -> SolverState -> SolverState
moveCoin r oldCol newCol state = addCoin (r, newCol) $ removeCoin (r, oldCol) state

-- | Get conflict score for a position
getConflicts :: (Int, Int) -> SolverState -> Int
getConflicts (r, cl) state = 
    let cc = Map.findWithDefault 0 cl (colCounts state)
        mc = Map.findWithDefault 0 (r - cl) (majDiagCounts state)
        nc = Map.findWithDefault 0 (r + cl) (minDiagCounts state)
        limit = c state
        excess v = if v > limit then v - limit else 0
    in excess cc + excess mc + excess nc

-- | Total conflicts across all lines
getTotalConflicts :: SolverState -> Int
getTotalConflicts state = 
    let limit = c state
        sumExcess m = sum [v - limit | v <- Map.elems m, v > limit]
    in sumExcess (colCounts state) + sumExcess (majDiagCounts state) + sumExcess (minDiagCounts state)

-- | Simple shuffle implementation
shuffleList :: [a] -> IO [a]
shuffleList [] = return []
shuffleList xs = do
    let nIdx = length xs
    let loop [] _ = return []
        loop l len = do
            i <- randomRIO (0, len-1)
            let (before, x:after) = splitAt i l
            rest <- loop (before ++ after) (len - 1)
            return (x:rest)
    loop xs nIdx

-- | Satisfy Row Constraint initially
initialAssignment :: Int -> Int -> IO SolverState
initialAssignment nVal cVal = do
    foldM (\state r -> do
        cols <- shuffleList [1..nVal]
        let selected = take cVal cols
        return $ foldl' (\s cl -> addCoin (r, cl) s) state selected
        ) (emptyState nVal cVal) [1..nVal]

-- | Search step
searchStep :: Int -> SolverState -> IO (Maybe SolverState)
searchStep 0 _ = return Nothing
searchStep iterations state = do
    if getTotalConflicts state == 0 
        then return (Just state)
        else do
            r <- randomRIO (1, n state)
            let coinsInRow = [cl | cl <- [1..n state], Set.member (r, cl) (board state)]
                emptyInRow = [cl | cl <- [1..n state], not $ Set.member (r, cl) (board state)]
            
            if null coinsInRow
                then return Nothing
                else do
                    oldColIdx <- randomRIO (0, length coinsInRow - 1)
                    let oldCol = coinsInRow !! oldColIdx
                    
                    -- Evaluate moves
                    let evaluate [] bests minConf = return (bests, minConf)
                        evaluate (newCol:rest) bests minConf = do
                            let testState = moveCoin r oldCol newCol state
                                conf = getConflicts (r, newCol) testState
                            if conf < minConf 
                                then evaluate rest [newCol] conf
                                else if conf == minConf 
                                    then evaluate rest (newCol:bests) minConf
                                    else evaluate rest bests minConf

                    (bestCols, _) <- evaluate emptyInRow [oldCol] (getConflicts (r, oldCol) state)
                    
                    targetIdx <- randomRIO (0, length bestCols - 1)
                    let targetCol = bestCols !! targetIdx
                    
                    let nextState = if targetCol == oldCol then state else moveCoin r oldCol targetCol state
                    searchStep (iterations - 1) nextState

-- | Main Solver with restarts
solve :: Int -> Int -> Int -> IO (Maybe SolverState)
solve nVal cVal restarts = do
    let maxIters = nVal * nVal * 100
    let loop 0 = return Nothing
        loop i = do
            startState <- initialAssignment nVal cVal
            result <- searchStep maxIters startState
            case result of
                Just s -> return (Just s)
                Nothing -> loop (i - 1)
    loop restarts

-- | Main Execution
main :: IO ()
main = do
    args <- getArgs
    case args of
        (nStr:cStr:_) -> do
            let nV = read nStr
                cV = read cStr
            printf "Solving for size %d with %d coins (Min-Conflicts)...\n" nV cV
            t1 <- getCurrentTime
            result <- solve nV cV 50
            t2 <- getCurrentTime
            case result of
                Just s -> do
                    let diff = diffUTCTime t2 t1
                    printf "\nSuccess! Found solution in %.2fms\n" (realToFrac diff * 1000 :: Double)
                    printBoard s
                Nothing -> putStrLn "\nFailed to find solution."
        _ -> putStrLn "Usage: runghc solver.hs <N> <C>"

-- | Console output
printBoard :: SolverState -> IO ()
printBoard s = forM_ [1..n s] $ \r -> do
    let line = unwords [if Set.member (r, cl) (board s) then "o" else "." | cl <- [1..n s]]
    putStrLn line
