import { List } from '..';

// This array should not be mutated. Thus a dummy element is placed in
// it. Thus the affix will not be owned and thus not mutated.
export const emptyAffix: any[] = [0];
export const branchingFactor = 32;
export const branchBits = 5;
export const mask = 31;
export let newAffix: any[];



export function cloneNode({ sizes, array }: Node): Node {
    return new Node(
        sizes === undefined ? undefined : copyArray(sizes),
        copyArray(array)
    );
}

export function createPath(depth: number, value: any): any {
    let current = value;
    for (let i = 0; i < depth; ++i) {
        current = new Node(undefined, [current]);
    }
    return current;
}

// We store a bit field in list. From right to left, the first five
// bits are suffix length, the next five are prefix length and the
// rest is depth. The functions below are for working with the bits in
// a sane way.

export const affixBits = 6;
export const affixMask = 0b111111;

export function getSuffixSize(l: List<any>): number {
    return l.bits & affixMask;
}

export function getPrefixSize(l: List<any>): number {
    return (l.bits >> affixBits) & affixMask;
}

export function getDepth(l: List<any>): number {
    return l.bits >> (affixBits * 2);
}

export function setPrefix(size: number, bits: number): number {
    return (size << affixBits) | (bits & ~(affixMask << affixBits));
}

export function setSuffix(size: number, bits: number): number {
    return size | (bits & ~affixMask);
}

export function setDepth(depth: number, bits: number): number {
    return (
        (depth << (affixBits * 2)) | (bits & (affixMask | (affixMask << affixBits)))
    );
}

export function incrementPrefix(bits: number): number {
    return bits + (1 << affixBits);
}

export function incrementSuffix(bits: number): number {
    return bits + 1;
}

export function incrementDepth(bits: number): number {
    return bits + (1 << (affixBits * 2));
}

// export function decrementDepth(bits: number): number {
//   return bits - (1 << (affixBits * 2));
// }

export function createBits(
    depth: number,
    prefixSize: number,
    suffixSize: number
): number {
    return (depth << (affixBits * 2)) | (prefixSize << affixBits) | suffixSize;
}

export function nodeNthDense(node: Node, depth: number, index: number): any {
    let current = node;
    for (; depth >= 0; --depth) {
        current = current.array[(index >> (depth * branchBits)) & mask];
    }
    return current;
}

export function handleOffset(depth: number, offset: number, index: number): number {
    index += offset;
    for (; depth >= 0; --depth) {
        index = index - (offset & (mask << (depth * branchBits)));
        if (((index >> (depth * branchBits)) & mask) !== 0) {
            break;
        }
    }
    return index;
}

export function nodeNth(node: Node, depth: number, index: number): any {
    let path;
    let current = node;
    while (current.sizes !== undefined) {
        path = (index >> (depth * branchBits)) & mask;
        while (current.sizes[path] <= index) {
            path++;
        }
        const traversed = path === 0 ? 0 : current.sizes[path - 1];
        index -= traversed;
        depth--;
        current = current.array[path];
    }
    return nodeNthDense(current, depth, index);
}

/**
 * Traverses down the right edge of the tree and copies k nodes
 * @param oldList
 * @param newList
 * @param k The number of nodes to copy. Will always be at least 1.
 * @param leafSize The number of elements in the leaf that will be inserted.
 */
function copyFirstK(
    oldList: List<any>,
    newList: List<any>,
    k: number,
    leafSize: number
): Node {
    let currentNode = cloneNode(oldList.root!); // copy root
    newList.root = currentNode; // install root

    for (let i = 1; i < k; ++i) {
        const index = currentNode.array.length - 1;
        if (currentNode.sizes !== undefined) {
            currentNode.sizes[index] += leafSize;
        }
        const newNode = cloneNode(currentNode.array[index]);
        // Install the copied node
        currentNode.array[index] = newNode;
        currentNode = newNode;
    }
    if (currentNode.sizes !== undefined) {
        currentNode.sizes.push(arrayLast(currentNode.sizes) + leafSize);
    }
    return currentNode;
}

function appendEmpty(node: Node, depth: number): Node {
    if (depth === 0) {
        return node;
    }
    let current = new Node(undefined, []);
    node.array.push(current);
    for (let i = 1; i < depth; ++i) {
        let newNode = new Node(undefined, []);
        current.array[0] = newNode;
        current = newNode;
    }
    return current;
}

/**
 * Takes a RRB-tree and a node tail. It then appends the node to the
 * tree.
 * @param l The subject for appending. `l` will be mutated. Nodes in
 * the tree will _not_ be mutated.
 * @param node The node that should be appended to the tree.
 */
export function appendNodeToTree<A>(l: List<A>, node: Node): List<A> {
    if (l.root === undefined) {
        // The old list has no content in tree, all content is in affixes
        if (getPrefixSize(l) === 0) {
            l.bits = setPrefix(node.array.length, l.bits);
            l.prefix = reverseArray(node.array);
        } else {
            l.root = node;
        }
        return l;
    }
    const depth = getDepth(l);
    let index = l.length - 1 - getPrefixSize(l);
    let nodesToCopy = 0;
    let nodesVisited = 0;
    let shift = depth * 5;
    let currentNode = l.root;
    if (32 ** (depth + 1) < index) {
        shift = 0; // there is no room
        nodesVisited = depth;
    }
    while (shift > 5) {
        let childIndex: number;
        if (currentNode.sizes === undefined) {
            // does not have size table
            childIndex = (index >> shift) & mask;
            index &= ~(mask << shift); // wipe just used bits
        } else {
            childIndex = currentNode.array.length - 1;
            index -= currentNode.sizes[childIndex - 1];
        }
        nodesVisited++;
        if (childIndex < mask) {
            // we are not going down the far right path, this implies that
            // there is still room in the current node
            nodesToCopy = nodesVisited;
        }
        currentNode = currentNode.array[childIndex];
        if (currentNode === undefined) {
            // This will only happened in a pvec subtree. The index does not
            // exist so we'll have to create a new path from here on.
            nodesToCopy = nodesVisited;
            shift = 5; // Set shift to break out of the while-loop
        }
        shift -= 5;
    }

    if (shift !== 0) {
        nodesVisited++;
        if (currentNode.array.length < branchingFactor) {
            // there is room in the found node
            nodesToCopy = nodesVisited;
        }
    }

    if (nodesToCopy === 0) {
        // there was no room in the found node
        const newPath = nodesVisited === 0 ? node : createPath(nodesVisited, node);
        const newRoot = new Node(undefined, [l.root, newPath]);
        l.root = newRoot;
        l.bits = incrementDepth(l.bits);
    } else {
        const copiedNode = copyFirstK(l, l, nodesToCopy, node.array.length);
        const leaf = appendEmpty(copiedNode, depth - nodesToCopy);
        leaf.array.push(node);
    }
    return l;
}

export function suffixToNode<A>(suffix: A[]): Node {
    // FIXME: should take size and copy
    return new Node(undefined, suffix);
}



export function prefixToNode<A>(prefix: A[]): Node {
    // FIXME: should take size and copy
    return new Node(undefined, prefix.reverse());
}

export function setSizes(node: Node, height: number): Node {
    let sum = 0;
    const sizeTable = [];
    for (let i = 0; i < node.array.length; ++i) {
        sum += sizeOfSubtree(node.array[i], height - 1);
        sizeTable[i] = sum;
    }
    node.sizes = sizeTable;
    return node;
}

/**
 * Returns the number of elements stored in the node.
 */
export function sizeOfSubtree(node: Node, height: number): number {
    if (height !== 0) {
        if (node.sizes !== undefined) {
            return arrayLast(node.sizes);
        } else {
            // the node is leftwise dense so all all but the last child are full
            const lastSize = sizeOfSubtree(arrayLast(node.array), height - 1);
            return ((node.array.length - 1) << (height * branchBits)) + lastSize;
        }
    } else {
        return node.array.length;
    }
}

export type EqualsState = {
    iterator: Iterator<any>;
    equals: boolean;
};

export const equalsState: EqualsState = {
    iterator: undefined as any,
    equals: true
};

export function arrayFirst<A>(array: A[]): A {
    return array[0];
}

export function arrayLast<A>(array: A[]): A {
    return array[array.length - 1];
}

export function updateNode(
    node: Node,
    depth: number,
    index: number,
    offset: number,
    value: any
): Node {
    const curOffset = (offset >> (depth * branchBits)) & mask;
    let path = ((index >> (depth * branchBits)) & mask) - curOffset;
    if (node.sizes !== undefined) {
        while (node.sizes[path] <= index) {
            path++;
        }
        const traversed = path === 0 ? 0 : node.sizes[path - 1];
        index -= traversed;
    }
    let array;
    if (path < 0) {
        // TOOD: Once `prepend` no longer uses `update` this should be removed
        array = arrayPrepend(createPath(depth, value), node.array);
    } else {
        array = copyArray(node.array);
        if (depth === 0) {
            array[path] = value;
        } else {
            array[path] = updateNode(
                array[path],
                depth - 1,
                index,
                path === 0 ? offset : 0,
                value
            );
        }
    }
    return new Node(node.sizes, array);
}

/**
 * Prepends an element to a node
 */
export function nodePrepend(value: any, size: number, node: Node): Node {
    const array = arrayPrepend(value, node.array);
    let sizes = undefined;
    if (node.sizes !== undefined) {
        sizes = new Array(node.sizes.length + 1);
        sizes[0] = size;
        for (let i = 0; i < node.sizes.length; ++i) {
            sizes[i + 1] = node.sizes[i] + size;
        }
    }
    return new Node(sizes, array);
}

function copyIndices(
    source: any[],
    sourceStart: number,
    target: any[],
    targetStart: number,
    length: number
): void {
    for (let i = 0; i < length; ++i) {
        target[targetStart + i] = source[sourceStart + i];
    }
}

export function affixPush<A>(a: A, array: A[], length: number): A[] {
    if (array.length === length) {
        array.push(a);
        return array;
    } else {
        const newArray: A[] = [];
        copyIndices(array, 0, newArray, 0, length);
        newArray.push(a);
        return newArray;
    }
}

export let elementEquals = (a: any, b: any) => {
    return a === b;
};

export function setEquals(equals: (a: any, b: any) => boolean): void {
    elementEquals = equals;
}