// Config
const LOGGING = false;

let config = {
    trafficWeight: "linear",
    distanceWeight: "square",
    idealNodePop: 50,
    packetSpawnChance: 1 / 30,
    addRemoveNodes: false,
    addRemoveChance: 1/100
}

// Globals
const nav: Map<Hub, Map<Hub, Hub>> = new Map();
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
    /** Float in the range 0<=x<1 indicating progress along current Pipe*/
    TProgress: number;
    /** Number indicating the packet's speed along the current Pipe */
    TSpeed: number;
    
    constructor(target: Hub) {
        this.id = getId();
        this.target = target;
        this.TAToB = null;
        this.TProgress = null;
        this.TSpeed = null;
    }
}

class Pipe {
    readonly ends: [Hub, Hub];
    readonly inflight: Set<Packet>;
    private _weight: number;
    /** Note that _length is in units squared */
    private _length: number;

    constructor(a: Hub, b: Hub) {
        this.ends = [a, b];
        this._weight = 1;
        this.inflight = new Set();
        
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this._length = dx**2+dy**2;
    }
    
    incrementWeight(): void {
        this._weight += 1;
    }
    
    decrementWeight() : void {
        // this formula stolen verbatim from chemicalburn,
        this._weight = ((this.weight - 1) * 0.99) + 1;
    }

    get weight(): number {
        let w = this._weight;
        switch (config.trafficWeight) {
            case "none":
                return 1;
            case "linear":
                return w;
            case "sqrt":
                return Math.sqrt(w);
            case "square":
                return w**2;
            case "exp":
                return Math.min(1e6, Math.exp(w / 3));
            case "log":
                return Math.log(w) + 1;
            case "bell":
                let aw = w / 3 - 2;
                return Math.max(0.01, Math.exp(aw - aw**2 / 2) * 25) 
        }
    }

    get length(): number {
        let l = this._length;
        switch (config.distanceWeight) {
            case "linear":
                return Math.sqrt(l);
            case "sqrt":
                return l**0.25 * 5;
            case "square":
                return l / 25;
            case "exp":
                // yes this seems nuts, I'm just copying reference implementation for now
                return Math.min(1e6, Math.exp(Math.sqrt(l) / 10) / 3);
            case "log":
                return Math.max(1, (Math.log(l) / 2 + 1) * 25);
        }
    }
    
    get cost(): number {
        if (this.ends[0].isDead || this.ends[1].isDead)
            return Number.MAX_VALUE;
        else
            return this.length / this.weight;
    }
    
    receive(p: Packet, destination: Hub): void {
        if (!(destination === this.ends[0] || destination === this.ends[1]))
            throw "Requested destination not available";
            
        log(`P${p.id} received by ${this.toString()}`);

        p.TAToB = destination === this.ends[1];
        p.TProgress = 0;
        p.TSpeed = Math.sqrt(this.weight / this.length) * 0.25;
        this.inflight.add(p);
        this.incrementWeight();
    }
    
    step(): void {
        const delivered: Set<Packet> = new Set();
        // loop through all the inflight packets, updating their status and making note
        // of those which are complete;
        for (let packet of this.inflight) {
            // todo: move weighting func to internal of weight property
            const newProgress = packet.TProgress + packet.TSpeed;
            
            if (newProgress < 1)
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
        
        this.decrementWeight();
    }
}

class Hub {
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
        if (p.target === this) {
            log(`P${p.id} delivered to ${this.id}!`);
            return;
       }
            
        if (this.neighbors.size === 0)
            throw "No links";
            
        const nextHop = nav.get(p.target).get(this);
        let target = this.neighbors.get(nextHop);
        
        target.receive(p, nextHop);
    }
}


// Program

type Scene = [Hub[], Pipe[]]

function generateHub(hubs: Hub[], pipes: Pipe[], width, height): void {
    function addNeighbor(a: Hub, b: Hub): void {
        if (a.neighbors.has(b))
            return;
        
        const p = new Pipe(a, b);
        pipes.push(p);
        a.neighbors.set(b, p);
        b.neighbors.set(a, p);
    }
    
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);
    let newHub = new Hub(x, y);
    for (let x of hubs) {
        addNeighbor(x, newHub);
        addNeighbor(newHub, x);
    }
    hubs.push(newHub);
}

function generateScene(numHubs: number, width: number, height: number): Scene {
    const hubs: Hub[] = [];
    const pipes: Pipe[] = [];
    
    for (let i = 0; i < numHubs; i++) {
        generateHub(hubs, pipes, width, height);
    }
    
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
        let lineWidth = Math.min(6, (p.weight - 1) / 24)
        let [x1, y1] = p.ends[0].position;
        let [x2, y2] = p.ends[1].position;

        if (lineWidth >= 1/255) {
            if (p.ends[0].isDead || p.ends[1].isDead)
                ctx.strokeStyle = "red";
            else 
                ctx.strokeStyle = "white";

            ctx.lineWidth = lineWidth;

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
    for (let h of hubs) {
        if (h.isDead)
            ctx.fillStyle = "red";
        else
            ctx.fillStyle = "white";

        let [x, y] = h.position;
        ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize);
    }
}

/** Removes the hub from hubs which has the lowest cost in the lookup table */
// todo: replace this with priority queue
function popMinDist(hubs: Set<Hub>, costLookup: Map<Hub, number>): Hub {
    let minDist = Infinity;
    let hub: Hub = hubs.values().next().value;
        
    for (let v of hubs.keys()) {
        let weight = costLookup.get(v);
        if (weight < minDist) {
            minDist = weight;
            hub = v;
        }
    }
    
    hubs.delete(hub);
    return hub;
}

function dijkstra(graph: Iterable<Hub>, source: Hub): Map<Hub, Hub> {
    
    /** set of all verticies not yet considered by the algorithm */
    const candidateHubs = new Set<Hub>();
    /** Map of Hub -> shortest path so far from source to Hub  */
    const minPathCost = new Map<Hub, number>();
    /** map of hub -> next hop on path to source */
    const prev = new Map<Hub, Hub>();

    for (let v of graph) {
        minPathCost.set(v, Infinity);
        prev.set(v, null);
        candidateHubs.add(v);
    }
    minPathCost.set(source, 0);
    
    while (candidateHubs.size > 0) {
        const closestHub = popMinDist(candidateHubs, minPathCost);
        
        for (let [hub, pipe] of closestHub.neighbors) {
            const currentBestCost = minPathCost.get(closestHub) + pipe.cost;
            const prevBestCost = minPathCost.get(hub);
            if (currentBestCost < prevBestCost) {
                minPathCost.set(hub, currentBestCost);
                prev.set(hub, closestHub);
            }
        }
    }
    
    return prev;
}

function updateNav(hubs: Iterable<Hub>) {
    for (let h of hubs) {
        const subnav = dijkstra(hubs, h);
        nav.set(h, subnav);
    }
}

function main() {
    const height = window.innerHeight;
    const width = window.innerWidth;

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.height = height;
    canvas.width = width;

    const ctx = canvas.getContext('2d');

    const scene = generateScene(config.idealNodePop, width, height);
    const [hubs, pipes] = scene;
    
    render(ctx, scene, height, width);
    updateNav(hubs);

    let renderStep = function() {
        render(ctx, scene, height, width);

        if (frameCount % 10 == 0) {
            updateNav(hubs);
        }

        for (let p of pipes)
            p.step();

        for (let h of hubs) {
            // test nav to make sure we only route to and from packets which we
            // have routing info on
            if (h.isDead || !nav.has(h))
                continue;

            if (Math.random() < config.packetSpawnChance) {
                let target: Hub;
                do {
                    target = randomSelection(hubs);
                } while (target.isDead || !nav.has(target))
                h.receive(new Packet(target));
            }
        }

        if (config.addRemoveNodes) {
            let popDelta = (config.idealNodePop - scene[0].length) / config.idealNodePop;
            let roll = Math.random();
            let addChance = config.addRemoveChance / 2;
            if (roll < addChance + addChance * popDelta) {
                generateHub(scene[0], scene[1], width, height)
            } else if (roll < config.addRemoveChance) {
                randomSelection(hubs).isDead = true;
            }
        }

        window.requestAnimationFrame(renderStep);
        frameCount += 1;
    }
    
    renderStep();
}

main()