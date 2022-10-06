import { AbstractTable } from "@saltcorn/types/model-abstracts/abstract_table";
import { AbstractField } from "@saltcorn/types/model-abstracts/abstract_field";
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import Node from "./node";

export class TableNode extends Node {
  table: AbstractTable;

  constructor(table: AbstractTable, tags: Array<AbstractTag>) {
    super("table", table.name, tags, table.id!);
    this.table = table;
  }

  cyDataObject() {
    const result = this.commonCyData();
    if (this.table.fields) {
      result.fields = this.table.fields.map((field: AbstractField) => {
        return { name: field.name, typeName: field.type_name };
      });
    }
    return result;
  }
}
