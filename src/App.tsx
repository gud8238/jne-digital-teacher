import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import BadgesPage from "./pages/BadgesPage";
import MyBadgesPage from "./pages/MyBadgesPage";
import GuidePage from "./pages/GuidePage";
export default function App() {
  return (
    <AuthProvider>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <Header />
      <div id="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/badges" element={<BadgesPage />} />
          <Route path="/my-badges" element={<MyBadgesPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <BottomNav />
    </AuthProvider>
  );
}
