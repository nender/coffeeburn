import Router from "worker-loader!./router";
import { RandomNumberGenerator } from "./rng";
import { Packet } from "./Packet";
import { Hub } from "./Hub";
import { Pipe } from "./Pipe";
import { globalConfig } from "./App";

declare var DEBUG: boolean;
export function log(msg: string) {
    if (DEBUG) {
        let now = performance.now().toPrecision(4);
        console.log(now + ' ' + msg);
    }
}

// Globals
let nav: RouteInfo = new Map();
let frameCount = 0;
let Scene: Scene = null;
let milisPerFrame = 0;
let packets: Set<Packet> = new Set();
let rng = new RandomNumberGenerator();

export const getId = (function() {
    let id = 0;
    return function getId() { return id += 1 };
}());

export function randomSelection<T>(collection: Iterable<T>): T {
    let result = null;
    let count = 0;
    for (let curr of collection) {
        if (rng.random() < 1/++count)
            result = curr;
    }
    return result;
}

export function randomLiveSelection<T>(collection: Map<number, Hub>): Hub {
    let target: Hub;
    do {
        target = randomSelection(collection.values());
    } while (target.isDead || !nav.has(target.id) )
    return target;
}

// Data Types
export type RouteInfo = Map<number, Map<number, number | null>>;

let packetPool: Packet[] = []

// Program
export type Scene = [Map<number, Hub>, Pipe[]]

export function generateHub(hubs: Map<number, Hub>, pipes: Pipe[], width: number, height: number): void {
    function addNeighbor(a: Hub, b: Hub): void {
        if (a.neighbors.has(b))
            return;
        
        const p = new Pipe(a, b);
        pipes.push(p);
        a.neighbors.set(b, p);
        b.neighbors.set(a, p);
    }
    
    let x = Math.floor(rng.random() * width);
    let y = Math.floor(rng.random() * height);
    let newHub = new Hub(x, y);
    for (let x of hubs.values()) {
        addNeighbor(x, newHub);
        addNeighbor(newHub, x);
    }
    hubs.set(newHub.id, newHub);
    log(`[GenerateScene]: Added Hub ${newHub.id}`);
}

export function generateScene(numHubs: number, width: number, height: number): Scene {
    const hubs: Map<number, Hub> = new Map();
    const pipes: Pipe[] = [];
    
    for (let i = 0; i < numHubs; i++) {
        generateHub(hubs, pipes, width, height);
    }
    return [hubs, pipes];
}

function randInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(rng.random() * (max - min)) + min;
}

export const intToColor = (function() {
    const colorTable = new Map<number, string>();
    return function intToColor(i: number): string {
        if (colorTable.has(i))
            return colorTable.get(i);
        else {
            // turns out that random rgb values don't *look* random!
            // so instead randomize hue value of hsl color
            const colorString = `hsl(${randInt(0,360)},100%,50%)`;
            colorTable.set(i, colorString);
            return colorString;
        }
    }
})();

function render(ctx: CanvasRenderingContext2D, scene: Scene, height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const [hubs, pipes] = scene;
    
    for (let pipe of pipes) {
        let lineWidth = Math.min(6, (pipe.traffic() - 1) / 24)
        let p1 = pipe.ends[0].position;
        let p2 = pipe.ends[1].position;

        if (lineWidth >= 1/255) {
            if (pipe.ends[0].isDead || pipe.ends[1].isDead)
                ctx.strokeStyle = "red";
            else 
                ctx.strokeStyle = "white";

            ctx.lineWidth = lineWidth;

            let [x1, y1] = p1;
            let [x2, y2] = p2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        for (let packet of pipe.inflight.keys()) {
            function drawPacket(p1: [number, number], p2: [number, number]) {
                let [x1, y1] = p1;
                let dx = (p2[0] - p1[0]) * packet.TProgress;
                let dy = (p2[1] - p1[1]) * packet.TProgress;
                if (packet.isPOD) {
                    const packetSize = 12;
                    const r = packetSize / 2;
                    ctx.fillStyle = "red";
                    ctx.beginPath();
                    ctx.moveTo(x1+ dx, y1 + dy - r);
                    ctx.lineTo(x1 + dx + r, y1 + dy + r);
                    ctx.lineTo(x1 + dx - r, y1 + dy + r);
                    ctx.fill();
                } else {
                    const packetSize = 4;
                    const r = packetSize / 2;
                    ctx.fillStyle = intToColor(packet.target.id);
                    ctx.fillRect((x1 + dx) - r,
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
    for (let h of hubs.values()) {
        if (h.isDead)
            ctx.fillStyle = "red";
        else
            ctx.fillStyle = "white";

        let [x, y] = h.position;
        ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize);
    }

    ctx.fillStyle = "white";
    ctx.fillText(Math.round(1000/milisPerFrame).toString(), 0, 8);
}

function main() {
    let params = new URLSearchParams(document.location.search);
    for (let k in globalConfig) {
        if (params.has(k)) {
            try {
                globalConfig[k] = JSON.parse(params.get(k));
            } catch (e) {
                globalConfig[k] = params.get(k);
            }
        } else if (["nodeCount", "addRemoveNodes", "packetOfDeath"].indexOf(k) !== -1) {
            params.set(k, globalConfig[k].toString());
        }
    }
    history.replaceState(0, document.title, "?"+params.toString());

    const height = window.innerHeight;
    const width = window.innerWidth;

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.height = height;
    canvas.width = width;

    const ctx = canvas.getContext('2d');
    ctx.font = '8px monospace';

    Scene = generateScene(globalConfig.nodeCount, width, height);
    const [hubs, pipes] = Scene;
    let packageOfDeath: Packet = null;

    let noRoute: Set<Hub> = new Set();
    let walkingDead: Map<Hub, number> = new Map();
    
    let started = false;
    let requestRefresh = false;
    let lastFrame = performance.now();
    
    render(ctx, Scene, height, width);

    function renderStep() {
        // generate package of death
        if (frameCount == 0 && globalConfig.packetOfDeath) {
            packageOfDeath = Packet.makePacket(randomSelection(hubs.values()), true);
            packets.add(packageOfDeath);
            randomSelection(hubs.values()).receive(packageOfDeath);
        }

        // remove dead nodes
        let okToKill: Hub[] = [];
        for (let [hub, framesUntilRipe] of walkingDead) {
            if (requestRefresh) {
                if (framesUntilRipe > 0) {
                    walkingDead.set(hub, framesUntilRipe - 1);
                } else {
                    noRoute.add(hub)
                }
            }

            let noInflight = true;
            for (let [, p] of hub.neighbors) {
                if (p.inflight.size > 0) {
                    noInflight = false;
                    break;
                }
            }

            if (noInflight && noRoute.has(hub)) {
                let h = hubs.get(hub.id);
                okToKill.push(hub);
                for (let [n, p] of h.neighbors) {
                    h.neighbors.delete(n);
                    n.neighbors.delete(h);

                    let pos = pipes.indexOf(p);
                    pipes.splice(pos, 1);
                }
            }
        }
        for (let k of okToKill) {
            log(`[Main]: reaped Hub ${k.id}`)
            walkingDead.delete(k);
            hubs.delete(k.id);
            noRoute.delete(k);
        }


        // advance all packets
        for (let p of pipes)
            p.step();

        // add new packages
        for (let h of hubs.values()) {
            if (h.isDead) {
                if (!walkingDead.has(h))
                    walkingDead.set(h, 2);

                continue;
            }

            // test nav to make sure we only route to and from packets which we
            // have routing info on
            if (!nav.has(h.id))
                continue;

            if (rng.random() < globalConfig.packetSpawnChance) {
                let target = randomLiveSelection(hubs);
                let p = Packet.makePacket(target);
                packets.add(p);
                h.receive(p);
            }
        }

        // add and remove nodes
        if (globalConfig.addRemoveNodes) {
            // destroy nodes
            if (packageOfDeath) {
                packageOfDeath.speed = ((hubs.size - walkingDead.size) / globalConfig.nodeCount) ** 2;
            }
            else {
                let nodeDiff = hubs.size - globalConfig.nodeCount + walkingDead.size;
                let factor = 0;
                if (nodeDiff <= 0) {
                    factor = 1;
                } else {
                    factor = (globalConfig.nodeCount - nodeDiff)/ globalConfig.nodeCount;
                }
                factor = Math.max(factor, 0);

                if (Math.floor(rng.random() * factor * globalConfig.addRemoveChance) == 0 && hubs.size > 3) {
                    let hub = randomLiveSelection(hubs);
                    hub.isDead = true;
                    let surrogate = randomLiveSelection(Scene[0]);
                    for (let p of packets)
                        if (p.target == this)
                            p.target = surrogate;
                }
            }

            // add nodes
            let nodeDiff = globalConfig.nodeCount - hubs.size - walkingDead.size;
            let factor = 0;
            if (nodeDiff <= 0) {
                factor = 1;
            } else {
                factor = (globalConfig.nodeCount - nodeDiff / globalConfig.nodeCount);
            }
            factor = Math.max(factor, 0);
            if (Math.floor(rng.random() * factor * globalConfig.addRemoveChance) == 0) {
                generateHub(hubs, pipes, width, height);
            }
        }

        if (requestRefresh) {
            router.postMessage([hubs, null]);
            requestRefresh = false;
        }

        render(ctx, Scene, height, width);
        window.requestAnimationFrame(renderStep);
        frameCount += 1;
        let frameTime = performance.now();
        milisPerFrame = (milisPerFrame * 19 + (frameTime - lastFrame)) / 20;
        lastFrame = frameTime;
    }

    let router = new Router();
    router.onmessage = function(e) {
        nav = e.data;
        requestRefresh = true;
        log("[Router] Got new route info")

        if (!started) {
            started = true;
            renderStep();
        }
    }

    router.postMessage([hubs, globalConfig]);
    
}

main()