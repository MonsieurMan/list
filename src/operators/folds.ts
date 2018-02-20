import { List, Node } from "..";
import { getPrefixSize, getSuffixSize, getDepth, nodeNthDense, handleOffset, nodeNth, elementEquals, arrayLast, arrayFirst, EqualsState, equalsState } from "./utils";

export function nth<A>(index: number, l: List<A>): A {
    const prefixSize = getPrefixSize(l);
    const suffixSize = getSuffixSize(l);
    const { offset } = l;
    if (index < prefixSize) {
        return l.prefix[prefixSize - index - 1];
    } else if (index >= l.length - suffixSize) {
        return l.suffix[index - (l.length - suffixSize)];
    }
    const depth = getDepth(l);
    return l.root!.sizes === undefined
        ? nodeNthDense(
            l.root!,
            depth,
            offset === 0
                ? index - prefixSize
                : handleOffset(depth, offset, index - prefixSize)
        )
        : nodeNth(l.root!, depth, index - prefixSize);
}

type PredState = {
    predicate: (a: any) => boolean;
    result: any;
};

function everyCb<A>(value: A, state: any): boolean {
    return (state.result = state.predicate(value));
}

export function every<A>(predicate: (a: A) => boolean, l: List<A>): boolean {
    return foldlCb<A, PredState>(everyCb, { predicate, result: true }, l).result;
}

export const all = every;

function someCb<A>(value: A, state: any): boolean {
    return !(state.result = state.predicate(value));
}

export function some<A>(predicate: (a: A) => boolean, l: List<A>): boolean {
    return foldlCb<A, PredState>(someCb, { predicate, result: false }, l).result;
}

// tslint:disable-next-line:variable-name
export const any = some;

export function none<A>(predicate: (a: A) => boolean, l: List<A>): boolean {
    return !some(predicate, l);
}

function findCb<A>(value: A, state: PredState): boolean {
    if (state.predicate(value)) {
        state.result = value;
        return false;
    } else {
        return true;
    }
}

export function find<A>(
    predicate: (a: A) => boolean,
    l: List<A>
): A | undefined {
    return foldlCb<A, PredState>(findCb, { predicate, result: undefined }, l)
        .result;
}

type IndexOfState = {
    element: any;
    found: boolean;
    index: number;
};

function indexOfCb<A>(value: A, state: IndexOfState): boolean {
    ++state.index;
    return !(state.found = elementEquals(value, state.element));
}

export function indexOf<A>(element: A, l: List<A>): number {
    const { found, index } = foldlCb<A, IndexOfState>(
        indexOfCb,
        { element, found: false, index: -1 },
        l
    );
    return found ? index : -1;
}

type FindIndexState = {
    predicate: (a: any) => boolean;
    found: boolean;
    index: number;
};

function findIndexCb<A>(value: A, state: FindIndexState): boolean {
    ++state.index;
    return !(state.found = state.predicate(value));
}

function foldlSuffix<A, B>(
    f: (acc: B, value: A) => B,
    acc: B,
    array: A[],
    length: number
): B {
    for (let i = 0; i < length; ++i) {
        acc = f(acc, array[i]);
    }
    return acc;
}

function foldlPrefix<A, B>(
    f: (acc: B, value: A) => B,
    acc: B,
    array: A[],
    length: number
): B {
    for (let i = length - 1; 0 <= i; --i) {
        acc = f(acc, array[i]);
    }
    return acc;
}

function foldlNode<A, B>(
    f: (acc: B, value: A) => B,
    acc: B,
    node: Node,
    depth: number
): B {
    const { array } = node;
    if (depth === 0) {
        return foldlSuffix(f, acc, array, array.length);
    }
    for (let i = 0; i < array.length; ++i) {
        acc = foldlNode(f, acc, array[i], depth - 1);
    }
    return acc;
}

function foldrSuffix<A, B>(
    f: (value: A, acc: B) => B,
    initial: B,
    array: A[],
    length: number
): B {
    let acc = initial;
    for (let i = length - 1; 0 <= i; --i) {
        acc = f(array[i], acc);
    }
    return acc;
}

function foldrPrefix<A, B>(
    f: (value: A, acc: B) => B,
    initial: B,
    array: A[],
    length: number
): B {
    let acc = initial;
    for (let i = 0; i < length; ++i) {
        acc = f(array[i], acc);
    }
    return acc;
}

function foldrNode<A, B>(
    f: (value: A, acc: B) => B,
    initial: B,
    { array }: Node,
    depth: number
): B {
    if (depth === 0) {
        return foldrSuffix(f, initial, array, array.length);
    }
    let acc = initial;
    for (let i = array.length - 1; 0 <= i; --i) {
        acc = foldrNode(f, acc, array[i], depth - 1);
    }
    return acc;
}

export function foldr<A, B>(
    f: (value: A, acc: B) => B,
    initial: B,
    l: List<A>
): B {
    const suffixSize = getSuffixSize(l);
    const prefixSize = getPrefixSize(l);
    let acc = foldrSuffix(f, initial, l.suffix, suffixSize);
    if (l.root !== undefined) {
        acc = foldrNode(f, acc, l.root, getDepth(l));
    }
    return foldrPrefix(f, acc, l.prefix, prefixSize);
}

export const reduceRight = foldr;

export type FoldCb<Input, State> = (input: Input, state: State) => boolean;

function foldlSuffixCb<A, B>(
    cb: FoldCb<A, B>,
    state: B,
    array: A[],
    length: number
): boolean {
    for (var i = 0; i < length && cb(array[i], state); ++i) { }
    return i === length;
}

function foldlPrefixCb<A, B>(
    cb: FoldCb<A, B>,
    state: B,
    array: A[],
    length: number
): boolean {
    for (var i = length - 1; 0 <= i && cb(array[i], state); --i) { }
    return i === -1;
}

function foldlNodeCb<A, B>(
    cb: FoldCb<A, B>,
    state: B,
    node: Node,
    depth: number
): boolean {
    const { array } = node;
    if (depth === 0) {
        return foldlSuffixCb(cb, state, array, array.length);
    }
    for (
        var i = 0;
        i < array.length && foldlNodeCb(cb, state, array[i], depth - 1);
        ++i
    ) { }
    return i === array.length;
}

/**
 * This function is a lot like a fold. But the reducer function is
 * supposed to mutate its state instead of returning it. Instead of
 * returning a new state it returns a boolean that tells wether or not
 * to continue the fold. `true` indicates that the folding should
 * continue.
 */
export function foldlCb<A, B>(cb: FoldCb<A, B>, state: B, l: List<A>): B {
    const suffixSize = getSuffixSize(l);
    const prefixSize = getPrefixSize(l);
    if (foldlPrefixCb(cb, state, l.prefix, prefixSize)) {
        if (l.root !== undefined) {
            if (foldlNodeCb(cb, state, l.root, getDepth(l))) {
                foldlSuffixCb(cb, state, l.suffix, suffixSize);
            }
        } else {
            foldlSuffixCb(cb, state, l.suffix, suffixSize);
        }
    }
    return state;
}

export function foldl<A, B>(
    f: (acc: B, value: A) => B,
    initial: B,
    l: List<A>
): B {
    const suffixSize = getSuffixSize(l);
    const prefixSize = getPrefixSize(l);
    initial = foldlPrefix(f, initial, l.prefix, prefixSize);
    if (l.root !== undefined) {
        initial = foldlNode(f, initial, l.root, getDepth(l));
    }
    return foldlSuffix(f, initial, l.suffix, suffixSize);
}
export const reduce = foldl;

export function findIndex<A>(predicate: (a: A) => boolean, l: List<A>): number {
    const { found, index } = foldlCb<A, FindIndexState>(
        findIndexCb,
        { predicate, found: false, index: -1 },
        l
    );
    return found ? index : -1;
}

type ContainsState = {
    element: any;
    result: boolean;
};

const containsState: ContainsState = {
    element: undefined,
    result: false
};

function containsCb(value: any, state: ContainsState): boolean {
    return !(state.result = value === state.element);
}

export function includes<A>(element: A, l: List<A>): boolean {
    containsState.element = element;
    containsState.result = false;
    return foldlCb(containsCb, containsState, l).result;
}
export const contains = includes;

export function length(l: List<any>): number {
    return l.length;
}

function equalsCb(value2: any, state: EqualsState): boolean {
    const { value } = state.iterator.next();
    return (state.equals = elementEquals(value, value2));
}

export function equals<A>(firstList: List<A>, secondList: List<A>): boolean {
    if (firstList === secondList) {
        return true;
    } else if (firstList.length !== secondList.length) {
        return false;
    } else {
        equalsState.iterator = secondList[Symbol.iterator]();
        equalsState.equals = true;
        return foldlCb<A, EqualsState>(equalsCb, equalsState, firstList).equals;
    }
}

export function first<A>(l: List<A>): A | undefined {
    if (getPrefixSize(l) !== 0) {
        return arrayLast(l.prefix);
    } else if (getSuffixSize(l) !== 0) {
        return arrayFirst(l.suffix);
    }
}

export function last<A>(l: List<A>): A | undefined {
    if (getSuffixSize(l) !== 0) {
        return arrayLast(l.suffix);
    } else if (getPrefixSize(l) !== 0) {
        return arrayFirst(l.prefix);
    }
}