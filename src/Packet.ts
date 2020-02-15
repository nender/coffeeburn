import { Hub } from "./Hub";
import { getId } from "./burn";
import { globalPacketPool } from "./App";

export class Packet {
    readonly id: number;
    isPOD: boolean;
    target: Hub;
    speed: number;
    
    /** True if packet is currently travelling from A to B */
    TAToB: boolean;
    /** Float in the range 0<=x<1 indicating progress along current Pipe */
    TProgress: number;

    static makePacket(target: Hub, isPOD = false, speed: number): Packet {
        if (globalPacketPool.length != 0) {
            let oldPacket = globalPacketPool.pop()!
            oldPacket.target = target
            oldPacket.speed = speed
            oldPacket.TAToB = false
            oldPacket.TProgress = 0
            return oldPacket
        }

        return new Packet(target, isPOD, speed)
    }
    
    constructor(target: Hub, isPOD = false, speed: number) {
        this.id = getId();
        this.target = target;
        this.isPOD = isPOD;
        this.speed = speed
        this.TAToB = false;
        this.TProgress = 0;
    }
}
