import { empty } from ".";

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