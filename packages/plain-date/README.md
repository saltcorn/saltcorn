# @saltcorn/plain-date

@saltcorn/plain-date is a JavaScript class for representing plain dates (no time or
timezone information). It is designed to be drop-in compatible with JavaScript's Date
class.

```javascript
const PlainDate = require("@saltcorn/plain-date");

let today = new PlainDate();
today;
// => PlainDate { year: 2025, month: 7, day: 29 }
today.toISOString();
// => '2025-07-29'
today.setDate(13);
// => 1752361200000
today.toISOString();
// => '2025-07-13'
today.toLocaleDateString();
// => '7/13/2025'
```

Run `plain_date.toDate()` to get the Date object for midnight in the ¯\\\_(ツ)\_/¯ timezone.

### Parsing Dates from pg

To parse dates from PostgreSQL with PlainDate, add this to your code:

```javascript
const PlainDate = require("@saltcorn/plain-date");
var types = require("pg").types;
types.setTypeParser(types.builtins.DATE, (d) =>
  d === null ? null : new PlainDate(d)
);
```

### Limitations

If you pass timezone information in a date string to PlainDate.parse or new PlainDate, and this is a different timezone to the computer's timezone, you could get a date shift.

Missing methods: `toUTCString`
