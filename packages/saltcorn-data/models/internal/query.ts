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
  Value,
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
    : `${
        aggregate.toLowerCase() === "array_agg" && db.isSQLite
          ? "json_group_array"
          : sqlsanitize(aggregate)
      }(${field ? `"${sqlsanitize(field)}"` : valueFormula || "*"}${
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
        const newFld = `(select ${
          db.isSQLite ? "json_group_array" : "array_agg"
        }(aggjoin."${sqlsanitize(
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
        let whereClause = "";
        let whereClause1 = ref ? `"${sqlsanitize(ref)}"=a."${ownField}"` : "";
        if (whereStr) whereClause1 += (whereClause1 ? ` and ` : "") + whereStr;
        if (whereClause1) whereClause = ` where ` + whereClause1;
        fldNms.push(
          `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
            table
          )}" where "${dateField}"=(select ${
            isLatest ? `max` : `min`
          }("${dateField}") from ${schema}"${sqlsanitize(
            table
          )}" ${whereClause})${
            whereClause1 ? ` and ${whereClause1}` : ""
          } limit 1) ${sqlsanitize(fldnm)}`
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

export const aggregation_query_fields = (
  table_name: string,
  aggregations: {
    [nm: string]: {
      field?: string;
      valueFormula?: string;
      aggregate: string;
    };
  },
  options?: {
    where?: Where;
    groupBy?: string[] | string;
    schema?: string;
  }
): {
  fldNms: string[];
  sql: string;
  values: Value[];
  where: string;
  groupBy: string[] | null;
} => {
  let fldNms: string[] = [];
  const where0 = options?.where || {};
  const groupBy = Array.isArray(options?.groupBy)
    ? (options?.groupBy as string[])
    : options?.groupBy
      ? [options?.groupBy]
      : null;
  const schema = options?.schema || db.getTenantSchemaPrefix();
  const { where, values } = mkWhere(where0, db.isSQLite);
  Object.entries(aggregations).forEach(
    ([nm, { field, valueFormula, aggregate }]) => {
      if (
        field &&
        (aggregate.startsWith("Percent ") || aggregate.startsWith("Percent "))
      ) {
        const targetBoolVal = aggregate.split(" ")[1] === "true";

        fldNms.push(
          `avg( CASE WHEN "${sqlsanitize(field)}"=${JSON.stringify(
            !!targetBoolVal
          )} THEN 100.0 ELSE 0.0 END) as "${sqlsanitize(nm)}"`
        );
      } else if (
        field &&
        (aggregate.startsWith("Latest ") || aggregate.startsWith("Earliest "))
      ) {
        const dateField = aggregate.split(" ")[1];
        const isLatest = aggregate.startsWith("Latest ");

        let newWhere = where;
        if (groupBy) {
          const newClauses = groupBy
            .map((f) => `innertbl."${f}" = a."${f}"`)
            .join(" AND ");
          if (!newWhere) newWhere = "where " + newClauses;
          else newWhere = `${newWhere} AND ${newClauses}`;
        }
        fldNms.push(
          `(select ${
            field ? `"${sqlsanitize(field)}"` : valueFormula
          } from ${schema}"${sqlsanitize(
            table_name
          )}" innertbl ${newWhere} order by "${sqlsanitize(dateField)}" ${
            isLatest ? "DESC" : "ASC"
          } limit 1) as "${sqlsanitize(nm)}"`
        );
      } else
        fldNms.push(
          `${getAggAndField(
            aggregate,
            field === "Formula" ? undefined : field,
            field === "Formula" ? valueFormula : undefined
          )} as "${sqlsanitize(nm)}"`
        );
    }
  );
  if (groupBy) {
    fldNms.push(...groupBy);
  }
  const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
    table_name
  )}" a ${where}${
    groupBy ? ` group by ${groupBy.map((f) => sqlsanitize(f)).join(", ")}` : ""
  }`;

  return { fldNms, sql, where, values, groupBy };
};
