export type Sizes = number[] | undefined;

export class Node {
  constructor(public sizes: Sizes, public array: any[]) { }
}