import type {
  Where,
  SelectOptions,
  Row,
  JoinFields,
  JoinOptions,
  AggregationOptions,
} from "@saltcorn/db-common/internal";
import {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
  orderByIsObject,
} from "@saltcorn/db-common/internal";
import utils from "../../utils";
const { isNode } = utils;
import Field from "../field";

export const process_aggregations = (
  aggregations: AggregationOptions[],
  placeCounter: number,
  fldNms: string[],
  values: any[],
  schema: string,
  this_table: any
) => {
  let aggValues: any = []; // for sqlite
  let Table = this_table.constructor;
  Object.entries<AggregationOptions>(aggregations).forEach(
    ([fldnm, { table, ref, field, where, aggregate, subselect, through }]) => {
      let whereStr = "";
      if (where && !subselect) {
        const whereAndValues = mkWhere(where, db.isSQLite, placeCounter);
        // todo warning deprecated symbol substr is used
        whereStr = whereAndValues.where.substr(6); // remove "where "
        if (isNode()) values.push(...whereAndValues.values);
        else aggValues.push(...whereAndValues.values);
        placeCounter += whereAndValues.values.length;
      }
      const aggTable = Table.findOne({ name: table });
      const aggField = aggTable?.fields?.find((f: Field) => f.name === field);
      const ownField = through ? sqlsanitize(through) : this_table.pk_name;
      const agg_and_field =
        aggregate.toLowerCase() === "countunique"
          ? `count(distinct ${field ? `"${sqlsanitize(field)}"` : "*"})`
          : `${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            })`;
      if (
        aggField?.is_fkey &&
        aggField.attributes.summary_field &&
        aggregate.toLowerCase() === "array_agg"
      ) {
        const newFld = `(select array_agg(aggjoin."${sqlsanitize(
          aggField.attributes.summary_field
        )}") from ${schema}"${sqlsanitize(
          table
        )}" aggto join ${schema}"${sqlsanitize(
          aggField.reftable_name as string
        )}" aggjoin on aggto."${sqlsanitize(
          field
        )}" = aggjoin.id where aggto."${sqlsanitize(ref)}"=a."${ownField}"${
          whereStr ? ` and ${whereStr}` : ""
        }) ${sqlsanitize(fldnm)}`;

        fldNms.push(newFld);
      } else if (
        aggregate.startsWith("Latest ") ||
        aggregate.startsWith("Earliest ")
      ) {
        const dateField = aggregate.split(" ")[1];
        const isLatest = aggregate.startsWith("Latest ");
        fldNms.push(
          `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
            table
          )}" where "${dateField}"=(select ${
            isLatest ? `max` : `min`
          }("${dateField}") from ${schema}"${sqlsanitize(
            table
          )}" where "${sqlsanitize(ref)}"=a."${ownField}"${
            whereStr ? ` and ${whereStr}` : ""
          }) and "${sqlsanitize(ref)}"=a."${ownField}" limit 1) ${sqlsanitize(
            fldnm
          )}`
        );
      } else if (subselect)
        fldNms.push(
          `(select ${agg_and_field} from ${schema}"${sqlsanitize(
            table
          )}" where "${sqlsanitize(ref)}" in (select "${
            subselect.field
          }" from ${schema}"${sqlsanitize(subselect.table.name)}" where "${
            subselect.whereField
          }"=a."${ownField}")) ${sqlsanitize(fldnm)}`
        );
      else
        fldNms.push(
          `(select ${agg_and_field} from ${schema}"${sqlsanitize(
            table
          )}" where "${sqlsanitize(ref)}"=a."${ownField}"${
            whereStr ? ` and ${whereStr}` : ""
          }) ${sqlsanitize(fldnm)}`
        );
    }
  );
  if (!isNode()) values.unshift(...aggValues);
};
