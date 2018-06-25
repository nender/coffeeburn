export class MinimumPriorityQueue<T> {
    private marked: Set<Node<T>>;
    private valueToNode: Map<T, Node<T>>;
    private roots: Node<T>[];
    private min: Node<T>;

    constructor() {
        this.marked = new Set();
        this.roots = [];
        this.valueToNode = new Map();
        this.min = null;
    }

    insert(value: T, priority: number) {
        let newNode = new Node(priority, value);
        this.valueToNode.set(value, newNode);
        this.roots.push(newNode);

        if (!this.min || newNode.key < this.min.key)
            this.min = newNode;
    }

    decreaseKey(value: T, newPriority: number) {
        throw "notimplemented";
    }

    empty(): boolean {
        return this.roots.length > 0;
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
            if (!this.min || n.key < this.min.key)
                this.min = n;
        }

        // consolidate trees so that no two roots have same rank
        let ranks = new Map<number, Node<T>>();
        for (let i = this.roots.length - 1; i >= 0; i--) {
            let node = this.roots[i];
            this.consolidateTrees(node, ranks);
        }

        return oldMin.value;
    }

    private consolidateTrees(node: Node<T>, ranks: Map<number, Node<T>>) {
        let originalRank = node.children.length;
        if (!ranks.has(originalRank)) {
            ranks.set(originalRank, node);
            return;
        } else {
            let oldNode = ranks.get(originalRank);
            if (oldNode.key > node.key) {
                let removeIndex = this.roots.indexOf(oldNode);
                this.roots.splice(removeIndex, 1);
                node.children.push(oldNode);
                this.consolidateTrees(node, ranks);
            } else {
                let removeIndex = this.roots.indexOf(node);
                this.roots.splice(removeIndex, 1);
                oldNode.children.push(node);
                this.consolidateTrees(oldNode, ranks);
            }
        }
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