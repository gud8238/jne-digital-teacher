import { useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useBadges } from "../data/BadgeProvider";
import { calculateProgress, type BadgeId } from "../domain/badges";
import PageBanner from "../components/PageBanner";
import ProgressSummary, { masterMessage } from "../components/ProgressSummary";
import CollectionCard from "../components/CollectionCard";
import BadgeDetail from "../components/BadgeDetail";
import AsyncState from "../components/AsyncState";
import Icon from "../components/Icon";
export default function MyBadgesPage() {
  const auth = useAuth(),
    data = useBadges(),
    location = useLocation(),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<BadgeId | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  if (auth.loading || data.loading)
    return (
      <main className="loading-page">
        <AsyncState loading />
      </main>
    );
  if (auth.error || data.error)
    return (
      <main>
        <AsyncState
          error={auth.error || data.error}
          onRetry={() => {
            void auth.refresh();
            void data.refresh();
          }}
        />
      </main>
    );
  if (!auth.me)
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  const { me } = auth,
    progress = calculateProgress(data.definitions, me.collections);
  const visible = data.definitions.filter(
    (b) =>
      filter === "all" ||
      (filter === "master" && b.stage === 3) ||
      (filter === "earned" &&
        me.collections.find((r) => r.badgeId === b.id)?.status === "획득") ||
      (filter === "locked" &&
        me.collections.find((r) => r.badgeId === b.id)?.status === "미획득"),
  );
  const active = data.definitions.find((b) => b.id === selected);
  const filters = [
    ["all", `전체 (7)`],
    ["earned", `획득 (${progress.earnedCount})`],
    ["locked", `미획득 (${7 - progress.earnedCount})`],
    ["master", "마스터 (1)"],
  ];
  const stages = [
    {
      stage: 1,
      title: "입문자",
      copy: "교사로서의 첫걸음을 시작하는 기초 역량을 배양하는 단계입니다.",
    },
    {
      stage: 2,
      title: "분야별 전문가",
      copy: "5가지 전문 분야에서 실천적 역량을 키우는 단계입니다.",
    },
    {
      stage: 3,
      title: "역량 마스터",
      copy: "여러 전문 영역의 경험을 모아 높은 수준의 교원 역량을 완성하는 단계입니다.",
    },
  ];
  return (
    <main className="my-badges-page">
      <PageBanner
        className="collection-banner"
        title={`${me.teacher.name} 선생님의`}
        subtitle="성장을 응원합니다!"
        description="지금까지의 배지 여정을 한눈에 확인해 보세요."
      />
      <div className="container profile-container">
        <ProgressSummary me={me} progress={progress} />
      </div>
      <section className="collection-board container panel">
        <div className="section-title">
          <h2>나의 배지함</h2>
          <p>7개의 배지를 통해 교사로서의 전문성을 키워보세요.</p>
          <div className="filters" aria-label="배지 수집 필터">
            {filters.map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="collection-groups" role="group" aria-label="배지 목록">
          {stages.map((stage) => {
            const badges = visible
              .filter((b) => b.stage === stage.stage)
              .sort((a, b) => {
                const acquired = (id: BadgeId) =>
                  me.collections.find((row) => row.badgeId === id)?.status ===
                  "획득"
                    ? 1
                    : 0;
                return (
                  acquired(b.id) - acquired(a.id) ||
                  a.displayOrder - b.displayOrder
                );
              });
            return badges.length ? (
              <div
                key={stage.stage}
                className={`collection-stage collection-stage-${stage.stage}`}
              >
                <div className="stage-label">
                  <span>{stage.stage}단계</span>
                  <div>
                    <h3>
                      {stage.stage}단계 · {stage.title}
                    </h3>
                    <p>{stage.copy}</p>
                  </div>
                </div>
                <div className="stage-cards">
                  {badges.map((b) => (
                    <CollectionCard
                      key={b.id}
                      badge={b}
                      collection={me.collections.find(
                        (r) => r.badgeId === b.id,
                      )!}
                      onClick={(e) => {
                        trigger.current = e.currentTarget;
                        setSelected(b.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null;
          })}
          {visible.length === 0 ? (
            <p className="empty-collection">
              해당하는 배지가 없습니다. 다른 필터를 선택해 보세요.
            </p>
          ) : null}
          {filter === "all" ? (
            <div className="mobile-growth-prompt">
              <Icon name="badge" size={35} />
              <b>{masterMessage(progress)}</b>
              <Link to="/guide" className="button button-primary">
                인증안내 보기 <Icon name="arrow" size={15} />
              </Link>
            </div>
          ) : null}
        </div>
        {active ? (
          <BadgeDetail
            badge={active}
            collection={me.collections.find((r) => r.badgeId === active.id)}
            onClose={() => {
              setSelected(null);
              trigger.current?.focus();
            }}
          />
        ) : null}
      </section>
      <div className="collection-next container">
        <Link to="/guide">
          나에게 맞는 다음 성장 경로 확인하기 <Icon name="arrow" size={17} />
        </Link>
      </div>
    </main>
  );
}
