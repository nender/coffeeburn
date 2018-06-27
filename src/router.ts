import { Hub } from './burn.js';

const ctx: Worker = self as any;

ctx.onmessage = function(message) {
    let hubs = message.data as Iterable<Hub>;
    let nav: Map<Hub, Map<Hub, Hub>>  = new Map();

    for (let h of hubs) {
        const subnav = dijkstra(hubs, h);
        nav.set(h, subnav);
    }

    ctx.postMessage(nav);
}

/** Removes the hub from hubs which has the lowest cost in the lookup table */
// todo: replace this with priority queue
function popMinDist(hubs: Set<Hub>, costLookup: Map<Hub, number>): Hub {
    let minDist = Infinity;
    let hub: Hub = hubs.values().next().value;
        
    for (let v of hubs.keys()) {
        let weight = costLookup.get(v);
        if (weight < minDist) {
            minDist = weight;
            hub = v;
        }
    }
    
    hubs.delete(hub);
    return hub;
}

function dijkstra(graph: Iterable<Hub>, source: Hub): Map<Hub, Hub> {
    
    /** set of all verticies not yet considered by the algorithm */
    const candidateHubs = new Set<Hub>();
    /** Map of Hub -> shortest path so far from source to Hub  */
    const minPathCost = new Map<Hub, number>();
    /** map of hub -> next hop on path to source */
    const prev = new Map<Hub, Hub>();

    for (let v of graph) {
        minPathCost.set(v, Infinity);
        prev.set(v, null);
        candidateHubs.add(v);
    }
    minPathCost.set(source, 0);
    
    while (candidateHubs.size > 0) {
        const closestHub = popMinDist(candidateHubs, minPathCost);
        
        for (let [hub, pipe] of closestHub.neighbors) {
            const currentBestCost = minPathCost.get(closestHub) + pipe.cost;
            const prevBestCost = minPathCost.get(hub);
            if (currentBestCost < prevBestCost) {
                minPathCost.set(hub, currentBestCost);
                prev.set(hub, closestHub);
            }
        }
    }
    
    return prev;
}