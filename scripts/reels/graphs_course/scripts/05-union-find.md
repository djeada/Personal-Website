# Section 5: Union-Find

Target length 4:30, about 640 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running example is Redundant Connection on a new Disjoint Set structure in the Data Structure Lab: five elements, 1 to 5, and the edges 1-2, 2-3, 3-4, 1-4, 1-5 in that order. The answer is 1-4. Network Connected and Accounts Merge appear as cards. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (card, then tool): "A tree with n nodes, plus one extra edge. Return the edge you can remove so it's a tree again." Then the Data Structure Lab, Disjoint Set, Redundant Connection preset: five separate nodes, the edge list on the side.

Here's a problem where searching feels clumsy. Redundant Connection: you get a tree with one extra edge, and you return that edge. The edges arrive one at a time, and for each one you want to know: are these two ends already connected? You could run a DFS before adding every edge, but that's a full search per edge. Union-Find answers the same question in almost constant time.

## Beat 2

On screen (tool): the five nodes, each its own root. The parent array below reads 1, 2, 3, 4, 5. A Components counter shows 5.

Union-Find keeps elements in groups. Each group is a small tree where every element points to a parent, and the root at the top represents the whole group. At the start, everyone is alone and is their own parent. That's the whole data structure: one array. Two elements are in the same group exactly when they lead up to the same root.

## Beat 3

On screen (tool): union(1, 2), union(2, 3), union(3, 4). Each find walks up to a root, one root is linked under the other, the parent array updates, and the Components counter goes 5, 4, 3, 2.

There are two operations. Find walks up the parent pointers to the root. Union finds both roots and, if they differ, points one root at the other, which merges the two groups. Every successful union removes one group, so a counter that starts at n and goes down by one gives you the number of components at any moment. That alone solves Number of Connected Components and Number of Provinces.

## Beat 4

On screen (tool): a tall tree preset. find on the deepest node walks the path up, then every node on that path is re-pointed straight at the root. Then a union where the smaller tree is hung under the larger one, with the sizes shown.

Left alone, the trees can grow into long chains, and find gets slow. Two small tricks prevent that. The first is path compression: when find walks up, it points every node it passed straight at the root, so the next find on any of them is almost instant. The second is union by size: always hang the smaller tree under the larger one, so the trees stay shallow.

## Beat 5

On screen (card): the Union-Find code panel types in. The line "if ra == rb: return False" is highlighted at the end.

```python
parent = list(range(n))
size = [1] * n

def find(x):
    if parent[x] != x:
        parent[x] = find(parent[x])
    return parent[x]

def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb:
        return False
    if size[ra] < size[rb]:
        ra, rb = rb, ra
    parent[rb] = ra
    size[ra] += size[rb]
    return True
```

Here it is in about a dozen lines. With both tricks, each operation costs the inverse Ackermann function, which is at most four for any input you'll ever see. Treat it as constant. And notice that union returns False when both ends already share a root. That return value is about to answer our problem.

## Beat 6

On screen (tool): the Redundant Connection preset again. The edges are added in order. 1-2, 2-3 and 3-4 merge groups. On 1-4, both finds reach the same root, and the edge turns red with the label "answer".

Back to Redundant Connection. Add the edges in order. One-two, two-three, three-four: each one merges two groups. Then one-four. Find one, find four: same root. They were already connected, so this edge closes a cycle. It's the first union that fails, and that's the answer. Since there's exactly one cycle, it's also the last cycle edge in the input, which is what the problem asks for.

## Beat 7

On screen (card): "n computers and some cables. You may move cables. What is the fewest number of moves to connect every computer, or -1?" Then "fewer than n - 1 cables → -1" and "otherwise → components - 1".

The counter solves more than you'd think. In Number of Operations to Make Network Connected, you're allowed to move cables. If there are fewer than n minus one cables, it's impossible. Otherwise, every failed union is a spare cable, and you need exactly one move to attach each extra group. So the answer is the number of components minus one.

## Beat 8

On screen (card): "Accounts with a name and emails. Two accounts belong to the same person if they share an email. Merge them." Then each email gets an integer id as it is first seen.

Union-Find works on integers, but problems often give you strings. In Accounts Merge, two accounts belong to the same person if they share an email. Give every email an id the first time you see it, union all the emails of one account together, and at the end, group the emails by their root.

## Beat 9

On screen (card): a two-column card. Left "Union-Find": are they connected, how many groups, edges only added. Right "BFS or DFS": the path itself, distances, edges removed. Then the bug: "parent[a] == parent[b]" crossed out, "find(a) == find(b)" below it.

When should you not use it? Union-Find can't remove an edge, and it can't give you the path between two nodes, only whether one exists. For those, go back to BFS or DFS. And watch for the classic bug: comparing parents instead of roots. Two nodes can have different parents and the same root, so always compare find of a with find of b.

## Beat 10

On screen (card): a checklist builds line by line: groups that only merge, find with path compression, union by size, a counter that starts at n, a failed union closes a cycle, strings become ids.

So: groups that only ever merge mean Union-Find. Compress paths, union by size, keep a counter, and remember that a failed union means a cycle. Up to now, every edge has cost the same. Next, edges get prices, and breadth-first search stops being enough.
