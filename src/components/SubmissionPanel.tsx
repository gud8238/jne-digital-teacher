import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BadgeCollection, BadgeDefinition, Me } from "../domain/badges";
import {
  submissionAccept,
  submitDocument,
  validateSubmissionFile,
} from "../lib/submissions";

export default function SubmissionPanel({
  badge,
  collection,
  onComplete,
}: {
  badge: BadgeDefinition;
  collection: BadgeCollection;
  onComplete: (me: Me) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  if (badge.id === "master") return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || collection.status === "획득") return;
    const form = event.currentTarget;
    const controller = new AbortController();
    uploadController.current = controller;
    setBusy(true);
    setError("");
    setSuccess("");
    setProgress(0);
    try {
      const result = await submitDocument(
        badge.id,
        file,
        setProgress,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      onComplete(result.me);
      setFile(null);
      setSuccess(
        result.submission.status === "획득"
          ? "제출이 완료되었습니다. 관리자가 승인한 획득 상태를 유지합니다."
          : "제출이 완료되었습니다. 관리자 심사를 기다려 주세요.",
      );
      form.reset();
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error
          ? err.message
          : "제출하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="submission-panel panel"
      aria-label="인증서류 제출"
      aria-busy={busy}
    >
      <div className="submission-intro">
        <h3>인증서류 제출</h3>
        <p>
          양식과 취득 기준을 확인한 뒤 증빙 파일을 첨부해 주세요. 제출한 서류는
          관리자가 검토합니다.
        </p>
        {badge.templateFileId ? (
          <a
            className="button button-outline"
            href={`/api/template?badgeId=${encodeURIComponent(badge.id)}`}
            download={badge.templateFileName}
          >
            인증서류 양식 다운로드
          </a>
        ) : (
          <button className="button button-outline" type="button" disabled>
            양식 준비 중
          </button>
        )}
        {!badge.templateFileId ? (
          <small>
            양식 준비 중에도 취득 기준에 맞는 증빙을 제출할 수 있습니다.
          </small>
        ) : null}
      </div>
      {collection.status === "획득" ? (
        <p className="submission-earned">이미 획득한 배지입니다.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          {collection.status === "서류제출" ? (
            <p className="submission-pending">
              서류제출 · 심사대기
              <br />
              <small>
                추가 증빙은 재제출해 주세요. 이전 제출 파일도 보존됩니다.
              </small>
            </p>
          ) : null}
          <label htmlFor={`submission-${badge.id}`}>인증서류 파일</label>
          <input
            id={`submission-${badge.id}`}
            type="file"
            accept={submissionAccept}
            disabled={busy}
            aria-describedby={`submission-help-${badge.id}`}
            onChange={(event) => {
              const chosen = event.currentTarget.files?.[0] || null;
              const issue = chosen ? validateSubmissionFile(chosen) : "";
              setError(issue);
              setSuccess("");
              setFile(issue ? null : chosen);
            }}
          />
          <small id={`submission-help-${badge.id}`}>
            HWPX · HWP · PDF · PNG · JPEG / 파일 1개, 최대 20Mb
          </small>
          {file ? <p className="submission-filename">{file.name}</p> : null}
          {busy ? (
            <div className="submission-progress" role="status">
              <progress
                max={100}
                value={progress}
                aria-label="서류 업로드 진행률"
              />
              <span>
                {progress === 100 ? "제출 확인 중…" : `업로드 중 ${progress}%`}
              </span>
              <small>제출이 끝날 때까지 화면을 유지해 주세요.</small>
            </div>
          ) : null}
          <button
            type="submit"
            className="button button-primary"
            disabled={!file || busy}
          >
            {busy
              ? "제출 중…"
              : collection.status === "서류제출"
                ? "서류 다시 제출하기"
                : "서류 제출하기"}
          </button>
        </form>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="submission-success" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
