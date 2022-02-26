/**
 * This is the saltcorn-types package
 * @module
 */
import * as baseTypesImports from "./base_types";
import * as commonTypesImports from "./common_types";
export namespace Types {
  export import base_types = baseTypesImports;
  export import common_types = commonTypesImports;
}

import generatorsImport from "generators";
/**
 * Those are generators
 */
export namespace generators {
  export const { generateBool, num_between, oneOf, generateString } =
    generatorsImport;
}

export * from "./model-abstracts";
