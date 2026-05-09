
function solve_greedy(n, c)
    board = Set{Tuple{Int, Int}}()
    
    # Track occupied lines
    rows = Set{Int}()
    cols = Set{Int}()
    major_diags = Set{Int}() # r - c
    minor_diags = Set{Int}() # r + c
    
    println("Starting Greedy Gravity Solver (N=$n, C=$c)...")
    
    for i in 1:c
        valid_cells = []
        
        # Find all valid spots
        for r in 0:n-1
            for cl in 0:n-1
                if !(r in rows) && !(cl in cols) && 
                   !((r - cl) in major_diags) && !((r + cl) in minor_diags)
                    push!(valid_cells, (r, cl))
                end
            end
        end
        
        if isempty(valid_cells)
            println("FAILED at coin $i: No valid cells remaining.")
            return false
        end
        
        # "Gravity" heuristic: pick the first available valid cell 
        # (simulating a row-by-row or top-down settling)
        # You can change this to pick based on neighbor potential if needed.
        target = valid_cells[1]
        
        # Place coin
        push!(board, target)
        push!(rows, target[1])
        push!(cols, target[2])
        push!(major_diags, target[1] - target[2])
        push!(minor_diags, target[1] + target[2])
        
        println("Coin $i placed at $(target[1]), $(target[2])")
    end
    
    println("\nSUCCESS: Target $c reached without backtracking!")
    return true
end

# Test with game defaults (N=10, C=10 - equivalent to 10-Queens)
solve_greedy(10, 10)
