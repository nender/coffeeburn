import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { Pipe } from "./Pipe";

declare var DEBUG: boolean
export function log(msg: string) {
    if (DEBUG) {
        let now = performance.now().toPrecision(4)
        console.log(now + ' ' + msg)
    }
}

// Data Types
export type RouteInfo = Map<number, Map<number, number | null>>

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