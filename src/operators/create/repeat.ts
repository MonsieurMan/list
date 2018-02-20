import { empty } from ".";

export function repeat<A>(value: A, times: number): List<A> {
    let l = empty();
    while (--times >= 0) {
        l = append(value, l);
    }
    return l;
}