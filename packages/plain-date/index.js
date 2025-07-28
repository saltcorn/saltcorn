class PlainDate {
  constructor(year, month, day) {
    if (arguments.length === 0) {
      const now = new Date();
      this.year = now.getFullYear();
      this.month = now.getMonth() + 1;
      this.day = now.getDate();
    } else if (arguments.length === 1 && typeof year === "string") {
      // Accept ISO date string
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(year);
      if (!match) throw new Error("Invalid date string");
      [, year, month, day] = match.map(Number);
      this.year = year;
      this.month = month;
      this.day = day;
    } else if (arguments.length === 1 && typeof year === "number") {
      const now = new Date(year);
      this.year = now.getFullYear();
      this.month = now.getMonth() + 1;
      this.day = now.getDate();
    } else if (arguments.length === 1 && year instanceof Date) {
      this.year = year.getFullYear();
      this.month = year.getMonth() + 1;
      this.day = year.getDate();
    } else if (arguments.length === 1 && year instanceof PlainDate) {
      this.year = year.year;
      this.month = year.month;
      this.day = year.day;
    } else {
      this.year = Number(year);
      this.month = Number(month);
      this.day = Number(day);
    }
    if (!this.isValid()) throw new Error("Invalid PlainDate");
  }

  static from(dateLike) {
    if (dateLike instanceof PlainDate)
      return new PlainDate(dateLike.year, dateLike.month, dateLike.day);
    if (dateLike instanceof Date) return PlainDate.fromDate(dateLike);
    if (typeof dateLike === "string") return new PlainDate(dateLike);
    throw new Error("Invalid dateLike");
  }

  static fromDate(date) {
    return new PlainDate(date);
  }

  isValid() {
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

  getFullYear() {
    return this.year;
  }
  getMonth() {
    return this.month - 1;
  } // 0-based like Date
  getDate() {
    return this.day;
  }
  getDay() {
    return this.toDate().getDay();
  }
  getTime() {
    return this.toDate().getTime();
  }

  toString() {
    return this.toISODateString();
  }
  toDateString() {
    return this.toISODateString();
  }
  toISOString() {
    return this.toISODateString();
  }
  toISODateString() {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }

  valueOf() {
    return Date.UTC(this.year, this.month - 1, this.day);
  }

  equals(other) {
    const d = PlainDate.from(other);
    return this.year === d.year && this.month === d.month && this.day === d.day;
  }

  addDays(days) {
    const d = new Date(this.year, this.month - 1, this.day + days);
    return PlainDate.fromDate(d);
  }

  // Setters: always return a new PlainDate with overflow handled
  setMonth(month, day = this.day) {
    // month: 0-based, like Date
    const d = new Date(this.year, month, day);
    return PlainDate.fromDate(d);
  }

  setDate(day) {
    const d = new Date(this.year, this.month - 1, day);
    return PlainDate.fromDate(d);
  }

  toJSON() {
    return this.toISODateString();
  }

  setYear(year) {
    const d = new Date(year, this.month - 1, this.day);
    return PlainDate.fromDate(d);
  }
  toDate() {
    return new Date(this.year, this.month - 1, this.day);
  }
  toLocaleDateString(...args) {
    return this.toDate().toLocaleDateString(...args);
  }
  toLocaleString(...args) {
    return this.toDate().toLocaleString(...args);
  }
}

module.exports = PlainDate;
