/*global window, FileReader*/

async function fileExists(path) {
  try {
    await getDirEntry(path);
    return true;
  } catch (error) {
    return false;
  }
}

function getDirEntry(directory) {
  return new Promise((resolve, reject) => {
    window.resolveLocalFileSystemURL(
      directory,
      function (fs) {
        resolve(fs);
      },
      function (error) {
        reject(error);
      }
    );
  });
}

async function readJSON(fileName, dirName) {
  const text = await readText(fileName, dirName);
  return JSON.parse(text);
}

async function readText(fileName, dirName) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        fileEntry.file(function (file) {
          let reader = new FileReader();
          reader.onloadend = function (e) {
            resolve(this.result);
          };
          reader.readAsText(file);
        });
      },
      function (err) {
        console.log(`unable to read  ${fileName}`);
        console.log(err);
        reject(err);
      }
    );
  });
}

async function readBinary(fileName, dirName) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        fileEntry.file(function (file) {
          let reader = new FileReader();
          reader.onloadend = function (e) {
            resolve(this.result);
          };
          reader.readAsArrayBuffer(file);
        });
      },
      function (err) {
        console.log(`unable to read  ${fileName}`);
        console.log(err);
        reject(err);
      }
    );
  });
}

async function write(fileName, dirName, content) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: true, exclusive: false },
      function (fileEntry) {
        fileEntry.createWriter(function (fileWriter) {
          fileWriter.onwriteend = function () {
            resolve();
          };
          fileWriter.onerror = function (e) {
            console.log("Failed file write: " + e.toString());
            reject(e);
          };
          fileWriter.write(content);
        });
      },
      function (err) {
        console.log(`unable to get ${fileName}`);
        console.log(err);
        reject(err);
      }
    );
  });
}

async function writeJSON(fileName, dirName, content) {
  await write(fileName, dirName, JSON.stringify(content));
}
