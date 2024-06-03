/* eslint-disable @typescript-eslint/no-var-requires */
const child_process = require("child_process");
const process = require("process");

let targets = [];
switch (process.platform) {
    case "win32":
        targets = ["i686-pc-windows-msvc", "x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc"];
    break;

    case "darwin":
        targets = ["x86_64-apple-darwin", "aarch64-apple-darwin"];
    break;

    default:
    switch (process.architecture) {
      case "x86_64":
        targets = ["x86_64-unknown-linux-musl"];
      break;

      case "arm64":
        targets = ["aarch64-unknown-linux-musl"];
      break;
    break;
    }
}

targets.forEach(target => {
    child_process.execSync(`npm run build -- --target ${target}`, {stdio: 'inherit'});
});
