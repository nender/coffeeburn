import { Hub, RouteInfo } from './burn.js';

const ctx: Worker = self as any;

ctx.onmessage = function(message) {
    let hubs = message.data as Map<number, Hub>;
    let nav: RouteInfo = new Map();

    for (let h of hubs.values()) {
        const subnav = dijkstra(hubs, h);
        nav.set(h.id, subnav);
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

function dijkstra(graph: Map<number, Hub>, source: Hub): Map<number, number | null> {
    
    /** set of all verticies not yet considered by the algorithm */
    const candidateHubs = new Set<Hub>();
    /** Map of Hub -> shortest path so far from source to Hub  */
    const minPathCost = new Map<Hub, number>();
    /** map of hub -> next hop on path to source */
    const prev = new Map<number, number | null>();

    for (let v of graph.values()) {
        minPathCost.set(v, Infinity);
        prev.set(v.id, null);
        candidateHubs.add(v);
    }
    minPathCost.set(source, 0);
    
    while (candidateHubs.size > 0) {
        const closestHub = popMinDist(candidateHubs, minPathCost);
        
        for (let [hub, pipe] of closestHub.neighbors) {
            const currentBestCost = minPathCost.get(closestHub) + pipe.cost();
            const prevBestCost = minPathCost.get(hub);
            if (currentBestCost < prevBestCost) {
                minPathCost.set(hub, currentBestCost);
                prev.set(hub.id, closestHub.id);
            }
        }
    }
    
    return prev;
}