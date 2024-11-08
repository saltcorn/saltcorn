import { Filesystem, Encoding } from "@capacitor/filesystem";

export async function write_new(name, directory, content) {
  try {
    await Filesystem.writeFile({
      path: name,
      data: content,
      directory: directory,
      encoding: Encoding.UTF8,
    });
  } catch (error) {
    console.log("Unable to write file", error);
    throw error;
  }
}

export async function read_new(name, directory) {
  try {
    const contents = await Filesystem.readFile({
      path: name,
      directory: directory,
      encoding: Encoding.UTF8,
    });
    return contents.data;
  } catch (error) {
    console.log("Unable to read file", error);
    throw error;
  }
}

export async function fileExists_new(name, directory) {
  try {
    await Filesystem.stat({ path: name, directory: directory });
    return true;
  } catch (error) {
    return false;
  }
}

export async function writeJSON_new(name, directory, json) {
  const contents = JSON.stringify(json);
  await write_new(name, directory, contents);
}

export async function readJSON_new(name, directory) {
  const contents = await read_new(name, directory);
  return JSON.parse(contents);
}

export async function fileExists(path) {
  try {
    await getDirEntry(path);
    return true;
  } catch (error) {
    return false;
  }
}

export function getDirEntry(directory) {
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

export const copyFile = async (srcEntry, destEntry) => {
  return new Promise((resolve, reject) => {
    srcEntry.copyTo(
      destEntry,
      srcEntry.name,
      function (fileEntry) {
        resolve(fileEntry);
      },
      function (err) {
        console.log(`unable to copy ${srcEntry.name}`);
        console.log(err);
        reject(err);
      }
    );
  });
};

export async function getFile(fileName, dirName) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        resolve(fileEntry);
      },
      function (err) {
        console.log(`unable to get ${fileName}`);
        console.log(err);
        reject(err);
      }
    );
  });
}

export async function createDir(dirName, location) {
  const dirEntry = await getDirEntry(location);
  return new Promise((resolve, reject) => {
    dirEntry.getDirectory(
      dirName,
      { create: true, exclusive: false },
      function (dirEntry) {
        resolve(dirEntry);
      },
      function (err) {
        console.log(`unable to create ${dirName}`);
        console.log(err);
        reject(err);
      }
    );
  });
}

export async function readJSON(fileName, dirName) {
  const text = await readText(fileName, dirName);
  return JSON.parse(text);
}

export async function readText(fileName, dirName) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        fileEntry.file(function (file) {
          let reader = new FileReader();
          reader.onloadend = function (/*e*/) {
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

export async function readBinary(fileName, dirName) {
  const dirEntry = await getDirEntry(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        fileEntry.file(function (file) {
          let reader = new FileReader();
          reader.onloadend = function (/*e*/) {
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

export async function write(fileName, dirName, content) {
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

export async function writeJSON(fileName, dirName, content) {
  await write(fileName, dirName, JSON.stringify(content));
}
