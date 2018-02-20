export function empty(): List<any> {
    return new List(0, 0, 0, undefined, emptyAffix, emptyAffix);
}