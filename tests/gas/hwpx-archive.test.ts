import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

// Python zipfile output: deflated HWPX entries, extended timestamp fields, archive comment.
const nativeZip =
  "UEsDBBQAAAAIAABgal2C8EFHFQAAABMAAAAIAAkAbWltZXR5cGVVVAUAAQAAAABLLCjIyUxOLMnMz9PPKC/QrsosAABQSwMEFAAAAAgAAGBqXSVz3owMAAAACgAAABUACQBDb250ZW50cy9zZWN0aW9uMC54bWxVVAUAAQAAAACzKU5NLsnMz9O3AwBQSwMEFAAAAAgAAGBqXaiR5RoMAAAACgAAAAsACQB2ZXJzaW9uLnhtbFVUBQABAAAAALMpSy0qzszP07cDAFBLAQIUABQAAAAIAABgal2C8EFHFQAAABMAAAAIAAkAAAAAAAAAAACAAQAAAABtaW1ldHlwZVVUBQABAAAAAFBLAQIUABQAAAAIAABgal0lc96MDAAAAAoAAAAVAAkAAAAAAAAAAACAAUQAAABDb250ZW50cy9zZWN0aW9uMC54bWxVVAUAAQAAAABQSwECFAAUAAAACAAAYGpdqJHlGgwAAAAKAAAACwAJAAAAAAAAAAAAgAGMAAAAdmVyc2lvbi54bWxVVAUAAQAAAABQSwUGAAAAAAMAAwDNAAAAygAAABMAbmF0aXZlIHppcCBtZXRhZGF0YQ==";
function fixture() {
  let decompressions = 0;
  const context = vm.createContext({
    Utilities: {
      newBlob: (bytes: number[]) => bytes,
      unzip: () => {
        decompressions++;
        return ["mimetype", "Contents/section0.xml", "version.xml"].map(
          (name) => ({
            getName: () => name,
            getDataAsString: () =>
              name === "mimetype" ? "application/hwp+zip" : "<xml/>",
          }),
        );
      },
    },
  });
  vm.runInContext(readFileSync("gas/Code.js", "utf8"), context);
  vm.runInContext(readFileSync("gas/Documents.js", "utf8"), context);
  const d = context.documentServices({ getProperty: () => null });
  return {
    bytes: Buffer.from(nativeZip, "base64"),
    validate: (bytes: Buffer) => d.validateHwpx(Array.from(bytes)),
    decompressions: () => decompressions,
  };
}
it("allows native ZIP timestamp extras and comments before normal HWPX validation", () => {
  const f = fixture();
  expect(() => f.validate(f.bytes)).not.toThrow();
  expect(f.decompressions()).toBe(1);
});
it.each([
  "entry-size",
  "total-size",
  "zip64",
  "zip64-extra",
  "malformed-extra",
  "encryption",
  "offset",
  "too-many",
  "truncated",
])("rejects %s metadata before allocating decompression memory", (mode) => {
  const f = fixture(),
    bytes = f.bytes;
  const central = bytes.indexOf(Buffer.from([80, 75, 1, 2]));
  const end = bytes.indexOf(Buffer.from([80, 75, 5, 6]));
  if (mode === "entry-size")
    bytes.writeUInt32LE(40 * 1048576 + 1, central + 24);
  if (mode === "total-size") {
    let at = central;
    for (let n = 0; n < 3; n++) {
      bytes.writeUInt32LE(24 * 1048576, at + 24);
      bytes.writeUInt32LE(24 * 1048576, bytes.readUInt32LE(at + 42) + 22);
      at = bytes.indexOf(Buffer.from([80, 75, 1, 2]), at + 4);
    }
  }
  if (mode === "zip64") bytes.writeUInt32LE(0xffffffff, central + 24);
  const firstExtra = central + 46 + bytes.readUInt16LE(central + 28);
  if (mode === "zip64-extra") bytes.writeUInt16LE(1, firstExtra);
  if (mode === "malformed-extra") bytes.writeUInt16LE(65535, firstExtra + 2);
  if (mode === "encryption") {
    bytes.writeUInt16LE(1, central + 8);
    bytes.writeUInt16LE(1, 6);
  }
  if (mode === "offset") bytes.writeUInt32LE(central + 1, central + 42);
  if (mode === "too-many") {
    bytes.writeUInt16LE(1001, end + 8);
    bytes.writeUInt16LE(1001, end + 10);
  }
  expect(() =>
    f.validate(mode === "truncated" ? bytes.subarray(0, end) : bytes),
  ).toThrow();
  expect(f.decompressions()).toBe(0);
});
