import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

function adapter() {
  const calls: { url: string; options: any }[] = [];
  const props = new Map([["SPREADSHEET_ID", "sheet-id"]]);
  let respond = (_url: string, _options: any): any => ({
    status: 200,
    body: {},
  });
  const context = vm.createContext({
    ScriptApp: { getOAuthToken: () => "private-oauth" },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: {
      fetch: (url: string, options: any) => {
        calls.push({ url, options });
        const result = respond(url, options);
        return {
          getResponseCode: () => result.status,
          getContentText: () => JSON.stringify(result.body),
          getAllHeaders: () => result.headers || {},
        };
      },
    },
  });
  vm.runInContext(readFileSync("gas/Code.js", "utf8"), context);
  vm.runInContext(readFileSync("gas/Documents.js", "utf8"), context);
  const service = context.documentServices({
    getProperty: (key: string) => props.get(key),
    getProperties: () => Object.fromEntries(props),
    setProperty: (key: string, value: string) => props.set(key, value),
    deleteProperty: (key: string) => props.delete(key),
  });
  return {
    service,
    calls,
    context,
    respond: (fn: typeof respond) => {
      respond = fn;
    },
  };
}

const formNames = [
  ["beginner", "AI 교육 입문자"],
  ["edtech", "AI 교육 활용 전문가"],
  ["professional", "AI 교육 수업 전문가"],
  ["research", "AI 교육 연구 실천가"],
  ["lecturer", "AI 교육 강의 전문가"],
  ["coaching", "AI 교육 코칭 전문가"],
];
it("recognizes all six Korean filenames after the English prefixes are removed", () => {
  const r = adapter();
  r.respond(() => ({
    status: 200,
    body: {
      files: formNames.map(([id, name]) => ({
        id: "new-" + id,
        name: name + "_취득 인증서류.hwpx",
      })),
    },
  }));
  expect(
    Array.from(r.service.templates(), (f: any) => [f.badgeId, f.id]),
  ).toEqual(formNames.map(([id]) => [id, "new-" + id]));
});
it("keeps the observed Drive file ID connected when its display name changes again", () => {
  const r = adapter();
  r.respond(() => ({
    status: 200,
    body: {
      files: [
        {
          id: "1oDsHIcXTBPTOYXdj68YWdNIUzZt0ZCHX",
          name: "입문자 신청서 최신본.hwpx",
        },
        { id: "unregistered-copy", name: "AI 교육 입문자_취득 인증서류.hwpx" },
      ],
    },
  }));
  expect(
    Array.from(r.service.templates(), (f: any) => [f.badgeId, f.id, f.name]),
  ).toEqual([
    [
      "beginner",
      "1oDsHIcXTBPTOYXdj68YWdNIUzZt0ZCHX",
      "입문자 신청서 최신본.hwpx",
    ],
  ]);
});
it("keeps legacy names compatible and refuses ambiguous replacement templates", () => {
  const r = adapter();
  let files = [{ id: "legacy", name: "professional_legacy.hwpx" }];
  r.respond(() => ({ status: 200, body: { files } }));
  expect(r.service.templates()[0].badgeId).toBe("professional");
  files = [
    { id: "copy1", name: "AI 교육 수업 전문가_취득 인증서류.hwpx" },
    { id: "copy2", name: "professional_copy.hwpx" },
  ];
  expect(() => r.service.templates()).toThrow();
});
it("uses only HWPX files returned from the configured forms folder and excludes master", () => {
  const r = adapter();
  let files: { id: string; name: string }[] = [];
  r.respond(() => ({ status: 200, body: { files } }));
  expect(r.service.templates()).toHaveLength(0);
  files = [
    { id: "1oDsHIcXTBPTOYXdj68YWdNIUzZt0ZCHX", name: "not-a-form.pdf" },
    { id: "master", name: "master_form.hwpx" },
    { id: "unrelated", name: "기타 문서.hwpx" },
  ];
  expect(r.service.templates()).toHaveLength(0);
  const query = new URL(r.calls[0].url).searchParams.get("q")!;
  expect(query).toContain("'1QHYSQBQVq4Tafl6NYTKSUzlTxj9dL2hM' in parents");
  expect(query).toContain("trashed=false");
});

it("keeps 308 Range visible and reconciles lost chunk responses before sending more bytes", () => {
  const r = adapter();
  r.respond((_url, options) =>
    options.headers["Content-Range"].startsWith("bytes */")
      ? { status: 308, headers: { Range: "bytes=0-1048575" } }
      : { status: 200, body: { id: "uploaded-file" } },
  );
  const u = {
    uri: "https://www.googleapis.com/upload/drive/v3/files?upload_id=private",
    size: 1048584,
    mimeType: "application/pdf",
  };
  expect(r.service.sendChunk(u, 0, new Array(1048576).fill(0))).toEqual({
    received: 1048576,
  });
  expect(r.calls).toHaveLength(1);
  expect(r.service.sendChunk(u, 1048576, [1, 2, 3, 4, 5, 6, 7, 8])).toEqual({
    received: 1048584,
    fileId: "uploaded-file",
  });
  expect(r.calls[2].options.headers["Content-Range"]).toBe(
    "bytes 1048576-1048583/1048584",
  );
  for (const call of r.calls) {
    expect(call.options.followRedirects).toBe(false);
    expect(call.options.headers.Authorization).toBe("Bearer private-oauth");
  }
});

it("refuses to create upload state when Drive returns an untrusted resumable URI", () => {
  const r = adapter();
  r.respond(() => ({
    status: 200,
    headers: { Location: "https://attacker.example/upload" },
  }));
  expect(() =>
    r.service.startUpload({
      mimeType: "application/pdf",
      size: 8,
      folderId: "private-folder",
    }),
  ).toThrow();
});

it("requires restricted teacher ancestry and rejects even a direct public badge permission", () => {
  const r = adapter();
  let restricted = false,
    publicChild = false,
    parentMetadataOnly = false;
  r.respond((url) => {
    if (url.includes("/permissions"))
      return {
        status: 200,
        body: {
          permissions:
            publicChild && url.includes("/child/")
              ? [{ type: "anyone" }]
              : parentMetadataOnly && url.includes("/teacher/")
                ? [{ type: "anyone", view: "metadata" }]
                : [{ type: "user" }],
        },
      };
    if (url.includes("/child?"))
      return {
        status: 200,
        body: {
          id: "child",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["teacher"],
          appProperties: { badgeId: "professional" },
        },
      };
    return {
      status: 200,
      body: {
        id: "teacher",
        inheritedPermissionsDisabled: restricted,
        parents: ["1HlRDMBP9-g1Ay5RZpXmmg31sHPm1PL0S"],
        appProperties: { teacherId: "test-01" },
      },
    };
  });
  expect(() =>
    r.service.verifyFolder("child", "test-01", "professional"),
  ).toThrow();
  restricted = true;
  expect(() =>
    r.service.verifyFolder("child", "test-01", "professional"),
  ).not.toThrow();
  parentMetadataOnly = true;
  expect(() =>
    r.service.verifyFolder("child", "test-01", "professional"),
  ).not.toThrow();
  publicChild = true;
  expect(() =>
    r.service.verifyFolder("child", "test-01", "professional"),
  ).toThrow();
});

it("provisions one stable restricted teacher folder and six badge folders idempotently", () => {
  const r = adapter();
  const files = new Map<string, any>();
  let count = 0,
    permitRestriction = true;
  r.respond((url, options) => {
    const endpoint = new URL(url),
      query = endpoint.searchParams.get("q");
    if (query) {
      const parent = /^'([^']+)' in parents/.exec(query)![1];
      const key = /key='([^']+)'/.exec(query)![1],
        value = /value='([^']+)'/.exec(query)![1];
      return {
        status: 200,
        body: {
          files: [...files.values()].filter(
            (f) => f.parents[0] === parent && f.appProperties[key] === value,
          ),
        },
      };
    }
    if (options.method === "post") {
      const body = JSON.parse(options.payload),
        id = "folder-" + ++count;
      files.set(id, { id, ...body });
      return { status: 200, body: { id } };
    }
    const id = /\/files\/([^/?]+)/.exec(url)![1];
    if (url.includes("/permissions"))
      return { status: 200, body: { permissions: [{ type: "user" }] } };
    if (options.method === "patch")
      files.get(id).inheritedPermissionsDisabled = permitRestriction;
    return { status: 200, body: files.get(id) };
  });
  const teacher = {
    teacher_id: "test-01",
    이름: "교원",
    "연수원 아이디": "jne-test01",
  };
  expect(r.service.ensureFolders(teacher, "professional")).toMatch(/^folder-/);
  expect(r.service.ensureFolders(teacher, "professional")).toMatch(/^folder-/);
  expect(files.size).toBe(7);
  const teacherFolder = [...files.values()].find(
    (f) => f.appProperties.teacherId,
  );
  expect(teacherFolder.inheritedPermissionsDisabled).toBe(true);
  expect(
    [...files.values()].filter((f) => f.appProperties.badgeId),
  ).toHaveLength(6);
  expect(r.calls.filter((c) => c.options.method === "post")).toHaveLength(7);
  permitRestriction = false;
  expect(() => r.service.ensureFolders(teacher, "professional")).toThrow();
  expect(files.size).toBe(7);
});

it("atomically logs once and conditionally replaces only ungranted status so an intervening admin grant wins", () => {
  const r = adapter();
  const audit = [
    [
      "submission_id",
      "teacher_id",
      "badge_id",
      "제출일시",
      "파일명",
      "Drive파일ID",
    ],
  ];
  let status = "미획득";
  const dates = "2026-10-01";
  r.respond((url, options) => {
    if (url.includes(":batchUpdate")) {
      // An administrator grants the badge after our read, before Google's atomic batch.
      status = "획득";
      const requests = JSON.parse(options.payload).requests;
      for (const request of requests) {
        if (request.updateCells)
          status =
            request.updateCells.rows[0].values[0].userEnteredValue.stringValue;
        if (
          request.findReplace &&
          new RegExp(request.findReplace.find).test(status)
        )
          status = request.findReplace.replacement;
        if (request.appendCells)
          audit.push(
            request.appendCells.rows[0].values.map(
              (v: any) => v.userEnteredValue.stringValue,
            ),
          );
      }
      return { status: 200, body: {} };
    }
    if (url.includes("/values/")) {
      return {
        status: 200,
        body: {
          values: decodeURIComponent(url).includes("서류제출 내역")
            ? audit
            : [
                [
                  "teacher_id",
                  "AI 교육 수업 전문가",
                  "AI 교육 수업 전문가 취득일",
                ],
                ["test-01", status, dates],
              ],
        },
      };
    }
    return {
      status: 200,
      body: {
        sheets: [
          { properties: { title: "서류제출 내역", sheetId: 6 } },
          { properties: { title: "배지별 수집현황", sheetId: 7 } },
        ],
      },
    };
  });
  const u = {
    id: "submission-one",
    teacherId: "test-01",
    badgeId: "professional",
    submittedAt: "2026-11-10T00:00:00Z",
    fileName: "증빙.pdf",
    fileId: "file-1",
  };
  r.service.commit(u);
  r.service.commit(u);
  expect(status).toBe("획득");
  expect(audit).toHaveLength(2);
  const batches = r.calls.filter((c) => c.url.includes(":batchUpdate"));
  expect(batches).toHaveLength(1);
  const requests = JSON.parse(batches[0].options.payload).requests;
  expect(requests[1].findReplace.range).toEqual({
    sheetId: 7,
    startRowIndex: 1,
    endRowIndex: 2,
    startColumnIndex: 1,
    endColumnIndex: 2,
  });
  expect(JSON.stringify(requests)).not.toContain("2026-10-01");
});
