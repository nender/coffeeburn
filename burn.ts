// ad-hoc config
let LOGGING = false;

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

// global navitaion data object. (I know, I know)
const nav: Map<Hub, Map<Hub, Hub>> = new Map();

// Data Types

class Packet {
    readonly id: number;
    readonly target: Hub;
    
    constructor(target: Hub) {
        this.id = getId();
        this.target = target;
    }
}

class Pipe {
    readonly target: Hub;
    readonly inflight: Map<Packet, number>;
    readonly weight: number;
    
    constructor(a: Hub, b: Hub) {
        this.target = b;
        
        this.inflight = new Map<Packet, number>();
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this.weight = Math.sqrt(dx*dx+dy*dy);
    }
    
    get speed(): number {
        return 1/this.weight;
    }
    
    receive(p: Packet): void {
        log(`P${p.id} received by ${this.toString()}`);
            this.inflight.set(p, 0);
    }
    
    step(dt: number): void {
        const delivered : Packet[] = [];
        
        // loop through all the inflight packets, updating their status and making note
        // of those which are complete;
        for (let packet of this.inflight.keys()) {
            const oldProg = this.inflight.get(packet);
            const newProg = oldProg + this.speed*dt;
            
            if (newProg <= 1)
                this.inflight.set(packet, newProg);
            else
                delivered.push(packet);
        }
        
        for (let packet of delivered) {
            log(`${packet.toString()} handed off to ${this.target.toString()}`)
            this.inflight.delete(packet);
            this.target.receive(packet);
        }
    }
}

class Hub {
    readonly position: [number, number];
    readonly id: number;
    readonly pipes: Pipe[];
    
    constructor(x: number, y: number) {
        this.position = [x, y]
        this.id = getId();
        this.pipes = [];
    }
    
    addNeighbor(other: Hub): void {
        function alreadyLinked(a: Hub, b: Hub): boolean {
            for (let x of a.pipes) {
                if (x.target === b)
                    return true;
            }
            return false;
        }
        
        if (alreadyLinked(this, other))
            return;
        
        const p = new Pipe(this, other);
        this.pipes.push(p);
        
        const op = new Pipe(other, this);
        other.pipes.push(op);
    }
    
    receive(p: Packet): void {
        if (p.target === this) {
            log(`P${p.id} delivered to ${this.id}!`);
            return;
       }
            
        if (this.pipes.length === 0)
            throw "No pipes";
            
        const nextHop = nav.get(p.target).get(this);
        let targetPipe: Pipe = null;
        for (let p of this.pipes) {
            if (p.target === nextHop)
            targetPipe = p;
        }
        
        log(`${this.toString()} routing ${p.toString()} on ${targetPipe.toString()}`);
        targetPipe.receive(p);
    }
    
    step(dt: number): void {
        for (let p of this.pipes)
            p.step(dt);
    }
}


// Program

function generateScene(numHubs: number): Hub[] {
    const hubs: Hub[] = [];
    
    for (let i = 0; i < numHubs; i++) {
        let x = Math.random();
        let y = Math.random();
        hubs.push(new Hub(x,y));
    }
    
    for (let x of hubs) {
        for (let y of hubs) {
            x.addNeighbor(y);
        }
    }
    
    return hubs;
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

function render(ctx: CanvasRenderingContext2D, hubs: Hub[], height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    for (let h of hubs) {
        for (let p of h.pipes) {
            ctx.strokeStyle = "dimgrey";
                
            let [x1, y1] = h.position;
            let [x2, y2] = p.target.position;
            
            const packetSize = 4;
            for (let packet of p.inflight.keys()) {
                ctx.fillStyle = intToColor(packet.target.id);
                const progress = p.inflight.get(packet);
                let dx = (x2 - x1) * progress;
                let dy = (y2 - y1) * progress;
                ctx.fillRect((x1+dx)*width - packetSize/2,
                    (y1+dy)*height - packetSize/2,
                    packetSize, packetSize);
            }
        }
    }
    
    const hubsize = 7;
    for (let h of hubs) {
        ctx.fillStyle = intToColor(h.id);
        let [x, y] = h.position;
        ctx.fillRect(x*width - (hubsize/2), y*height - (hubsize/2), hubsize, hubsize);
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
        
        for (let pipe of u.pipes) {
            const v = pipe.target;
            const cost = dist.get(u) + pipe.weight;
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
    
    function resizeHandler() {
        height = Math.min(window.innerHeight, window.innerWidth);
        width = height;
        canvas.height = height;
        canvas.width = width;
    }
    resizeHandler();
    
    window.onresize = resizeHandler;
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const hubs = generateScene(100);
    render(ctx, hubs, height, width);
    
    for (let h of hubs) {
        const subnav = dijkstra(hubs, h);
        nav.set(h, subnav);
    }
    
    for (let i = 0; i < 100; i++) {
        const target = randomSelection(hubs);
        randomSelection(hubs).receive(new Packet(target));
    }
    
    let renderStep = function() {
        render(ctx, hubs, height, width);
        for (let p of hubs)
            p.step(0.005);
        randomSelection(hubs).receive(new Packet(randomSelection(hubs)));
        randomSelection(hubs).receive(new Packet(randomSelection(hubs)));
        window.requestAnimationFrame(renderStep);
    }
    
    renderStep();
}

main()