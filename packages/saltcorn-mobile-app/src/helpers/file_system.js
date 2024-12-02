import { Filesystem, Encoding, Directory } from "@capacitor/filesystem";

export async function writeFile(name, directory, content) {
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

export async function readFile(name, directory) {
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

export async function fileExists(name, directory) {
  try {
    await Filesystem.stat({ path: name, directory: directory });
    return true;
  } catch (error) {
    return false;
  }
}

export async function writeJSON(name, directory, json) {
  const contents = JSON.stringify(json);
  await writeFile(name, directory, contents);
}

function getDirEntryCordova(directory) {
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

export async function readBinaryCordova(fileName, dirName) {
  const dirEntry = await getDirEntryCordova(dirName);
  return new Promise((resolve, reject) => {
    dirEntry.getFile(
      fileName,
      { create: false, exclusive: false },
      function (fileEntry) {
        fileEntry.file(function (file) {
          let reader = new FileReader();
          reader.onloadend = function (e) {
            resolve({ buffer: this.result, file: file });
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

// TODO get this working
// export function normalizeFilePath(filePath) {
//   if (filePath.startsWith("file:///")) {
//     return filePath.replace("file:///storage/emulated/0/", "");
//   }
//   return filePath;
// }

// export async function readBinary(name, directory) {
//   try {
//     const file = await Filesystem.readFile({
//       path: normalizeFilePath(`${directory}/${name}`),
//       directory: Directory.ExternalStorage,
//     });
//     return Uint8Array.from(file.data, (char) => char.charCodeAt(0));
//   } catch (error) {
//     console.log("Unable to read file", error);
//     throw error;
//   }
// }
