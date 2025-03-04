const Workflow = require("../../models/workflow");
const Form = require("../../models/form");
const File = require("../../models/file");
const { div, script, domReady } = require("@saltcorn/markup/tags");
const { getState } = require("../../db/state");
const { spawn } = require("child_process");

const processRunner = (req, baseDirectory) => {
  return {
    runBuild: async () => {
      const dir = await File.findOne({ filename: baseDirectory });
      const location = dir.location;
      return new Promise((resolve, reject) => {
        const child = spawn("npm", ["run", "build"], {
          cwd: location,
        });
        child.stdout.on("data", (data) => {
          getState().log(5, data.toString());
        });
        child.stderr?.on("data", (data) => {
          getState().log(2, data.toString());
        });
        child.on("exit", function (code, signal) {
          getState().log(5, `child process exited with code ${code}`);
          resolve(code);
        });
        child.on("error", (msg) => {
          getState().log(`child process failed: ${msg.code}`);
          reject(msg.code);
        });
      });
    },
    npmInstall: async () => {
      const dir = await File.findOne({ filename: baseDirectory });
      const location = dir.location;
      return new Promise((resolve, reject) => {
        const child = spawn("npm", ["install"], {
          cwd: location,
        });
        child.stdout.on("data", (data) => {
          getState().log(5, data.toString());
        });
        child.stderr?.on("data", (data) => {
          getState().log(2, data.toString());
        });
        child.on("exit", function (code, signal) {
          getState().log(5, `child process exited with code ${code}`);
          resolve(code);
        });
        child.on("error", (msg) => {
          getState().log(`child process failed: ${msg.code}`);
          reject(msg.code);
        });
      });
    },
  };
};

const resourceWriter = (req, baseDirectory, mainCode) => {
  const userId = req?.user?.id;
  const minRole = req?.user?.role_id || 100;
  return {
    writeIndexJs: async () => {
      const allFiles = await File.find({
        folder: baseDirectory,
      });
      const oldFile = allFiles.find((f) => f.filename === "index.js");
      if (oldFile) await oldFile.overwrite_contents(mainCode);
      else {
        await File.from_contents(
          "index.js",
          "application/javascript",
          mainCode,
          userId,
          minRole,
          baseDirectory
        );
      }
    },
    writePackageJson: async () => {
      await File.from_contents(
        "package.json",
        "application/json",
        JSON.stringify({
          name: "saltcorn-react-view",
          version: "1.0.0",
          description: "React view",
          main: "index.js",
          scripts: {
            build: "webpack --mode development",
          },
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            webpack: "5.97.1",
            "webpack-cli": "6.0.1",
            "babel-loader": "^10.0.0",
            "@babel/core": "^7.26.9",
            "@babel/preset-env": "^7.26.9",
            "@babel/preset-react": "^7.26.3",
          },
        }),
        userId,
        minRole,
        baseDirectory
      );
    },
    writeWebpackConfig: async () => {
      await File.from_contents(
        "webpack.config.js",
        "application/javascript",
        `const path = require('path');
    module.exports = {
      entry: './index.js',
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
      },
      module: {
        rules: [
          {
            test: /.js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
            },
          },
        ],
      },
      mode: 'development',
    };`,
        userId,
        minRole,
        baseDirectory
      );
    },
    writeBabelRc: async () => {
      await File.from_contents(
        ".babelrc",
        "application/json",
        `{
      "presets": ["@babel/preset-env", "@babel/preset-react"]
    }`,
        userId,
        minRole,
        baseDirectory
      );
    },
  };
};

const prepareDirectory = async (req, baseDirectory, mainCode) => {
  const baseDir = await File.findOne(baseDirectory);
  if (!baseDir) throw new Error("Base directory not found");
  const writer = resourceWriter(req, baseDirectory, mainCode);
  const runner = processRunner(req, baseDirectory);
  const allFiles = await File.find({
    folder: baseDirectory,
    hiddenFiles: true,
  });
  if (!allFiles.find((f) => f.filename === "package.json"))
    await writer.writePackageJson(baseDirectory);
  await runner.npmInstall(baseDirectory);
  if (!allFiles.find((f) => f.filename === "webpack.config.js"))
    await writer.writeWebpackConfig(baseDirectory);
  if (!allFiles.find((f) => f.filename === ".babelrc"))
    await writer.writeBabelRc(baseDirectory);
  await writer.writeIndexJs(baseDirectory, mainCode);
  await runner.runBuild(baseDirectory);
};

const configuration_workflow = (req) =>
  new Workflow({
    onDone: async (context) => {
      if (context.build_base_directory)
        await prepareDirectory(req, context.base_directory, context.main_code);
      return context;
    },
    steps: [
      {
        name: "Build settings",
        form: async (context) => {
          const directories = await File.find({ isDirectory: true });
          return new Form({
            fields: [
              {
                name: "build_base_directory",
                label: "Build base directory",
                sublabel:
                  "Prepare and build your base directory (see help). " +
                  "Deselect, if you want to do this on your own.",
                type: "Bool",
                default: true,
                help: {
                  topic: "Build base directory",
                },
              },
              {
                name: "main_code",
                label: "Main code",
                input_type: "code",
                required: true,
                help: {
                  topic: "React main code",
                },
              },
              {
                name: "base_directory",
                label: "Base directory",
                sublabel: "This is the base directory for your Rect code",
                type: "String",
                required: true,
                attributes: {
                  options: directories.map((d) => d.path_to_serve),
                },
              },
              {
                name: "root_element_id",
                label: "Root element id",
                sublabel: "The root id for your React root element",
                type: "String",
                default: "root",
              },
            ],
            additionalButtons: [
              {
                label: "build",
                onclick: `view_post('${context.viewname}', 'run_build', {});`,
                class: "btn btn-primary",
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = () => [];

const run = async (
  table_id,
  viewname,
  { base_directory, root_element_id },
  state,
  extra
) => {
  return (
    div({ id: root_element_id || "root" }) +
    script({
      src: `/files/serve/${base_directory}/dist/bundle.js`,
    })
  );
};

const run_build = async (
  table_id,
  viewname,
  { main_code, base_directory },
  body,
  { req, res }
) => {
  await prepareDirectory(req, base_directory, main_code);
};

module.exports = {
  name: "React view",
  description: "React view",
  get_state_fields,
  configuration_workflow,
  run,
  routes: { run_build },
};
