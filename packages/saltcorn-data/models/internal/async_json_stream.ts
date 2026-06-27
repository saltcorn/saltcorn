// https://stackoverflow.com/a/37041949/19839414
// https://github.com/uhop/stream-json/issues/82#issuecomment-685289413

import _sc_stream from "stream";
import _sc_stream_chain from "stream-chain";
import _sc_stream_json from "stream-json";
import _sc_fs from "fs";
import _sc_stream_json_streamers_StreamArray from "stream-json/streamers/StreamArray.js";
const { Writable } = (_sc_stream as any);
const { chain } = (_sc_stream_chain as any);
const { parser } = (_sc_stream_json as any);
const fs = (_sc_fs as any);
const { streamArray } = (_sc_stream_json_streamers_StreamArray as any);

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
