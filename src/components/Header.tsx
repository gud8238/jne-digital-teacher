import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
export default function Header() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  async function leave() {
    try {
      await logout();
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link
            to="/"
            className="brand"
            aria-label="전남광주통합특별시교육청 홈"
          >
            <img
              src="/assets/logo-wide.png"
              alt="전남광주통합특별시교육청"
              width="400"
              height="40"
            />
          </Link>
          <span className="brand-caption">교원역량 디지털배지</span>
          <nav aria-label="주요 메뉴">
            <NavLink to="/badges">배지 소개</NavLink>
            <NavLink to="/guide">인증 안내</NavLink>
            <NavLink to="/my-badges">나의 배지함</NavLink>
          </nav>
          {me ? (
            <div className="header-account">
              <span>{me.teacher.name} 선생님</span>
              <button className="login-link" onClick={() => void leave()}>
                로그아웃
              </button>
            </div>
          ) : (
            <Link className="login-link" to="/">
              로그인
            </Link>
          )}
        </div>
      </header>
      {error ? (
        <div className="header-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="안내 닫기">
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
