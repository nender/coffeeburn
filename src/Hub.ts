import { Pipe } from "./Pipe";

export class Hub {
    // x, y coordinates in world-space (i.e. in the range [0-1])
    readonly position: [number, number]
    readonly id: number
    readonly neighbors: Map<Hub, Pipe>
    isDead: boolean
    
    constructor(id: number, x: number, y: number) {
        this.position = [x, y]
        this.id = id
        this.neighbors = new Map()
        this.isDead = false
    }
}
