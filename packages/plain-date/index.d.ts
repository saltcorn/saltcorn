declare class PlainDate {
    year: number;
    month: number;
    day: number;
    is_invalid?: boolean;
  
    constructor();
    constructor(year: number, month: number, day: number);
    constructor(isoString: string);
    constructor(date: Date);
    constructor(plainDate: PlainDate);
  
    static from(dateLike: string | number | Date | PlainDate): PlainDate;
    static parse(dateStr: string): PlainDate;
    static fromDate(date: Date): PlainDate;
  
    isValid(): boolean;
    getFullYear(): number;
    getMonth(): number;
    getDate(): number;
    getDay(): number;
    getTime(): number;
  
    toString(): string;
    toDateString(): string;
    toISOString(): string;
    toISODateString(): string;
    toUTCString(): string;
    toUTCDate(): Date;
    valueOf(): number;
    equals(other: string | number | Date | PlainDate): boolean;
    addDays(days: number): PlainDate;
    setMonth(month: number, day?: number): number;
    setDate(day: number): number;
    setYear(year: number): number;
    toJSON(): string | null;
    toDate(): Date;
    toLocaleDateString(...args: any[]): string;
    toLocaleString(...args: any[]): string;
  
    [Symbol.toPrimitive](hint: "number" | "string" | "default"): number | string | null;
  }
  
  export = PlainDate;
  