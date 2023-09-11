const fs = require("fs");
const { eval_expression } = require("./models/expression");
const fsp = fs.promises;

const util = require("util");
const exec = util.promisify(require("child_process").exec);

const get_predictor = (nbfile) => {
  const ipynb = JSON.parse(fs.readFileSync(nbfile));
  const cells = ipynb.cells;
  const predCell = cells.find((cell) =>
    cell.source.some((ln) => ln.includes("def predict("))
  );
  return predCell.source.join("");
};

const write_csv = async (rows, columns, fields, filename) => {
  return new Promise((resolve, reject) => {
    const colWriters = [];
    /*let idSupply = 0;
  const getId = () => {
    idSupply++;
    return idSupply;
  };*/
    columns.forEach((column) => {
      switch (column.type) {
        case "FormulaValue":
          colWriters.push({
            header: column.header_label,
            write: (row) => eval_expression(column.formula, row),
          });
          break;
        case "Field":
          let f = fields.find((fld) => fld.name === column.field_name);
          if (f.type.name === "FloatArray") {
            const dims = rows.map((r) => r[column.field_name].length);
            const maxDims = Math.max(...dims);
            for (let i = i < maxDims; i++; ) {
              colWriters.push({
                header: column.field_name + i,
                write: (row) => row[column.field_name][i],
              });
            }
          } else {
            colWriters.push({
              header: column.field_name,
              write: (row) => row[column.field_name],
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

function shorten_trackback(s) {
  if (!s) return s;
  //https://stackoverflow.com/a/29497680/19839414

  const noAnsi = (t) =>
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
}) => {
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
  } catch (e) {
    return {
      error: shorten_trackback(e.message),
    };
  }
  //pick up
  const fit_object = await fsp.readFile("/tmp/scanomallymodel");
  const report = await fsp.readFile("/tmp/scmodelreport.html");
  const metric_values = JSON.parse(
    await fsp.readFile("/tmp/scmodelmetrics.json")
  );
  return {
    fit_object,
    report,
    metric_values,
  };
};

module.exports = {
  get_predictor,
  write_csv,
  shorten_trackback,
  run_jupyter_model,
};
