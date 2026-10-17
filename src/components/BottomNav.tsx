import { NavLink } from "react-router-dom";
import Icon from "./Icon";
const links = [
  { to: "/", label: "홈", icon: "home" },
  { to: "/badges", label: "배지소개", icon: "book" },
  { to: "/guide", label: "인증안내", icon: "guide" },
  { to: "/my-badges", label: "나의 배지함", icon: "badge" },
] as const;
export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="모바일 메뉴">
      {links.map((l) => (
        <NavLink to={l.to} key={l.to} end={l.to === "/"}>
          <Icon name={l.icon} />
          <span>{l.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
