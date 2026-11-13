# Graphs for LeetCode: recording sheet

Narration only, all eight sections. Record one file per section, named like the heading (for example `04-topological-sort.wav`). Read each beat as one take and leave about one second of silence before the next beat; the renderer cuts the recording on those silences. If you stumble, pause, then restart the whole beat. The beat headings are for you, don't read them.

Shots, code panels and on-screen text are in the full scripts in `scripts/`. This sheet is generated from them by `python3 recording_sheet.py scripts`, so edit the scripts, not this file.

## 01-reading-graph-problems: Reading a graph problem

About 681 words, roughly 4.7 minutes.

**Beat 1.** Here are three LeetCode problems. In the first, some courses have to be taken before others, and you're asked whether you can finish them all. In the second, you get a map of land and water and you count the islands. In the third, you find the cheapest trip between two cities with at most k stops. None of them says the word graph. All three are graph problems, and each statement already tells you which algorithm it wants, if you know how to read it.

**Beat 2.** That's what this first part is about. Before any search algorithm, you'll learn to turn a story into a graph, build it in code, and ask four questions that narrow the choice down. At the end we'll read these three problems again.

**Beat 3.** A graph is two things: nodes and edges. Nodes are the things in the story, edges are the relationships. In the course problem each course is a node and each prerequisite is an edge. On the map each land cell is a node, joined to the land beside it. With the flights, cities are nodes and flights are edges. Once you can name both, the story becomes a structure you know how to search.

**Beat 4.** LeetCode almost never hands you the graph ready to search. It hands you a list of pairs. So the first code you write is nearly always these four lines: an empty list for every node, and for each pair, one end appended to the other's list. That's an adjacency list, the shape every search in this course expects. It costs one pass over the edges, so it's never the slow part.

**Beat 5.** Now the four questions. First: does an edge go both ways? Friendships, roads and cables usually do, so you add the edge twice. That's the last line, and forgetting it is the most common bug in graph code. Prerequisites and one-way streets have a direction, so you add the edge once, and you have to read which way it points. In Course Schedule, the pair a, b means take b first, so the edge goes from b to a.

**Beat 6.** Second: does every edge cost the same? On a grid, one step is one step, and breadth-first search finds the shortest path, like this. The moment edges carry prices or travel times, BFS starts giving wrong answers, and you need Dijkstra or one of its relatives. In the flight problem, the word prices is what rules plain BFS out.

**Beat 7.** Third: is it a tree? This graph has six nodes, five edges and no cycles, so it's a tree. A tree is always connected and always has n minus one edges. Add one more edge, here from E to F, and you've made a cycle: A, B, D, F, E, C and back to A. Trees are the easy case: you can skip the visited set and just remember where you came from.

**Beat 8.** Fourth: is the graph promised to be connected? Watch what happens when I remove this node. F is cut off, and a search from A will never reach it. So unless the statement promises connectivity, don't search once from node zero and stop. Loop over every node and start a new search from each one you haven't visited. Counting those starts counts the pieces, and on the map, that count is the answer.

**Beat 9.** One last habit: read the constraints, because they quietly tell you the intended speed. With n up to a hundred thousand, you need about one pass over the nodes and edges. With n at most a hundred, even a cubic algorithm is fine.

**Beat 10.** So let's read our three problems again. Courses: directed edges, from the prerequisite to the course. That's topological sort, in part four. The map: a grid where land touches land, with no promise that it's connected. That's counting components, in parts two and three. Flights: directed, weighted, with a limit on stops. That's Bellman–Ford, in part six. Same four questions every time. Next, we take the adjacency list we just built and run the first real algorithm on it: breadth-first search.

## 02-breadth-first-search: Breadth-first search

About 667 words, roughly 4.6 minutes.

**Beat 1.** In part one, we learned to see the graph in a problem. Now we search it. Breadth-first search, or BFS, is the answer to one question that comes up constantly on LeetCode: what's the fewest number of steps? Fewest moves through a maze, fewest transformations from one word to another, fewest minutes for something to spread. Whenever every step costs the same, BFS is the tool.

**Beat 2.** The idea is simple. Start at the source. First visit everything one step away, then everything two steps away, then three, and so on. The search spreads out in rings, like a ripple on water. Each number here is how many steps that cell is from the start, and notice that the numbers never skip. A ring is only explored after the whole ring before it is finished.

**Beat 3.** In code, the rings come from a queue: first in, first out. Put the start in the queue. Then repeatedly take the node at the front, and push each neighbor you haven't seen yet to the back, one step further than the node it came from. This dictionary does two jobs at once. It stores each distance, and it remembers which nodes you've already seen.

**Beat 4.** Here's the detail that separates working BFS from buggy BFS. Mark a node as seen when you push it, not when you pop it. These outlined cells are in the queue right now, already marked, waiting their turn. If you only marked nodes when you popped them, the same cell could be pushed again and again by each of its neighbors, and on a big grid your queue would explode.

**Beat 5.** Why is the first visit always the shortest? Because the queue hands out nodes in order of distance. Look at the order BFS takes on our graph from part one: A, then B and C, then D and E, then F. Distance zero, one, two, three. By the time a node is first reached, every closer node has already been processed, so no shorter route can still be on its way.

**Beat 6.** Usually you need the distance, and sometimes the actual path. For the path, store a parent for each node when you first push it. When you reach the target, walk the parents backwards to the start and reverse the list. On a grid, the neighbors are the four cells up, down, left and right that are inside the grid and not walls. And in Python, always use a deque. Popping from the front of a list is slow, and it quietly turns a linear algorithm into a quadratic one.

**Beat 7.** Now a twist you'll meet often. In Rotting Oranges, the rot doesn't start in one place. It starts at every rotten orange at the same time. You don't run a search from each one. You put all of them in the queue before the loop starts, all at distance zero. That's called multi-source BFS, and it's also the trick behind 01 Matrix, where you need the distance from every cell to its nearest zero.

**Beat 8.** Watch three sources spreading at once. The question asks for minutes, so we process one level at a time, and each level is one minute. The Level counter here is exactly the answer. At the end, if any fresh orange was never reached, it's walled off, and the answer is minus one.

**Beat 9.** In code, the only change is this inner loop. Read the length of the queue at the start of each round, and process exactly that many nodes. Those are the whole current level. Everything they push belongs to the next level, the next minute.

**Beat 10.** BFS touches every node and every edge once, so it runs in order V plus E. Use it when every step costs the same. When steps have different costs, BFS gives wrong answers, and that's part six. So remember: a queue, mark on push, levels are distances, and several starts go in together. Next, the other way to walk a graph: depth-first search, on this very same maze.

## 03-depth-first-search: Depth-first search, components and cycles

About 634 words, roughly 4.4 minutes.

**Beat 1.** Same maze as last time, but now with depth-first search. It found a path. But look at the length. It's much longer than the one BFS found. DFS doesn't care about distance at all. So why do we need it? Because a huge number of LeetCode problems never ask for the shortest anything. They ask you to visit everything, count pieces, or find a loop. That's DFS territory.

**Beat 2.** The idea: pick a direction and keep going until you can't. Then back up to the last place where you had another option, and try that. The highlighted line is the path DFS is currently on. Watch it run into a dead end, shrink back, and branch off somewhere new. That backing up is called backtracking, and it's the heart of DFS.

**Beat 3.** The recursive version is about the shortest useful code in this whole course. Mark the node, then call DFS on each neighbor you haven't seen. The call stack does the backtracking for you. One warning for Python: the default recursion limit is about a thousand calls. On a big grid, a single long path can blow through that, so either raise the limit or use an explicit stack, which does the same thing without recursion.

**Beat 4.** Compare the two orders on our small graph. BFS goes A, B, C, D, E, F, ring by ring. DFS goes A, B, D, F, then backs all the way up and finishes with C and E. Both visit every node reachable from A, and both take order V plus E time. They just visit them in a different order, and that order is what decides which one fits the problem.

**Beat 5.** Now the most famous graph problem on LeetCode: Number of Islands. Remember the third question from part one: is the graph connected? Here it definitely isn't. So we scan every cell, row by row. Whenever we find land that we haven't visited, that's a new island. We add one to the count and flood the whole island with DFS, so we never count it twice.

**Beat 6.** Watch it work. The scan finds land, the flood colors the whole island, the count goes up, and the scan moves on, skipping everything already colored. Every cell is looked at by the scan once, and flooded at most once, so the whole thing is linear in the size of the grid. The same pattern counts components in any graph: Number of Provinces just loops over people instead of cells.

**Beat 7.** A handy trick for grids: instead of a separate visited set, mark land as visited by overwriting it, turning each one into a zero as you flood. And if the problem asks for the biggest island instead, like Max Area of Island, have the flood return how many cells it covered, and keep the maximum.

**Beat 8.** DFS also finds cycles. Let's add the edge from E to F, which we saw in part one creates a loop. DFS walks A, B, D, F, E, C, and from C it sees A, which is already visited and isn't the node it just came from. In an undirected graph, that's the whole test. Reaching a visited node other than your parent means a cycle.

**Beat 9.** In a directed graph that test isn't enough, and we'll fix it in part four with three colors. For now, choosing is simple. If the question says fewest steps, levels or minutes, use BFS. If it says count, connected, any path, or explore everything, either works, and DFS is usually less code.

**Beat 10.** So, DFS: go deep, backtrack, and don't expect shortest paths. Loop over every start to count components, and use the parent check for cycles in undirected graphs. Next up are graphs with a direction, and the problem that comes up in almost every interview list: course prerequisites, and topological sort.

## 04-topological-sort: Topological sort

About 662 words, roughly 4.6 minutes.

**Beat 1.** Back to the first problem from part one. You have some courses, and some of them must be taken before others. Can you finish all of them? Every pair becomes an arrow, and this time the direction matters. LeetCode gives you the pair a, b, which means take b first, so the arrow goes from b to a. Flip it, and in the version that asks for the order, you'll return the order backwards. So the real question is: is there an order that respects every arrow?

**Beat 2.** Count the arrows coming into each course. That number is called the indegree, and here it means how many prerequisites are still missing. A course with indegree zero can be taken right now. In this graph, that's only course zero, so it goes into a queue. Everything else has to wait.

**Beat 3.** Now repeat one move. Take a course from the queue and add it to the order. Taking it removes its outgoing arrows, so every course that depended on it is missing one prerequisite fewer. Whenever a count drops to zero, that course is ready, and it joins the queue. Course three needs both one and two, so it waits until both are done. When the queue runs dry, the order underneath is a valid schedule. This is Kahn's algorithm.

**Beat 4.** In code, build the adjacency list and the indegree array in the same loop over the pairs. Start the queue with every course whose count is zero, not just course zero. After that, it's BFS with one change: a neighbor joins the queue when its count reaches zero, not the first time you see it. It runs in order V plus E, like every traversal so far.

**Beat 5.** Now add one arrow, from course four back to course one, and run it again. Zero, two and five come out, and then the queue is empty. One, three and four are left, each one waiting for another one in the loop. None of them will ever reach zero. That's the whole cycle test: if the order has fewer than n courses, there's a cycle. Course Schedule returns whether the length equals n. Course Schedule Two returns the order itself, or an empty list.

**Beat 6.** Part three promised a fix for directed graphs, so here's why the old test breaks. In this diamond, depth-first search reaches D through B, and later it sees D again from C. D is visited, and it isn't C's parent, but there's no cycle: both arrows point down. In a directed graph, seeing a visited node isn't enough. You need to know whether that node is still on the current path.

**Beat 7.** So DFS keeps three colors. White means not visited yet. Gray means we're inside its call, on the path right now. Black means it's finished, with everything below it explored. Reaching a black node is fine. Reaching a gray node means you've walked back onto your own path, and that's a cycle. Add an arrow from D back to A, and that's exactly what happens. The same colors solve Find Eventual Safe States: the safe nodes are the ones that turn black without ever reaching a gray node.

**Beat 8.** Sometimes you have to build the arrows yourself. In Alien Dictionary, you get words sorted in an unknown alphabet. Compare each word with the next one. The first letter where they differ gives you one arrow: that letter comes first. Nothing after it tells you anything. Then it's the same topological sort, on letters. One trap: if a longer word comes before its own prefix, like abc before ab, the input is invalid, so return an empty string.

**Beat 9.** So: read the direction from the wording, count the indegrees, start with every zero, and if fewer than n come out, there's a cycle. In DFS, gray means on the path. So far, we've answered every connectivity question by searching. Next is a structure that answers it without searching at all, even while edges keep arriving: Union-Find.

## 05-union-find: Union-Find

About 611 words, roughly 4.2 minutes.

**Beat 1.** Here's a problem where searching feels clumsy. Redundant Connection: you get a tree with one extra edge, and you return that edge. The edges arrive one at a time, and for each one you want to know: are these two ends already connected? You could run a DFS before adding every edge, but that's a full search per edge. Union-Find answers the same question in almost constant time.

**Beat 2.** Union-Find keeps elements in groups. Each group is a small tree where every element points to a parent, and the root at the top represents the whole group. At the start, everyone is alone and is their own parent. That's the whole data structure: one array. Two elements are in the same group exactly when they lead up to the same root.

**Beat 3.** There are two operations. Find walks up the parent pointers to the root. Union finds both roots and, if they differ, points one root at the other, which merges the two groups. Every successful union removes one group, so a counter that starts at n and goes down by one gives you the number of components at any moment. That alone solves Number of Connected Components and Number of Provinces.

**Beat 4.** Left alone, the trees can grow into long chains, and find gets slow. Two small tricks prevent that. The first is path compression: when find walks up, it points every node it passed straight at the root, so the next find on any of them is almost instant. The second is union by size: always hang the smaller tree under the larger one, so the trees stay shallow.

**Beat 5.** Here it is in about a dozen lines. With both tricks, each operation costs the inverse Ackermann function, which is at most four for any input you'll ever see. Treat it as constant. And notice that union returns False when both ends already share a root. That return value is about to answer our problem.

**Beat 6.** Back to Redundant Connection. Add the edges in order. One-two, two-three, three-four: each one merges two groups. Then one-four. Find one, find four: same root. They were already connected, so this edge closes a cycle. It's the first union that fails, and that's the answer. Since there's exactly one cycle, it's also the last cycle edge in the input, which is what the problem asks for.

**Beat 7.** The counter solves more than you'd think. In Number of Operations to Make Network Connected, you're allowed to move cables. If there are fewer than n minus one cables, it's impossible. Otherwise, every failed union is a spare cable, and you need exactly one move to attach each extra group. So the answer is the number of components minus one.

**Beat 8.** Union-Find works on integers, but problems often give you strings. In Accounts Merge, two accounts belong to the same person if they share an email. Give every email an id the first time you see it, union all the emails of one account together, and at the end, group the emails by their root.

**Beat 9.** When should you not use it? Union-Find can't remove an edge, and it can't give you the path between two nodes, only whether one exists. For those, go back to BFS or DFS. And watch for the classic bug: comparing parents instead of roots. Two nodes can have different parents and the same root, so always compare find of a with find of b.

**Beat 10.** So: groups that only ever merge mean Union-Find. Compress paths, union by size, keep a counter, and remember that a failed union means a cycle. Up to now, every edge has cost the same. Next, edges get prices, and breadth-first search stops being enough.

## 06-weighted-shortest-paths: Weighted shortest paths

About 710 words, roughly 4.9 minutes.

**Beat 1.** Here's the same kind of maze, but the brown cells are mud. Stepping into mud costs five instead of one. BFS doesn't know that. It finds the path with the fewest steps, right through the mud. Dijkstra counts cost, not steps, so it goes around. Its path is longer, but cheaper. As soon as edges have different costs, the first visit is no longer the best one, and BFS gives wrong answers.

**Beat 2.** Dijkstra's idea: always finish the node that's cheapest to reach so far. Keep a min-heap of candidate distances, and pop the smallest. That distance is final, because any other route would have to pass through something at least as expensive. Then relax its edges: if going through this node makes a neighbor cheaper, update the neighbor and push its new distance. Network Delay Time is exactly this, and the answer is the largest final distance.

**Beat 3.** Watch this node. It's pushed once with cost seven, and later again with cost four, when a cheaper route turns up. The heap now holds both. Python's heap can't update an entry in place, so we leave the old one there. When it's popped, we compare it with the best known distance and skip it. That one line, the stale check, is what keeps Dijkstra fast.

**Beat 4.** Here's the full loop, in order E log V. There's one rule: weights must not be negative. A negative edge could make a finished node cheaper later, and Dijkstra never looks back. Within that rule, it bends. In Path With Minimum Effort, a path costs its single biggest step, so you combine with max instead of plus, and the same loop still works.

**Beat 5.** One shortcut worth knowing. If every move costs either zero or one, you don't need a heap. Use a deque: push zero-cost moves to the front, and one-cost moves to the back. The deque stays sorted by distance on its own, and you're back to linear time. That's called 0-1 BFS.

**Beat 6.** Now the third problem from part one: the cheapest flight with at most k stops. Plain Dijkstra fails here. It can lock in the cheapest price for a city using a route with too many stops, and then throw away a pricier route that still had stops to spare. We need an algorithm that counts edges, and that's Bellman–Ford.

**Beat 7.** Bellman–Ford is simpler than Dijkstra. Go over every edge, and if it makes its endpoint cheaper, update it. That's one pass. After one pass, you know the best prices using at most one flight. After two passes, at most two flights. K stops means k plus one flights, so run exactly k plus one passes. The catch is the copy row on top. Each pass must read the prices from the previous pass, not the ones it wrote a moment ago.

**Beat 8.** Here's why. Without the copy, this pass updates the middle city, and then, in the same pass, it uses that brand new price to reach the destination. That's two flights in one pass, and the stop limit is silently broken. The answer comes out cheaper than it should be, and it's wrong. Copy the array at the start of each pass, and read only from the copy.

**Beat 9.** The code is short, and it runs in order k times E. Bellman–Ford also handles negative edges, which is its other job. Run n minus one passes, and if one more pass can still improve something, there's a negative cycle.

**Beat 10.** The last tool is for when you need the distance between every pair, and n is only a few hundred. That's Floyd–Warshall: a matrix and three loops. For each node k, check whether going through k shortens the path from i to j. The k loop has to be the outermost one. That's n cubed, which is fine for a hundred nodes, and it's the intended solution for Find the City With the Smallest Number of Neighbors.

**Beat 11.** So, choose by the weights. Equal costs: BFS. Zero or one: a deque. Non-negative: Dijkstra with the stale check. A limit on edges, or negative weights: Bellman–Ford with a copy. All pairs and a small n: Floyd–Warshall. Next, a different kind of question: not how far apart two nodes are, but whether a graph can be split in two.

## 07-bipartite-and-coloring: Bipartite graphs and coloring

About 557 words, roughly 3.8 minutes.

**Beat 1.** Here's a problem that hides its graph well. Some people dislike each other, and you want to split everyone into two groups, so that no two people who dislike each other end up together. People are nodes, and each dislike is an undirected edge. Two groups means two colors, and the rule is that the two ends of every edge get different colors. A graph you can color like that is called bipartite.

**Beat 2.** Checking it is easy, because there's no choice to make. Color the first node blue. Its neighbors must be orange. Their neighbors must be blue again. BFS spreads the colors ring by ring, and every node's color is forced. On this square, it works: every edge joins blue to orange.

**Beat 3.** Now a triangle. The first node is blue, and both its neighbors are orange, but those two are connected to each other. Same color on both ends: impossible. That isn't bad luck with the starting color. A cycle with an odd number of nodes can never alternate between two colors. A graph is bipartite exactly when it has no odd cycle, and BFS finds one the moment an edge joins two nodes of the same color.

**Beat 4.** The code is BFS with a color array instead of a visited set. Minus one means uncolored. A new neighbor gets the opposite color, one minus mine. A neighbor that already has my color means stop and return false. And notice the outer loop over every node.

**Beat 5.** Here's why that loop matters. This graph has two pieces. A search from node zero colors the first piece perfectly and stops. If you return true now, you're wrong, because the second piece contains a triangle. Remember the fourth question from part one: nothing says the graph is connected. Is Graph Bipartite has test cases built around exactly this trap.

**Beat 6.** Read the input shape before you write the loop. Is Graph Bipartite hands you the adjacency list directly, so you can start coloring right away. Possible Bipartition gives you a list of pairs instead, with people numbered from one to n. So build the adjacency list first, add each dislike in both directions, because a dislike blocks both people, and allocate n plus one slots, or shift every label down by one.

**Beat 7.** With more than two colors, things change. In Flower Planting With No Adjacent, every garden gets one of four flower types, different from its neighbors, and each garden touches at most three others. Go through the gardens and give each one the smallest type its neighbors aren't using. At most three types are taken, so one of the four is always free, and greedy never gets stuck. The general rule: max degree plus one colors are always enough.

**Beat 8.** But don't expect more than that. Finding the fewest colors for a general graph is NP-hard, and even asking whether three colors are enough is already NP-complete. So a coloring problem in an interview always comes with a shortcut: exactly two colors, a degree limit like the gardens, or a graph small enough to try every option with backtracking.

**Beat 9.** So: two groups means two colors with BFS, an odd cycle means no, and always start from every uncolored node. One last kind of problem to go. Next, connecting everything as cheaply as possible, and then the whole course on one page.

## 08-mst-and-cheat-sheet: Minimum spanning trees and the cheat sheet

About 560 words, roughly 3.9 minutes.

**Beat 1.** The last kind of problem. You have points, and connecting two of them costs the distance between them. Connect everything for the least total cost. This isn't a shortest path. Nobody cares how far one point is from another inside the network. You just want every point reachable, as cheaply as possible. That's a minimum spanning tree.

**Beat 2.** A spanning tree reaches every node and has no cycles, so it always has exactly n minus one edges. The minimum spanning tree is the one with the smallest total weight. Any extra edge would only add cost, and a cycle means one of its edges wasn't needed. There are two standard ways to build it.

**Beat 3.** The first is Kruskal. Sort all the edges by cost. Go through them cheapest first, and take each edge unless its two ends are already connected. That check is exactly Union-Find from part five. A failed union means the edge would close a cycle, so you skip it. Stop as soon as you've accepted n minus one edges.

**Beat 4.** In code, it's barely more than the sort, and sorting is most of the running time: order E log E. If you run out of edges before reaching n minus one, the graph isn't connected, and that's when Connecting Cities With Minimum Cost wants minus one.

**Beat 5.** The second is Prim, and it should look familiar. Start from any node and grow one tree. Keep a heap of edges leaving the tree, and always take the cheapest one that reaches a new node. It's almost Dijkstra. The only difference is the key. Dijkstra uses the total distance from the start, and Prim uses just the weight of that one edge.

**Beat 6.** Which one fits the points problem? Every pair of points is an edge, so a thousand points means about half a million edges. Sorting them all works, but there's a neater way: Prim with a plain array. For each point, keep its cheapest connection to the tree so far, pick the smallest one each round, and update the rest. That's n squared with no heap and no edge list, and it's the best fit when every pair is connected.

**Beat 7.** That's every algorithm in this course, so let's put it on one page, as phrases you'll actually read in problem statements. Two-way, or friends: add every edge in both directions. Fewest steps or minutes on an unweighted graph: BFS, with every source in the queue at once. Count islands, groups or provinces: loop over every start and flood each piece. Prerequisites or order: Kahn's algorithm, and fewer than n in the output means a cycle.

**Beat 8.** Group, merge or redundant edge: Union-Find. Cheapest or fastest with non-negative costs: Dijkstra. At most k stops: Bellman–Ford with a copy. All pairs with a small n: Floyd–Warshall. Two groups, or no two neighbors alike: two-coloring. And the minimum cost to connect everything: a minimum spanning tree.

**Beat 9.** And before any of these, ask the four questions from part one: directed, weighted, connected, tree. Read the statement for those words, read the constraints for the speed you need, then pick from this table. That covers most graph problems you'll meet on LeetCode. A few topics, like bridges, Euler paths and searching over states, are left for another video. The full table, with code for everything in this course, is in the notes linked below. Thanks for watching.
