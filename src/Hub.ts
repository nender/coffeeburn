import { Packet } from "./Packet";
import { Pipe } from "./Pipe";
import { getId, log, randomLiveSelection } from "./burn";
import { globalScene, globalPackets, globalPacketPool, globalNav } from "./App";

export class Hub {
    // x, y coordinates in world-space (i.e. in the range [0-1])
    readonly position: [number, number];
    readonly id: number;
    readonly neighbors: Map<Hub, Pipe>;
    isDead: boolean;
    
    constructor(x: number, y: number) {
        this.position = [x, y]
        this.id = getId();
        this.neighbors = new Map();
        this.isDead = false;
    }
    
    receive(p: Packet): void {
        if (p.isPOD) {
            if (!this.isDead) {
                this.isDead = true;
                log(`[Hub ${this.id}]: Killed by POD`);
                let surrogate = randomLiveSelection(globalScene[0]);
                for (let p of globalPackets)
                    if (p.target == this)
                        p.target = surrogate;
            }

            if (p.target === this) {
                p.target = randomLiveSelection(globalScene[0]);
                log(`[Hub ${this.id}]: Rerouting POD to ${p.target.id}`);
            }

        } else if (p.target === this) {
            log(`[Hub ${this.id}]: Accepted packet ${p.id}`);
            globalPackets.delete(p);
            globalPacketPool.push(p)
            return;
        }

        if (this.neighbors.size === 0)
            throw "No links";
        const nexthopID = globalNav.get(p.target.id)!.get(this.id)!
        const nextHop = globalScene[0].get(nexthopID)!;
        let pipe = this.neighbors.get(nextHop)!
        pipe.receive(p, nextHop);
        log(`[Hub ${this.id}]: Sent ${p.id} towards ${nextHop.id}`);
    }
}
