/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_library
 * @subcategory model-abstracts
 */

/** A reusable Library component's configuration. */
export type LibraryCfg = {
  id?: number;
  name: string;
  icon: string;
  layout: string | any;
};

/** A portable (import/export) representation of a {@link LibraryCfg}. */
export type LibraryPack = {} & LibraryCfg;
