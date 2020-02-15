import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { Pipe } from "./Pipe";
import { app } from "./main";

declare var DEBUG: boolean;
export function log(msg: string) {
    if (DEBUG) {
        let now = performance.now().toPrecision(4);
        console.log(now + ' ' + msg);
    }
}

export const getId = (function() {
    let id = 0;
    return function getId() { return id += 1 };
}());

// Data Types
export type RouteInfo = Map<number, Map<number, number | null>>;

let packetPool: Packet[] = []

export class Scene {
    hubs: Map<number, Hub>
    pipes: Pipe[]
    packets: Set<Packet>

    constructor(hubs: Map<number, Hub>, pipes: Pipe[], packets: Set<Packet>) {
        this.hubs = hubs
        this.pipes = pipes
        this.packets = packets
    }
}


function randInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(app.rng.random() * (max - min)) + min;
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