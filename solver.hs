
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

-- | State of the board and conflict counts
data SolverState = SolverState {
    board :: Set Pos,
    colCounts :: Map Int Int,
    majDiagCounts :: Map Int Int,
    minDiagCounts :: Map Int Int,
    n :: Int,
    c :: Int
} deriving (Show)

-- | Initial empty state
emptyState :: Int -> Int -> SolverState
emptyState nVal cVal = SolverState Set.empty Map.empty Map.empty Map.empty nVal cVal

-- | Update conflict counts when adding or removing a coin
updateCounts :: Pos -> Int -> SolverState -> SolverState
updateCounts (r, cl) delta state = state {
    colCounts = Map.insertWith (+) cl delta (colCounts state),
    majDiagCounts = Map.insertWith (+) (r - cl) delta (majDiagCounts state),
    minDiagCounts = Map.insertWith (+) (r + cl) delta (minDiagCounts state)
}

-- | Add a coin to the board
addCoin :: Pos -> SolverState -> SolverState
addCoin pos state = updateCounts pos 1 (state { board = Set.insert pos (board state) })

-- | Remove a coin from the board
removeCoin :: Pos -> SolverState -> SolverState
removeCoin pos state = updateCounts pos (-1) (state { board = Set.delete pos (board state) })

-- | Movement: swap a coin in a row from one column to another
moveCoin :: Int -> Int -> Int -> SolverState -> SolverState
moveCoin r oldCol newCol state = 
    addCoin (r, newCol) $ removeCoin (r, oldCol) state

-- | Calculate conflicts for a specific position
getConflicts :: Pos -> SolverState -> Int
getConflicts (r, cl) state = 
    let colVal = Map.findWithDefault 0 cl (colCounts state)
        majVal = Map.findWithDefault 0 (r - cl) (majDiagCounts state)
        minVal = Map.findWithDefault 0 (r + cl) (minDiagCounts state)
        -- Row is ignored because we maintain exactly C coins per row
        countLimit = c state
        sumConflicts v = if v > countLimit then v - countLimit else 0
    in sumConflicts colVal + sumConflicts majVal + sumConflicts minVal

-- | Calculate total board conflicts
getTotalConflicts :: SolverState -> Int
getTotalConflicts state = 
    let countLimit = c state
        sumConflicts m = sum [v - countLimit | v <- Map.elems m, v > countLimit]
    in sumConflicts (colCounts state) + 
       sumConflicts (majDiagCounts state) + 
       sumConflicts (minDiagCounts state)

-- | Shuffle a list
shuffle :: [a] -> IO [a]
shuffle [] = return []
shuffle xs = do
    let n = length xs
    indices <- replicateM n (randomRIO (0, n - 1))
    -- Simple enough for a script, not the most efficient
    return [xs !! i | i <- indices]

-- | Fisher-Yates shuffle
fisherYates :: [a] -> IO [a]
fisherYates xs = do
    let n = length xs
    ar <- foldM (\a i -> do
        j <- randomRIO (i, n - 1)
        let vi = a !! i
            vj = a !! j
        return $ updateList a i vj j vi) xs [0..n-2]
    return ar
    where
        updateList l i valI j valJ = 
            let (before, atI:after) = splitAt i l
                (middle, atJ:end) = splitAt (j - i - 1) after
            in if i == j then l else before ++ [valJ] ++ middle ++ [valI] ++ end

-- | Initial assignment: Place C coins per row randomly
initialAssignment :: Int -> Int -> IO SolverState
initialAssignment nVal cVal = do
    let initialState = emptyState nVal cVal
    foldM (\state r -> do
        cols <- fisherYates [0..nVal-1]
        let selectedCols = take cVal cols
        return $ foldl' (\s cl -> addCoin (r, cl) s) state selectedCols
        ) initialState [0..nVal-1]

-- | Min-Conflicts search step
searchStep :: Int -> SolverState -> IO SolverState
searchStep 0 state = return state
searchStep iterations state = do
    let currentConflicts = getTotalConflicts state
    if currentConflicts == 0 
        then return state
        else do
            -- Pick a random row
            r <- randomRIO (0, n state - 1)
            
            -- Find coins and empty spaces in this row
            let coinsInRow = [cl | cl <- [0..n state - 1], Set.member (r, cl) (board state)]
                emptyInRow = [cl | cl <- [0..n state - 1], not (Set.member (r, cl) (board state))]
            
            -- Pick a random coin in this row
            coinIdx <- randomRIO (0, length coinsInRow - 1)
            let oldCol = coinsInRow !! coinIdx
            
            -- Find the best column to move this coin to (minimizing conflicts)
            let tryMove bestCols minConf [] = return (bestCols, minConf)
                tryMove bestCols minConf (newCol:rest) = do
                    let stateMoved = moveCoin r oldCol newCol state
                        conf = getConflicts (r, newCol) stateMoved
                    if conf < minConf 
                        then tryMove [newCol] conf rest
                        else if conf == minConf 
                            then tryMove (newCol:bestCols) minConf rest
                            else tryMove bestCols minConf rest

            (candidates, _) <- tryMove [oldCol] (getConflicts (r, oldCol) state) emptyInRow
            
            -- Pick a random candidate from best columns
            bestIdx <- randomRIO (0, length candidates - 1)
            let targetCol = candidates !! bestIdx
            
            searchStep (iterations - 1) (if targetCol == oldCol then state else moveCoin r oldCol targetCol state)

-- | Run the solver with restarts
solve :: Int -> Int -> Int -> IO (Maybe SolverState)
solve nVal cVal restarts = do
    let maxIters = nVal * nVal * 50
    let loop 0 = return Nothing
        loop r = do
            startState <- initialAssignment nVal cVal
            result <- searchStep maxIters startState
            if getTotalConflicts result == 0 
                then return (Just result)
                else loop (r - 1)
    loop restarts

-- | Main entry point
main :: IO ()
main = do
    args <- getArgs
    case args of
        (nStr:cStr:_) -> do
            let nVal = read nStr
                cVal = read cStr
            putStrLn $ "Solving N=" ++ show nVal ++ ", C=" ++ show cVal ++ " using Min-Conflicts..."
            result <- solve nVal cVal 20
            case result of
                Just s -> do
                    putStrLn "Solution found!"
                    printBoard s
                Nothing -> putStrLn "No solution found within limits."
        _ -> putStrLn "Usage: runghc solver.hs <N> <C>"

-- | Helper to print the board
printBoard :: SolverState -> IO ()
printBoard s = do
    let nVal = n s
    mapM_ (\r -> do
        let rowStr = [if Set.member (r, cl) (board s) then 'Q' else '.' | cl <- [0..nVal-1]]
        putStrLn rowStr
        ) [0..nVal-1]
