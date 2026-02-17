/**
 * Model-helper
 * @category saltcorn-data
 * @module model-helper
 */
import fs from "fs";
import { Column } from "@saltcorn/types/base_types";
import type { Row } from "@saltcorn/db-common/internal";
import type Field from "./models/field";
const { eval_expression } = require("./models/expression");
const util = require("util");

const fsp = fs.promises;
const exec = util.promisify(require("child_process").exec);

interface NotebookCell {
  source: string[];
  [key: string]: any;
}

interface Notebook {
  cells: NotebookCell[];
  [key: string]: any;
}

interface ColumnWriter {
  header: string;
  write: (row: any) => any;
}

interface RunJupyterModelParams {
  csvPath: string;
  configuration: any;
  hyperparameters: any;
  ipynbPath: string;
}

interface ModelResult {
  error?: string;
  fit_object?: Buffer;
  report?: Buffer;
  metric_values?: any;
}

const get_predictor = (nbfile: string): string => {
  const ipynb: Notebook = JSON.parse(fs.readFileSync(nbfile, "utf-8"));
  const cells = ipynb.cells;
  const predCell = cells.find((cell) =>
    cell.source.some((ln) => ln.includes("def predict("))
  );
  if (!predCell) {
    throw new Error("No predict function found in notebook");
  }
  return predCell.source.join("");
};

const write_csv = async (
  rows: Row[],
  columns: Column[],
  fields: Field[],
  filename: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const colWriters: ColumnWriter[] = [];
    /*let idSupply = 0;
  const getId = () => {
    idSupply++;
    return idSupply;
  };*/
    columns.forEach((column) => {
      switch (column.type) {
        case "FormulaValue":
          if (column.formula) {
            colWriters.push({
              header: column.header_label || "",
              write: (row) => eval_expression(column.formula!, row),
            });
          }
          break;
        case "Field":
          let f = fields.find((fld) => fld.name === column.field_name);
          if (!f) break;
          if (f.type_name === "FloatArray") {
            const dims = rows.map((r) => r[column.field_name!].length);
            const maxDims = Math.max(...dims);
            for (let i = 0; i < maxDims; i++) {
              colWriters.push({
                header: column.field_name! + i,
                write: (row) => row[column.field_name!][i],
              });
            }
          } else if (f.type_name === "PGVector") {
            rows.forEach((row) => {
              const pgvs = row[column.field_name!];
              if (!pgvs) return;
              row[column.field_name!] = JSON.parse(pgvs);
            });
            const row0 = rows.find((r) => r[column.field_name!]);
            if (row0) {
              const dims = row0[column.field_name!].length;
              for (let i = 0; i < dims; i++) {
                colWriters.push({
                  header: column.field_name! + i,
                  write: (row) => {
                    const pgvs = row[column.field_name!];
                    if (!pgvs) return "";
                    return pgvs[i];
                  },
                });
              }
            }
          } else if (f.type_name === "Bool") {
            colWriters.push({
              header: column.field_name!,
              write: (row) =>
                row[column.field_name!] === true
                  ? 1.0
                  : row[column.field_name!] === false
                  ? 0.0
                  : "",
            });
          } else {
            colWriters.push({
              header: column.field_name!,
              write: (row) => row[column.field_name!],
            });
          }
          break;

        default:
          break;
      }
    });
    const outstream = fs.createWriteStream(filename);
    outstream.write(colWriters.map((cw) => cw.header).join(",") + "\n");
    rows.forEach((row) => {
      outstream.write(colWriters.map((cw) => cw.write(row)).join(",") + "\n");
    });
    outstream.end();
    //https://stackoverflow.com/a/39880990/19839414
    outstream.on("finish", () => {
      resolve();
    });
    outstream.on("error", reject);
  });
};

function shorten_trackback(s: string | undefined): string | undefined {
  if (!s) return s;
  //https://stackoverflow.com/a/29497680/19839414

  const noAnsi = (t: string) =>
    t.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ""
    );
  const parts = s.split("nbclient.exceptions.CellExecutionError: ");
  if (parts.length === 2) return noAnsi(parts[1]);
  return noAnsi(s);
}

const run_jupyter_model = async ({
  csvPath,
  configuration,
  hyperparameters,
  ipynbPath,
}: RunJupyterModelParams): Promise<ModelResult> => {
  try {
    //run notebook
    await exec(
      `jupyter nbconvert --to html --ClearOutputPreprocessor.enabled=True --embed-images ${ipynbPath} --execute --output /tmp/scmodelreport.html`,
      {
        cwd: "/tmp",
        env: {
          ...process.env,
          SC_MODEL_CFG: JSON.stringify(configuration),
          SC_MODEL_HYPERPARAMS: JSON.stringify(hyperparameters),
          SC_MODEL_DATA_FILE: csvPath,
          SC_MODEL_FIT_DEST: "/tmp/scanomallymodel",
          SC_MODEL_METRICS_DEST: "/tmp/scmodelmetrics.json",
        },
      }
    );
  } catch (e: any) {
    return {
      error: shorten_trackback(e.message),
    };
  }
  //pick up
  const fit_object = await fsp.readFile("/tmp/scanomallymodel");
  const report = await fsp.readFile("/tmp/scmodelreport.html");
  const metric_values = JSON.parse(
    await fsp.readFile("/tmp/scmodelmetrics.json", "utf-8")
  );
  return {
    fit_object,
    report,
    metric_values,
  };
};

export { get_predictor, write_csv, shorten_trackback, run_jupyter_model };
