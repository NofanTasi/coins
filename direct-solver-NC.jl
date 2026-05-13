
# direct-solver-NC.jl
# A direct solver for placing N*C coins on an N x N grid.
# The goal is to reach the target without backtracking, 
# ensuring every row, column, and diagonal has <= C coins.

function solve_direct_nc(n, c_limit)
    total_target = n * c_limit
    board = Set{Tuple{Int, Int}}()
    
    # Track counts for each line to stay within c_limit
    row_counts = Dict{Int, Int}()
    col_counts = Dict{Int, Int}()
    maj_diag_counts = Dict{Int, Int}()
    min_diag_counts = Dict{Int, Int}()
    
    # Initialize counts to zero
    for i in 0:n-1
        row_counts[i] = 0
        col_counts[i] = 0
    end

    println("Attempting Direct Placement for N=$n, C=$c_limit (Total Target: $total_target)...")
    
    # Strategy: Scanline Greedy (Gravity)
    # We iterate through the grid and place a coin if it doesn't violate the limit.
    # To hit exactly N*C, we need each row and col to reach exactly C.
    
    coins_placed = 0
    for r in 0:n-1
        for cl in 0:n-1
            # Check if current cell is safe
            maj = r - cl
            min = r + cl
            
            curr_r = get(row_counts, r, 0)
            curr_cl = get(col_counts, cl, 0)
            curr_maj = get(maj_diag_counts, maj, 0)
            curr_min = get(min_diag_counts, min, 0)
            
            if curr_r < c_limit && curr_cl < c_limit && 
               curr_maj < c_limit && curr_min < c_limit
               
                # Place coin
                push!(board, (r, cl))
                row_counts[r] = curr_r + 1
                col_counts[cl] = curr_cl + 1
                maj_diag_counts[maj] = curr_maj + 1
                min_diag_counts[min] = curr_min + 1
                
                coins_placed += 1
                
                # If we hit the target, we are done
                if coins_placed == total_target
                    break
                end
            end
        end
        if coins_placed == total_target
            break
        end
    end
    
    if coins_placed == total_target
        println("SUCCESS: Placed $coins_placed coins without any backtracking!")
        println("This supports the conjecture that for N=$n, C=$c_limit, a configuration exists.")
        return true
    else
        println("FAILURE: Greedy approach only placed $coins_placed / $total_target coins.")
        println("Backtracking or a better 'recipe' (choice heuristic) is required for this configuration.")
        return false
    end
end

# Test cases
println("--- Test 1: N=8, C=2 ---")
solve_direct_nc(8, 2)

println("\n--- Test 2: N=10, C=3 ---")
solve_direct_nc(10, 3)

println("\n--- Test 3: N=4, C=1 (The impossible case) ---")
solve_direct_nc(4, 1) # Note: N-Queens for N=4 IS possible, but N=2, C=1 isn't.
