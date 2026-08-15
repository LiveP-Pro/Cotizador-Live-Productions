const fs = require("node:fs");
const path = require("node:path");

function decodeMountInfoPath(value) {
  return String(value || "").replace(/\\([0-7]{3})/g, (_match, octal) =>
    String.fromCharCode(Number.parseInt(octal, 8)),
  );
}

function mountPointsFromInfo(mountInfo) {
  return String(mountInfo || "")
    .split(/\r?\n/)
    .map((line) => line.split(" - ")[0]?.split(" ")[4])
    .filter(Boolean)
    .map(decodeMountInfoPath);
}

function resolveLuxuryDataDir(configuredDataDir, options = {}) {
  const environment = options.environment || process.env;
  const fileSystem = options.fileSystem || fs;
  const explicitDataDir = String(environment.LUXURY_DATA_DIR || "");
  if (explicitDataDir) return path.resolve(explicitDataDir);

  const normalizedDataDir = path.resolve(configuredDataDir);
  let mountInfo = options.mountInfo;
  if (mountInfo === undefined) {
    try {
      mountInfo = fileSystem.readFileSync("/proc/self/mountinfo", "utf8");
    } catch {
      return normalizedDataDir;
    }
  }

  const equivalentMount = mountPointsFromInfo(mountInfo).find((mountPoint) => {
    if (mountPoint === normalizedDataDir || mountPoint.trimEnd() !== normalizedDataDir) {
      return false;
    }
    try {
      return fileSystem.statSync(mountPoint).isDirectory();
    } catch {
      return false;
    }
  });

  return equivalentMount || normalizedDataDir;
}

module.exports = {
  decodeMountInfoPath,
  mountPointsFromInfo,
  resolveLuxuryDataDir,
};
