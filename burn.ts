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

let intToColor = (function() {
    const colorTable = new Map<number, string>();
    const r100 = () => Math.floor(Math.random() * 100);
    return function intToColor(i: number): string {
        if (colorTable.has(i))
            return colorTable.get(i);
        else {
            const colorString = `rgb(${r100()}%,${r100()}%,${r100()}%)`;
            colorTable.set(i, colorString);
            return colorString;
        }
    }
})();


// Data Types

class Packet {
    readonly id: number;
    readonly destId: number;
    
    constructor(destId: number) {
        this.id = getId();
        this.destId = destId;
    }
}

class Pipe {
    readonly target: Hub;
    readonly inflight: Map<Packet, number>;
    readonly weight: number;
    private readonly speed: number;
    
    constructor(a: Hub, b: Hub) {
        this.target = b;
        
        this.inflight = new Map<Packet, number>();
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this.weight = Math.sqrt(dx*dx+dy*dy);
        
        this.speed = 1/this.weight;
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
        this.pipes = [];
        this.id = getId();
    }
    
    addNeighbor(other: Hub): void {
        const p = new Pipe(this, other);
        this.pipes.push(p);
        
        const op = new Pipe(other, this);
        other.pipes.push(op);
    }
    
    receive(p: Packet): void {
        if (p.destId === this.id) {
            log(`P${p.id} delivered to ${this.id}!`);
            return;
       }
            
        if (this.pipes.length === 0)
            throw "No pipes";
            
        let targetPipe = randomSelection(this.pipes);
        log(`${this.toString()} routing ${p.toString()} on ${targetPipe.toString()}`);
        targetPipe.receive(p);
    }
    
    step(dt: number): void {
        for (let p of this.pipes)
            p.step(dt);
    }
}


// Program

function generateScene(): Hub[] {
    const hubs: Hub[] = [];
    
    for (let i = 0; i < 20; i++) {
        let x = Math.random();
        let y = Math.random();
        hubs.push(new Hub(x,y));
    }
    
    const pipes: Pipe[] = [];
    const startHub = randomSelection(hubs);
    const disovered = new Set<Hub>();
    function dfs(h: Hub) {
        disovered.add(h);
        for (let w of hubs) {
            if (w !== h && !disovered.has(w)) {
                h.addNeighbor(w);
                dfs(w);
            }
        }
    }
    dfs(startHub);
    
    const bonusPipes = hubs.length;
    for (let i = 0; i < bonusPipes; i++) {
        let a: Hub, b: Hub;
        do {
            a = randomSelection(hubs);
            b = randomSelection(hubs);
        } while (a === b)
        a.addNeighbor(b);
    }
    
    return hubs;
}

function render(ctx: CanvasRenderingContext2D, hubs: Hub[], height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    for (let h of hubs) {
        for (let p of h.pipes) {
            ctx.strokeStyle = "dimgrey";
                
            let [x1, y1] = h.position;
            let [x2, y2] = p.target.position;
            ctx.beginPath();
            ctx.moveTo(x1*width, y1*height);
            ctx.lineTo(x2*width, y2*height);
            ctx.stroke();
            
            const packetSize = 4;
            for (let packet of p.inflight.keys()) {
                ctx.fillStyle = intToColor(packet.destId);
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

/* 
function dijkstra(graph: Hub[], source: Hub): [Map<Hub, number>, Map<Hub, Hub>] {
    function minDistFromQ(): Hub {
        let minDist = Infinity;
        let hub: Hub = null;
        
        for (let v of Q.keys()) {
            let weight = dist.get(v);
            if (weight < minDist) {
                minDist = weight;
                hub = v;
            }
        }
        
        return hub;
    }
    
    const Q = new Set<Hub>();
    const dist = new Map<Hub, number>();
    const prev = new Map<Hub, Hub>();
    
    for (let v of graph) {
        dist.set(v, Infinity);
        prev.set(v, null);
        Q.add(v);
    }
    
    dist.set(source, 0);
    
    while (Q.size > 0) {
        const u = minDistFromQ();
        Q.delete(u);
        
        for (let pr of u.neighbors) {
            const v = pr.hub;
            const alt = dist.get(v) + pr.pipe.weight;
            if (alt < dist.get(v)) {
                dist.set(v, alt);
                prev.set(v, u);
            }
        }
    }
    
    return [dist, prev];
}
*/

function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    
    const height = canvas.height;
    const width = canvas.width;
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const hubs = generateScene();
    
    for (let i = 0; i < 100; i++) {
        const targetId = randomSelection(hubs).id;
        randomSelection(hubs).receive(new Packet(targetId));
    }
    
    let renderStep = function() {
        render(ctx, hubs, height, width);
        for (let p of hubs)
            p.step(0.005);
        window.requestAnimationFrame(renderStep);
    }
    
    renderStep();
}

main()