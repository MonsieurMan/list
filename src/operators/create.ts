import { List, Node } from '..';
import { append } from './update';
import { emptyAffix, cloneNode } from './utils';

export function list<A>(...elements: A[]): List<A> {
    let l = empty();
    for (const element of elements) {
        l = append(element, l);
    }
    return l;
}

export function range(start: number, end: number): List<number> {
    let list = empty();
    for (let i = start; i < end; ++i) {
        list = append(i, list);
    }
    return list;
}

export function fromArray<A>(array: A[]): List<A> {
    let l = empty();
    for (let i = 0; i < array.length; ++i) {
        l = append(array[i], l);
    }
    return l;
}

export function fromIterable<A>(iterable: IterableIterator<A>): List<A> {
    let l = empty();
    let iterator = iterable[Symbol.iterator]();
    let cur;
    // tslint:disable-next-line:no-conditional-assignment
    while ((cur = iterator.next()).done === false) {
        l = append(cur.value, l);
    }
    return l;
}

export function of<A>(a: A): List<A> {
    return list(a);
}

export function pair<A>(first: A, second: A): List<A> {
    return new List(2, 0, 2, undefined, [first, second], emptyAffix);
}

export function empty(): List<any> {
    return new List(0, 0, 0, undefined, emptyAffix, emptyAffix);
}

export function repeat<A>(value: A, times: number): List<A> {
    let l = empty();
    while (--times >= 0) {
        l = append(value, l);
    }
    return l;
}

export function cloneList<A>(l: List<A>): List<A> {
    return new List(l.bits, l.offset, l.length, l.root, l.suffix, l.prefix);
}

/**
 * Traverses down the left edge of the tree and copies k nodes.
 * Returns the last copied node.
 * @param l
 * @param k The number of nodes to copy. Will always be at least 1.
 * @param leafSize The number of elements in the leaf that will be
 * inserted.
 */
export function copyLeft(l: List<any>, k: number, leafSize: number): Node {
    let currentNode = cloneNode(l.root!); // copy root
    l.root = currentNode; // install copy of root

    for (let i = 1; i < k; ++i) {
        const index = 0; // go left
        if (currentNode.sizes !== undefined) {
            for (let i = 0; i < currentNode.sizes.length; ++i) {
                currentNode.sizes[i] += leafSize;
            }
        }
        const newNode = cloneNode(currentNode.array[index]);
        // Install the copied node
        currentNode.array[index] = newNode;
        currentNode = newNode;
    }
    return currentNode;
}