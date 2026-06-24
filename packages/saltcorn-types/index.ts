/**
 * This is the saltcorn-types package
 * @module
 */
import * as baseTypesImports from "./base_types.js";
import * as commonTypesImports from "./common_types.js";
export namespace Types {
  export import base_types = baseTypesImports;
  export import common_types = commonTypesImports;
}

import generatorsImport from "./generators.js";
/**
 * Those are generators
 */
export namespace generators {
  export const { generateBool, num_between, oneOf, generateString } =
    generatorsImport;
}

export * from "./model-abstracts/index.js";
