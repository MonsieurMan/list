import { List, Node, Sizes } from "..";
import { empty, pair, copyLeft, cloneList } from "./create";
import { nth, foldl, foldlCb } from "./folds";
import { arrayPrepend, incrementDepth, arrayLast, getDepth, setSuffix, getSuffixSize, branchingFactor, createPath, nodePrepend, branchBits, mask, copyArray, getPrefixSize, incrementPrefix, affixPush, setPrefix, incrementSuffix, suffixToNode, emptyAffix, setDepth, prefixToNode, setSizes, createBits, updateNode, reverseArray, appendNodeToTree, arrayPush, newAffix } from "./utils";

function prependSizes(n: number, sizes: Sizes): Sizes {
    if (sizes === undefined) {
        return undefined;
    } else {
        const newSizes = new Array(sizes.length + 1);
        newSizes[0] = n;
        for (let i = 0; i < sizes.length; ++i) {
            newSizes[i + 1] = sizes[i] + n;
        }
        return newSizes;
    }
}

/**
 * Prepends a node to a tree. Either by shifting the nodes in the root
 * left or by increasing the height
 */
function prependTopTree<A>(l: List<A>, depth: number, node: Node) {
    let newOffset;
    if (l.root!.array.length < branchingFactor) {
        // There is space in the root
        newOffset = 32 ** depth - 32;
        l.root = new Node(
            prependSizes(32, l.root!.sizes),
            arrayPrepend(createPath(depth - 1, node), l.root!.array)
        );
    } else {
        // We need to create a new root
        l.bits = incrementDepth(l.bits);
        const sizes =
            l.root!.sizes === undefined
                ? undefined
                : [32, arrayLast(l.root!.sizes!) + 32];
        newOffset = depth === 0 ? 0 : 32 ** (depth + 1) - 32;
        l.root = new Node(sizes, [createPath(depth, node), l.root]);
    }
    return newOffset;
}

/**
 * Takes a RRB-tree and a node tail. It then prepends the node to the
 * tree.
 * @param l The subject for prepending. `l` will be mutated. Nodes in
 * the tree will _not_ be mutated.
 * @param node The node that should be prepended to the tree.
 */
function prependNodeToTree<A>(l: List<A>, array: A[]): List<A> {
    if (l.root === undefined) {
        if (getSuffixSize(l) === 0) {
            // ensure invariant 1
            l.bits = setSuffix(array.length, l.bits);
            l.suffix = array;
        } else {
            l.root = new Node(undefined, array);
        }
        return l;
    } else {
        const node = new Node(undefined, array);
        const depth = getDepth(l);
        let newOffset = 0;
        if (l.root.sizes === undefined) {
            if (l.offset !== 0) {
                newOffset = l.offset - branchingFactor;
                l.root = prependDense(
                    l.root,
                    depth - 1,
                    (l.offset - 1) >> 5,
                    l.offset >> 5,
                    node
                );
            } else {
                // in this case we can be sure that the is not room in the tree
                // for the new node
                newOffset = prependTopTree(l, depth, node);
            }
        } else {
            // represents how many nodes _with size-tables_ that we should copy.
            let copyableCount = 0;
            // go down while there is size tables
            let nodesTraversed = 0;
            let currentNode = l.root;
            while (currentNode.sizes !== undefined && nodesTraversed < depth) {
                ++nodesTraversed;
                if (currentNode.array.length < 32) {
                    // there is room if offset is > 0 or if the first node does not
                    // contain as many nodes as it possibly can
                    copyableCount = nodesTraversed;
                }
                currentNode = currentNode.array[0];
            }
            if (l.offset !== 0) {
                const copiedNode = copyLeft(l, nodesTraversed, 32);
                for (let i = 0; i < copiedNode.sizes!.length; ++i) {
                    copiedNode.sizes![i] += branchingFactor;
                }
                copiedNode.array[0] = prependDense(
                    copiedNode.array[0],
                    depth - nodesTraversed - 1,
                    (l.offset - 1) >> 5,
                    l.offset >> 5,
                    node
                );
                l.offset = l.offset - branchingFactor;
                return l;
            } else {
                if (copyableCount === 0) {
                    l.offset = prependTopTree(l, depth, node);
                } else {
                    let parent: Node | undefined;
                    let prependableNode: Node;
                    // Copy the part of the path with size tables
                    if (copyableCount > 1) {
                        parent = copyLeft(l, copyableCount - 1, 32);
                        prependableNode = parent.array[0];
                    } else {
                        parent = undefined;
                        prependableNode = l.root!;
                    }
                    const path = createPath(depth - copyableCount, node);
                    // add offset
                    l.offset = 32 ** (depth - copyableCount + 1) - 32;
                    const prepended = nodePrepend(path, 32, prependableNode);
                    if (parent === undefined) {
                        l.root = prepended;
                    } else {
                        parent.array[0] = prepended;
                    }
                }
                return l;
            }
        }
        l.offset = newOffset;
        return l;
    }
}

function prependDense(
    node: Node,
    depth: number,
    index: number,
    offset: number,
    value: any
): Node {
    const curOffset = (offset >> (depth * branchBits)) & mask;
    let path = ((index >> (depth * branchBits)) & mask) - curOffset;
    let array;
    if (path < 0) {
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

export function prepend<A>(value: A, l: List<A>): List<A> {
    const prefixSize = getPrefixSize(l);
    if (prefixSize < 32) {
        return new List<A>(
            incrementPrefix(l.bits),
            l.offset,
            l.length + 1,
            l.root,
            l.suffix,
            affixPush(value, l.prefix, prefixSize)
        );
    } else {
        const newList = cloneList(l);
        prependNodeToTree(newList, reverseArray(l.prefix));
        const newPrefix = [value];
        newList.prefix = newPrefix;
        newList.length++;
        newList.bits = setPrefix(1, newList.bits);
        return newList;
    }
}

export function partition<A>(
    predicate: (a: A) => boolean,
    l: List<A>
): List<List<A>> {
    const { fst, snd } = foldl(
        (obj, a) => (
            predicate(a)
                ? (obj.fst = append(a, obj.fst))
                : (obj.snd = append(a, obj.snd)),
            obj
        ),
        { fst: empty(), snd: empty() },
        l
    );
    return pair(fst, snd);
}

export function join(separator: string, l: List<string>): string {
    return foldl((a, b) => (a.length === 0 ? b : a + separator + b), "", l);
}

export function forEach<A>(callback: (a: A) => void, l: List<A>): void {
    foldl((_, element) => callback(element), undefined as void, l);
}

export function append<A>(value: A, l: List<A>): List<A> {
    const suffixSize = getSuffixSize(l);
    if (suffixSize < 32) {
        return new List(
            incrementSuffix(l.bits),
            l.offset,
            l.length + 1,
            l.root,
            affixPush(value, l.suffix, suffixSize),
            l.prefix
        );
    }
    const newSuffix = [value];
    const suffixNode = suffixToNode(l.suffix);
    const newList = cloneList(l);
    appendNodeToTree(newList, suffixNode);
    newList.suffix = newSuffix;
    newList.length++;
    newList.bits = setSuffix(1, newList.bits);
    return newList;
}

export function flatten<A>(nested: List<List<A>>): List<A> {
    return foldl<List<A>, List<A>>(concat, empty(), nested);
}

export function pluck<A, K extends keyof A>(key: K, l: List<A>): List<A[K]> {
    return map(a => a[key], l);
}

function mapArray<A, B>(f: (a: A) => B, array: A[]): B[] {
    const result = new Array(array.length);
    for (let i = 0; i < array.length; ++i) {
      result[i] = f(array[i]);
    }
    return result;
  }
  
  function mapNode<A, B>(f: (a: A) => B, node: Node, depth: number): Node {
    if (depth !== 0) {
      const { array } = node;
      const result = new Array(array.length);
      for (let i = 0; i < array.length; ++i) {
        result[i] = mapNode(f, array[i], depth - 1);
      }
      return new Node(node.sizes, result);
    } else {
      return new Node(undefined, mapArray(f, node.array));
    }
  }
  
  function mapAffix<A, B>(f: (a: A) => B, suffix: A[], length: number): B[] {
    const newSuffix = new Array(length);
    for (let i = 0; i < length; ++i) {
      newSuffix[i] = f(suffix[i]);
    }
    return newSuffix;
  }

export function map<A, B>(f: (a: A) => B, l: List<A>): List<B> {
    return new List(
        l.bits,
        l.offset,
        l.length,
        l.root === undefined ? undefined : mapNode(f, l.root, getDepth(l)),
        mapAffix(f, l.suffix, getSuffixSize(l)),
        mapAffix(f, l.prefix, getPrefixSize(l))
    );
}

export function toArray<A>(l: List<A>): A[] {
    return foldl<A, A[]>(arrayPush, [], l);
}

function sliceLeft(
    tree: Node,
    depth: number,
    index: number,
    offset: number
): Node | undefined {
    const curOffset = (offset >> (depth * branchBits)) & mask;
    let path = ((index >> (depth * branchBits)) & mask) - curOffset;
    if (depth === 0) {
        newAffix = tree.array.slice(path).reverse();
        // this leaf node is moved up as a suffix so there is nothing here
        // after slicing
        return undefined;
    } else {
        // slice the child
        const child = sliceLeft(
            tree.array[path],
            depth - 1,
            index,
            path === 0 ? offset : 0
        );
        if (child === undefined) {
            // there is nothing in the child after slicing so we don't include it
            ++path;
            if (path === tree.array.length) {
                return undefined;
            }
        }
        let array = tree.array.slice(path);
        if (child !== undefined) {
            array[0] = child;
        }
        return new Node(tree.sizes, array); // FIXME: handle the size table
    }
}

function sliceRight(
    tree: Node,
    depth: number,
    index: number,
    offset: number
): Node | undefined {
    const curOffset = (offset >> (depth * branchBits)) & mask;
    let path = ((index >> (depth * branchBits)) & mask) - curOffset;
    if (depth === 0) {
        newAffix = tree.array.slice(0, path + 1);
        // this leaf node is moved up as a suffix so there is nothing here
        // after slicing
        return undefined;
    } else {
        // slice the child, note that we subtract 1 then the radix lookup
        // algorithm can find the last element that we want to include
        // and sliceRight will do a slice that is inclusive on the index.
        const child = sliceRight(
            tree.array[path],
            depth - 1,
            index,
            path === 0 ? offset : 0
        );
        if (child === undefined) {
            // there is nothing in the child after slicing so we don't include it
            --path;
            if (path === -1) {
                return undefined;
            }
        }
        // note that we add 1 to the path since we want the slice to be
        // inclusive on the end index. Only at the leaf level do we want
        // to do an exclusive slice.
        let array = tree.array.slice(0, path + 1);
        if (child !== undefined) {
            array[array.length - 1] = child;
        }
        return new Node(tree.sizes, array); // FIXME: handle the size table
    }
}

function sliceTreeList<A>(
    from: number,
    to: number,
    tree: Node,
    depth: number,
    offset: number,
    l: List<A>
): List<A> {
    const curOffset = (offset >> (depth * branchBits)) & mask;
    let pathLeft = ((from >> (depth * branchBits)) & mask) - curOffset;
    let pathRight = ((to >> (depth * branchBits)) & mask) - curOffset;
    if (depth === 0) {
        // we are slicing a piece off a leaf node
        l.prefix = emptyAffix;
        l.suffix = tree.array.slice(pathLeft, pathRight + 1);
        l.root = undefined;
        l.bits = setSuffix(pathRight - pathLeft + 1, 0);
        return l;
    } else if (pathLeft === pathRight) {
        // Both ends are located in the same subtree, this means that we
        // can reduce the height
        // l.bits = decrementDepth(l.bits);
        // return sliceTreeList(from, to, tree.array[pathLeft], depth - 1, pathLeft === 0 ? offset : 0, l);
        const rec = sliceTreeList(
            from,
            to,
            tree.array[pathLeft],
            depth - 1,
            pathLeft === 0 ? offset : 0,
            l
        );
        if (rec.root !== undefined) {
            rec.root = new Node(undefined, [rec.root]);
        }
        return rec;
    } else {
        const childLeft = sliceLeft(
            tree.array[pathLeft],
            depth - 1,
            from,
            pathLeft === 0 ? offset : 0
        );
        l.bits = setPrefix(newAffix.length, l.bits);
        l.prefix = newAffix;
        const childRight = sliceRight(tree.array[pathRight], depth - 1, to, 0);
        l.bits = setSuffix(newAffix.length, l.bits);
        l.suffix = newAffix;
        if (childLeft === undefined) {
            ++pathLeft;
        }
        if (childRight === undefined) {
            --pathRight;
        }
        if (pathLeft > pathRight) {
            // there is no tree left
            l.bits = setDepth(0, l.bits);
            l.root = undefined;
            // } else if (pathLeft === pathRight) {
            // height can be reduced
            // l.bits = decrementDepth(l.bits);
            // l.root = childLeft === undefined ? childRight : childLeft;
        } else {
            let array = tree.array.slice(pathLeft, pathRight + 1);
            if (childLeft !== undefined) {
                array[0] = childLeft;
            }
            if (childRight !== undefined) {
                array[array.length - 1] = childRight;
            }
            l.root = new Node(tree.sizes, array);
        }
        return l;
    }
}

export function slice<A>(from: number, to: number, l: List<A>): List<A> {
    let { bits, length } = l;

    to = Math.min(length, to);
    // handle negative indices
    if (from < 0) {
        from = length + from;
    }
    if (to < 0) {
        to = length + to;
    }

    if (to <= from || to <= 0 || length <= from) {
        return empty();
    }

    // return list unchanged if we are slicing nothing off
    if (from <= 0 && length <= to) {
        return l;
    }

    const newLength = to - from;
    let prefixSize = getPrefixSize(l);
    const suffixSize = getSuffixSize(l);

    // both indices lie in the prefix
    if (to <= prefixSize) {
        return new List(
            setPrefix(newLength, 0),
            0,
            newLength,
            undefined,
            emptyAffix,
            l.prefix.slice(l.prefix.length - to, l.prefix.length - from)
        );
    }

    const suffixStart = length - suffixSize;
    // both indices lie in the suffix
    if (suffixStart <= from) {
        return new List(
            setSuffix(newLength, 0),
            0,
            newLength,
            undefined,
            l.suffix.slice(from - suffixStart, to - suffixStart),
            emptyAffix
        );
    }

    const newList = cloneList(l);

    // both indices lie in the tree
    if (prefixSize <= from && to <= length - suffixSize) {
        sliceTreeList(
            from - prefixSize + l.offset,
            to - prefixSize + l.offset - 1,
            l.root!,
            getDepth(l),
            l.offset,
            newList
        );
        if (newList.root !== undefined) {
            newList.offset += from - prefixSize + getPrefixSize(newList);
        }
        newList.length = to - from;
        return newList;
    }

    // we need to slice something off of the left
    if (0 < from) {
        if (from < prefixSize) {
            // do a cheap slice by setting prefix length
            bits = setPrefix(prefixSize - from, bits);
        } else {
            // if we're here `to` can't lie in the tree, so we can set the
            // root
            newList.root = sliceLeft(
                newList.root!,
                getDepth(l),
                from - prefixSize + l.offset,
                l.offset
            );
            bits = setPrefix(newAffix.length, bits);
            newList.offset += from - prefixSize + newAffix.length;
            prefixSize = newAffix.length;
            newList.prefix = newAffix;
        }
        newList.length -= from;
    }

    if (to < length) {
        if (length - to < suffixSize) {
            bits = setSuffix(suffixSize - (length - to), bits);
        } else {
            newList.root = sliceRight(
                newList.root!,
                getDepth(l),
                to - prefixSize + newList.offset - 1,
                newList.offset
            );
            if (newList.root === undefined) {
                bits = setDepth(0, bits);
            }
            bits = setSuffix(newAffix.length, bits);
            newList.suffix = newAffix;
        }
        newList.length -= length - to;
    }
    newList.bits = bits;
    return newList;
}

export function takeLast<A>(n: number, l: List<A>): List<A> {
    return slice(l.length - n, l.length, l);
}

export function splitAt<A>(index: number, l: List<A>): [List<A>, List<A>] {
    return [slice(0, index, l), slice(index, l.length, l)];
}

export function remove<A>(from: number, amount: number, l: List<A>): List<A> {
    return concat(slice(0, from, l), slice(from + amount, l.length, l));
}

export function drop<A>(n: number, l: List<A>): List<A> {
    return slice(n, l.length, l);
}

export function dropLast<A>(n: number, l: List<A>): List<A> {
    return slice(0, l.length - n, l);
}

export function pop<A>(l: List<A>): List<A> {
    return slice(0, -1, l);
}

export function filter<A>(predicate: (a: A) => boolean, l: List<A>): List<A> {
    return foldl((acc, a) => (predicate(a) ? append(a, acc) : acc), empty(), l);
}

export function reject<A>(predicate: (a: A) => boolean, l: List<A>): List<A> {
    return foldl((acc, a) => (predicate(a) ? acc : append(a, acc)), empty(), l);
}

export function update<A>(index: number, a: A, l: List<A>): List<A> {
    const prefixSize = getPrefixSize(l);
    const suffixSize = getSuffixSize(l);
    const newList = cloneList(l);
    if (index < prefixSize) {
        const newPrefix = copyArray(newList.prefix);
        newPrefix[newPrefix.length - index - 1] = a;
        newList.prefix = newPrefix;
    } else if (index >= l.length - suffixSize) {
        const newSuffix = copyArray(newList.suffix);
        newSuffix[index - (l.length - suffixSize)] = a;
        newList.suffix = newSuffix;
    } else {
        newList.root = updateNode(
            l.root!,
            getDepth(l),
            index - prefixSize + l.offset,
            l.offset,
            a
        );
    }
    return newList;
}

export function take<A>(n: number, l: List<A>): List<A> {
    return slice(0, n, l);
}

type FindNotIndexState = {
    predicate: (a: any) => boolean;
    index: number;
};

export function insert<A>(index: number, element: A, l: List<A>): List<A> {
    return concat(append(element, slice(0, index, l)), slice(index, l.length, l));
}

export function insertAll<A>(
    index: number,
    elements: List<A>,
    l: List<A>
): List<A> {
    return concat(
        concat(slice(0, index, l), elements),
        slice(index, l.length, l)
    );
}

export function reverse<A>(l: List<A>): List<A> {
    return foldl((newL, element) => prepend(element, newL), empty(), l);
}

function findNotIndexCb<A>(value: A, state: FindNotIndexState): boolean {
    ++state.index;
    return state.predicate(value);
}

export function dropWhile<A>(
    predicate: (a: A) => boolean,
    l: List<A>
): List<A> {
    const { index } = foldlCb<A, FindNotIndexState>(
        findNotIndexCb,
        { predicate, index: -1 },
        l
    );
    return slice(index, l.length, l);
}

export const init = pop;

export function tail<A>(l: List<A>): List<A> {
    return slice(1, l.length, l);
}

export function takeWhile<A>(
    predicate: (a: A) => boolean,
    l: List<A>
): List<A> {
    const { index } = foldlCb<A, FindNotIndexState>(
        findNotIndexCb,
        { predicate, index: -1 },
        l
    );
    return slice(0, index, l);
}

export function ap<A, B>(listF: List<(a: A) => B>, l: List<A>): List<B> {
    return flatten(map(f => map(f, l), listF));
}

export function chain<A, B>(f: (a: A) => List<B>, l: List<A>): List<B> {
    return flatten(map(f, l));
}

export function adjust<A>(f: (a: A) => A, index: number, l: List<A>): List<A> {
    return update(index, f(nth(index, l)), l);
}

export function concat<A>(left: List<A>, right: List<A>): List<A> {
    if (left.length === 0) {
        return right;
    } else if (right.length === 0) {
        return left;
    }
    const newSize = left.length + right.length;
    const rightSuffixSize = getSuffixSize(right);
    let newList = cloneList(left);
    if (right.root === undefined) {
        // right is nothing but a prefix and a suffix
        const nrOfAffixes = concatAffixes(left, right);
        for (var i = 0; i < nrOfAffixes; ++i) {
            newList = appendNodeToTree(newList, new Node(undefined, concatBuffer[i]));
            newList.length += concatBuffer[i].length;
            // wipe pointer, otherwise it might end up keeping the array alive
            concatBuffer[i] = undefined;
        }
        newList.length = newSize;
        newList.suffix = concatBuffer[nrOfAffixes];
        newList.bits = setSuffix(concatBuffer[nrOfAffixes].length, newList.bits);
        concatBuffer[nrOfAffixes] = undefined;
        return newList;
    } else {
        newList = appendNodeToTree(newList, suffixToNode(left.suffix));
        newList.length += getSuffixSize(left);
        newList = appendNodeToTree(newList, prefixToNode(right.prefix));
        const newNode = concatSubTree(
            newList.root!,
            getDepth(newList),
            right.root,
            getDepth(right),
            true
        );
        const newDepth = getHeight(newNode);
        setSizes(newNode, newDepth);
        const bits = createBits(newDepth, getPrefixSize(newList), rightSuffixSize);
        // FIXME: Return `newList` here
        return new List(bits, 0, newSize, newNode, right.suffix, newList.prefix);
    }
}