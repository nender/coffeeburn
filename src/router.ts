import { RouteInfo } from './burn';
import { GraphInfo } from './graphInfo';

const ctx: Worker = self as any;

let info = new GraphInfo()

ctx.onmessage = function(message) {
    let nav: RouteInfo = new Map();

    let data = message.data as Float64Array
    info.wrap(data)

    let hubIDs = info.hubIDs()

    for (let h of hubIDs) {
        const subnav = dijkstra(info, h);
        nav.set(h, subnav);
    }

    ctx.postMessage(nav);
}

/** Removes the hub from hubs which has the lowest cost in the lookup table */
// todo: replace this with priority queue
function popMinDist(hubs: Set<number>, costLookup: Map<number, number>): number {
    let minDist = Infinity;
    let hub = hubs.values().next().value;
        
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

/** set of all verticies not yet considered by the algorithm */
const candidateHubs = new Set<number>();
/** Map of Hub Id -> shortest path so far from source to Hub  */
const minPathCost = new Map<number, number>();
/** map of hub -> next hop on path to source */
const prev = new Map<number, number | null>();

function dijkstra(graph: GraphInfo, source: number): Map<number, number | null> {
    candidateHubs.clear()
    minPathCost.clear()
    prev.clear()

    for (let v of info.hubIDs()) {
        minPathCost.set(v, Infinity);
        prev.set(v, null);
        candidateHubs.add(v);
    }
    minPathCost.set(source, 0);
    
    while (candidateHubs.size > 0) {
        const closestHub = popMinDist(candidateHubs, minPathCost);
        
        for (let neighborID of graph.hubIDs()) {
            if (neighborID == closestHub)
                continue

            let pipeCost: number = null;
            if (graph.isDead(closestHub)) {
                pipeCost = Number.MAX_VALUE;
            } else {
                pipeCost = graph.linkCost(closestHub, neighborID)
            }

            const currentBestCost = minPathCost.get(closestHub) + pipeCost;
            const prevBestCost = minPathCost.get(neighborID);
            if (currentBestCost < prevBestCost) {
                minPathCost.set(neighborID, currentBestCost);
                prev.set(neighborID, closestHub);
            }
        }
    }
    
    return prev;
}