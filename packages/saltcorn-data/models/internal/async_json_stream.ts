// https://stackoverflow.com/a/37041949/19839414
// https://github.com/uhop/stream-json/issues/82#issuecomment-685289413

const { Writable } = require("stream");
const { chain } = require("stream-chain");
const { parser } = require("stream-json");
const fs = require("fs");
const { streamArray } = require("stream-json/streamers/StreamArray");

type AsyncConsumer<T> = (subString: T) => Promise<void>;

export default async function async_json_stream<T>(
  filename: string,
  asyncF: AsyncConsumer<T>
): Promise<void> {
  class WriteToDB extends Writable {
    constructor(options: any) {
      super({ ...options, objectMode: true });
    }

    _write(chunk: any, encoding: any, callback: any) {
      // this is the stuff you need:
      asyncF(chunk.value)
        .then(() => callback(null))
        .catch((error) => callback(error));
    }
  }
  const writerToDB = new WriteToDB({});

  const pipeline = chain([
    fs.createReadStream(filename),
    parser(),
    streamArray(),
    writerToDB,
  ]);
  return await new Promise((resolve, reject) => {
    pipeline.on("end", () => {
      resolve();
    });
  });
}
