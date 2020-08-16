import { Config } from "./Config"
import { log, RouteInfo } from "./burn"
import { Packet } from "./Data/Packet"
import { Hub } from "./Data/Hub"
import { RandomNumberGenerator } from "./rng"
import Router from "worker-loader!./router"
import { Pipe } from "./Data/Pipe"
import { Scene } from "./Data/Scene"
import { routeInfoFor } from "./router"

const getId = (function() {
    let id = 0
    return function getId() { return id += 1 }
}())

export class App {
    readonly height: number
    readonly width: number
    scene: Scene
    tick = 0
    config: Config
    rng: RandomNumberGenerator
    nav: RouteInfo

    noRoute: Set<Hub> = new Set()
    walkingDead: Map<Hub, number> = new Map()
    requestRoutingRefresh = true

    router: Router
    packageOfDeath: Packet | null = null
    started = false

    meanPacketLifespan = 1
    packetDeliveryCount = 1

    constructor(canvas: HTMLCanvasElement, config: Config) {
        this.config = config
        this.rng = new RandomNumberGenerator()
        this.width = canvas.width
        this.height = canvas.height
        this.scene = this.generateScene(this.config.nodeCount, this.width, this.height, this.rng)
        this.nav = routeInfoFor(this.hubs, this.config)

        let router = new Router()
        router.onmessage = (messageEvent) => {
            this.nav = messageEvent.data as RouteInfo
            this.requestRoutingRefresh = true
            log("[Router] Got new route info")
        }
        this.router = router

        // generate package of death
        if (this.tick == 0 && this.config.packetOfDeath) {
            let speed = this.randomPacketSpeed()
            let travellingAtoB = true
            let targetHub = this.rng.randomSelection(this.scene.hubs.values())
            this.packageOfDeath = this.makeOrRecyclePacket(targetHub, travellingAtoB, speed, this.tick)
            this.packets.add(this.packageOfDeath)
            const h = this.rng.randomSelection(this.scene.hubs.values())
            this.hubReceive(h, this.packageOfDeath, this)
        }
    }

    randomPacketSpeed(): number {
        return (this.rng.random() * 1.5) + 0.5
    }

    get hubs(): Map<number, Hub> {
        return this.scene.hubs
    }

    get pipes(): Pipe[] {
        return this.scene.pipes
    }
    
    get packets(): Set<Packet> {
        return this.scene.packets
    }

    step() {
        // remove dead nodes
        let okToKill: Hub[] = []
        for (let [hub, framesUntilRipe] of this.walkingDead) {
            if (this.requestRoutingRefresh) {
                if (framesUntilRipe > 0) {
                    this.walkingDead.set(hub, framesUntilRipe - 1)
                } else {
                    this.noRoute.add(hub)
                }
            }

            let noInflight = true
            for (let [, p] of hub.neighbors) {
                if (p.inflight.size > 0) {
                    noInflight = false
                    break
                }
            }

            if (noInflight && this.noRoute.has(hub)) {
                let h = this.hubs.get(hub.id)!
                okToKill.push(hub)
                for (let [n, p] of h.neighbors) {
                    h.neighbors.delete(n)
                    n.neighbors.delete(h)

                    let pos = this.pipes.indexOf(p)
                    this.pipes.splice(pos, 1)
                }
            }
        }

        for (let k of okToKill) {
            log(`[Main]: reaped Hub ${k.id}`)
            this.walkingDead.delete(k)
            this.hubs.delete(k.id)
            this.noRoute.delete(k)
        }


        // advance all packets
        for (let p of this.pipes)
            this.pipeStep(p, this)

        // add new packages
        for (let h of this.hubs.values()) {
            if (h.isDead) {
                if (!this.walkingDead.has(h))
                    this.walkingDead.set(h, 2)

                continue
            }

            // test nav to make sure we only route to and from packets which we
            // have routing info on
            if (!this.nav.has(h.id))
                continue

            if (this.rng.random() < this.config.packetSpawnChance) {
                let target = this.randomLiveHub()
                let speed = this.randomPacketSpeed()
                let travellingAtoB = undefined
                let p = this.makeOrRecyclePacket(target, travellingAtoB, speed, this.tick)
                this.packets.add(p)
                this.hubReceive(h, p, this)
            }
        }

        // add and remove nodes
        if (this.config.addRemoveNodes) {
            // destroy nodes
            if (this.packageOfDeath) {
                this.packageOfDeath.speed = ((this.hubs.size - this.walkingDead.size) / this.config.nodeCount) ** 2
            }
            else {
                let nodeDiff = this.hubs.size - this.config.nodeCount + this.walkingDead.size
                let factor = 0
                if (nodeDiff <= 0) {
                    factor = 1
                } else {
                    factor = (this.config.nodeCount - nodeDiff)/ this.config.nodeCount
                }
                factor = Math.max(factor, 0)

                if (Math.floor(this.rng.random() * factor * this.config.addRemoveChance) == 0 && this.hubs.size > 3) {
                    let hub = this.randomLiveHub()
                    hub.isDead = true
                    let surrogate = this.randomLiveHub()
                    for (let p of this.packets)
                        if (p.target == hub)
                            p.target = surrogate
                }
            }

            // add nodes
            let nodeDiff = this.config.nodeCount - this.hubs.size - this.walkingDead.size
            let factor = 0
            if (nodeDiff <= 0) {
                factor = 1
            } else {
                factor = (this.config.nodeCount - nodeDiff / this.config.nodeCount)
            }
            factor = Math.max(factor, 0)
            if (Math.floor(this.rng.random() * factor * this.config.addRemoveChance) == 0) {
                this.generateHub(this.hubs, this.pipes, this.width, this.height, this.rng)
            }
        }

        if (this.requestRoutingRefresh) {
            this.router.postMessage([this.hubs, this.config])
            this.requestRoutingRefresh = false
        }
    }

    hubReceive(h: Hub, p: Packet, app: App): void {
        if (p.isPOD) {
            if (!h.isDead) {
                h.isDead = true
                log(`[Hub ${h.id}]: Killed by POD`)
                let surrogate = app.randomLiveHub()
                for (let p of app.packets)
                    if (p.target == h)
                        p.target = surrogate
            }

            if (p.target === h) {
                p.target = app.randomLiveHub()
                log(`[Hub ${h.id}]: Rerouting POD to ${p.target.id}`)
            }

        } else if (p.target === h) {
            log(`[Hub ${h.id}]: Accepted packet ${p.id}`)
            app.packets.delete(p)
            app.recordDeliveryStats(p)
            return
        }

        if (h.neighbors.size === 0)
            throw "No links"
        const nexthopID = app.nav.get(p.target.id)!.get(h.id)!
        const nextHop = app.hubs.get(nexthopID)!
        let pipe = h.neighbors.get(nextHop)!
        pipe.receive(p, nextHop)
        log(`[Hub ${h.id}]: Sent ${p.id} towards ${nextHop.id}`)
    }

    pipeStep(p: Pipe, app: App): void {
        const delivered: Set<Packet> = new Set()
        // loop through all the inflight packets, updating their status and making note
        // of those which are complete
        for (let packet of p.inflight) {
            const newProgress = packet.TProgress + packet.speed * p.traffic() / p.distance()
            
            if (newProgress < 1)
                packet.TProgress = newProgress
            else
                delivered.add(packet)
        }
        
        for (let packet of delivered) {
            p.inflight.delete(packet)
            if (packet.TAToB)
                this.hubReceive(p.ends[1], packet, app)
            else
                this.hubReceive(p.ends[0], packet, app)
        }
        
        p.decrementWeight()
    }

    makeOrRecyclePacket(target: Hub, isPOD = false, speed: number, currentFrame: number): Packet {
        let id = getId()
        return new Packet(id, target, isPOD, speed, currentFrame)
    }

    generateHub(hubs: Map<number, Hub>, pipes: Pipe[], width: number, height: number, rng: RandomNumberGenerator): void {
        let x = Math.floor(rng.random() * width)
        let y = Math.floor(rng.random() * height)
        let id = getId()
        let newHub = new Hub(id, x, y)
        for (let x of hubs.values()) {
            this.addNeighbor(x, newHub, pipes)
            this.addNeighbor(newHub, x, pipes)
        }
        hubs.set(newHub.id, newHub)
        log(`[GenerateScene]: Added Hub ${newHub.id}`)
    }

    addNeighbor(a: Hub, b: Hub, pipes: Pipe[]): void {
        if (a.neighbors.has(b))
            return
        
        const p = new Pipe(a, b, this.config)
        pipes.push(p)
        a.neighbors.set(b, p)
        b.neighbors.set(a, p)
    }

    generateScene(numHubs: number, width: number, height: number, rng: RandomNumberGenerator): Scene {
        const hubs: Map<number, Hub> = new Map()
        const pipes: Pipe[] = []
        
        for (let i = 0; i < numHubs; i++) {
            this.generateHub(hubs, pipes, width, height, rng)
        }
        return new Scene(hubs, pipes, new Set<Packet>())
    }

    randomLiveHub(): Hub {
        let target: Hub
        do {
            target = this.rng.randomSelection(this.hubs.values())
        } while (target.isDead || !this.nav.has(target.id) )
        return target
    }

    recordDeliveryStats(packet: Packet) {
        this.packetDeliveryCount += 1
        let transitTime = this.tick - packet.birthFrame
        let avgScale = (this.packetDeliveryCount - 1) / this.packetDeliveryCount
        this.meanPacketLifespan *= avgScale
        this.meanPacketLifespan += transitTime / this.packetDeliveryCount
    }
}
