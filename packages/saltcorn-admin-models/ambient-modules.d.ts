// Ambient declarations for dependencies that ship no type definitions. Before
// the ESM conversion these were pulled in with require(), which @types/node
// types as `any`; under static `import` NodeNext reports TS7016/TS2307 instead.
// Declaring them here restores the prior `any` typing without changing runtime
// behaviour.
declare module "chaos-guinea-pig";
