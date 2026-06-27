/**
 * PlainDate: Date without time and timezone, drop-in compatible with Date
 * @module
 */

class PlainDate {
  year: number;
  month: number;
  day: number;
  is_invalid?: boolean;

  constructor();
  constructor(year: number, month: number, day: number);
  constructor(epochMs: number);
  constructor(isoString: string);
  constructor(date: Date);
  constructor(plainDate: PlainDate);
  constructor(
    year?: number | string | Date | PlainDate,
    month?: number,
    day?: number
  ) {
    if (arguments.length === 0) {
      const now = new Date();
      this.year = now.getFullYear();
      this.month = now.getMonth() + 1;
      this.day = now.getDate();
    } else if (arguments.length === 1 && typeof year === "string") {
      // Accept ISO date string
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(year);
      if (!match) throw new Error("Invalid date string");
      const [, y, m, d] = match.map(Number);
      this.year = y;
      this.month = m;
      this.day = d;
    } else if (arguments.length === 1 && typeof year === "number") {
      const now = new Date(year);
      this.year = now.getFullYear();
      this.month = now.getMonth() + 1;
      this.day = now.getDate();
    } else if (arguments.length === 1 && year instanceof Date) {
      if (isNaN(year.getTime())) this.is_invalid = true;
      this.year = year.getFullYear();
      this.month = year.getMonth() + 1;
      this.day = year.getDate();
    } else if (arguments.length === 1 && year instanceof PlainDate) {
      this.year = year.year;
      this.month = year.month;
      this.day = year.day;
      this.is_invalid = year.is_invalid;
    } else {
      this.year = Number(year);
      this.month = Number(month);
      this.day = Number(day);
    }
    if (!this.isValid()) this.is_invalid = true;
  }

  copyFromPlainDate(pd: PlainDate): void {
    this.year = pd.year;
    this.month = pd.month;
    this.day = pd.day;
    this.is_invalid = pd.is_invalid;
  }

  static from(dateLike: string | number | Date | PlainDate): PlainDate {
    if (dateLike instanceof PlainDate)
      return new PlainDate(dateLike.year, dateLike.month, dateLike.day);
    if (dateLike instanceof Date) return PlainDate.fromDate(dateLike);
    if (typeof dateLike === "string") return new PlainDate(dateLike);
    if (typeof dateLike === "number") return new PlainDate(dateLike);
    throw new Error("Invalid dateLike");
  }

  static parse(dateStr: string): PlainDate {
    return new PlainDate(Date.parse(dateStr));
  }

  static fromDate(date: Date): PlainDate {
    return new PlainDate(date);
  }

  isValid(): boolean {
    if (this.is_invalid) return false;
    if (
      !Number.isInteger(this.year) ||
      !Number.isInteger(this.month) ||
      !Number.isInteger(this.day)
    )
      return false;
    if (this.month < 1 || this.month > 12) return false;
    const d = new Date(this.year, this.month - 1, this.day);
    return (
      d.getFullYear() === this.year &&
      d.getMonth() + 1 === this.month &&
      d.getDate() === this.day
    );
  }

  getFullYear(): number {
    return this.year;
  }
  getMonth(): number {
    return this.month - 1;
  } // 0-based like Date
  getDate(): number {
    return this.day;
  }
  getDay(): number {
    return this.toDate().getDay();
  }
  getTime(): number {
    return this.toDate().getTime();
  }

  toString(): string {
    if (this.is_invalid) return "Invalid Date";
    return this.toISODateString();
  }
  toDateString(): string {
    if (this.is_invalid) return "Invalid Date";
    return this.toISODateString();
  }
  toISOString(): string {
    return this.toISODateString();
  }
  toISODateString(): string {
    if (this.is_invalid) throw new RangeError("Invalid time value");
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }

  valueOf(): number {
    if (this.is_invalid) return NaN;
    return Date.UTC(this.year, this.month - 1, this.day);
  }

  equals(other: string | number | Date | PlainDate): boolean {
    const d = PlainDate.from(other);
    return this.year === d.year && this.month === d.month && this.day === d.day;
  }

  addDays(days: number): PlainDate {
    const d = new Date(this.year, this.month - 1, this.day + days);
    return PlainDate.fromDate(d);
  }

  // Setters: always return a new PlainDate with overflow handled
  setMonth(month: number, day: number = this.day): number {
    // month: 0-based, like Date
    const d = new Date(this.year, month, day);
    this.copyFromPlainDate(PlainDate.fromDate(d));
    return this.getTime();
  }

  setDate(day: number): number {
    const d = this.toDate();
    d.setDate(day);
    this.copyFromPlainDate(PlainDate.fromDate(d));
    return this.getTime();
  }

  setYear(year: number): number {
    const d = new Date(year, this.month - 1, this.day);
    this.copyFromPlainDate(PlainDate.fromDate(d));
    return this.getTime();
  }

  toJSON(): string | null {
    if (this.is_invalid) return null;
    return this.toISODateString();
  }

  toDate(): Date {
    if (this.is_invalid) return new Date("Invalid Date");
    return new Date(this.year, this.month - 1, this.day);
  }
  toLocaleDateString(...args: any[]): string {
    return this.toDate().toLocaleDateString(...args);
  }
  toLocaleString(...args: any[]): string {
    return this.toDate().toLocaleString(...args);
  }

  toLocaleDate(
    locale: string = Intl.DateTimeFormat().resolvedOptions().locale,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    if (this.is_invalid) return "Invalid Date";
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return this.toDate().toLocaleDateString(locale, {
      ...defaultOptions,
      ...options,
    });
  }

  toUTCString(): string {
    if (this.is_invalid) return "Invalid Date";
    let locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-GB";
    const date = new Date(Date.UTC(this.year, this.month - 1, this.day));
    return date.toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  toUTCDate(): string {
    if (this.is_invalid) return "Invalid Date";
    const date = new Date(Date.UTC(this.year, this.month - 1, this.day));
    return date.toISOString().split("T")[0];
  }

  [Symbol.toPrimitive](
    hint: "number" | "string" | "default"
  ): number | string | null {
    if (hint === "number") {
      return this.getTime();
    }
    if (hint === "string") {
      return this.toString();
    }
    return null;
  }
}

export default PlainDate;
