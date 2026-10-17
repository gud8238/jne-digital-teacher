import type { BadgeDefinition, BadgeCollection } from "../domain/badges";
import { calculateProgress } from "../domain/badges";
import BadgeImage from "./BadgeImage";
import Icon from "./Icon";
export default function Roadmap({
  definitions,
  collections,
}: {
  definitions: BadgeDefinition[];
  collections?: BadgeCollection[];
}) {
  const progress = collections
    ? calculateProgress(definitions, collections)
    : null;
  const earned = (id: string) =>
    collections?.some((r) => r.badgeId === id && r.status === "획득");
  return (
    <div className="roadmap panel" aria-label="교원 성장 배지 체계">
      <div className="roadmap-title">
        <h2>{progress ? "나의 성장 로드맵" : "교원 성장 배지 체계"}</h2>
        <span>
          {progress
            ? progress.masterState === "awarded"
              ? "역량 마스터 달성!"
              : progress.masterState === "eligible"
                ? "마스터 조건 충족 · 발급 전"
                : `역량 마스터까지 전문가 배지 ${progress.remainingExperts}개 남았어요!`
            : "단계별 배지를 획득하며 성장 로드맵을 완성해 보세요."}
        </span>
      </div>
      <div className="roadmap-stages">
        <div className="roadmap-stage beginner">
          <span className="pill green">1단계</span>
          <BadgeImage badgeId="beginner" size={120} />
          <b>AI디지털 입문자</b>
          {progress ? (
            <span className={`pill ${earned("beginner") ? "green" : "gray"}`}>
              {earned("beginner") ? "획득" : "미획득"}
            </span>
          ) : (
            <p>배움의 첫걸음</p>
          )}
        </div>
        <Icon name="arrow" />
        <div className="roadmap-stage experts">
          <span className="pill">2단계</span>
          <b>분야별 전문가</b>
          <div className="expert-icons">
            {definitions
              .filter((b) => b.stage === 2)
              .map((b) => (
                <div key={b.id}>
                  <BadgeImage badgeId={b.id} size={78} />
                  <span>{b.name}</span>
                  {progress ? (
                    <small className={earned(b.id) ? "earned" : "unearned"}>
                      {earned(b.id) ? "획득" : "미획득"}
                    </small>
                  ) : null}
                </div>
              ))}
          </div>
          <div className="mobile-expert-image">
            <BadgeImage badgeId="professional" size={83} />
          </div>
          <p>
            {progress ? (
              <>
                <b>{progress.expertCount} / 5</b>
                <span>전문가 배지</span>
              </>
            ) : (
              "5개 분야에서 전문성을 키워보세요."
            )}
          </p>
        </div>
        <Icon name="arrow" />
        <div className="roadmap-stage master">
          <span className="pill gold">3단계</span>
          <BadgeImage badgeId="master" size={120} />
          <b>역량 마스터</b>
          {progress ? (
            <span
              className={`pill ${progress.masterState === "awarded" ? "gold" : progress.masterState === "eligible" ? "purple" : "gray"}`}
            >
              {progress.masterState === "awarded"
                ? "획득"
                : progress.masterState === "eligible"
                  ? "조건 충족"
                  : "미획득"}
            </span>
          ) : (
            <p>전문가 배지 3종 이상</p>
          )}
        </div>
      </div>
    </div>
  );
}
