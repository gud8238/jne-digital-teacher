import type { BadgeDefinition, BadgeCollection } from "../domain/badges";
import BadgeImage from "./BadgeImage";
import Icon from "./Icon";
export default function CollectionCard({
  badge,
  collection,
  onClick,
}: {
  badge: BadgeDefinition;
  collection: BadgeCollection;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const earned = collection.status === "획득";
  return (
    <button
      className={`collection-card ${earned ? "collected" : "locked"} stage-${badge.stage}`}
      aria-label={`${badge.name} 상세 보기`}
      onClick={onClick}
    >
      <div className="collection-image">
        <BadgeImage badgeId={badge.id} locked={!earned} size={130} />
        <span className={`badge-status-icon ${earned ? "check" : "lock"}`}>
          <Icon name={earned ? "check" : "lock"} size={15} />
        </span>
      </div>
      <div className="collection-card-content">
        <h3>{badge.name}</h3>
        <span className={`pill ${earned ? "green" : "gray"}`}>
          {earned ? "획득 완료" : "미획득"}
        </span>
        <p>
          {earned ? (
            <>
              <Icon name="calendar" size={15} />
              {collection.earnedAt || "취득일 미등록"}
            </>
          ) : badge.id === "master" ? (
            "전문가 배지 3종 이상 획득"
          ) : (
            <span>나의 다음 도전</span>
          )}
        </p>
      </div>
    </button>
  );
}
