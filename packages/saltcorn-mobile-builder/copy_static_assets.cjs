const fs = require("fs");
const path = require("path");

// The xcodeproj helper is plain Ruby, not compiled by tsc - copy it into
// dist so it ships next to the compiled JS that shells out to it.
fs.mkdirSync(path.join(__dirname, "dist", "utils", "xcode"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(__dirname, "utils", "xcode", "create_share_extension.rb"),
  path.join(__dirname, "dist", "utils", "xcode", "create_share_extension.rb")
);
