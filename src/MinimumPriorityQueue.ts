export class MinimumPriorityQueue<T> {
    private marked: Set<Node<T>>;
    private valueToNode: Map<T, Node<T>>;
    private roots: Node<T>[];
    private min: Node<T>;

    constructor() {
        this.marked = new Set();
    }

    insert(value: T, priority: number) {
        let newNode = new Node(priority, value);
        this.valueToNode.set(value, newNode);
        this.roots.push(newNode);

        if (newNode.key < this.min.key)
            this.min = newNode;
    }

    decreaseKey(value: T, newPriority: number) {
        throw "notimplemented";
    }

    empty(): boolean {
        throw "notimplemented";
    }

    popMinimum(): T {
        // delete min
        let oldMin = this.min;
        let i = this.roots.indexOf(oldMin);
        this.roots.splice(i, 1);
        this.min = null;
        this.valueToNode.delete(oldMin.value);

        // merge it's children into root
        for (let c of oldMin.children)
            this.roots.push(c);

        // update min
        for (let n of this.roots) {
            if (this.min === null || n.key < this.min.key)
                this.min = n;
        }

        // consolidate trees so that no two roots have same rank
        let ranks = new Map<number, Node<T>>();
        for (let i = this.roots.length - 1; i >= 0; i--) {
            let currentNode = this.roots[i];
            let originalRank = currentNode.children.length;
            if (ranks.has(originalRank)) {
                let oldNode = ranks.get(originalRank);
                let oldIndex = this.roots.indexOf(oldNode);
                this.roots.splice(oldIndex, 1);
                currentNode.children.push(oldNode);
            } else {
                ranks.set(originalRank, currentNode);
            }
        }

        return oldMin.value;
    }
}

class Node<T> {
    key: number;
    value: T;
    children: Node<T>[];

    constructor(key: number, value: T) {
        this.key = key;
        this.value = value;
        this.children = [];
    }
}