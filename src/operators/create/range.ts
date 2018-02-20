import { empty } from ".";

export function range(start: number, end: number): List<number> {
    let list = empty();
    for (let i = start; i < end; ++i) {
        list = append(i, list);
    }
    return list;
}