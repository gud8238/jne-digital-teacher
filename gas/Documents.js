// All Drive IDs and resumable URIs stay server-side. No permission is made public.
var DOCUMENT_CHUNK_SIZE = 1048576;
var DOCUMENT_MAX_SIZE = 20 * 1048576;
var DOCUMENT_AUDIT_HEADERS = [
  "submission_id",
  "teacher_id",
  "badge_id",
  "제출일시",
  "파일명",
  "Drive파일ID",
];
var DOCUMENT_TYPES = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  hwpx: [
    "application/hwp+zip",
    "application/vnd.hancom.hwpx",
    "application/zip",
    "application/octet-stream",
  ],
  hwp: [
    "application/x-hwp",
    "application/haansofthwp",
    "application/vnd.hancom.hwp",
    "application/octet-stream",
  ],
};
function validateDocumentName(name, mime, size) {
  if (
    typeof name !== "string" ||
    name !== name.trim() ||
    name.length > 180 ||
    /[\\/\x00-\x1f\x7f]/.test(name) ||
    name.charAt(0) === "." ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > DOCUMENT_MAX_SIZE
  )
    apiFailure("BAD_REQUEST");
  var extension = name.split(".").pop().toLowerCase();
  if (
    !DOCUMENT_TYPES[extension] ||
    DOCUMENT_TYPES[extension].indexOf(mime) === -1
  )
    apiFailure("BAD_REQUEST");
  return extension;
}
function validateDocumentSignature(bytes, extension, complete) {
  var prefix = function (values) {
    return values.every(function (v, i) {
      return (bytes[i] & 255) === v;
    });
  };
  var valid =
    extension === "pdf"
      ? prefix([37, 80, 68, 70, 45])
      : extension === "png"
        ? prefix([137, 80, 78, 71, 13, 10, 26, 10])
        : extension === "jpg" || extension === "jpeg"
          ? prefix([255, 216, 255])
          : extension === "hwp"
            ? prefix([208, 207, 17, 224, 161, 177, 26, 225])
            : extension === "hwpx"
              ? prefix([80, 75, 3, 4])
              : false;
  if (!valid) apiFailure("BAD_REQUEST");
  if (complete && extension === "hwp") {
    var marker = "HWP Document File",
      found = false;
    for (var i = 8; i <= bytes.length - marker.length; i++) {
      if ((bytes[i] & 255) !== 72) continue;
      var matches = true;
      for (var j = 1; j < marker.length; j++) {
        if ((bytes[i + j] & 255) !== marker.charCodeAt(j)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        found = true;
        break;
      }
    }
    if (!found) apiFailure("BAD_REQUEST");
  }
}
function uploadState(p, s, me) {
  if (!/^[a-f0-9]{64}$/.test(p.uploadId || "")) apiFailure("BAD_REQUEST");
  var u = s.documents.getUpload(p.uploadId);
  if (!u || u.teacherId !== me.teacher.id || u.expiresAt <= s.now())
    apiFailure("UNAUTHORIZED");
  return u;
}
function handleDocumentRequest(p, s) {
  var d = s.documents;
  if (!d) apiFailure("SERVICE_UNAVAILABLE");
  // Reject all caller-selected resources, including for public blank templates.
  if (p.fileId || p.folderId || p.uploadUri || p.uri) apiFailure("BAD_REQUEST");
  if (p.action === "template") {
    if (BADGE_IDS.indexOf(p.badgeId) === -1 || p.badgeId === "master")
      apiFailure("BAD_REQUEST");
    var template = d.templates().find(function (f) {
      return f.badgeId === p.badgeId;
    });
    if (!template) apiFailure("NOT_FOUND");
    if (
      !Number.isSafeInteger(Number(template.size)) ||
      Number(template.size) <= 0 ||
      Number(template.size) > 4 * 1048576
    )
      apiFailure("BAD_REQUEST");
    var bytes = d.getBytes(template.id);
    if (bytes.length !== Number(template.size))
      apiFailure("SERVICE_UNAVAILABLE");
    var ext = validateDocumentName(
      template.name,
      template.mimeType,
      bytes.length,
    );
    validateDocumentSignature(bytes, ext, true);
    if (ext === "hwpx") d.validateHwpx(bytes);
    return {
      fileName: template.name,
      mimeType: template.mimeType,
      data: d.encode(bytes),
    };
  }
  if (p.action === "admin-provision") {
    return d.lock(function () {
      var teachers = teacherRows(s);
      teachers.forEach(function (teacher) {
        d.ensureFolders(teacher);
      });
      d.ensureAudit();
      return { provisioned: teachers.length };
    });
  }
  var me = readPersonal(s, p.token);
  return d.lock(function () {
    if (p.action === "submission-start") {
      var badge = me.collections.find(function (b) {
        return b.badgeId === p.badgeId;
      });
      if (!badge || badge.badgeId === "master" || badge.status === "획득")
        apiFailure("BAD_REQUEST");
      var extension = validateDocumentName(p.fileName, p.mimeType, p.size);
      var teacher = teacherRows(s).find(function (t) {
        return t.teacher_id === me.teacher.id;
      });
      var folder = d.ensureFolders(teacher, p.badgeId);
      var id = s.newToken();
      var state = {
        id: id,
        teacherId: teacher.teacher_id,
        badgeId: p.badgeId,
        fileName: p.fileName,
        mimeType: p.mimeType,
        size: p.size,
        extension: extension,
        folderId: folder,
        received: 0,
        createdAt: s.now(),
        expiresAt: s.now() + 24 * 60 * 60 * 1000,
      };
      state.uri = d.startUpload(state);
      d.putUpload(id, state);
      return { uploadId: id, chunkSize: DOCUMENT_CHUNK_SIZE, received: 0 };
    }
    var u = uploadState(p, s, me);
    if (p.action === "submission-chunk") {
      if (
        !Number.isSafeInteger(p.offset) ||
        p.offset < 0 ||
        typeof p.data !== "string" ||
        p.data.length > 1398104 ||
        p.data.length % 4 !== 0 ||
        /[^A-Za-z0-9+/=]/.test(p.data)
      )
        apiFailure("BAD_REQUEST");
      var chunk = d.decode(p.data);
      if (d.encode(chunk) !== p.data) apiFailure("BAD_REQUEST");
      if (
        !chunk.length ||
        chunk.length > DOCUMENT_CHUNK_SIZE ||
        p.offset + chunk.length > u.size ||
        (p.offset + chunk.length < u.size &&
          chunk.length !== DOCUMENT_CHUNK_SIZE) ||
        p.offset > u.received
      )
        apiFailure("BAD_REQUEST");
      if (p.offset === 0) validateDocumentSignature(chunk, u.extension);
      if (p.offset < u.received) {
        if (p.offset + chunk.length > u.received) apiFailure("BAD_REQUEST");
        return { uploadId: u.id, received: u.received, complete: !!u.fileId };
      }
      if (u.finalized) apiFailure("BAD_REQUEST");
      d.verifyFolder(u.folderId, u.teacherId, u.badgeId);
      var result = d.sendChunk(u, p.offset, chunk);
      if (
        !Number.isSafeInteger(result.received) ||
        result.received < u.received ||
        result.received > u.size ||
        (result.fileId && result.received !== u.size)
      )
        apiFailure("SERVICE_UNAVAILABLE");
      u.received = result.received;
      if (result.fileId) u.fileId = result.fileId;
      d.putUpload(u.id, u);
      return { uploadId: u.id, received: u.received, complete: !!u.fileId };
    }
    if (u.received !== u.size || !u.fileId) apiFailure("BAD_REQUEST");
    d.verifyFolder(u.folderId, u.teacherId, u.badgeId);
    var file = d.getFile(u.fileId);
    if (
      file.trashed ||
      Number(file.size) !== u.size ||
      file.mimeType !== u.mimeType ||
      !file.parents ||
      file.parents.length !== 1 ||
      file.parents[0] !== u.folderId
    )
      apiFailure("SERVICE_UNAVAILABLE");
    if (!u.finalized) {
      var completeBytes = d.getBytes(u.fileId);
      if (completeBytes.length !== u.size) apiFailure("SERVICE_UNAVAILABLE");
      validateDocumentSignature(completeBytes, u.extension, true);
      if (u.extension === "hwpx") d.validateHwpx(completeBytes);
      u.submittedAt = u.submittedAt || new Date(s.now()).toISOString();
      d.putUpload(u.id, u);
      // The adapter rereads both status and audit inside this lock before one atomic write.
      d.commit(u);
      u.finalized = true;
      d.putUpload(u.id, u);
    }
    var updated = readPersonal(s, p.token);
    return {
      me: updated,
      submission: {
        badgeId: u.badgeId,
        status: updated.collections.find(function (b) {
          return b.badgeId === u.badgeId;
        }).status,
        fileName: u.fileName,
        submittedAt: u.submittedAt,
      },
    };
  });
}

// Bound archive allocation before Apps Script's all-at-once unzip operation.
// Read individual unsigned fields directly from the original byte array.
function validateHwpxArchiveBounds(bytes) {
  function u16(at) {
    if (at < 0 || at + 2 > bytes.length) apiFailure("BAD_REQUEST");
    return (bytes[at] & 255) + (bytes[at + 1] & 255) * 256;
  }
  function u32(at) {
    return u16(at) + u16(at + 2) * 65536;
  }
  function extraFields(at, length) {
    var end = at + length;
    while (at < end) {
      if (at + 4 > end) apiFailure("BAD_REQUEST");
      var kind = u16(at),
        size = u16(at + 2);
      // ZIP64 and WinZip AES are outside the bounded, unencrypted format.
      if (kind === 1 || kind === 0x9901 || at + 4 + size > end)
        apiFailure("BAD_REQUEST");
      at += 4 + size;
    }
  }
  if (bytes.length < 22 || bytes.length > DOCUMENT_MAX_SIZE)
    apiFailure("BAD_REQUEST");
  var end = -1;
  for (
    var pos = bytes.length - 22;
    pos >= Math.max(0, bytes.length - 65557);
    pos--
  ) {
    if (u32(pos) === 0x06054b50 && pos + 22 + u16(pos + 20) === bytes.length) {
      end = pos;
      break;
    }
  }
  if (end < 0) apiFailure("BAD_REQUEST");
  var count = u16(end + 10),
    directorySize = u32(end + 12),
    directory = u32(end + 16);
  if (
    u16(end + 4) !== 0 ||
    u16(end + 6) !== 0 ||
    u16(end + 8) !== count ||
    count < 1 ||
    count > 1000 ||
    directorySize === 0xffffffff ||
    directory === 0xffffffff ||
    directory + directorySize !== end
  )
    apiFailure("BAD_REQUEST");
  var at = directory,
    total = 0,
    intervals = [];
  for (var entry = 0; entry < count; entry++) {
    if (at + 46 > end || u32(at) !== 0x02014b50) apiFailure("BAD_REQUEST");
    var flags = u16(at + 8),
      method = u16(at + 10),
      compressed = u32(at + 20),
      expanded = u32(at + 24);
    var nameSize = u16(at + 28),
      extraSize = u16(at + 30),
      commentSize = u16(at + 32),
      local = u32(at + 42);
    var next = at + 46 + nameSize + extraSize + commentSize;
    total += expanded;
    if (
      (flags & 0x2041) !== 0 ||
      (method !== 0 && method !== 8) ||
      compressed === 0xffffffff ||
      compressed > bytes.length ||
      expanded > 40 * 1048576 ||
      total > 64 * 1048576 ||
      (method === 0 && compressed !== expanded) ||
      u16(at + 34) !== 0 ||
      nameSize === 0 ||
      next > end ||
      local === 0xffffffff ||
      local + 30 > directory ||
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u16(local + 26) !== nameSize
    )
      apiFailure("BAD_REQUEST");
    var localExtra = u16(local + 28),
      dataStart = local + 30 + nameSize + localExtra,
      dataEnd = dataStart + compressed;
    if (dataEnd > directory) apiFailure("BAD_REQUEST");
    for (var n = 0; n < nameSize; n++) {
      if ((bytes[at + 46 + n] & 255) !== (bytes[local + 30 + n] & 255))
        apiFailure("BAD_REQUEST");
    }
    var localCompressed = u32(local + 18),
      localExpanded = u32(local + 22);
    if (flags & 8) {
      if (
        (localCompressed !== 0 && localCompressed !== compressed) ||
        (localExpanded !== 0 && localExpanded !== expanded)
      )
        apiFailure("BAD_REQUEST");
    } else if (
      localCompressed !== compressed ||
      localExpanded !== expanded ||
      u32(local + 14) !== u32(at + 16)
    )
      apiFailure("BAD_REQUEST");
    extraFields(at + 46 + nameSize, extraSize);
    extraFields(local + 30 + nameSize, localExtra);
    intervals.push({ start: local, end: dataEnd });
    at = next;
  }
  if (at !== end) apiFailure("BAD_REQUEST");
  intervals.sort(function (a, b) {
    return a.start - b.start;
  });
  for (var i = 1; i < intervals.length; i++) {
    if (intervals[i].start < intervals[i - 1].end) apiFailure("BAD_REQUEST");
  }
}

function documentServices(properties) {
  var driveRoot =
    properties.getProperty("SUBMISSION_FOLDER_ID") ||
    "1HlRDMBP9-g1Ay5RZpXmmg31sHPm1PL0S";
  var formsRoot =
    properties.getProperty("FORMS_FOLDER_ID") ||
    "1QHYSQBQVq4Tafl6NYTKSUzlTxj9dL2hM";
  var spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  var driveBase = "https://www.googleapis.com/drive/v3/files";
  function fetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {}, {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
    });
    options.muteHttpExceptions = true;
    options.followRedirects = false;
    return UrlFetchApp.fetch(url, options);
  }
  function json(url, method, body) {
    var response = fetch(url, {
      method: method || "get",
      contentType: "application/json",
      payload: body ? JSON.stringify(body) : undefined,
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300)
      apiFailure("SERVICE_UNAVAILABLE");
    return JSON.parse(response.getContentText() || "{}");
  }
  function list(query, fields) {
    var files = [],
      pageToken;
    do {
      var result = json(
        driveBase +
          "?q=" +
          encodeURIComponent(query) +
          "&spaces=drive&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=" +
          encodeURIComponent("nextPageToken,files(" + fields + ")") +
          (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
      );
      files = files.concat(result.files || []);
      pageToken = result.nextPageToken;
    } while (pageToken);
    return files;
  }
  function quoted(value) {
    return (
      "'" + String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"
    );
  }
  function getFile(id) {
    return json(
      driveBase +
        "/" +
        encodeURIComponent(id) +
        "?supportsAllDrives=true&fields=id,name,size,mimeType,parents,trashed,inheritedPermissionsDisabled,appProperties",
    );
  }
  function assertNoPublicPermission(id, allowMetadataOnly) {
    var next;
    do {
      var perms = json(
        driveBase +
          "/" +
          encodeURIComponent(id) +
          "/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(type,view)&pageSize=100" +
          (next ? "&pageToken=" + encodeURIComponent(next) : ""),
      );
      if (
        (perms.permissions || []).some(function (p) {
          return (
            (p.type === "anyone" || p.type === "domain") &&
            !(allowMetadataOnly && p.view === "metadata")
          );
        })
      )
        apiFailure("SERVICE_UNAVAILABLE");
      next = perms.nextPageToken;
    } while (next);
  }
  function stableFolder(parent, key, value, name, teacherFolder) {
    var query =
      quoted(parent) +
      " in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key=" +
      quoted(key) +
      " and value=" +
      quoted(value) +
      " }";
    var folders = list(query, "id,name");
    if (folders.length > 1) apiFailure("DATA_ERROR");
    var folder = folders[0];
    if (!folder) {
      var body = {
        name: name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent],
        appProperties: {},
      };
      body.appProperties[key] = value;
      if (teacherFolder) body.inheritedPermissionsDisabled = true;
      folder = json(
        driveBase + "?supportsAllDrives=true&fields=id",
        "post",
        body,
      );
    }
    if (teacherFolder) {
      json(
        driveBase +
          "/" +
          encodeURIComponent(folder.id) +
          "?supportsAllDrives=true&fields=id,inheritedPermissionsDisabled",
        "patch",
        { inheritedPermissionsDisabled: true },
      );
      if (getFile(folder.id).inheritedPermissionsDisabled !== true)
        apiFailure("SERVICE_UNAVAILABLE");
    }
    assertNoPublicPermission(folder.id, teacherFolder);
    return folder.id;
  }
  function verifyFolder(id, teacherId, badgeId) {
    var child = getFile(id);
    if (
      child.trashed ||
      child.mimeType !== "application/vnd.google-apps.folder" ||
      !child.appProperties ||
      child.appProperties.badgeId !== badgeId ||
      !child.parents ||
      child.parents.length !== 1
    )
      apiFailure("SERVICE_UNAVAILABLE");
    var teacher = getFile(child.parents[0]);
    if (
      teacher.trashed ||
      teacher.inheritedPermissionsDisabled !== true ||
      !teacher.appProperties ||
      teacher.appProperties.teacherId !== teacherId ||
      !teacher.parents ||
      teacher.parents.length !== 1 ||
      teacher.parents[0] !== driveRoot
    )
      apiFailure("SERVICE_UNAVAILABLE");
    assertNoPublicPermission(id);
    assertNoPublicPermission(teacher.id, true);
  }
  function sheetMetadata() {
    return json(
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(spreadsheetId) +
        "?fields=sheets(properties(sheetId,title))",
    ).sheets;
  }
  function batch(requests) {
    return json(
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(spreadsheetId) +
        ":batchUpdate",
      "post",
      { requests: requests },
    );
  }
  function cells(values) {
    return values.map(function (v) {
      return { userEnteredValue: { stringValue: String(v) } };
    });
  }
  function values(name) {
    return (
      json(
        "https://sheets.googleapis.com/v4/spreadsheets/" +
          encodeURIComponent(spreadsheetId) +
          "/values/" +
          encodeURIComponent("'" + name.replace(/'/g, "''") + "'") +
          "?valueRenderOption=FORMATTED_VALUE",
      ).values || []
    );
  }
  function ensureAudit() {
    var sheet = sheetMetadata().find(function (s) {
      return s.properties.title === "서류제출 내역";
    });
    if (!sheet) {
      var reply = batch([
        { addSheet: { properties: { title: "서류제출 내역" } } },
      ]);
      sheet = { properties: reply.replies[0].addSheet.properties };
      batch([
        {
          updateCells: {
            range: {
              sheetId: sheet.properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            rows: [{ values: cells(DOCUMENT_AUDIT_HEADERS) }],
            fields: "userEnteredValue",
          },
        },
      ]);
    }
    var rows = values("서류제출 내역");
    assertData(
      rows.length &&
        DOCUMENT_AUDIT_HEADERS.every(function (h, i) {
          return rows[0][i] === h;
        }),
    );
    return sheet.properties.sheetId;
  }
  function uploadResponse(response, total) {
    var status = response.getResponseCode();
    if (status === 200 || status === 201) {
      var file = JSON.parse(response.getContentText());
      if (!file.id) apiFailure("SERVICE_UNAVAILABLE");
      return { received: total, fileId: file.id };
    }
    if (status !== 308) apiFailure("SERVICE_UNAVAILABLE");
    var headers = response.getAllHeaders(),
      range = headers.Range || headers.range;
    if (!range) return { received: 0 };
    var match = /^bytes=0-(\d+)$/.exec(String(range));
    if (!match) apiFailure("SERVICE_UNAVAILABLE");
    return { received: Number(match[1]) + 1 };
  }
  return {
    lock: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
    getUpload: function (id) {
      var raw = properties.getProperty("document-upload:" + id);
      return raw ? JSON.parse(raw) : null;
    },
    putUpload: function (id, u) {
      properties.setProperty("document-upload:" + id, JSON.stringify(u));
    },
    decode: function (data) {
      return Utilities.base64Decode(data);
    },
    encode: function (bytes) {
      return Utilities.base64Encode(bytes);
    },
    ensureFolders: function (teacher, badgeId) {
      var teacherFolder = stableFolder(
        driveRoot,
        "teacherId",
        teacher.teacher_id,
        teacher.teacher_id +
          "_" +
          teacher["이름"] +
          "_" +
          teacher["연수원 아이디"],
        true,
      );
      var selected;
      BADGE_IDS.filter(function (b) {
        return b !== "master";
      }).forEach(function (id) {
        var folder = stableFolder(
          teacherFolder,
          "badgeId",
          id,
          COLLECTION_ALIASES[id],
          false,
        );
        verifyFolder(folder, teacher.teacher_id, id);
        if (id === badgeId) selected = folder;
      });
      return selected;
    },
    verifyFolder: verifyFolder,
    authorizeRead: function () {
      getFile(driveRoot);
      getFile(formsRoot);
      sheetMetadata();
    },
    ensureAudit: ensureAudit,
    getFile: function (id) {
      assertNoPublicPermission(id);
      return getFile(id);
    },
    getBytes: function (id) {
      var response = fetch(
        driveBase +
          "/" +
          encodeURIComponent(id) +
          "?alt=media&supportsAllDrives=true",
      );
      if (response.getResponseCode() !== 200) apiFailure("SERVICE_UNAVAILABLE");
      return response.getBlob().getBytes();
    },
    validateHwpx: function (bytes) {
      validateHwpxArchiveBounds(bytes);
      var entries;
      try {
        entries = Utilities.unzip(Utilities.newBlob(bytes, "application/zip"));
      } catch (_) {
        apiFailure("BAD_REQUEST");
      }
      var mimetype = entries.find(function (entry) {
        return entry.getName() === "mimetype";
      });
      if (
        !mimetype ||
        mimetype.getDataAsString().trim() !== "application/hwp+zip" ||
        !entries.some(function (entry) {
          return entry.getName() === "Contents/section0.xml";
        }) ||
        !entries.some(function (entry) {
          return entry.getName() === "version.xml";
        })
      )
        apiFailure("BAD_REQUEST");
    },
    templates: function () {
      var files = list(
        quoted(formsRoot) +
          " in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'",
        "id,name,mimeType,size",
      );
      var templates = [];
      BADGE_IDS.filter(function (id) {
        return id !== "master";
      }).forEach(function (id) {
        var matches = files.filter(function (f) {
          return f.name.indexOf(id + "_") === 0;
        });
        if (matches.length > 1) apiFailure("DATA_ERROR");
        if (matches.length === 1)
          templates.push(Object.assign({ badgeId: id }, matches[0]));
      });
      return templates;
    },
    startUpload: function (u) {
      // Expired upload records are private metadata only; abandon incomplete Drive sessions.
      var props = properties.getProperties();
      Object.keys(props)
        .filter(function (k) {
          return k.indexOf("document-upload:") === 0;
        })
        .forEach(function (key) {
          if (JSON.parse(props[key]).expiresAt <= Date.now())
            properties.deleteProperty(key);
        });
      var response = fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
        {
          method: "post",
          contentType: "application/json",
          headers: {
            "X-Upload-Content-Type": u.mimeType,
            "X-Upload-Content-Length": String(u.size),
          },
          payload: JSON.stringify({
            name: u.fileName,
            mimeType: u.mimeType,
            parents: [u.folderId],
            appProperties: {
              submissionId: u.id,
              teacherId: u.teacherId,
              badgeId: u.badgeId,
            },
          }),
        },
      );
      var headers = response.getAllHeaders(),
        uri = headers.Location || headers.location;
      if (
        response.getResponseCode() !== 200 ||
        typeof uri !== "string" ||
        !/^https:\/\/(www\.googleapis\.com|content\.googleapis\.com)\/upload\/drive\//.test(
          uri,
        )
      )
        apiFailure("SERVICE_UNAVAILABLE");
      return uri;
    },
    sendChunk: function (u, offset, bytes) {
      // Probe first: a prior PUT may have succeeded even if its HTTP response was lost.
      var current = uploadResponse(
        fetch(u.uri, {
          method: "put",
          headers: { "Content-Range": "bytes */" + u.size },
          payload: [],
        }),
        u.size,
      );
      if (current.fileId || current.received >= offset + bytes.length)
        return current;
      if (current.received !== offset) apiFailure("BAD_REQUEST");
      return uploadResponse(
        fetch(u.uri, {
          method: "put",
          contentType: u.mimeType,
          headers: {
            "Content-Range":
              "bytes " +
              offset +
              "-" +
              (offset + bytes.length - 1) +
              "/" +
              u.size,
          },
          payload: bytes,
        }),
        u.size,
      );
    },
    commit: function (u) {
      var auditId = ensureAudit();
      var audit = values("서류제출 내역");
      if (
        audit.slice(1).some(function (row) {
          return row[0] === u.id;
        })
      )
        return;
      var collectionSheet = sheetMetadata().find(function (s) {
        return s.properties.title === "배지별 수집현황";
      });
      assertData(!!collectionSheet);
      var rows = values("배지별 수집현황"),
        headers = rows[0] || [];
      var teacherColumn = headers.indexOf("teacher_id"),
        badgeColumn = headers.indexOf("badge_id");
      var matching = rows
        .map(function (r, i) {
          return { row: r, index: i };
        })
        .filter(function (r) {
          return (
            r.index > 0 &&
            r.row[teacherColumn] === u.teacherId &&
            (badgeColumn < 0 || r.row[badgeColumn] === u.badgeId)
          );
        });
      assertData(teacherColumn >= 0 && matching.length === 1);
      var statusColumn =
        badgeColumn >= 0
          ? headers.indexOf("수집현황")
          : headers.indexOf(COLLECTION_ALIASES[u.badgeId]);
      if (statusColumn < 0)
        statusColumn = headers.indexOf(
          COLLECTION_COLUMNS.find(function (c) {
            return c[0] === u.badgeId;
          })[1],
        );
      assertData(statusColumn >= 0);
      var target = matching[0],
        status = target.row[statusColumn];
      assertData(["미획득", "서류제출", "획득"].indexOf(status) !== -1);
      var requests = [
        {
          appendCells: {
            sheetId: auditId,
            rows: [
              {
                values: cells([
                  u.id,
                  u.teacherId,
                  u.badgeId,
                  u.submittedAt,
                  u.fileName,
                  u.fileId,
                ]),
              },
            ],
            fields: "userEnteredValue",
          },
        },
      ];
      if (status !== "획득")
        requests.push({
          findReplace: {
            range: {
              sheetId: collectionSheet.properties.sheetId,
              startRowIndex: target.index,
              endRowIndex: target.index + 1,
              startColumnIndex: statusColumn,
              endColumnIndex: statusColumn + 1,
            },
            find: "^(미획득|서류제출)$",
            replacement: "서류제출",
            matchCase: true,
            matchEntireCell: true,
            searchByRegex: true,
            includeFormulas: false,
          },
        });
      // Dates and all other cells are deliberately absent from this atomic mutation.
      batch(requests);
    },
  };
}

// Run from the Apps Script editor as the deploying owner to grant expanded scopes.
// This performs only reads; it never provisions folders or changes Sheets.
function authorizeDocumentWorkflow() {
  var properties = PropertiesService.getScriptProperties();
  var service = documentServices(properties);
  service.authorizeRead();
  service.templates();
  Sheets.Spreadsheets.get(properties.getProperty("SPREADSHEET_ID"), {
    fields: "spreadsheetId",
  });
  return "Document workflow authorization verified";
}
