import { Hub } from "./Hub";
import { getId } from "./burn";

export class Packet {
    readonly id: number
    isPOD: boolean
    target: Hub
    speed: number
    
    /** True if packet is currently travelling from A to B */
    TAToB: boolean
    /** Float in the range 0<=x<1 indicating progress along current Pipe */
    TProgress: number

    
    constructor(target: Hub, isPOD = false, speed: number) {
        this.id = getId()
        this.target = target
        this.isPOD = isPOD
        this.speed = speed
        this.TAToB = false
        this.TProgress = 0
    }
}
