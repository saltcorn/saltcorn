// Ambient declarations for dependencies (and dependency subpaths) that ship no
// type definitions. Before the ESM conversion these were pulled in with
// require(), which @types/node types as `any`; under static `import` NodeNext
// reports TS7016/TS2307 instead. Declaring them here restores the prior `any`
// typing without changing runtime behaviour.
declare module "contractis";
declare module "contractis/is.js";
declare module "contractis/is";
declare module "pluralize";
declare module "markdown-it";
declare module "fs-extended-attributes";
declare module "npm-registry-fetch";
declare module "unidecode";
declare module "buffer/index.js";
declare module "stream-json/streamers/StreamArray.js";
declare module "stream-json/streamers/StreamArray";
declare module "nodemailer/lib/mailer";
declare module "@saltcorn/admin-models/models/tenant";
