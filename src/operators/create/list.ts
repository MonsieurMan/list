import { empty } from ".";

export function list<A>(...elements: A[]): List<A> {
    let l = empty();
    for (const element of elements) {
        l = append(element, l);
    }
    return l;
}