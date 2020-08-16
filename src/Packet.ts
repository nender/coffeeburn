import { Hub } from "./Hub";

export class Packet {
    id: number
    isPOD: boolean
    target: Hub
    speed: number
    birthFrame: number
    
    /** True if packet is currently travelling from A to B */
    TAToB: boolean
    /** Float in the range 0<=x<1 indicating progress along current Pipe */
    TProgress: number;

    
    constructor(id: number, target: Hub, isPOD = false, speed: number, currentFrame: number) {
        this.id = id
        this.target = target
        this.isPOD = isPOD
        this.speed = speed
        this.TAToB = false
        this.TProgress = 0
        this.birthFrame = currentFrame
    }
}
