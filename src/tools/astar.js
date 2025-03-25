import {z} from 'zod';
import PriorityQueue from 'priority-queue-js';

const schema = z.object({
    startId: z.string(),
    goalId: z.string()
});

function heuristic(startId, goalId) {
    // Simple heuristic: Manhattan distance (example, adapt as needed)
    return Math.abs(startId.length - goalId.length);
}

function reconstructPath(cameFrom, currentId) {
    const path = [currentId];
    while (cameFrom.has(currentId)) {
        currentId = cameFrom.get(currentId);
        path.unshift(currentId);
    }
    return path;
}

async function astarPathfinding(graph, startId, goalId) {
    const open = new PriorityQueue({comparator: (a, b) => b.f - a.f});
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startId, 0);
    fScore.set(startId, heuristic(startId, goalId));
    open.enqueue({id: startId, f: fScore.get(startId)});

    while (!open.isEmpty()) {
        const current = open.dequeue();

        if (current.id === goalId) {
            return reconstructPath(cameFrom, current.id);
        }

        const note = graph.getNote(current.id);
        if (!note) continue;

        for (const edge of note.references) { // Assuming getReferences returns IDs of referenced notes
            const neighborId = edge;
            const tentativeGScore = (gScore.get(current.id) || 0) + 1; // Assuming each step costs 1

            if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
                cameFrom.set(neighborId, current.id);
                gScore.set(neighborId, tentativeGScore);
                fScore.set(neighborId, tentativeGScore + heuristic(neighborId, goalId, goalId));
                if (!open.find(item => item.id === neighborId)) {
                    open.enqueue({id: neighborId, f: fScore.get(neighborId)});
                }
            }
        }
    }

    return []; // No path found
}


export default {
    name: 'astar',
    description: 'Find the shortest path between two notes using A* algorithm',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'priority-queue-js'],
    async invoke(input, context) {
        const { startId, goalId } = schema.parse(input);
        const graph = context.graph;

        if (!graph.getNote(startId)) {
            return `Error: Start Note with ID '${startId}' not found.`;
        }
        if (!graph.getNote(goalId)) {
            return `Error: Goal Note with ID '${goalId}' not found.`;
        }

        return await astarPathfinding(graph, startId, goalId);
    }
};
