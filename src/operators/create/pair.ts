export function pair<A>(first: A, second: A): List<A> {
    return new List(2, 0, 2, undefined, [first, second], emptyAffix);
}