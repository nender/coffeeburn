export class MinimumPriorityQueue<T> {
    private valueToNode: Map<T, Node<T>>;
    private roots: Node<T>[];
    private min: Node<T>;

    constructor() {
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
        let node = this.valueToNode.get(value);
        node.key = newPriority;
        let parent = node.parent;
        if (!parent) {
            this.updateMin();
            return;
        } else if (node.key > parent.key) {
            return;
        } else {
            this.cut(node);
        }
    }

    private cut(node: Node<T>) {
        let parent = node.parent;
        let i = parent.children.indexOf(node);
        parent.children.splice(i, 1);
        node.parent = null;
        node.marked = false;
        this.roots.push(node);
        this.updateMin();

        if (!parent.marked) {
            parent.marked = true;
        } else if (parent.parent) {
            this.cut(parent);
        }
    }

    empty(): boolean {
        return this.roots.length == 0;
    }

    popMinimum(): T {
        // delete min
        let oldMin = this.min;
        oldMin.parent = null;
        let i = this.roots.indexOf(oldMin);
        this.roots.splice(i, 1);
        this.min = null;
        this.valueToNode.delete(oldMin.value);

        // merge it's children into root
        for (let c of oldMin.children) {
            this.roots.push(c);
            c.parent = null;
        }

        this.updateMin();

        // consolidate trees so that no two roots have same rank
        let ranks = new Map<number, Node<T>>();
        for (let i = this.roots.length - 1; i >= 0; i--) {
            let node = this.roots[i];
            this.consolidateTrees(node, ranks);
        }

        return oldMin.value;
    }

    private updateMin() {
        // update min
        for (let n of this.roots) {
            if (!this.min || n.key < this.min.key)
                this.min = n;
        }
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
                oldNode.parent = node;

                ranks.delete(originalRank);

                this.consolidateTrees(node, ranks);
            } else {
                let removeIndex = this.roots.indexOf(node);
                this.roots.splice(removeIndex, 1);

                oldNode.children.push(node);
                node.parent = oldNode;

                ranks.delete(originalRank);

                this.consolidateTrees(oldNode, ranks);
            }
        }
    }

    nodeCount(): number {
        function nodeCountInner(node: Node<T>) {
            let sum = 1;
            for (let c of node.children)
                sum += nodeCountInner(c);
            return sum;
        }

        let sum = 0;
        for (let c of this.roots) {
            sum += nodeCountInner(c);
        }

        return sum;
    }
}

class Node<T> {
    key: number;
    value: T;
    children: Node<T>[];
    parent: Node<T>;
    marked: boolean;

    constructor(key: number, value: T) {
        this.key = key;
        this.value = value;
        this.children = [];
        this.marked = false;
        this.parent = null;
    }
}