import type { BadgeDefinition } from "../domain/badges";
import BadgeImage from "./BadgeImage";
import Icon from "./Icon";
export default function RecommendationCard({
  badge,
  index,
  onSelect,
}: {
  badge: BadgeDefinition;
  index: number;
  onSelect: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <article className="recommendation-card panel">
      <span className="recommendation-number">
        {String(index + 1).padStart(2, "0")}
      </span>
      <BadgeImage badgeId={badge.id} size={105} />
      <div>
        <div className="recommendation-heading">
          <h3>{badge.name}</h3>
          {index === 0 ? (
            <span className="pill gold">다음 도전 추천</span>
          ) : null}
        </div>
        <p>{badge.preparation}</p>
        <span className="recommendation-tag">
          <Icon name="check" size={13} />
          취득 기준과 준비 활동 확인
        </span>
      </div>
      <button
        className={`button ${index === 0 ? "button-primary" : "button-outline"}`}
        aria-label={`${badge.name} ${index === 0 ? "도전 준비하기" : "기준 보기"}`}
        onClick={onSelect}
      >
        {index === 0 ? "도전 준비하기" : "기준 보기"}
        <Icon name="arrow" size={17} />
      </button>
    </article>
  );
}
