const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLuxuryDataDir } = require("../lib/platform-storage.cjs");

const directoryFileSystem = {
  statSync() {
    return { isDirectory: () => true };
  },
};

test("uses the exact configured directory when it is the mounted path", () => {
  const result = resolveLuxuryDataDir("/data", {
    environment: {},
    fileSystem: directoryFileSystem,
    mountInfo: "31 20 0:22 / /data rw,relatime - ext4 /dev/nvme0n1 rw",
  });

  assert.equal(result, "/data");
});

test("detects a mounted directory with an invisible trailing space", () => {
  const result = resolveLuxuryDataDir("/data", {
    environment: {},
    fileSystem: directoryFileSystem,
    mountInfo: "31 20 0:22 / /data\\040 rw,relatime - ext4 /dev/nvme0n1 rw",
  });

  assert.equal(result, "/data ");
});

test("honors a dedicated Luxury directory when configured", () => {
  const result = resolveLuxuryDataDir("/data", {
    environment: { LUXURY_DATA_DIR: "/persistent/luxury" },
    fileSystem: directoryFileSystem,
    mountInfo: "",
  });

  assert.equal(result, "/persistent/luxury");
});

test("recovers an equivalent directory when the dedicated Luxury path has no snapshot", () => {
  const validSnapshot = JSON.stringify({
    users: [],
    clients: [],
    drivers: [],
    vehicles: [],
    quotes: [],
    itineraries: [],
    history: [],
    settings: {},
    rates: {},
  });
  const fileSystem = {
    readFileSync(filePath) {
      if (filePath === "/data /luxury-travel.json") return validSnapshot;
      throw new Error("missing");
    },
    readdirSync() {
      return [];
    },
    statSync(filePath) {
      if (filePath === "/data" || filePath === "/data ") {
        return { isDirectory: () => true, mtimeMs: 0 };
      }
      if (filePath === "/data /luxury-travel.json") {
        return { isDirectory: () => false, mtimeMs: 300 };
      }
      throw new Error("missing");
    },
  };

  const result = resolveLuxuryDataDir("/fallback", {
    environment: { LUXURY_DATA_DIR: "/data" },
    fileSystem,
    mountInfo: "31 20 0:22 / /data\\040 rw,relatime - ext4 /dev/nvme0n1 rw",
  });

  assert.equal(result, "/data ");
});

test("finds a trailing-space data directory even when mount information is unavailable", () => {
  const fileSystem = {
    readFileSync(filePath) {
      if (filePath === "/proc/self/mountinfo") throw new Error("not available");
      throw new Error("not a snapshot");
    },
    readdirSync(directoryPath) {
      if (directoryPath === "/") {
        return [
          { name: "data", isDirectory: () => true },
          { name: "data ", isDirectory: () => true },
        ];
      }
      return [];
    },
    statSync(filePath) {
      if (filePath === "/data" || filePath === "/data ") {
        return { isDirectory: () => true };
      }
      throw new Error("missing");
    },
  };

  const result = resolveLuxuryDataDir("/data", {
    environment: {},
    fileSystem,
  });

  assert.equal(result, "/data ");
});

test("prefers the directory containing the newest valid Luxury snapshot", () => {
  const validSnapshot = JSON.stringify({
    users: [],
    clients: [],
    drivers: [],
    vehicles: [],
    quotes: [],
    itineraries: [],
    history: [],
    settings: {},
    rates: {},
  });
  const fileSystem = {
    readFileSync(filePath) {
      if (filePath === "/data /luxury-travel-recovery.json") return validSnapshot;
      throw new Error("missing");
    },
    readdirSync() {
      return [];
    },
    statSync(filePath) {
      if (filePath === "/data" || filePath === "/data ") {
        return { isDirectory: () => true, mtimeMs: 0 };
      }
      if (filePath === "/data /luxury-travel-recovery.json") {
        return { isDirectory: () => false, mtimeMs: 200 };
      }
      throw new Error("missing");
    },
  };

  const result = resolveLuxuryDataDir("/data", {
    environment: {},
    fileSystem,
    mountInfo: "31 20 0:22 / /data\\040 rw,relatime - ext4 /dev/nvme0n1 rw",
  });

  assert.equal(result, "/data ");
});
