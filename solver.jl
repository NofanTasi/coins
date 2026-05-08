"""
GENERALIZED N-QUEENS SOLVER (Julia Implementation)

This script solves the Generalized N-Queens problem: place exactly C coins 
in an N x N grid such that each row, each column, and each diagonal contains 
at most C coins (often C=1 is the standard 1-Queens problem).

ALGORITHM: Min-Conflicts Heuristic
Min-Conflicts is a local search algorithm that is extremely effective for 
constraint satisfaction problems like N-Queens. It starts with a random 
initial configuration (satisfying row constraints) and iteratively moves 
coins to positions that minimize the total number of conflicts on the board.

The key idea is to maintain the row constraint (exactly C coins per row) as 
an invariant throughout the search. We then only have to resolve conflicts 
in columns and diagonals.
"""

using Random

# --- Main Solver Logic ---

"""
Finds a solution for (N, C) if one exists within limits.
- n: Size of the board (NxN)
- c: Target number of coins per row/column/diagonal
"""
function find_solution_min_conflicts(n::Int, c::Int)
    max_restarts = 50   # Attempt to find a solution from different starting points
    max_iterations = n * n * 100 # Maximum steps per restart

    for restart in 1:max_restarts
        # We store the board as a Set of (row, col) tuples for fast lookup.
        # This allows O(1) checks if a cell is occupied.
        board = Set{Tuple{Int, Int}}()
        
        # State tracking: count coins in each column and each diagonal.
        # Major diagonals: r - cl is constant.
        # Minor diagonals: r + cl is constant.
        col_counts = zeros(Int, n)
        maj_diag_counts = Dict{Int, Int}()
        min_diag_counts = Dict{Int, Int}()

        # Helper to update counts incrementally when adding/removing coins.
        # This keeps the logic O(1) per coordinate update.
        function update_counts!(r, cl, delta)
            col_counts[cl] += delta
            maj_diag_counts[r - cl] = get(maj_diag_counts, r - cl, 0) + delta
            min_diag_counts[r + cl] = get(min_diag_counts, r + cl, 0) + delta
        end

        # INITIALIZATION PHASE: Satisfy the Row Constraint by default.
        # Place exactly C coins in every row at random columns.
        for r in 1:n
            cols = shuffle(1:n)
            for i in 1:c
                cl = cols[i]
                push!(board, (r, cl))
                update_counts!(r, cl, 1)
            end
        end

        # Helper to calculate conflict score for a specific cell.
        # This function returns how many extra coins (above limit C) 
        # are currently sharing lines with this cell.
        function get_conflicts(r, cl)
            # Row conflicts are zero as we maintain exactly C per row
            cc = col_counts[cl]
            mc = get(maj_diag_counts, r - cl, 0)
            nc = get(min_diag_counts, r + cl, 0)
            
            res = 0
            # A collision is any coin count over the limit C in that line direction.
            if cc > c res += (cc - c) end
            if mc > c res += (mc - c) end
            if nc > c res += (nc - c) end
            return res
        end

        # Calculate the global violation score.
        # A score of zero means a valid solution has been reached.
        function get_total_conflicts()
            total = 0
            for v in col_counts if v > c total += (v - c) end end
            for v in values(maj_diag_counts) if v > c total += (v - c) end end
            for v in values(min_diag_counts) if v > c total += (v - c) end end
            return total
        end

        # LOCAL SEARCH REPAIR LOOP
        for iter in 1:max_iterations
            if get_total_conflicts() == 0
                return board # SUCCESS: Found a valid configuration!
            end

            # Pick a random row to attempt a conflict-reducing move.
            r = rand(1:n)
            coins_in_row = [cl for cl in 1:n if (r, cl) in board]
            empty_in_row = [cl for cl in 1:n if !((r, cl) in board)]

            # Pick a random coin currently in this row to reconsider.
            old_col = rand(coins_in_row)
            
            # Evaluate the benefit of moving this specific coin to any other empty column in the same row.
            # We look for the column that minimizes the current "tension" on the board.
            min_conf = get_conflicts(r, old_col)
            best_cols = [old_col]

            for new_col in empty_in_row
                # Tentatively update counts to see the effect of a potential move
                update_counts!(r, old_col, -1)
                update_counts!(r, new_col, 1)
                
                conf = get_conflicts(r, new_col)
                
                if conf < min_conf
                    min_conf = conf
                    best_cols = [new_col]
                elseif conf == min_conf
                    # Maintain randomness: collect all best moves to pick from
                    push!(best_cols, new_col)
                end

                # Rollback tentative update
                update_counts!(r, new_col, -1)
                update_counts!(r, old_col, 1)
            end
            
            # Commit to one of the columns that yields minimum conflicts
            target_col = rand(best_cols)
            if target_col != old_col
                delete!(board, (r, old_col))
                update_counts!(r, old_col, -1)
                push!(board, (r, target_col))
                update_counts!(r, target_col, 1)
            end
        end
    end
    return nothing # FAILURE: Timed out or hit iteration limit
end

"""
Prints the NxN board to stdout.
"""
function print_board(n, sol)
    for r in 1:n
        for cl in 1:n
            print((r, cl) in sol ? "o " : ". ")
        end
        println()
    end
end

# --- main Execution ---

if abspath(PROGRAM_FILE) == @__FILE__
    if length(ARGS) < 2
        println("Missing arguments. Usage: julia solver.jl <N> <C>")
        exit(1)
    end
    
    n_val = parse(Int, ARGS[1])
    c_val = parse(Int, ARGS[2])

    println("Solving for board size $n_val with $c_val coins per line...")
    println("Using Min-Conflicts heuristic...")
    
    start_t = time()
    result = find_solution_min_conflicts(n_val, c_val)
    end_t = time()
    
    if result === nothing
        println("\nFailure: Could not find a solution after multiple attempts.")
    else
        duration = round((end_t - start_t) * 1000, digits=2)
        println("\nSuccess! Found solution in $(duration)ms")
        println("-" ^ (n_val * 2))
        print_board(n_val, result)
        println("-" ^ (n_val * 2))
    end
end
