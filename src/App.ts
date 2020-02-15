import { Config } from "./Config";
import { Scene, randomSelection, randomLiveSelection, intToColor, log, generateScene, RouteInfo, generateHub } from "./burn";
import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { RandomNumberGenerator } from "./rng";
import Router from "worker-loader!./router";
import { Pipe } from "./Pipe";

export const globalConfig = new Config()
export const globalRng = new RandomNumberGenerator()
export const globalPacketPool: Packet[] = []
export let globalScene: Scene
export let globalPackets: Set<Packet> = new Set()
export let globalNav: RouteInfo

export class App {
    readonly height: number
    readonly width: number
    canvas: HTMLCanvasElement
    scene: Scene
    frameCount = 0
    packets: Set<Packet>
    milisPerFrame: number

    noRoute: Set<Hub> = new Set()
    walkingDead: Map<Hub, number> = new Map()
    requestRefresh = false
    lastFrame = performance.now()
    ctx: CanvasRenderingContext2D

    router: Router
    packageOfDeath: Packet | null = null;
    started = false

    constructor(canvas: HTMLCanvasElement) {
        this.width = canvas.width
        this.height = canvas.height
        this.ctx = canvas.getContext('2d')!
        this.ctx.font = '8px monospace';
        this.scene = generateScene(globalConfig.nodeCount, this.width, this.height);

        let router = new Router();
        router.onmessage = (e) => {
            globalNav = e.data;
            this.requestRefresh = true;
            log("[Router] Got new route info")

            if (!this.started) {
                this.started = true;
                this.step();
            }
        }
        this.router = router
        this.router.postMessage([this.hubs, globalConfig]);

        // generate package of death
        if (this.frameCount == 0 && globalConfig.packetOfDeath) {
            this.packageOfDeath = Packet.makePacket(randomSelection(this.scene.hubs.values()), true);
            this.packets.add(this.packageOfDeath);
            randomSelection(this.scene.hubs.values()).receive(this.packageOfDeath);
        }
    }

    get hubs(): Map<number, Hub> {
        return this.scene.hubs
    }

    get pipes(): Pipe[] {
        return this.scene.pipes
    }

    step() {
        // remove dead nodes
        let okToKill: Hub[] = [];
        for (let [hub, framesUntilRipe] of this.walkingDead) {
            if (this.requestRefresh) {
                if (framesUntilRipe > 0) {
                    this.walkingDead.set(hub, framesUntilRipe - 1);
                } else {
                    this.noRoute.add(hub)
                }
            }

            let noInflight = true;
            for (let [, p] of hub.neighbors) {
                if (p.inflight.size > 0) {
                    noInflight = false;
                    break;
                }
            }

            if (noInflight && this.noRoute.has(hub)) {
                let h = this.hubs.get(hub.id)!
                okToKill.push(hub);
                for (let [n, p] of h.neighbors) {
                    h.neighbors.delete(n);
                    n.neighbors.delete(h);

                    let pos = this.pipes.indexOf(p);
                    this.pipes.splice(pos, 1);
                }
            }
        }
        for (let k of okToKill) {
            log(`[Main]: reaped Hub ${k.id}`)
            this.walkingDead.delete(k);
            this.hubs.delete(k.id);
            this.noRoute.delete(k);
        }


        // advance all packets
        for (let p of this.pipes)
            p.step();

        // add new packages
        for (let h of this.hubs.values()) {
            if (h.isDead) {
                if (!this.walkingDead.has(h))
                    this.walkingDead.set(h, 2);

                continue;
            }

            // test nav to make sure we only route to and from packets which we
            // have routing info on
            if (!globalNav.has(h.id))
                continue;

            if (globalRng.random() < globalConfig.packetSpawnChance) {
                let target = randomLiveSelection(this.hubs);
                let p = Packet.makePacket(target);
                this.packets.add(p);
                h.receive(p);
            }
        }

        // add and remove nodes
        if (globalConfig.addRemoveNodes) {
            // destroy nodes
            if (this.packageOfDeath) {
                this.packageOfDeath.speed = ((this.hubs.size - this.walkingDead.size) / globalConfig.nodeCount) ** 2;
            }
            else {
                let nodeDiff = this.hubs.size - globalConfig.nodeCount + this.walkingDead.size;
                let factor = 0;
                if (nodeDiff <= 0) {
                    factor = 1;
                } else {
                    factor = (globalConfig.nodeCount - nodeDiff)/ globalConfig.nodeCount;
                }
                factor = Math.max(factor, 0);

                if (Math.floor(globalRng.random() * factor * globalConfig.addRemoveChance) == 0 && this.hubs.size > 3) {
                    let hub = randomLiveSelection(this.hubs);
                    hub.isDead = true;
                    let surrogate = randomLiveSelection(this.scene[0]);
                    for (let p of this.packets)
                        if (p.target == hub)
                            p.target = surrogate;
                }
            }

            // add nodes
            let nodeDiff = globalConfig.nodeCount - this.hubs.size - this.walkingDead.size;
            let factor = 0;
            if (nodeDiff <= 0) {
                factor = 1;
            } else {
                factor = (globalConfig.nodeCount - nodeDiff / globalConfig.nodeCount);
            }
            factor = Math.max(factor, 0);
            if (Math.floor(globalRng.random() * factor * globalConfig.addRemoveChance) == 0) {
                generateHub(this.hubs, this.pipes, this.width, this.height);
            }
        }

        if (this.requestRefresh) {
            this.router.postMessage([this.hubs, null]);
            this.requestRefresh = false;
        }

        this.frameCount += 1;
        let frameTime = performance.now();
        this.milisPerFrame = (this.milisPerFrame * 19 + (frameTime - this.lastFrame)) / 20;
        this.lastFrame = frameTime;
    }

    render(): void {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        for (let pipe of this.pipes) {
            let lineWidth = Math.min(6, (pipe.traffic() - 1) / 24)
            let p1 = pipe.ends[0].position;
            let p2 = pipe.ends[1].position;

            if (lineWidth >= 1/255) {
                if (pipe.ends[0].isDead || pipe.ends[1].isDead)
                    this.ctx.strokeStyle = "red";
                else 
                    this.ctx.strokeStyle = "white";

                this.ctx.lineWidth = lineWidth;

                let [x1, y1] = p1;
                let [x2, y2] = p2;

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }

            for (let packet of pipe.inflight.keys()) {
                function drawPacket(p1: [number, number], p2: [number, number]) {
                    let [x1, y1] = p1;
                    let dx = (p2[0] - p1[0]) * packet.TProgress;
                    let dy = (p2[1] - p1[1]) * packet.TProgress;
                    if (packet.isPOD) {
                        const packetSize = 12;
                        const r = packetSize / 2;
                        this.ctx.fillStyle = "red";
                        this.ctx.beginPath();
                        this.ctx.moveTo(x1+ dx, y1 + dy - r);
                        this.ctx.lineTo(x1 + dx + r, y1 + dy + r);
                        this.ctx.lineTo(x1 + dx - r, y1 + dy + r);
                        this.ctx.fill();
                    } else {
                        const packetSize = 4;
                        const r = packetSize / 2;
                        this.ctx.fillStyle = intToColor(packet.target.id);
                        this.ctx.fillRect((x1 + dx) - r,
                            (y1 + dy) - r,
                            packetSize, packetSize);
                    }
                }

                const aToB = packet.TAToB;
                const progress = packet.TProgress;
                if (aToB) {
                    drawPacket(p1, p2);
                } else {
                    drawPacket(p2, p1);
                }
            }
        }
        
        const hubsize = 7;
        for (let h of this.hubs.values()) {
            if (h.isDead)
                this.ctx.fillStyle = "red";
            else
                this.ctx.fillStyle = "white";

            let [x, y] = h.position;
            this.ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize);
        }

        this.ctx.fillStyle = "white";
        this.ctx.fillText(Math.round(1000/this.milisPerFrame).toString(), 0, 8);
    }
}
