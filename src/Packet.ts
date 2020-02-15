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
            let oldPacket = globalPacketPool.pop()!
            oldPacket.target = target
            oldPacket.speed = this.newSpeed()
            oldPacket.TAToB = false
            oldPacket.TProgress = 0
            return oldPacket
        }

        return new Packet(target, isPOD)
    }
    
    constructor(target: Hub, isPOD = false) {
        this.id = getId();
        this.target = target;
        this.isPOD = isPOD;
        this.speed = Packet.newSpeed()
        this.TAToB = false;
        this.TProgress = 0;
    }

    private static newSpeed(): number {
        return (globalRng.random() * 1.5) + 0.5
    }
}
