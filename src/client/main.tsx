import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./providers/auth";
import { ThemeProvider } from "./providers/theme";
import "@excalidraw/excalidraw/index.css";
import DesignPage from "./DesignPage";
import GuestRoomPage from "./GuestRoomPage";
import LandingPage from "./LandingPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  //  <React.StrictMode>
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Owner access - requires auth, validates user param */}
          <Route path="/:user/:questionId" element={<DesignPage />} />
          {/* Guest access - no auth required, token-based */}
          <Route path="/room/:token" element={<GuestRoomPage />} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  //  </React.StrictMode>
);
