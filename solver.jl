"""
Generalized N-Queens Solver in Julia
Solves for N columns/rows with exactly C coins per line.
"""

using Random

# --- Min-Conflicts Heuristic (for Fast Single Solution) ---

function find_solution_min_conflicts(n::Int, c::Int)
    max_restarts = 20
    max_iterations = n * n * 50

    for restart in 1:max_restarts
        board = Set{Tuple{Int, Int}}()
        col_counts = zeros(Int, n)
        maj_diag_counts = Dict{Int, Int}()
        min_diag_counts = Dict{Int, Int}()

        function update_counts!(r, cl, delta)
            col_counts[cl] += delta
            maj_diag_counts[r - cl] = get(maj_diag_counts, r - cl, 0) + delta
            min_diag_counts[r + cl] = get(min_diag_counts, r + cl, 0) + delta
        end

        # Initial random assignment: C per row
        for r in 1:n
            cols = shuffle(1:n)
            for i in 1:c
                cl = cols[i]
                push!(board, (r, cl))
                update_counts!(r, cl, 1)
            end
        end

        function get_conflicts(r, cl)
            rc = col_counts[cl]
            mc = get(maj_diag_counts, r - cl, 0)
            nc = get(min_diag_counts, r + cl, 0)
            
            res = 0
            if rc > c res += (rc - c) end
            if mc > c res += (mc - c) end
            if nc > c res += (nc - c) end
            return res
        end

        function get_total_conflicts()
            total = 0
            for v in col_counts if v > c total += (v - c) end end
            for v in values(maj_diag_counts) if v > c total += (v - c) end end
            for v in values(min_diag_counts) if v > c total += (v - c) end end
            return total
        end

        for iter in 1:max_iterations
            if get_total_conflicts() == 0
                return board
            end

            r = rand(1:n)
            coins_in_row = [cl for cl in 1:n if (r, cl) in board]
            empty_in_row = [cl for cl in 1:n if !((r, cl) in board)]

            old_col = rand(coins_in_row)
            
            # Find best swap in this row
            min_conf = get_conflicts(r, old_col)
            best_cols = [old_col]

            for new_col in empty_in_row
                update_counts!(r, old_col, -1)
                update_counts!(r, new_col, 1)
                
                conf = get_conflicts(r, new_col)
                if conf < min_conf
                    min_conf = conf
                    best_cols = [new_col]
                elseif conf == min_conf
                    push!(best_cols, new_col)
                end

                update_counts!(r, new_col, -1)
                update_counts!(r, old_col, 1)
            end

            target_col = rand(best_cols)
            if target_col != old_col
                delete!(board, (r, old_col))
                update_counts!(r, old_col, -1)
                push!(board, (r, target_col))
                update_counts!(r, target_col, 1)
            end
        end
    end
    return nothing
end

function print_board(n, sol)
    for r in 1:n
        for cl in 1:n
            print((r, cl) in sol ? "o " : ". ")
        end
        println()
    end
end

# CLI Entry
if abspath(PROGRAM_FILE) == @__FILE__
    if length(ARGS) < 2
        println("Usage: julia solver.jl <N> <C>")
        exit(1)
    end
    n = parse(Int, ARGS[1])
    c = parse(Int, ARGS[2])

    println("Finding a solution for ($n, $c) using Min-Conflicts...")
    start_time = time()
    sol = find_solution_min_conflicts(n, c)
    end_time = time()
    
    if sol === nothing
        println("No solution found in allotted time.")
    else
        println("Success! [Time: $(round((end_time - start_time)*1000, digits=2))ms]")
        print_board(n, sol)
    end
end

