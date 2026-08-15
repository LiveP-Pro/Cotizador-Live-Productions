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
