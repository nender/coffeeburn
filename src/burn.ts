import Router from "worker-loader!./router";
import { RandomNumberGenerator } from "./rng";
import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { Pipe } from "./Pipe";

declare var DEBUG: boolean;
export function log(msg: string) {
    if (DEBUG) {
        let now = performance.now().toPrecision(4);
        console.log(now + ' ' + msg);
    }
}

// Globals
let nav: RouteInfo = new Map();
let frameCount = 0;
let milisPerFrame = 0;
let packets: Set<Packet> = new Set();
let rng = new RandomNumberGenerator();

export const getId = (function() {
    let id = 0;
    return function getId() { return id += 1 };
}());

export function randomSelection<T>(collection: Iterable<T>): T {
    let result: T | null = null;
    let count = 0;
    for (let curr of collection) {
        if (rng.random() < 1/++count)
            result = curr;
    }
    return result!;
}

export function randomLiveSelection<T>(collection: Map<number, Hub>): Hub {
    let target: Hub;
    do {
        target = randomSelection(collection.values());
    } while (target.isDead || !nav.has(target.id) )
    return target;
}

// Data Types
export type RouteInfo = Map<number, Map<number, number | null>>;

let packetPool: Packet[] = []

export class Scene {
    hubs: Map<number, Hub>
    pipes: Pipe[]
}

export function generateHub(hubs: Map<number, Hub>, pipes: Pipe[], width: number, height: number): void {
    function addNeighbor(a: Hub, b: Hub): void {
        if (a.neighbors.has(b))
            return;
        
        const p = new Pipe(a, b);
        pipes.push(p);
        a.neighbors.set(b, p);
        b.neighbors.set(a, p);
    }
    
    let x = Math.floor(rng.random() * width);
    let y = Math.floor(rng.random() * height);
    let newHub = new Hub(x, y);
    for (let x of hubs.values()) {
        addNeighbor(x, newHub);
        addNeighbor(newHub, x);
    }
    hubs.set(newHub.id, newHub);
    log(`[GenerateScene]: Added Hub ${newHub.id}`);
}

export function generateScene(numHubs: number, width: number, height: number): Scene {
    const hubs: Map<number, Hub> = new Map();
    const pipes: Pipe[] = [];
    
    for (let i = 0; i < numHubs; i++) {
        generateHub(hubs, pipes, width, height);
    }
    return new Scene()
}

function randInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(rng.random() * (max - min)) + min;
}

export const intToColor = (function() {
    const colorTable = new Map<number, string>();
    return function intToColor(i: number): string {
        if (colorTable.has(i))
            return colorTable.get(i)!
        else {
            // turns out that random rgb values don't *look* random!
            // so instead randomize hue value of hsl color
            const colorString = `hsl(${randInt(0,360)},100%,50%)`;
            colorTable.set(i, colorString);
            return colorString;
        }
    }
})();