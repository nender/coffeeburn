import { Config } from "./Config";
import { Scene, intToColor, log, RouteInfo, getId } from "./burn";
import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { RandomNumberGenerator } from "./rng";
import Router from "worker-loader!./router";
import { Pipe } from "./Pipe";
import { routeInfoFor } from "./router";

export class App {
    readonly height: number
    readonly width: number
    scene: Scene
    frameCount = 0
    milisPerFrame = 0
    config: Config
    rng: RandomNumberGenerator
    nav: RouteInfo

    noRoute: Set<Hub> = new Set()
    walkingDead: Map<Hub, number> = new Map()
    requestRoutingRefresh = true
    lastFrame = performance.now()
    ctx: CanvasRenderingContext2D

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
        this.ctx = canvas.getContext('2d')!
        this.ctx.font = '8px monospace'
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
        if (this.frameCount == 0 && this.config.packetOfDeath) {
            let speed = this.randomPacketSpeed()
            let travellingAtoB = true
            let targetHub = this.rng.randomSelection(this.scene.hubs.values())
            this.packageOfDeath = this.makeOrRecyclePacket(targetHub, travellingAtoB, speed, this.frameCount)
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
                let p = this.makeOrRecyclePacket(target, travellingAtoB, speed, this.frameCount)
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

    render(): void {
        let ctx = this.ctx
        this.ctx.fillStyle = "black"
        ctx.fillRect(0, 0, this.width, this.height)
        
        for (let pipe of this.pipes) {
            let lineWidth = Math.min(6, (pipe.traffic() - 1) / 24)
            let p1 = pipe.ends[0].position
            let p2 = pipe.ends[1].position

            if (lineWidth >= 1/255) {
                if (pipe.ends[0].isDead || pipe.ends[1].isDead)
                    ctx.strokeStyle = "red"
                else 
                    ctx.strokeStyle = "white"

                ctx.lineWidth = lineWidth

                let [x1, y1] = p1
                let [x2, y2] = p2

                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
            }

            for (let packet of pipe.inflight.keys()) {
                const aToB = packet.TAToB
                if (aToB) {
                    this.drawPacket(packet, p1, p2)
                } else {
                    this.drawPacket(packet, p2, p1)
                }
            }
        }
        
        const hubsize = 7
        for (let h of this.hubs.values()) {
            if (h.isDead)
                ctx.fillStyle = "red"
            else
                ctx.fillStyle = "white"

            let [x, y] = h.position
            ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize)
        }

        let fps = Math.round(1000/this.milisPerFrame)
        if (fps >= 60) {
            ctx.fillStyle = "green"
        } else {
            ctx.fillStyle = "yellow"
        }
        ctx.fillText(fps.toString(), 0, 8)

        ctx.fillStyle = "white"
        ctx.fillText(`Packets: ${this.packets.size} `, 0, 8*2)
        ctx.fillText(`Hubs: ${this.hubs.size} `, 0, 8*3)
        ctx.fillText(`Avg. Life: ${Math.round(this.meanPacketLifespan)} `, 0, 8*4)

        this.frameCount += 1
        let frameTime = performance.now()
        this.milisPerFrame = (this.milisPerFrame * 19 + (frameTime - this.lastFrame)) / 20
        this.lastFrame = frameTime
    }

    drawPacket(packet: Packet, p1: [number, number], p2: [number, number]) {
        let ctx = this.ctx
        let [x1, y1] = p1
        let dx = (p2[0] - p1[0]) * packet.TProgress
        let dy = (p2[1] - p1[1]) * packet.TProgress
        if (packet.isPOD) {
            const packetSize = 12
            const r = packetSize / 2
            ctx.fillStyle = "red"
            ctx.beginPath()
            ctx.moveTo(x1+ dx, y1 + dy - r)
            ctx.lineTo(x1 + dx + r, y1 + dy + r)
            ctx.lineTo(x1 + dx - r, y1 + dy + r)
            ctx.fill()
        } else {
            const packetSize = 4
            const r = packetSize / 2
            ctx.fillStyle = intToColor(packet.target.id)
            ctx.fillRect((x1 + dx) - r,
                (y1 + dy) - r,
                packetSize, packetSize)
        }
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
        let transitTime = this.frameCount - packet.birthFrame
        let avgScale = (this.packetDeliveryCount - 1) / this.packetDeliveryCount
        this.meanPacketLifespan *= avgScale
        this.meanPacketLifespan += transitTime / this.packetDeliveryCount
    }
}
