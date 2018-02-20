



// Array helper functions



function pushElements<A>(
  source: A[],
  target: A[],
  offset: number,
  amount: number
): void {
  for (let i = offset; i < offset + amount; ++i) {
    target.push(source[i]);
  }
}

export type Sizes = number[] | undefined;

export class Node {
  constructor(public sizes: Sizes, public array: any[]) { }
}

/*
 * Invariants that any list `l` should satisfy
 *
 * 1. If `l.root !== undefined` then `getSuffixSize(l) !== 0` and
 *   `getPrefixSize(l) !== 0`. The invariant ensures that `first` and
 *   `last` never have to look in the root and that they therefore
 *   take O(1) time.
 * 2. If a tree or sub-tree does not have a size-table then all leaf
      nodes in the tree are of size 32.
 */
export class List<A> {
  constructor(
    public bits: number,
    public offset: number,
    public length: number,
    public root: Node | undefined,
    public suffix: A[],
    public prefix: A[]
  ) { }
  [Symbol.iterator](): Iterator<A> {
    return new ListIterator(this);
  }
}

class ListIterator<A> implements Iterator<A> {
  stack: any[][];
  indices: number[];
  idx: number;
  prefixSize: number;
  middleSize: number;
  result: IteratorResult<A> = { done: false, value: undefined as any };
  constructor(private l: List<A>) {
    this.idx = -1;
    this.prefixSize = getPrefixSize(l);
    this.middleSize = l.length - getSuffixSize(l);
    if (l.root !== undefined) {
      const depth = getDepth(l);
      this.stack = new Array(depth + 1);
      this.indices = new Array(depth + 1);
      let currentNode = l.root.array;
      for (let i = depth; 0 <= i; --i) {
        this.stack[i] = currentNode;
        this.indices[i] = 0;
        currentNode = currentNode[0].array;
      }
      this.indices[0] = -1;
    }
  }
  nextInTree(): void {
    let i = 0;
    while (++this.indices[i] === this.stack[i].length) {
      this.indices[i] = 0;
      ++i;
    }
    for (; 0 < i; --i) {
      this.stack[i - 1] = this.stack[i][this.indices[i]].array;
    }
  }
  next(): IteratorResult<A> {
    let newVal;
    const idx = ++this.idx;
    if (idx < this.prefixSize) {
      newVal = this.l.prefix[this.prefixSize - idx - 1];
    } else if (idx < this.middleSize) {
      this.nextInTree();
      newVal = this.stack[0][this.indices[0]];
    } else if (idx < this.l.length) {
      newVal = this.l.suffix[idx - this.middleSize];
    } else {
      this.result.done = true;
    }
    this.result.value = newVal;
    return this.result;
  }
}


const eMax = 2;

function createConcatPlan(array: Node[]): number[] | undefined {
  const sizes = [];
  let sum = 0;
  for (let i = 0; i < array.length; ++i) {
    sum += array[i].array.length; // FIXME: maybe only access array once
    sizes[i] = array[i].array.length;
  }
  const optimalLength = Math.ceil(sum / branchingFactor);
  let n = array.length;
  let i = 0;
  if (optimalLength + eMax >= n) {
    return undefined; // no rebalancing needed
  }
  while (optimalLength + eMax < n) {
    while (sizes[i] > branchingFactor - eMax / 2) {
      // Skip nodes that are already sufficiently balanced
      ++i;
    }
    // the node at this index is too short
    let remaining = sizes[i]; // number of elements to re-distribute
    do {
      const size = Math.min(remaining + sizes[i + 1], branchingFactor);
      sizes[i] = size;
      remaining = remaining - (size - sizes[i + 1]);
      ++i;
    } while (remaining > 0);
    // Shift nodes after
    for (let j = i; j <= n - 1; ++j) {
      sizes[j] = sizes[j + 1];
    }
    --i;
    --n;
  }
  sizes.length = n;
  return sizes;
}

/**
 * Combines the children of three nodes into an array. The last child
 * of `left` and the first child of `right is ignored as they've been
 * concatenated into `center`.
 */
function concatNodeMerge(
  left: Node | undefined,
  center: Node,
  right: Node | undefined
): Node[] {
  const array = [];
  if (left !== undefined) {
    for (let i = 0; i < left.array.length - 1; ++i) {
      array.push(left.array[i]);
    }
  }
  for (let i = 0; i < center.array.length; ++i) {
    array.push(center.array[i]);
  }
  if (right !== undefined) {
    for (let i = 1; i < right.array.length; ++i) {
      array.push(right.array[i]);
    }
  }
  return array;
}

function executeConcatPlan(
  merged: Node[],
  plan: number[],
  height: number
): any[] {
  const result = [];
  let sourceIdx = 0; // the current node we're copying from
  let offset = 0; // elements in source already used
  for (let toMove of plan) {
    let source = merged[sourceIdx].array;
    if (toMove === source.length && offset === 0) {
      // source matches target exactly, reuse source
      result.push(merged[sourceIdx]);
      ++sourceIdx;
    } else {
      const node = new Node(undefined, []);
      while (toMove > 0) {
        const available = source.length - offset;
        const itemsToCopy = Math.min(toMove, available);
        pushElements(source, node.array, offset, itemsToCopy);
        if (toMove >= available) {
          ++sourceIdx;
          source = merged[sourceIdx].array;
          offset = 0;
        } else {
          offset += itemsToCopy;
        }
        toMove -= itemsToCopy;
      }
      if (height > 1) {
        // Set sizes on children unless they are leaf nodes
        setSizes(node, height - 1);
      }
      result.push(node);
    }
  }
  return result;
}

/**
 * Takes three nodes and returns a new node with the content of the
 * three nodes. Note: The returned node does not have its size table
 * set correctly. The caller must do that.
 */
function rebalance(
  left: Node | undefined,
  center: Node,
  right: Node | undefined,
  height: number,
  top: boolean
): Node {
  const merged = concatNodeMerge(left, center, right);
  const plan = createConcatPlan(merged);
  const balanced =
    plan !== undefined ? executeConcatPlan(merged, plan, height) : merged;
  if (balanced.length <= branchingFactor) {
    if (top === true) {
      return new Node(undefined, balanced);
    } else {
      // Return a single node with extra height for balancing at next
      // level
      return new Node(undefined, [
        setSizes(new Node(undefined, balanced), height)
      ]);
    }
  } else {
    return new Node(undefined, [
      setSizes(new Node(undefined, balanced.slice(0, branchingFactor)), height),
      setSizes(new Node(undefined, balanced.slice(branchingFactor)), height)
    ]);
  }
}

function concatSubTree<A>(
  left: Node,
  lDepth: number,
  right: Node,
  rDepth: number,
  isTop: boolean
): Node {
  if (lDepth > rDepth) {
    const c = concatSubTree(
      arrayLast(left.array),
      lDepth - 1,
      right,
      rDepth,
      false
    );
    return rebalance(left, c, undefined, lDepth, isTop);
  } else if (lDepth < rDepth) {
    const c = concatSubTree(
      left,
      lDepth,
      arrayFirst(right.array),
      rDepth - 1,
      false
    );
    return rebalance(undefined, c, right, rDepth, isTop);
  } else if (lDepth === 0) {
    return new Node(undefined, [left, right]);
  } else {
    const c = concatSubTree<A>(
      arrayLast(left.array),
      lDepth - 1,
      arrayFirst(right.array),
      rDepth - 1,
      false
    );
    return rebalance(left, c, right, lDepth, isTop);
  }
}

function getHeight(node: Node): number {
  if (node.array[0] instanceof Node) {
    return 1 + getHeight(node.array[0]);
  } else {
    return 0;
  }
}


/*
function concatSuffix<A>(
  left: A[], lSize: number, right: A[], rSize: number
): A[] {
  const newArray = new Array(lSize + rSize);
  for (let i = 0; i < lSize; ++i) {
    newArray[i] = left[i];
  }
  for (let i = 0; i < rSize; ++i) {
    newArray[lSize + i] = right[i];
  }
  return newArray;
}
*/

const concatBuffer = new Array(3);

function concatAffixes<A>(left: List<A>, right: List<A>): number {
  // TODO: Try and find a neat way to reduce the LOC here
  var nr = 0;
  var arrIdx = 0;
  var i = 0;
  var length = getSuffixSize(left);
  concatBuffer[nr] = [];
  for (i = 0; i < length; ++i) {
    concatBuffer[nr][arrIdx] = left.suffix[i];
    if (++arrIdx === 32) {
      arrIdx = 0;
      ++nr;
      concatBuffer[nr] = [];
    }
  }
  length = getPrefixSize(right);
  for (i = 0; i < length; ++i) {
    concatBuffer[nr][arrIdx] = right.prefix[right.prefix.length - 1 - i];
    if (++arrIdx === 32) {
      arrIdx = 0;
      ++nr;
      concatBuffer[nr] = [];
    }
  }
  length = getSuffixSize(right);
  for (i = 0; i < length; ++i) {
    concatBuffer[nr][arrIdx] = right.suffix[i];
    if (++arrIdx === 32) {
      arrIdx = 0;
      ++nr;
      concatBuffer[nr] = [];
    }
  }
  return nr;
}


