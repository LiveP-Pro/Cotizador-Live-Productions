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

function isDirectory(fileSystem, directoryPath) {
  try {
    return fileSystem.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function readDirectory(fileSystem, directoryPath) {
  try {
    return fileSystem.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function snapshotCandidates(dataDirectory, fileSystem) {
  const candidates = [
    path.join(dataDirectory, "luxury-travel.json"),
    path.join(dataDirectory, "luxury-travel-recovery.json"),
    path.join(dataDirectory, "luxury-travel", "luxury-travel.json"),
  ];
  const backupDirectories = [
    path.join(dataDirectory, "luxury-travel-backups"),
    path.join(dataDirectory, "luxury-travel", "backups"),
  ];

  for (const backupDirectory of backupDirectories) {
    for (const entry of readDirectory(fileSystem, backupDirectory)) {
      const entryName = typeof entry === "string" ? entry : entry.name;
      const isFile = typeof entry === "string" || entry.isFile?.();
      if (isFile && entryName.endsWith(".json")) {
        candidates.push(path.join(backupDirectory, entryName));
      }
    }
  }
  return candidates;
}

function validSnapshotMtime(fileSystem, filePath) {
  try {
    const snapshot = JSON.parse(fileSystem.readFileSync(filePath, "utf8"));
    const collections = ["users", "clients", "drivers", "vehicles", "quotes", "itineraries", "history"];
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      !snapshot.settings ||
      !snapshot.rates ||
      collections.some((name) => !Array.isArray(snapshot[name]))
    ) {
      return 0;
    }
    return Number(fileSystem.statSync(filePath).mtimeMs || 1);
  } catch {
    return 0;
  }
}

function latestValidSnapshotMtime(fileSystem, dataDirectory) {
  return snapshotCandidates(dataDirectory, fileSystem).reduce(
    (latest, candidate) => Math.max(latest, validSnapshotMtime(fileSystem, candidate)),
    0,
  );
}

function equivalentDataDirectories(normalizedDataDir, mountInfo, fileSystem) {
  const candidates = mountPointsFromInfo(mountInfo).filter(
    (mountPoint) =>
      mountPoint !== normalizedDataDir &&
      mountPoint.trimEnd() === normalizedDataDir &&
      isDirectory(fileSystem, mountPoint),
  );

  const parentDirectory = path.dirname(normalizedDataDir);
  for (const entry of readDirectory(fileSystem, parentDirectory)) {
    const entryName = typeof entry === "string" ? entry : entry.name;
    const canBeDirectory = typeof entry === "string" || entry.isDirectory?.() || entry.isSymbolicLink?.();
    if (!canBeDirectory) continue;
    const candidate = path.join(parentDirectory, entryName);
    if (
      candidate !== normalizedDataDir &&
      candidate.trimEnd() === normalizedDataDir &&
      isDirectory(fileSystem, candidate)
    ) {
      candidates.push(candidate);
    }
  }

  return [...new Set(candidates)];
}

function resolveLuxuryDataDir(configuredDataDir, options = {}) {
  const environment = options.environment || process.env;
  const fileSystem = options.fileSystem || fs;
  const explicitDataDir = String(environment.LUXURY_DATA_DIR || "");
  const normalizedDataDir = path.resolve(explicitDataDir || configuredDataDir);
  let mountInfo = options.mountInfo;
  if (mountInfo === undefined) {
    try {
      mountInfo = fileSystem.readFileSync("/proc/self/mountinfo", "utf8");
    } catch {
      mountInfo = "";
    }
  }

  const equivalentDirectories = equivalentDataDirectories(
    normalizedDataDir,
    mountInfo,
    fileSystem,
  );
  const allCandidates = [...equivalentDirectories, normalizedDataDir];
  const dataBackedCandidate = allCandidates
    .map((directory) => ({
      directory,
      modifiedAt: latestValidSnapshotMtime(fileSystem, directory),
    }))
    .filter((candidate) => candidate.modifiedAt > 0)
    .sort((first, second) => second.modifiedAt - first.modifiedAt)[0];

  return dataBackedCandidate?.directory || equivalentDirectories[0] || normalizedDataDir;
}

module.exports = {
  decodeMountInfoPath,
  mountPointsFromInfo,
  resolveLuxuryDataDir,
};
