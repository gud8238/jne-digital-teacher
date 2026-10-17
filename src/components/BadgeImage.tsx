import type { BadgeId } from "../domain/badges";
import { badgeAsset } from "../assets";
export default function BadgeImage({
  badgeId,
  locked = false,
  size,
  alt = "",
}: {
  badgeId: BadgeId;
  locked?: boolean;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      className={`badge-image ${locked ? "is-locked" : ""}`}
      src={badgeAsset(badgeId)}
      alt={alt}
      width={size || 140}
      height={size || 140}
      loading="lazy"
      draggable={false}
    />
  );
}
