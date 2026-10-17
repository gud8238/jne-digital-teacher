import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";
export default function HomePage() {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [form, setForm] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = new FormData(e.currentTarget);
    try {
      await auth.login(
        String(values.get("neisNumber")),
        String(values.get("name")),
      );
      const target = location.state?.from;
      navigate(
        typeof target === "string" &&
          target.startsWith("/") &&
          !target.startsWith("//")
          ? target
          : "/my-badges",
        { replace: true },
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="home-page">
      <section className="home-hero container">
        <div className="home-visual">
          <h1>
            선생님의 성장을
            <br />
            <strong>디지털배지로 이어갑니다</strong>
          </h1>
          <p>배움과 실천의 경험을 나만의 배지로 기록하고 확인해 보세요.</p>
          <div className="home-art" aria-hidden="true" />
        </div>
        <div className="login-card panel">
          <h2>
            {form ? "이메일로 로그인" : auth.me ? "반가워요, 선생님" : "로그인"}
          </h2>
          <p className="login-description">
            전남광주통합특별시교육청 교원의
            <br />더 나은 성장을 위해 함께합니다.
          </p>
          {auth.me ? (
            <>
              <p className="welcome-name">{auth.me.teacher.name} 선생님</p>
              <Link to="/my-badges" className="button button-primary">
                나의 배지함 보기 <Icon name="arrow" />
              </Link>
            </>
          ) : form ? (
            <form onSubmit={(e) => void submit(e)} aria-label="교원 로그인">
              <label htmlFor="neisNumber">나이스번호</label>
              <input
                id="neisNumber"
                name="neisNumber"
                autoComplete="username"
                inputMode="text"
                placeholder="나이스번호를 입력해 주세요"
                required
                maxLength={128}
              />
              <label htmlFor="name">이름</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="이름을 입력해 주세요"
                required
                maxLength={80}
              />
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="button button-primary"
                disabled={busy}
                type="submit"
              >
                {busy ? "확인 중…" : "로그인하기"}
                <Icon name="arrow" />
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setForm(false);
                  setError("");
                }}
              >
                로그인 방식 선택으로 돌아가기
              </button>
              <small className="test-label">구글시트 테스트버전</small>
            </form>
          ) : (
            <div className="login-methods">
              <button
                className="button button-primary"
                onClick={() => setNotice("아이모두 로그인은 준비 중입니다.")}
              >
                <img
                  src="/assets/logo-symbol.png"
                  alt=""
                  className="login-symbol"
                />
                아이모두계정으로 로그인
                <Icon name="arrow" />
              </button>
              <div className="email-method">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setForm(true);
                    setNotice("");
                  }}
                >
                  <Icon name="mail" />
                  이메일로 로그인
                  <Icon name="arrow" />
                </button>
                <small className="test-label">구글시트 테스트버전</small>
              </div>
              {notice ? (
                <p className="login-notice" role="status">
                  {notice}
                </p>
              ) : null}
            </div>
          )}
          <div className="login-security">
            <Icon name="shield" size={35} />
            <div>
              <b>나만의 배지 정보를 확인하세요.</b>
              <span>배움과 실천이 선생님의 성장 기록이 됩니다.</span>
            </div>
          </div>
        </div>
      </section>
      <section className="shortcuts container" aria-label="배지 서비스 안내">
        {[
          {
            to: "/badges",
            title: "배지 소개",
            copy: "다양한 배지를 통해 교원의 성장 여정을 확인해 보세요.",
            style: "book",
          },
          {
            to: "/guide",
            title: "인증 안내",
            copy: "배지 획득 기준과 나의 성장 경로를 자세히 알아보세요.",
            style: "guide",
          },
          {
            to: "/my-badges",
            title: "나의 배지함",
            copy: "지금까지 획득한 나만의 배지를 확인해 보세요.",
            style: "collection",
          },
        ].map((item) => (
          <Link to={item.to} className="shortcut panel" key={item.to}>
            <span className={`shortcut-art ${item.style}`} aria-hidden="true" />
            <div>
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
            </div>
            <span className="circle-arrow">
              <Icon name="arrow" size={18} />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
