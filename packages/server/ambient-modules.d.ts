// Ambient declarations for dependencies that ship no type definitions. Before
// the TypeScript conversion these were pulled in with require()/untyped import,
// which @types/node types as `any`; under static `import` NodeNext reports
// TS7016/TS2307 instead. Declaring them here restores the prior `any` typing
// without changing runtime behaviour.
declare module "express-session";
declare module "cookie-session";
declare module "markdown-it";
declare module "npm-registry-fetch";
