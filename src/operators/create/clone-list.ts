export function cloneList<A>(l: List<A>): List<A> {
    return new List(l.bits, l.offset, l.length, l.root, l.suffix, l.prefix);
}