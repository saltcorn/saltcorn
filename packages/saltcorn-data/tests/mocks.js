const File = require("../models/file");
const fs = require("fs").promises;

const rick_file = async () => {
  await File.ensure_file_store();

  const mv = async fnm => {
    await fs.writeFile(fnm, "nevergonnagiveyouup");
  };
  return await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    10
  );
};

module.exports = { rick_file };
