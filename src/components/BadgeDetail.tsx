import { useEffect, useRef } from "react";
import type { BadgeDefinition, BadgeCollection } from "../domain/badges";
import { stageNames } from "../assets";
import BadgeImage from "./BadgeImage";
import Icon from "./Icon";
export default function BadgeDetail({
  badge,
  collection,
  onClose,
  defaultDetail = false,
}: {
  badge: BadgeDefinition;
  collection?: BadgeCollection;
  onClose?: () => void;
  defaultDetail?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!defaultDetail) {
      ref.current?.focus();
      ref.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [badge.id, defaultDetail]);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label={`${badge.name} 상세 설명`}
      className={`badge-detail panel badge-${badge.id} ${defaultDetail ? "default-detail" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onClose) onClose();
      }}
    >
      <BadgeImage badgeId={badge.id} size={170} />
      <div className="detail-content">
        <span
          className={`pill ${badge.stage === 1 ? "green" : badge.stage === 3 ? "gold" : "purple"}`}
        >
          {badge.stage}단계 · {stageNames[badge.stage]} 배지
        </span>
        <h2>{badge.name}</h2>
        <p>{badge.description}</p>
        <h3>취득 기준</h3>
        <p>{badge.criteria}</p>
        <h3>도전 준비</h3>
        <p>{badge.preparation}</p>
        <div className="detail-meta">
          <span>{badge.criteriaStatus}</span>
          {collection ? (
            <span
              className={`pill ${collection.status === "획득" ? "green" : "gray"}`}
            >
              {collection.status}
              {collection.status === "획득"
                ? ` · ${collection.earnedAt || "취득일 미등록"}`
                : ""}
            </span>
          ) : null}
        </div>
      </div>
      {onClose ? (
        <button
          className="detail-close"
          aria-label="설명 닫기"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      ) : null}
    </section>
  );
}
