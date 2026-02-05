import { Navigate, Route, Routes } from "react-router-dom";
import DemoRequestPage from "./pages/DemoRequestPage";
import DemoSessionPage from "./pages/DemoSessionPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/demo" replace />} />
      <Route path="/demo" element={<DemoRequestPage />} />
      <Route path="/demo/:token" element={<DemoSessionPage />} />
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
}

