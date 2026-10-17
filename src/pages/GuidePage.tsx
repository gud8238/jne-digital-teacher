import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useBadges } from "../data/BadgeProvider";
import {
  calculateProgress,
  recommendBadges,
  type BadgeId,
} from "../domain/badges";
import PageBanner from "../components/PageBanner";
import Roadmap from "../components/Roadmap";
import BadgeImage from "../components/BadgeImage";
import BadgeDetail from "../components/BadgeDetail";
import RecommendationCard from "../components/RecommendationCard";
import AsyncState from "../components/AsyncState";
import Icon from "../components/Icon";
import { masterMessage } from "../components/ProgressSummary";
export default function GuidePage() {
  const auth = useAuth(),
    data = useBadges(),
    [selected, setSelected] = useState<BadgeId | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  const ready = !auth.loading && !data.loading && !data.error && !auth.error;
  const progress =
    ready && auth.me
      ? calculateProgress(data.definitions, auth.me.collections)
      : null;
  const recommendations =
    ready && auth.me
      ? recommendBadges(data.definitions, auth.me.collections)
      : [];
  const active = data.definitions.find((b) => b.id === selected);
  return (
    <main className="guide-page">
      <PageBanner
        className="guide-banner"
        title="인증 안내"
        subtitle="현재 배지 현황을 바탕으로 다음 성장 경로를 확인해 보세요."
      />
      {!ready ? (
        <AsyncState
          loading={auth.loading || data.loading}
          error={auth.error || data.error}
          onRetry={() => {
            void auth.refresh();
            void data.refresh();
          }}
        />
      ) : (
        <>
          <div className="guide-roadmap container">
            <Roadmap
              definitions={data.definitions}
              collections={auth.me?.collections}
            />
          </div>
          {!auth.me ? (
            <section className="public-guide container panel">
              <h2>나의 성장 로드맵을 확인해 보세요.</h2>
              <p>
                로그인하면 배지 달성 현황과 다음 도전 배지를 확인할 수 있습니다.
              </p>
              <Link
                to="/"
                state={{ from: "/guide" }}
                className="button button-primary"
              >
                로그인하고 현황 보기 <Icon name="arrow" />
              </Link>
              <Link to="/badges" className="text-button">
                전체 배지 취득 기준 보기
              </Link>
            </section>
          ) : progress ? (
            <>
              <div className="guide-columns container">
                <section
                  className="guide-progress panel"
                  aria-label="나의 배지 달성 현황"
                >
                  <div className="section-title">
                    <h2>나의 배지 달성 현황</h2>
                    <b className="guide-total" aria-label="전체 획득 배지">
                      {progress.earnedCount} / 7
                    </b>
                  </div>
                  <div className="expert-progress">
                    <strong>
                      전문가 배지 {progress.expertCount} / 5개 달성
                    </strong>
                    <progress
                      max={100}
                      value={progress.expertPercent}
                      aria-label="전문가 달성 진행"
                    />
                    <span aria-label="전문가 달성률">
                      {progress.expertPercent}%
                    </span>
                  </div>
                  <div className="guide-badge-list">
                    {data.definitions.map((b) => {
                      const row = auth.me!.collections.find(
                        (r) => r.badgeId === b.id,
                      )!;
                      return (
                        <button
                          key={b.id}
                          className="guide-badge-row"
                          aria-label={`${b.name} 현황과 기준 보기`}
                          onClick={(e) => {
                            trigger.current = e.currentTarget;
                            setSelected(b.id);
                          }}
                        >
                          <BadgeImage badgeId={b.id} size={53} />
                          <b>{b.name}</b>
                          <span className="row-criteria">{b.criteria}</span>
                          <span
                            className={`pill ${row.status === "획득" ? "green" : b.id === "master" && progress.masterState === "eligible" ? "gold" : "gray"}`}
                          >
                            {row.status === "획득"
                              ? "획득"
                              : b.id === "master" &&
                                  progress.masterState === "eligible"
                                ? "조건 충족"
                                : "미획득"}
                          </span>
                          <Icon name="arrow" size={15} />
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section
                  className="recommendations panel"
                  aria-label="추천 성장 경로"
                >
                  <div className="section-title">
                    <Icon name="target" size={32} />
                    <h2>추천 성장 경로</h2>
                  </div>
                  <p className="recommendation-intro">
                    {progress.masterState === "awarded"
                      ? "마스터 달성을 축하합니다. 계속해서 배움과 실천을 나눠보세요."
                      : progress.masterState === "eligible"
                        ? "마스터 조건을 충족했어요. 발급 여부는 배지함에서 확인할 수 있습니다."
                        : "지금 도전하면 역량 마스터에 한 걸음 더 가까워져요!"}
                  </p>
                  {progress.masterState === "awarded" ? (
                    <div className="master-congratulations">
                      <BadgeImage badgeId="master" size={155} />
                      <h3>역량 마스터 달성</h3>
                      <p>선생님의 성장 여정을 응원합니다.</p>
                    </div>
                  ) : (
                    recommendations.map((b, index) => (
                      <RecommendationCard
                        key={b.id}
                        badge={b}
                        index={index}
                        onSelect={(e) => {
                          trigger.current = e.currentTarget;
                          setSelected(b.id);
                        }}
                      />
                    ))
                  )}
                  <p className="recommendation-basis">
                    미획득 배지와 기본 추천 순서에 따른 안내입니다.
                  </p>
                </section>
              </div>
              <div className="growth-callout container">
                <Icon name="badge" size={36} />
                <div>
                  <b>{masterMessage(progress)}</b>
                  <p>배지의 취득 기준과 준비 활동을 확인해 보세요.</p>
                </div>
                <Link to="/badges" className="button button-primary">
                  배지 기준 보기 <Icon name="arrow" />
                </Link>
              </div>
            </>
          ) : null}
          {active ? (
            <div className="container">
              <BadgeDetail
                badge={active}
                collection={auth.me?.collections.find(
                  (r) => r.badgeId === active.id,
                )}
                onClose={() => {
                  setSelected(null);
                  trigger.current?.focus();
                }}
              />
            </div>
          ) : null}
        </>
      )}
      <p className="official-note">
        <Icon name="guide" size={19} />
        공식 신청·심사·발급 절차 및 세부 기준은 추후 확정될 예정입니다.
      </p>
    </main>
  );
}
