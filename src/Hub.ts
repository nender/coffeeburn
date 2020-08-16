import { Packet } from "./Packet";
import { Pipe } from "./Pipe";
import { log } from "./burn";
import { App } from "./App";

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
    
    receive(p: Packet, app: App): void {
        if (p.isPOD) {
            if (!this.isDead) {
                this.isDead = true
                log(`[Hub ${this.id}]: Killed by POD`)
                let surrogate = app.randomLiveHub()
                for (let p of app.packets)
                    if (p.target == this)
                        p.target = surrogate
            }

            if (p.target === this) {
                p.target = app.randomLiveHub()
                log(`[Hub ${this.id}]: Rerouting POD to ${p.target.id}`)
            }

        } else if (p.target === this) {
            log(`[Hub ${this.id}]: Accepted packet ${p.id}`)
            app.packets.delete(p)
            app.recordDeliveryStats(p)
            return
        }

        if (this.neighbors.size === 0)
            throw "No links"
        const nexthopID = app.nav.get(p.target.id)!.get(this.id)!
        const nextHop = app.hubs.get(nexthopID)!
        let pipe = this.neighbors.get(nextHop)!
        pipe.receive(p, nextHop)
        log(`[Hub ${this.id}]: Sent ${p.id} towards ${nextHop.id}`)
    }
}
