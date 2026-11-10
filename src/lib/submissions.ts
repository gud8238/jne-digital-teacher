import { apiRequest } from "./api";
import type { BadgeId, Me } from "../domain/badges";

export const submissionAccept = ".hwpx,.hwp,.pdf,.png,.jpg,.jpeg";
const maxSize = 20 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "",
  "application/octet-stream",
  "application/hwp+zip",
  "application/vnd.hancom.hwpx",
  "application/x-hwpx",
  "application/x-hwp",
  "application/haansofthwp",
  "application/vnd.hancom.hwp",
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
export function validateSubmissionFile(file: File): string {
  if (
    !/\.(hwpx|hwp|pdf|png|jpe?g)$/i.test(file.name) ||
    !allowedMimeTypes.has(file.type.toLowerCase())
  )
    return "HWPX, HWP, PDF, PNG, JPEG 파일만 제출할 수 있습니다.";
  if (!file.size) return "내용이 있는 파일을 선택해 주세요.";
  if (file.size > maxSize) return "파일은 최대 20 MiB까지 제출할 수 있습니다.";
  return "";
}
function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () =>
      reject(new Error("파일을 읽지 못했습니다. 다시 선택해 주세요."));
    reader.onabort = () => reject(new Error("파일 읽기가 중단되었습니다."));
    reader.readAsDataURL(blob);
  });
}
type Upload = { uploadId: string; chunkSize: number; received: number };
export type SubmissionResult = {
  me: Me;
  submission: {
    badgeId: BadgeId;
    status: string;
    fileName: string;
    submittedAt: string;
  };
};
export async function submitDocument(
  badgeId: BadgeId,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<SubmissionResult> {
  const error = validateSubmissionFile(file);
  if (error) throw new Error(error);
  const post = <T>(path: string, body: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    });
  const upload = await post<Upload>("submission-start", {
    badgeId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  if (
    !upload.uploadId ||
    upload.chunkSize !== 1048576 ||
    !Number.isInteger(upload.received) ||
    upload.received < 0 ||
    upload.received > file.size
  )
    throw new Error("업로드 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
  let offset = upload.received;
  onProgress(Math.floor((offset / file.size) * 100));
  while (offset < file.size) {
    const end = Math.min(file.size, offset + upload.chunkSize);
    const data = await base64(file.slice(offset, end));
    const chunk = await post<{
      uploadId: string;
      received: number;
      complete: boolean;
    }>("submission-chunk", { uploadId: upload.uploadId, offset, data });
    if (chunk.uploadId !== upload.uploadId || chunk.received !== end)
      throw new Error("전송 결과를 확인할 수 없습니다. 다시 제출해 주세요.");
    offset = chunk.received;
    onProgress(Math.floor((offset / file.size) * 100));
  }
  return post<SubmissionResult>("submission-complete", {
    uploadId: upload.uploadId,
  });
}
