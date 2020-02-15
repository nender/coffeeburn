import { Hub } from "./Hub";
import { getId } from "./burn";
import { globalRng, globalPacketPool } from "./App";

export class Packet {
    readonly id: number;
    isPOD: boolean;
    target: Hub;
    speed: number;
    
    /** True if packet is currently travelling from A to B */
    TAToB: boolean;
    /** Float in the range 0<=x<1 indicating progress along current Pipe*/
    TProgress: number;

    static makePacket(target: Hub, isPOD = false): Packet {
        if (globalPacketPool.length != 0) {
            let oldPacket = globalPacketPool.pop()
            oldPacket.target = target
            oldPacket.speed = this.newSpeed()
            oldPacket.TAToB = null
            oldPacket.TProgress = null
            return oldPacket
        }

        return new Packet(target, isPOD)
    }
    
    constructor(target: Hub, isPOD = false) {
        this.id = getId();
        this.target = target;
        this.isPOD = isPOD;
        this.speed = Packet.newSpeed()
        this.TAToB = null;
        this.TProgress = null;
    }

    private static newSpeed(): number {
        return (globalRng.random() * 1.5) + 0.5
    }
}
