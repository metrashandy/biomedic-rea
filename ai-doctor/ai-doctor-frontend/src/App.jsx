import { BrowserRouter, Routes, Route } from "react-router-dom";
import PatientPage from "./pages/PatientPage";
import DiagnosisPage from "./pages/DiagnosisPage";
import HistoryPage from "./pages/HistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PatientPage />} />
        <Route path="/diagnosis" element={<DiagnosisPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}