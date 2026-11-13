# Section 7: Bipartite graphs and coloring

Target length 4:00, about 580 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running examples are Possible Bipartition as a card, network-mode presets for a square, a triangle and a two-piece graph whose second piece holds a triangle, and Flower Planting With No Adjacent for greedy coloring. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (card): "n people and a list of pairs who dislike each other. Can you split everyone into two groups so that no such pair ends up together?" The words "dislike" and "two groups" are highlighted.

Here's a problem that hides its graph well. Some people dislike each other, and you want to split everyone into two groups, so that no two people who dislike each other end up together. People are nodes, and each dislike is an undirected edge. Two groups means two colors, and the rule is that the two ends of every edge get different colors. A graph you can color like that is called bipartite.

## Beat 2

On screen (tool): network mode, square preset. BFS from one node colors it blue, its two neighbors orange, and the last node blue. Every edge joins blue to orange, and the result reads "bipartite".

Checking it is easy, because there's no choice to make. Color the first node blue. Its neighbors must be orange. Their neighbors must be blue again. BFS spreads the colors ring by ring, and every node's color is forced. On this square, it works: every edge joins blue to orange.

## Beat 3

On screen (tool): triangle preset. The first node is blue, both neighbors orange, and the edge between those two turns red. The triangle is outlined as an odd cycle.

Now a triangle. The first node is blue, and both its neighbors are orange, but those two are connected to each other. Same color on both ends: impossible. That isn't bad luck with the starting color. A cycle with an odd number of nodes can never alternate between two colors. A graph is bipartite exactly when it has no odd cycle, and BFS finds one the moment an edge joins two nodes of the same color.

## Beat 4

On screen (card): the bipartite code panel types in. The outer loop is highlighted at the end.

```python
color = [-1] * n
for s in range(n):
    if color[s] != -1:
        continue
    color[s] = 0
    queue = deque([s])
    while queue:
        u = queue.popleft()
        for v in graph[u]:
            if color[v] == -1:
                color[v] = 1 - color[u]
                queue.append(v)
            elif color[v] == color[u]:
                return False
return True
```

The code is BFS with a color array instead of a visited set. Minus one means uncolored. A new neighbor gets the opposite color, one minus mine. A neighbor that already has my color means stop and return false. And notice the outer loop over every node.

## Beat 5

On screen (tool): the two-piece preset. A search from node 0 colors the first piece cleanly and stops. Then the outer loop starts in the second piece, which contains a triangle, and the failing edge turns red.

Here's why that loop matters. This graph has two pieces. A search from node zero colors the first piece perfectly and stops. If you return true now, you're wrong, because the second piece contains a triangle. Remember the fourth question from part one: nothing says the graph is connected. Is Graph Bipartite has test cases built around exactly this trap.

## Beat 6

On screen (card): two input shapes side by side. Left, "Is Graph Bipartite: graph[i] lists the neighbors of i". Right, "Possible Bipartition: dislikes as pairs, people labeled 1 to n", with "n + 1 slots" and "add both directions" marked.

Read the input shape before you write the loop. Is Graph Bipartite hands you the adjacency list directly, so you can start coloring right away. Possible Bipartition gives you a list of pairs instead, with people numbered from one to n. So build the adjacency list first, add each dislike in both directions, because a dislike blocks both people, and allocate n plus one slots, or shift every label down by one.

## Beat 7

On screen (tool): Flower Planting preset with four flower colors. Gardens are visited in order, and each takes the smallest color its neighbors aren't using. A badge shows "max degree 3, 4 colors".

With more than two colors, things change. In Flower Planting With No Adjacent, every garden gets one of four flower types, different from its neighbors, and each garden touches at most three others. Go through the gardens and give each one the smallest type its neighbors aren't using. At most three types are taken, so one of the four is always free, and greedy never gets stuck. The general rule: max degree plus one colors are always enough.

## Beat 8

On screen (card): "Is 3 colors enough? NP-complete." Below it, three lines: exactly two colors → BFS, a degree limit → greedy, small n → backtracking.

But don't expect more than that. Finding the fewest colors for a general graph is NP-hard, and even asking whether three colors are enough is already NP-complete. So a coloring problem in an interview always comes with a shortcut: exactly two colors, a degree limit like the gardens, or a graph small enough to try every option with backtracking.

## Beat 9

On screen (card): a checklist builds line by line: two groups means 2-coloring, an odd cycle means impossible, a color array with -1, start from every uncolored node, max degree + 1 colors for greedy.

So: two groups means two colors with BFS, an odd cycle means no, and always start from every uncolored node. One last kind of problem to go. Next, connecting everything as cheaply as possible, and then the whole course on one page.
