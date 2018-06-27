import { Hub, RouteInfo } from './burn';

// TODO: use webpack to properly import these from burn
function weightTraffic(w: number, mode: string): number {
    switch (mode) {
        case "none":
            return 1;
        case "linear":
            return w;
        case "sqrt":
            return Math.sqrt(w);
        case "square":
            return w ** 2;
        case "exp":
            return Math.min(1e6, Math.exp(w / 3));
        case "log":
            return Math.log(w) + 1;
        case "bell":
            let aw = w / 3 - 2;
            return Math.max(0.01, Math.exp(aw - aw ** 2 / 2) * 25)
    }
}

function weightLength(l: number, mode: string): number {
    switch (mode) {
        case "linear":
            return Math.sqrt(l);
        case "sqrt":
            return l ** 0.25 * 5;
        case "square":
            return l / 25;
        case "exp":
            // yes this seems nuts, I'm just copying reference implementation for now
            return Math.min(1e6, Math.exp(Math.sqrt(l) / 10) / 3);
        case "log":
            return Math.max(1, (Math.log(l) / 2 + 1) * 25);
    }
}
const ctx: Worker = self as any;
let config: any = null;

ctx.onmessage = function(message) {
    let nav: RouteInfo = new Map();

    let [hubs, cfg] = message.data as [Map<number, Hub>, any];
    if (cfg)
        config = cfg;

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
            let pipeCost: number = null;
            if (pipe.ends[0].isDead || pipe.ends[1].isDead)
                pipeCost = Number.MAX_VALUE;
            else {
                let [l, lmode] = [pipe._length, config.distanceWeight]
                let [w, wmode] = [pipe._weight, config.trafficWeight]
                pipeCost = weightLength(l, lmode) / weightTraffic(w, wmode);
            }

            const currentBestCost = minPathCost.get(closestHub) + pipeCost;
            const prevBestCost = minPathCost.get(hub);
            if (currentBestCost < prevBestCost) {
                minPathCost.set(hub, currentBestCost);
                prev.set(hub.id, closestHub.id);
            }
        }
    }
    
    return prev;
}