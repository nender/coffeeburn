import { Hub } from "./Hub"
import { Packet } from "./Packet"
import { Pipe } from "./Pipe"

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