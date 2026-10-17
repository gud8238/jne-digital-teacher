import { useRef, useState } from "react";
import type { BadgeId } from "../domain/badges";
import { useBadges } from "../data/BadgeProvider";
import { stageNames } from "../assets";
import PageBanner from "../components/PageBanner";
import Roadmap from "../components/Roadmap";
import BadgeImage from "../components/BadgeImage";
import BadgeDetail from "../components/BadgeDetail";
import AsyncState from "../components/AsyncState";
import Icon from "../components/Icon";
export default function BadgesPage() {
  const data = useBadges(),
    [filter, setFilter] = useState(0),
    [selected, setSelected] = useState<BadgeId | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  const visible = data.definitions.filter((b) => !filter || b.stage === filter);
  const defaultId =
    filter === 2 ? "edtech" : filter === 3 ? "master" : "beginner";
  const active =
    visible.find((b) => b.id === selected) ||
    visible.find((b) => b.id === defaultId);
  function close() {
    setSelected(null);
    trigger.current?.focus();
  }
  return (
    <main className="catalog-page">
      <PageBanner
        className="catalog-banner"
        title="배지 소개"
        subtitle="교원의 성장 여정을 응원하는 디지털 배지"
        description="다양한 배지를 통해 전문성을 키우고, 나만의 성장 경로를 만들어 보세요."
      />
      {data.loading || data.error ? (
        <AsyncState
          loading={data.loading}
          error={data.error}
          onRetry={() => void data.refresh()}
        />
      ) : (
        <>
          <div className="catalog-roadmap container">
            <Roadmap definitions={data.definitions} />
          </div>
          <section className="catalog-body container">
            <div className="section-title">
              <h2>배지별 안내</h2>
              <p>
                각 배지의 의미와 취득 기준을 확인하고, 나에게 맞는 배지에
                도전하세요.
              </p>
            </div>
            <div
              className="filters catalog-filters"
              aria-label="배지 단계 필터"
            >
              {["전체", "입문", "전문가", "마스터"].map((label, i) => (
                <button
                  key={label}
                  className={filter === i ? "active" : ""}
                  aria-pressed={filter === i}
                  onClick={() => {
                    setFilter(i);
                    setSelected(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="badge-selectors">
              {visible.map((b) => (
                <button
                  key={b.id}
                  aria-label={`${b.name} 상세 보기`}
                  aria-pressed={selected === b.id}
                  className={`badge-selector badge-${b.id} ${selected === b.id ? "selected" : ""}`}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setSelected(b.id);
                  }}
                >
                  <BadgeImage badgeId={b.id} size={126} />
                  <div>
                    <span
                      className={`pill ${b.stage === 1 ? "green" : b.stage === 3 ? "gold" : "purple"}`}
                    >
                      {stageNames[b.stage]}
                    </span>
                    <h3>{b.name}</h3>
                    <p>{b.description}</p>
                  </div>
                  <Icon name="arrow" size={17} />
                </button>
              ))}
            </div>
            {active ? (
              <BadgeDetail
                badge={active}
                onClose={selected ? close : undefined}
                defaultDetail={!selected}
              />
            ) : null}
          </section>
        </>
      )}
      <p className="official-note">
        <Icon name="guide" size={18} />
        배지별 세부 인증 기준과 신청·심사·발급 절차는 추후 확정 예정입니다.
      </p>
    </main>
  );
}
