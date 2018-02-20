export function copyArray(source: any[]): any[] {
    const array = [];
    for (let i = 0; i < source.length; ++i) {
        array[i] = source[i];
    }
    return array;
}

export function arrayPush<A>(array: A[], a: A): A[] {
    array.push(a);
    return array;
}

/**
 * Create a reverse _copy_ of an array.
 */
export function reverseArray<A>(array: A[]): A[] {
    return array.slice().reverse();
}

export function arrayPrepend<A>(value: A, array: A[]): A[] {
    const newLength = array.length + 1;
    const result = new Array(newLength);
    result[0] = value;
    for (let i = 1; i < newLength; ++i) {
        result[i] = array[i - 1];
    }
    return result;
}