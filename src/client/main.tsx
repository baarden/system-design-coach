import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./providers/auth";
import { ThemeProvider } from "./providers/theme";
import "@excalidraw/excalidraw/index.css";
import DesignPage from "./DesignPage";
import LandingPage from "./LandingPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  //  <React.StrictMode>
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/:user/:questionId" element={<DesignPage />} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  //  </React.StrictMode>
);
