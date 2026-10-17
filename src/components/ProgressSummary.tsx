import type { Me, Progress } from "../domain/badges";
import Icon from "./Icon";
export function masterMessage(progress: Progress) {
  return progress.masterState === "awarded"
    ? "마스터 달성"
    : progress.masterState === "eligible"
      ? "조건 충족 · 발급 전"
      : `전문가 배지 ${progress.remainingExperts}개 남음`;
}
export default function ProgressSummary({
  me,
  progress,
}: {
  me: Me;
  progress: Progress;
}) {
  return (
    <div className="profile-summary panel">
      <div className="profile-person">
        <div className="avatar-art" aria-hidden="true" />
        <div>
          <h2>
            {me.teacher.name} <small>선생님</small>
          </h2>
          <span className="pill">
            {progress.masterState === "awarded" ? "마스터" : "성장 중"}
          </span>
          {me.teacher.school ? (
            <p>
              <Icon name="school" size={19} />
              {me.teacher.school}
            </p>
          ) : null}
        </div>
      </div>
      <div className="summary-stats">
        <div>
          <span>획득 배지</span>
          <b aria-label="전체 획득 배지">
            {progress.earnedCount} <small>/ 7</small>
          </b>
        </div>
        <div>
          <span>전문가 배지</span>
          <b aria-label="전문가 획득 배지">
            {progress.expertCount} <small>/ 5</small>
          </b>
        </div>
        <div>
          <span>달성률</span>
          <b aria-label="전체 달성률">{progress.overallPercent}%</b>
        </div>
      </div>
      <div className="master-summary">
        <div
          className="progress-ring"
          style={{
            background: `conic-gradient(var(--blue) ${Math.min(100, (progress.expertCount / 3) * 100)}%,#dbeaff 0)`,
          }}
        >
          <span>{Math.min(3, progress.expertCount)} / 3</span>
        </div>
        <div>
          <span>역량 마스터까지</span>
          <b>{masterMessage(progress)}</b>
        </div>
      </div>
    </div>
  );
}
