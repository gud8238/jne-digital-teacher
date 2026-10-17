import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <main className="container empty-page panel">
      <h1>화면을 찾을 수 없습니다.</h1>
      <p>메뉴에서 원하는 화면을 다시 선택해 주세요.</p>
      <Link to="/" className="button button-primary">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
