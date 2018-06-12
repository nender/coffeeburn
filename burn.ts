// Globals
const nav: Map<Hub, Map<Hub, Hub>> = new Map();
const LOGGING = false;
let frameCount = 0;

function log(str: string): void {
    if (LOGGING)
        console.log(str);
}

let getId = (function() {
    let id = 0;
    return function getId() { return id += 1 };
}());

function randomSelection<T>(target: T[]): T {
    const index = Math.floor(Math.random() * target.length);
    return target[index];
}

// Data Types

class Packet {
    readonly id: number;
    readonly target: Hub;
    
    /** True if packet is currently travelling from A to B */
    TAToB: boolean;
    /** Float in the range 0<=x<1 indicating progress along current pipe*/
    TProgress: number;
    
    constructor(target: Hub) {
        this.id = getId();
        this.target = target;
        this.TAToB = null;
        this.TProgress = null;
    }
}

class Pipe {
    readonly ends: [Hub, Hub];
    readonly inflight: Set<Packet>;
    weight: number;
    length: number;
    
    constructor(a: Hub, b: Hub) {
        this.ends = [a, b];
        this.weight = 1;
        this.inflight = new Set();
        
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this.length = Math.sqrt(dx*dx+dy*dy);
    }
    
    increment(): void {
        this.weight += 1;
    }
    
    decrement() : void {
        // this formula stolen verbatim from chemicalburn,
        this.weight = ((this.weight - 1) * 0.99) + 1;
    }
    
    receive(p: Packet, destination: Hub): void {
        if (!(destination === this.ends[0] || destination === this.ends[1]))
            throw "Requested destination not available";
            
        log(`P${p.id} received by ${this.toString()}`);

        p.TAToB = destination === this.ends[1];
        p.TProgress = 0;
        this.inflight.add(p);
        this.increment();
    }
    
    step(dt: number): void {
        const delivered: Set<Packet> = new Set();
        // loop through all the inflight packets, updating their status and making note
        // of those which are complete;
        for (let packet of this.inflight) {
            // todo: move weighting func to internal of weight property
            const newProgress = packet.TProgress + (this.weight * dt / this.length) * 25;
            
            if (newProgress <= 1)
                packet.TProgress = newProgress;
            else
                delivered.add(packet);
        }
        
        for (let packet of delivered) {
            this.inflight.delete(packet);
            if (packet.TAToB) {
                log(`${packet.toString()} handed off to ${this.ends[1].toString()}`)
                this.ends[1].receive(packet);
            }
            else
            {
                log(`${packet.toString()} handed off to ${this.ends[0].toString()}`)
                this.ends[0].receive(packet);
            }
        }
        
        this.decrement();
    }
}

class Link {
    readonly target: Hub;
    readonly source: Hub;
    private pipe: Pipe;
    
    constructor(from: Hub, pipe: Pipe) {
        this.pipe = pipe;
        if (from === pipe.ends[0]) {
            this.target = pipe.ends[1];
            this.source = pipe.ends[0];
        } else if (from === pipe.ends[1]) {
            this.target = pipe.ends[0];
            this.source = pipe.ends[1];
        } else {
            throw "From is not one of pipe ends";
        }
    }
    
    get weight(): number {
        return this.pipe.weight;
    }
    
    receive(p: Packet): void {
        this.pipe.receive(p, this.target);
    }
}

class Hub {
    // x, y coordinates in world-space (i.e. in the range [0-1])
    readonly position: [number, number];
    readonly id: number;
    readonly links: Link[];
    
    constructor(x: number, y: number) {
        this.position = [x, y]
        this.id = getId();
        this.links = [];
    }
    
    receive(p: Packet): void {
        if (p.target === this) {
            log(`P${p.id} delivered to ${this.id}!`);
            return;
       }
            
        if (this.links.length === 0)
            throw "No links";
            
        const nextHop = nav.get(p.target).get(this);
        let targetLink: Link = null;
        for (let p of this.links) {
            if (p.target === nextHop) {
                targetLink = p;
                break;
            }
        }
        
        log(`${this.toString()} routing ${p.toString()} on ${targetLink.toString()}`);
        targetLink.receive(p);
    }
}


// Program

type Scene = [Hub[], Pipe[]]
function generateScene(numHubs: number, width: number, height: number): Scene {
    function addNeighbor(a: Hub, b: Hub): void {
        function alreadyLinked(a: Hub, b: Hub): boolean {
            for (let x of a.links) {
                if (x.target === b)
                    return true;
            }
            return false;
        }
        
        if (alreadyLinked(a, b))
            return;
        
        const p = new Pipe(a, b);
        pipes.push(p);
        a.links.push(new Link(a, p));
        b.links.push(new Link(b, p));
    }
    
    const hubs: Hub[] = [];
    const pipes: Pipe[] = [];
    
    for (let i = 0; i < numHubs; i++) {
        let x = Math.random() * width;
        let y = Math.random() * height;
        hubs.push(new Hub(x,y));
    }
    
    for (let x of hubs)
        for (let y of hubs)
            addNeighbor(x, y);
    
    return [hubs, pipes];
}

function randInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

let intToColor = (function() {
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
    
    for (let p of pipes) {
        ctx.strokeStyle = "dimgrey";
            
        let [x1, y1] = p.ends[0].position;
        let [x2, y2] = p.ends[1].position;
        
       // todo: change this to proportional weighting rather than
       // hard cutoff
       if (p.weight >= 3) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
       }

        const packetSize = 4;
        for (let packet of p.inflight.keys()) {
            ctx.fillStyle = intToColor(packet.target.id);
            const aToB = packet.TAToB;
            const progress = packet.TProgress;
            if (aToB) {
                let dx = (x2 - x1) * progress;
                let dy = (y2 - y1) * progress;
                ctx.fillRect((x1+dx) - packetSize/2,
                    (y1+dy) - packetSize/2,
                    packetSize, packetSize);
            } else {
                let dx = (x1 - x2) * progress;
                let dy = (y1 - y2) * progress;
                ctx.fillRect((x2+dx) - packetSize/2,
                    (y2+dy) - packetSize/2,
                    packetSize, packetSize);
            }
        }
    }
    
    const hubsize = 7;
    ctx.fillStyle = "white";
    for (let h of hubs) {
        let [x, y] = h.position;
        ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize);
    }
}

function dijkstra(graph: Hub[], source: Hub): Map<Hub, Hub> {
    function popMinDistFromQ(): Hub {
        let minDist = Infinity;
        let hub: Hub = Q.values().next().value;
            
        for (let v of Q.keys()) {
            let weight = dist.get(v);
            if (weight < minDist) {
                minDist = weight;
                hub = v;
            }
        }
        
        Q.delete(hub);
        return hub;
    }
    
    // set of all verticies not yet considered by the algorithm
    const Q = new Set<Hub>();
    // map of hub -> shortest path from source
    const dist = new Map<Hub, number>();
    // map of hub -> next hop on path to source
    const prev = new Map<Hub, Hub>();
    for (let v of graph) {
        dist.set(v, Infinity);
        prev.set(v, null);
        Q.add(v);
    }
    dist.set(source, 0);
    
    while (Q.size > 0) {
        // destructively remove node with minimum distance from Q
        const u = popMinDistFromQ();
        
        for (let pipe of u.links) {
            const v = pipe.target;
            const cost = dist.get(u) + 1 / pipe.weight;
            const prevCost = dist.get(v);
            if (cost < prevCost) {
                dist.set(v, cost);
                prev.set(v, u);
            }
        }
    }
    
    return prev;
}

function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    let height, width;

    height = window.innerHeight;
    canvas.height = height;

    width = window.innerWidth;
    canvas.width = width;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const scene = generateScene(25, width, height);
    const [hubs, pipes] = scene;
    
    render(ctx, scene, height, width);
    
    for (let h of hubs) {
        const subnav = dijkstra(hubs, h);
        nav.set(h, subnav);
    }
    
    for (let i = 0; i < 100; i++) {
        const target = randomSelection(hubs);
        randomSelection(hubs).receive(new Packet(target));
    }
    
    let renderStep = function() {
        render(ctx, scene, height, width);
        if (frameCount % 10 == 0) {
            for (let h of hubs) {
                const subnav = dijkstra(hubs, h);
                nav.set(h, subnav);
            }
        }
        for (let p of pipes)
            p.step(1/60);
        randomSelection(hubs).receive(new Packet(randomSelection(hubs)));
        randomSelection(hubs).receive(new Packet(randomSelection(hubs)));
        randomSelection(hubs).receive(new Packet(randomSelection(hubs)));
        window.requestAnimationFrame(renderStep);
        frameCount += 1;
    }
    
    renderStep();
}

main()