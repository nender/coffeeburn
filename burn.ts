
let getId = function() {
    let id = 0;
    return function getId() {
        return id++;
    }
}();

class Packet {
    readonly id: number;
    readonly destId: number;
    
    constructor(destId: number) {
        this.id = getId();
        this.destId = destId;
    }
}

class Pipe {
    readonly ends: [Hub, Hub];
    readonly inflight: IMap<FlightState>;
    private readonly speed: number;
    
    constructor(a: Hub, b: Hub) {
        this.ends = [a, b];
        this.inflight = {}
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        let distance = Math.sqrt(dx*dx+dy*dy);
        this.speed = 1/distance;
    }
    
    receive(p: Packet, senderId: number): void {
        if (senderId == this.ends[0].id)
            this.inflight[p.id] = new FlightState(p, FlightDirection.AB);
        else if (senderId == this.ends[1].id)
            this.inflight[p.id] = new FlightState(p, FlightDirection.BA);
        else
            throw "Bad id";
    }
    
    step(dt: number): void {
        let delivered: FlightState[] = [];
        
        for (let key in this.inflight) {
            let status = this.inflight[key];
            status.progress += this.speed*dt;
            
            if (status.progress > 1.0)
                delivered.push(status);
        }
        
        for (let status of delivered) {
            delete this.inflight[status.packet.id];
            
            if (status.direction === FlightDirection.AB)
                this.ends[1].receive(status.packet);
            else
                this.ends[0].receive(status.packet);
        }
    }
}

enum FlightDirection {
    AB,
    BA
}

class FlightState {
    readonly packet: Packet;
    readonly direction: FlightDirection;
    progress: number;
    
    constructor(p: Packet, direction: FlightDirection) {
        this.packet = p;
        this.direction = direction;
        this.progress = 0;
    }
}

interface IMap<T> {
    [K: string]: T;
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
    
    receive(p: Packet): void {
        if (p.destId === this.id) {
            console.log(`P${p.id} delivered to ${this.id}!`);
            return;
        }
            
        if (this.pipes.length === 0)
            throw "No pipes";
            
        let rawRandom = Math.random();
        let randIndex = Math.floor(rawRandom*this.pipes.length);
        let targetPipe = this.pipes[randIndex];
        targetPipe.receive(p, this.id);
    }
}

function generateScene(): [Hub[], Pipe[]] {
    let hubs: Hub[] = [];
    for (let i = 0; i < 20; i++) {
        let x = Math.random();
        let y = Math.random();
        hubs.push(new Hub(x,y));
    }
    
    let pipes: Pipe[] = [];
    for (let self of hubs) {
        for (let other of hubs) {
            if (self === other)
                continue;
                
            let bail = false;
            
            for (let existing of self.pipes) {
                if (existing.ends[0].id === other.id || existing.ends[1].id === other.id)
                    bail = true;
            }
            
            if (!bail) {
                let newPipe = new Pipe(self, other);
                pipes.push(newPipe);
                self.pipes.push(newPipe);
                other.pipes.push(newPipe);
            }
        }
    }   
    
    return [hubs, pipes];
}

function render(ctx: CanvasRenderingContext2D, pipes: Pipe[], hubs: Hub[], height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    for (let p of pipes) {
        ctx.strokeStyle = "grey";
            
        let [x1, y1] = p.ends[0].position;
        let [x2, y2] = p.ends[1].position;
        ctx.beginPath();
        ctx.moveTo(x1*width, y1*height);
        ctx.lineTo(x2*width, y2*height);
        ctx.stroke();
        
        const packetSize = 5;
        ctx.fillStyle = "red";
        for (let pkey in p.inflight) {
            let pinfo = p.inflight[pkey];
            if (pinfo.direction == FlightDirection.AB) {
                let dx = (x2 - x1) * pinfo.progress;
                let dy = (y2 - y1) * pinfo.progress;
                ctx.fillRect((x1+dx)*width - packetSize/2,
                    (y1+dy)*height - packetSize/2,
                    packetSize, packetSize);
            } else {
                let dx = (x1 - x2) * pinfo.progress;
                let dy = (y1 - y2) * pinfo.progress;
                
                ctx.fillRect((x2+dx)*width - packetSize/2,
                    (y2+dy)*height - packetSize/2,
                    packetSize, packetSize);
            }
        }
    }
    
    const hubsize = 5;
    ctx.fillStyle = "green";
    for (let h of hubs) {
        let [x, y] = h.position;
        ctx.fillRect(x*width - (hubsize/2), y*height - (hubsize/2), hubsize, hubsize);
    }
}

function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    
    const height = canvas.height;
    const width = canvas.width;
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const [hubs, pipes] = generateScene();
    
    const targetId = hubs[0].id;
    for (let i = 0; i < 200; i++) {
        hubs[2].receive(new Packet(targetId));
    }
    
    let renderStep = function() {
        render(ctx, pipes, hubs, height, width);
        for (let p of pipes)
            p.step(0.005);
        window.requestAnimationFrame(renderStep);
    }
    
    renderStep();
}

main()