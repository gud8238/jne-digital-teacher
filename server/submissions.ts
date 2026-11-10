import { badgeIds, validateMe } from "../src/domain/badges";
import { callGas, ServiceError, type ApiDependencies } from "./gas-client";
import { readSession } from "./session";

const CHUNK_SIZE = 1024 * 1024;
const MAX_FILE = 20 * CHUNK_SIZE;
const bad = (message = "제출 정보를 확인해 주세요."): never => {
  throw new ServiceError(400, "BAD_REQUEST", message);
};
const dataError = (): never => {
  throw new ServiceError(
    502,
    "DATA_ERROR",
    "서류 처리 응답을 확인할 수 없습니다.",
  );
};
function badge(value: unknown) {
  if (
    typeof value !== "string" ||
    !badgeIds.includes(value as never) ||
    value === "master"
  )
    return bad("서류를 제출할 배지를 확인해 주세요.");
  return value;
}
function fileName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 180 ||
    /[\\/]/.test(value) ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    return bad("파일 이름을 확인해 주세요.");
  return value.trim();
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{8,128}$/.test(value)) return bad();
  return value;
}
function natural(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function decode(value: unknown, max: number): Buffer {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > 4 * Math.ceil(max / 3) ||
    value.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(value)
  )
    return bad("파일 데이터 형식을 확인해 주세요.");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > max || bytes.toString("base64") !== value)
    return bad("파일 조각 크기를 확인해 주세요.");
  return bytes;
}
async function input(request: Request, max: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max)
    throw new ServiceError(
      413,
      "PAYLOAD_TOO_LARGE",
      "파일 조각 크기가 너무 큽니다.",
    );
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > max)
    throw new ServiceError(
      413,
      "PAYLOAD_TOO_LARGE",
      "파일 조각 크기가 너무 큽니다.",
    );
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return bad();
    return value as Record<string, unknown>;
  } catch {
    return bad();
  }
}

export async function handleSubmission(
  request: Request,
  action: string,
  deps: ApiDependencies,
) {
  const token = readSession(request);
  if (!token)
    throw new ServiceError(
      401,
      "UNAUTHORIZED",
      "로그인한 뒤 서류를 제출해 주세요.",
    );
  const body = await input(
    request,
    action === "submission-chunk"
      ? Math.ceil((CHUNK_SIZE * 4) / 3) + 4096
      : 4096,
  );
  let params: Record<string, unknown>;
  if (action === "submission-start") {
    const badgeId = badge(body.badgeId),
      name = fileName(body.fileName);
    if (!natural(body.size) || body.size === 0)
      return bad("비어 있지 않은 파일을 선택해 주세요.");
    if (body.size > MAX_FILE)
      throw new ServiceError(
        413,
        "PAYLOAD_TOO_LARGE",
        "파일은 20MB 이하로 제출해 주세요.",
      );
    const extension = name.split(".").pop()!.toLowerCase();
    const mime: Record<string, string> = {
      hwpx: "application/hwp+zip",
      hwp: "application/x-hwp",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };
    if (!mime[extension])
      return bad("HWPX, HWP, PDF 또는 이미지(PNG/JPG) 파일을 선택해 주세요.");
    params = {
      action,
      token,
      badgeId,
      fileName: name,
      mimeType: mime[extension],
      size: body.size,
    };
  } else if (action === "submission-chunk") {
    const uploadId = id(body.uploadId);
    if (!natural(body.offset)) return bad();
    decode(body.data, CHUNK_SIZE);
    params = { action, token, uploadId, offset: body.offset, data: body.data };
  } else params = { action, token, uploadId: id(body.uploadId) };
  const result = await callGas(params, deps);
  if (action === "submission-start") {
    if (
      result?.chunkSize !== CHUNK_SIZE ||
      !natural(result?.received) ||
      result.received > MAX_FILE
    )
      return dataError();
    return {
      uploadId: id(result.uploadId),
      chunkSize: CHUNK_SIZE,
      received: result.received,
    };
  }
  if (action === "submission-chunk") {
    if (
      !natural(result?.received) ||
      result.received > MAX_FILE ||
      typeof result.complete !== "boolean"
    )
      return dataError();
    return {
      uploadId: id(result.uploadId),
      received: result.received,
      complete: result.complete,
    };
  }
  try {
    const me = validateMe(result.me),
      submission = result.submission;
    const badgeId = badge(submission?.badgeId);
    if (
      !["서류제출", "획득"].includes(submission.status) ||
      me.collections.find((b) => b.badgeId === badgeId)?.status !==
        submission.status ||
      typeof submission.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(submission.submittedAt))
    )
      return dataError();
    return {
      me,
      submission: {
        badgeId,
        status: submission.status,
        fileName: fileName(submission.fileName),
        submittedAt: submission.submittedAt,
      },
    };
  } catch {
    return dataError();
  }
}

export async function templateResponse(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  const badgeId = badge(new URL(request.url).searchParams.get("badgeId"));
  const result = await callGas({ action: "template", badgeId }, deps);
  let bytes: Buffer, name: string;
  try {
    name = fileName(result.fileName);
    bytes = decode(result.data, 4 * CHUNK_SIZE);
    if (!/\.hwpx$/i.test(name) || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      return dataError();
  } catch {
    return dataError();
  }
  return new Response(new Uint8Array(bytes).buffer, {
    headers: {
      "content-type": "application/hwp+zip",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename="badge-template.hwpx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
