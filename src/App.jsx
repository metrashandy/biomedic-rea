import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import LandingPage from "./pages/LandingPage";
import AnalyzePage from "./pages/AnalyzePage";
import PatientList from "./pages/PatientList";
import PatientDetail from "./pages/PatientDetail";
import RecordDetail from "./pages/RecordDetail";

export default function App() {
  return (
    <>
      <Toaster position="top-right" />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patient/:id" element={<PatientDetail />} />
        <Route path="/record/:recordId" element={<RecordDetail />} />
      </Routes>
    </>
  );
}
