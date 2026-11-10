import { expect, it } from "vitest";
import { runtime } from "./runtime";

function setup() {
  const r = runtime();
  const uploads = new Map<string, any>();
  const audit: any[] = [];
  const file = {
    id: "file-1",
    size: "8",
    parents: ["badge-folder"],
    mimeType: "application/pdf",
    trashed: false,
  };
  let received = 0;
  let restricted = true;
  const documents = {
    lock: (fn: () => any) => fn(),
    getUpload: (id: string) => uploads.get(id),
    putUpload: (id: string, value: any) =>
      uploads.set(id, structuredClone(value)),
    decode: (data: string) => Array.from(Buffer.from(data, "base64")),
    encode: (bytes: number[]) => Buffer.from(bytes).toString("base64"),
    ensureFolders: () => {
      if (!restricted) throw new Error("unrestricted");
      return "badge-folder";
    },
    verifyFolder: () => {
      if (!restricted) throw new Error("unrestricted");
    },
    startUpload: () => "https://www.googleapis.com/upload/secret-uri",
    sendChunk: (_u: any, offset: number, bytes: number[]) => {
      received = offset + bytes.length;
      return { received, fileId: received === 8 ? file.id : null };
    },
    getFile: () => file,
    getBytes: () => Array.from(Buffer.from("%PDF-1.7")),
    commit: (u: any) => {
      if (!audit.some((v) => v.id === u.id)) {
        audit.push(u);
        const row = r.tables["배지별 수집현황"].find(
          (v) => v.badge_id === u.badgeId,
        )!;
        if (row.수집현황 !== "획득") row.수집현황 = "서류제출";
      }
    },
    templates: () => [],
  };
  Object.assign(r.services, { documents });
  const token = r.call({
    action: "login",
    trainingId: "jne-test01",
    name: "테스트교원01",
  }).data.token;
  return {
    ...r,
    token,
    uploads,
    documents,
    file,
    audit,
    restrict: (v: boolean) => {
      restricted = v;
    },
    start: (p = {}) =>
      r.call({
        action: "submission-start",
        token,
        badgeId: "professional",
        fileName: "증빙.pdf",
        mimeType: "application/pdf",
        size: 8,
        ...p,
      }),
    chunk: (id: string, p = {}) =>
      r.call({
        action: "submission-chunk",
        token,
        uploadId: id,
        offset: 0,
        data: Buffer.from("%PDF-1.7").toString("base64"),
        ...p,
      }),
    complete: (id: string) =>
      r.call({ action: "submission-complete", token, uploadId: id }),
  };
}

it("accepts only trainingId authentication and keeps public identity minimal", () => {
  const r = setup();
  expect(
    r.call({ action: "login", name: "테스트교원01", neisNumber: "jne-test01" })
      .ok,
  ).toBe(false);
  expect(r.call({ action: "me", token: r.token }).data.teacher).toEqual({
    id: "test-01",
    name: "테스트교원01",
    school: "테스트학교",
  });
});
it("rejects master, granted badges, unsafe names, unsupported types and size before creating an upload", () => {
  const r = setup();
  for (const input of [
    { badgeId: "master" },
    { badgeId: "beginner" },
    { fileName: "../secret.pdf" },
    { mimeType: "text/html" },
    { size: 0 },
    { size: 20 * 1024 * 1024 + 1 },
    { size: 1.5 },
  ]) {
    expect(r.start(input).ok, JSON.stringify(input)).toBe(false);
  }
  expect(r.uploads.size).toBe(0);
});
it("uploads privately, hides Drive session details and changes status only after verified completion", () => {
  const r = setup(),
    start = r.start();
  expect(start.ok).toBe(true);
  expect(start.data).toEqual({
    uploadId: "a".repeat(64),
    chunkSize: 1048576,
    received: 0,
  });
  expect(JSON.stringify(start)).not.toContain("secret-uri");
  expect(r.complete(start.data.uploadId).ok).toBe(false);
  expect(r.audit).toHaveLength(0);
  expect(r.chunk(start.data.uploadId).data.complete).toBe(true);
  const result = r.complete(start.data.uploadId);
  expect(result.data.submission).toMatchObject({
    badgeId: "professional",
    status: "서류제출",
    fileName: "증빙.pdf",
  });
  expect(
    result.data.me.collections.find((b: any) => b.badgeId === "professional")
      .status,
  ).toBe("서류제출");
  expect(r.complete(start.data.uploadId).ok).toBe(true);
  expect(r.audit).toHaveLength(1);
});
it("rejects foreign owners, malformed base64, wrong offsets and invalid file signatures without changing state", () => {
  const r = setup(),
    id = r.start().data.uploadId;
  expect(r.chunk(id, { offset: 1 }).ok).toBe(false);
  expect(r.chunk(id, { data: "%%%" }).ok).toBe(false);
  expect(
    r.chunk(id, { data: Buffer.from("<html>xx").toString("base64") }).ok,
  ).toBe(false);
  r.uploads.get(id).teacherId = "other-teacher";
  expect(r.chunk(id).ok).toBe(false);
  expect(r.complete(id).ok).toBe(false);
  expect(r.audit).toHaveLength(0);
});
it("acknowledges an already accepted chunk and preserves concurrent administrator grants", () => {
  const r = setup(),
    id = r.start().data.uploadId;
  expect(r.chunk(id).data.received).toBe(8);
  expect(r.chunk(id).data.received).toBe(8);
  const row = r.tables["배지별 수집현황"].find(
    (v) => v.badge_id === "professional",
  )!;
  row.수집현황 = "획득";
  row.취득일 = "2026-11-10";
  expect(r.complete(id).data.submission.status).toBe("획득");
  expect(row.취득일).toBe("2026-11-10");
});
it("fails closed for inherited public access and wrong final size or parent", () => {
  const r = setup();
  r.restrict(false);
  expect(r.start().ok).toBe(false);
  r.restrict(true);
  const id = r.start().data.uploadId;
  r.chunk(id);
  r.file.parents = ["wrong-parent"];
  expect(r.complete(id).ok).toBe(false);
  r.file.parents = ["badge-folder"];
  r.file.size = "9";
  expect(r.complete(id).ok).toBe(false);
  r.file.size = "8";
  r.restrict(false);
  expect(r.complete(id).ok).toBe(false);
  expect(r.audit).toHaveLength(0);
});
it("expires upload sessions and never accepts caller supplied Drive IDs", () => {
  const r = setup(),
    id = r.start().data.uploadId;
  r.advance(24 * 60 * 60 * 1000);
  expect(r.chunk(id).ok).toBe(false);
  expect(
    r.call({ action: "template", badgeId: "professional", fileId: "arbitrary" })
      .ok,
  ).toBe(false);
});
it("accepts a full 1 MiB chunk without regex overflow and rejects oversized or noncanonical chunks", () => {
  const r = setup(),
    id = r.start({ size: 1048584 }).data.uploadId;
  const bytes = Buffer.alloc(1048576);
  bytes.write("%PDF-1.7");
  r.documents.sendChunk = (_u, offset, chunk) => ({
    received: offset + chunk.length,
    fileId: null,
  });
  expect(r.chunk(id, { data: bytes.toString("base64") }).data.received).toBe(
    1048576,
  );
  expect(r.chunk(id, { offset: 1048576, data: "YQ==AAAA" }).ok).toBe(false);
  expect(
    r.chunk(id, { data: Buffer.alloc(1048577).toString("base64") }).ok,
  ).toBe(false);
  expect(r.audit).toHaveLength(0);
});
it("returns only a configured badge template and hides Drive resources from its download", () => {
  const r = setup();
  r.documents.templates = () =>
    [
      {
        id: "blank-file",
        badgeId: "professional",
        name: "professional_양식.pdf",
        mimeType: "application/pdf",
        size: "8",
      },
    ] as any;
  const result = r.call({ action: "template", badgeId: "professional" });
  expect(result.data).toEqual({
    fileName: "professional_양식.pdf",
    mimeType: "application/pdf",
    data: Buffer.from("%PDF-1.7").toString("base64"),
  });
  expect(r.call({ action: "template", badgeId: "master" }).ok).toBe(false);
  expect(r.call({ action: "template", badgeId: "edtech" }).error.code).toBe(
    "NOT_FOUND",
  );
});
it("rejects a generic OLE file renamed as HWP after upload without a submission write", () => {
  const r = setup();
  const bytes = Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]);
  const id = r.start({ fileName: "증빙.hwp", mimeType: "application/x-hwp" })
    .data.uploadId;
  r.file.mimeType = "application/x-hwp";
  r.documents.getBytes = () => Array.from(bytes);
  expect(r.chunk(id, { data: bytes.toString("base64") }).ok).toBe(true);
  expect(r.complete(id).ok).toBe(false);
  expect(r.audit).toHaveLength(0);
});
