const fs = require("fs");
const { eval_expression } = require("./models/expression");

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

module.exports = { get_predictor, write_csv };
