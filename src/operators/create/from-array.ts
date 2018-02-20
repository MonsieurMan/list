import { empty } from ".";

export function fromArray<A>(array: A[]): List<A> {
    let l = empty();
    for (let i = 0; i < array.length; ++i) {
        l = append(array[i], l);
    }
    return l;
}