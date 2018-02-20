import { list } from ".";

export function of<A>(a: A): List<A> {
    return list(a);
}