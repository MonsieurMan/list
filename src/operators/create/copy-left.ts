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