# Section 4: Topological sort

Target length 4:30, about 640 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running examples are Course Schedule as a preset in the graphs tool's network mode (six courses, 0 to 5, with the edges 0→1, 0→2, 1→3, 2→3, 3→4 and 2→5), the same preset with one extra edge 4→1 that makes a cycle, a small directed diamond for three-color DFS, and Alien Dictionary as a card. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (card, then tool): the course card from part 1 returns: "You have n courses. Some must be taken before others. Can you finish all of them?" Then the graphs tool in network mode, Course Schedule preset. The pairs are listed on the side, and each arrow is drawn as its pair is read.

Back to the first problem from part one. You have some courses, and some of them must be taken before others. Can you finish all of them? Every pair becomes an arrow, and this time the direction matters. LeetCode gives you the pair a, b, which means take b first, so the arrow goes from b to a. Flip it, and in the version that asks for the order, you'll return the order backwards. So the real question is: is there an order that respects every arrow?

## Beat 2

On screen (tool): an indegree badge appears on every node. Course 0 has indegree zero, lights up and moves into the queue row under the graph.

Count the arrows coming into each course. That number is called the indegree, and here it means how many prerequisites are still missing. A course with indegree zero can be taken right now. In this graph, that's only course zero, so it goes into a queue. Everything else has to wait.

## Beat 3

On screen (tool): Kahn's algorithm stepping. A course leaves the queue, its outgoing arrows fade, the badges they point to count down, courses that reach zero join the queue, and the output order grows below: 0, 1, 2, 3, 5, 4.

Now repeat one move. Take a course from the queue and add it to the order. Taking it removes its outgoing arrows, so every course that depended on it is missing one prerequisite fewer. Whenever a count drops to zero, that course is ready, and it joins the queue. Course three needs both one and two, so it waits until both are done. When the queue runs dry, the order underneath is a valid schedule. This is Kahn's algorithm.

## Beat 4

On screen (card): the Kahn code panel types in.

```python
graph = [[] for _ in range(n)]
indeg = [0] * n
for a, b in prerequisites:
    graph[b].append(a)
    indeg[a] += 1

queue = deque(i for i in range(n) if indeg[i] == 0)
order = []
while queue:
    u = queue.popleft()
    order.append(u)
    for v in graph[u]:
        indeg[v] -= 1
        if indeg[v] == 0:
            queue.append(v)
```

In code, build the adjacency list and the indegree array in the same loop over the pairs. Start the queue with every course whose count is zero, not just course zero. After that, it's BFS with one change: a neighbor joins the queue when its count reaches zero, not the first time you see it. It runs in order V plus E, like every traversal so far.

## Beat 5

On screen (tool): the cycle preset, the same graph plus the arrow 4→1. Kahn's algorithm outputs 0, 2 and 5, then the queue is empty. Courses 1, 3 and 4 stay highlighted, and the trace says "3 of 6 courses in the order: cycle".

Now add one arrow, from course four back to course one, and run it again. Zero, two and five come out, and then the queue is empty. One, three and four are left, each one waiting for another one in the loop. None of them will ever reach zero. That's the whole cycle test: if the order has fewer than n courses, there's a cycle. Course Schedule returns whether the length equals n. Course Schedule Two returns the order itself, or an empty list.

## Beat 6

On screen (tool): network mode, a directed diamond: A→B, A→C, B→D, C→D. DFS from A reaches D through B, then sees D again from C. No cycle is reported.

Part three promised a fix for directed graphs, so here's why the old test breaks. In this diamond, depth-first search reaches D through B, and later it sees D again from C. D is visited, and it isn't C's parent, but there's no cycle: both arrows point down. In a directed graph, seeing a visited node isn't enough. You need to know whether that node is still on the current path.

## Beat 7

On screen (tool): the same diamond with three colors: white for unvisited, gray while a node's call is open, black when it's finished. Then the arrow D→A is added, DFS reaches A while A is still gray, and that arrow is flagged as a cycle.

So DFS keeps three colors. White means not visited yet. Gray means we're inside its call, on the path right now. Black means it's finished, with everything below it explored. Reaching a black node is fine. Reaching a gray node means you've walked back onto your own path, and that's a cycle. Add an arrow from D back to A, and that's exactly what happens. The same colors solve Find Eventual Safe States: the safe nodes are the ones that turn black without ever reaching a gray node.

## Beat 8

On screen (card): "A list of words, sorted in an unknown alphabet. Find the order of the letters." Then the words wrt, wrf, er, ett, rftt, with the first differing letter in each neighboring pair highlighted and the arrows t→f, w→e, r→t, e→r appearing beside them.

Sometimes you have to build the arrows yourself. In Alien Dictionary, you get words sorted in an unknown alphabet. Compare each word with the next one. The first letter where they differ gives you one arrow: that letter comes first. Nothing after it tells you anything. Then it's the same topological sort, on letters. One trap: if a longer word comes before its own prefix, like abc before ab, the input is invalid, so return an empty string.

## Beat 9

On screen (card): a checklist builds line by line: direction from the wording, indegree array, start with every zero, fewer than n means a cycle, gray means on the path, build edges from comparisons.

So: read the direction from the wording, count the indegrees, start with every zero, and if fewer than n come out, there's a cycle. In DFS, gray means on the path. So far, we've answered every connectivity question by searching. Next is a structure that answers it without searching at all, even while edges keep arriving: Union-Find.
