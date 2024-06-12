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
import db from "../../db";

// TODO check valueFormula for sql injection
export const getAggAndField = (
  aggregate: string,
  field: string | undefined,
  valueFormula: string | undefined,
  orderBy?: string
) =>
  aggregate.toLowerCase() === "countunique"
    ? `count(distinct ${field ? `"${sqlsanitize(field)}"` : "*"})`
    : `${sqlsanitize(aggregate)}(${
        field ? `"${sqlsanitize(field)}"` : valueFormula || "*"
      }${
        orderBy && aggregate.toLowerCase() === "array_agg"
          ? ` order by "${sqlsanitize(orderBy)}"`
          : ""
      })`;

export const process_aggregations = (
  this_table: any, //Table
  aggregations: { [nm: string]: AggregationOptions },
  fldNms: string[],
  values: any[],
  schema: string
) => {
  let placeCounter = values.length;

  let aggValues: any = []; // for sqlite
  let Table = this_table.constructor;

  Object.entries<AggregationOptions>(aggregations).forEach(
    ([
      fldnm,
      {
        table,
        ref,
        field,
        valueFormula,
        where,
        aggregate,
        subselect,
        through,
        orderBy,
      },
    ]) => {
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
      const agg_and_field = getAggAndField(
        aggregate,
        field,
        valueFormula,
        orderBy
      );

      if (
        aggField?.is_fkey &&
        aggField.attributes.summary_field &&
        aggregate.toLowerCase() === "array_agg" &&
        field
      ) {
        let whereClause = ref
          ? `aggto."${sqlsanitize(ref)}"=a."${ownField}"`
          : "";
        if (whereStr) whereClause += (whereClause ? ` and ` : "") + whereStr;
        if (whereClause) whereClause = ` where ` + whereClause;
        const newFld = `(select array_agg(aggjoin."${sqlsanitize(
          aggField.attributes.summary_field
        )}") from ${schema}"${sqlsanitize(
          table
        )}" aggto join ${schema}"${sqlsanitize(
          aggField.reftable_name as string
        )}" aggjoin on aggto."${sqlsanitize(
          field
        )}" = aggjoin.id ${whereClause}) ${sqlsanitize(fldnm)}`;

        fldNms.push(newFld);
      } else if (field && aggregate.startsWith("Percent ")) {
        const targetBoolVal = aggregate.split(" ")[1] === "true";
        let whereClause = ref ? `"${sqlsanitize(ref)}"=a."${ownField}"` : "";
        if (whereStr) whereClause += (whereClause ? ` and ` : "") + whereStr;
        if (whereClause) whereClause = ` where ` + whereClause;
        fldNms.push(
          `(select avg( CASE WHEN "${sqlsanitize(field)}"=${JSON.stringify(
            !!targetBoolVal
          )} THEN 100.0 ELSE 0.0 END)  from ${schema}"${sqlsanitize(
            table
          )}" ${whereClause}) ${sqlsanitize(fldnm)}`
        );
      } else if (
        field &&
        (aggregate.startsWith("Latest ") || aggregate.startsWith("Earliest "))
      ) {
        const dateField = aggregate.split(" ")[1];
        const isLatest = aggregate.startsWith("Latest ");
        let whereClause = ref ? `"${sqlsanitize(ref)}"=a."${ownField}"` : "";
        if (whereStr) whereClause += (whereClause ? ` and ` : "") + whereStr;
        if (whereClause) whereClause = ` where ` + whereClause;
        fldNms.push(
          `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
            table
          )}" where "${dateField}"=(select ${
            isLatest ? `max` : `min`
          }("${dateField}") from ${schema}"${sqlsanitize(
            table
          )}" ${whereClause}) limit 1) ${sqlsanitize(fldnm)}`
        );
      } else if (subselect && ref)
        fldNms.push(
          `(select ${agg_and_field} from ${schema}"${sqlsanitize(
            table
          )}" where "${sqlsanitize(ref)}" in (select "${
            subselect.field
          }" from ${schema}"${sqlsanitize(subselect.table.name)}" where "${
            subselect.whereField
          }"=a."${ownField}")) ${sqlsanitize(fldnm)}`
        );
      else {
        let whereClause = ref ? `"${sqlsanitize(ref)}"=a."${ownField}"` : "";
        if (whereStr) whereClause += (whereClause ? ` and ` : "") + whereStr;
        if (whereClause) whereClause = ` where ` + whereClause;
        fldNms.push(
          `(select ${agg_and_field} from ${schema}"${sqlsanitize(
            table
          )}" ${whereClause}) ${sqlsanitize(fldnm)}`
        );
      }
    }
  );

  if (!isNode()) values.unshift(...aggValues);
};
