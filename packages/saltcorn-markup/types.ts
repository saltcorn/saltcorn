export type ClassVal = string | string[];
export type StyleVal = string | string[] | { [key: string]: string };
export type AttributeVal = string | boolean | undefined | null;
export type Element = string | number | boolean | null | undefined | Element[];
export type Attributes =
  | {
      [attribute: string]: AttributeVal;
    }
  | { class?: ClassVal; style?: StyleVal };

export type TagFunction = (
  first?: Attributes | Element,
  ...args: Element[]
) => string;
