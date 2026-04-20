import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, Filter } from "lucide-react";
import toast from "react-hot-toast";
import { exportToPDF } from "../services/pdfExport";

import Header from "../components/Header";
import UploadForm from "../components/UploadForm";
import ResultSection from "../components/ResultSection";

// ===== DAFTAR KATEGORI =====
const CATEGORIES = ["Retina Scan", "CT Scan", "X-Ray"];

export default function AnalyzePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analysisType, setAnalysisType] = useState("X-Ray");
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const resultsRef = useRef(null);

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
    setLoading(false);
  };

  useEffect(() => {
    if (result) {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [result]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/patients")
      .then((res) => res.json())
      .then((data) => setPatients(data.data));
  }, []);

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Silakan upload gambar terlebih dahulu");
      return;
    }
    if (!selectedPatientId) { toast.error("Pilih Pasien dulu!"); return; }
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("symptoms", symptoms);
    formData.append("analysis_type", analysisType);
    formData.append("id_pasien", selectedPatientId);

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }
      if (!data.result || !data.result.findings) {
        setResult(null);
        toast.error("Gambar tidak dapat dianalisis");
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (error) {
      console.error(error);
      toast.error("Gagal terhubung ke server.");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportPDF = async () => {
    if (!result || !selectedFile) return;
    try {
      setExporting(true);
      await exportToPDF(
        result,
        selectedFile,
        doctorBoxes,
        imagePreview,
        doctorNotes,
      );
      toast.success("PDF berhasil dibuat!");
    } catch (error) {
      toast.error("Gagal export PDF");
    } finally {
      setExporting(false);
    }
  };

  const dummyResult = {
    segmentation_image: "",
    result: {
      findings: "Terdapat pola konsolidasi pada lapang paru...",
      abnormality: "Possible pneumonia",
      risk: 75,
      bboxes: [{ x: 0, y: 0, width: 1, height: 1 }],
      recommendation: { approach: "Antibiotics", treatment: "Amoxicillin" },
      disclaimer: "Analisis ini hanya simulasi.",
    },
  };

  const handleTestUI = () => {
    setLoading(true);
    setTimeout(() => {
      setResult(dummyResult);
      setLoading(false);
    }, 2000);
  };

  const [doctorBoxes, setDoctorBoxes] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState({
    temuan: "",
    penyakit: "",
    risiko: "",
    rekomendasi: "",
  });

  return (
    <div className="min-h-screen bg-sky-50">
      <Header onReset={handleReset} />

      <motion.div
        className="max-w-6xl mx-auto px-6 py-12 space-y-6"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ===== BUNGKUS DROPDOWN & UPLOAD DI DALAM max-w-3xl BIAR SEJAJAR ===== */}
        {!loading && !result && (
          <div className="max-w-3xl mx-auto">
            {/* Kotak Dropdown Jenis Pemeriksaan yang Rapi */}
            <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-sky-100 p-4 rounded-2xl border border-sky-200">
              <label className="font-bold text-sky-900 flex items-center gap-2 whitespace-nowrap">
                <Filter size={20} className="text-sky-600" /> Jenis Pemeriksaan:
              </label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-full md:w-72 font-semibold cursor-pointer"
              >
                {CATEGORIES.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 max-w-3xl mx-auto bg-white p-4 rounded-xl border border-slate-200">
              <label className="block mb-2 font-bold text-slate-700">
                Pilih Pasien:
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full p-2 border rounded-lg shadow-sm"
              >
                <option value="">-- Pilih Pasien dari Database --</option>
                {patients.map((p) => (
                  <option key={p.id_pasien} value={p.id_pasien}>
                    {p.no_rm} - {p.nama_pasien}
                  </option>
                ))}
              </select>
            </div>

            {/* Form Upload */}
            <UploadForm
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              imagePreview={imagePreview}
              setImagePreview={setImagePreview}
              symptoms={symptoms}
              setSymptoms={setSymptoms}
              onAnalyze={handleAnalyze}
              onReset={handleReset}
              onTest={handleTestUI}
            />
          </div>
        )}

        {/* LOADING ANIMATION */}
        {loading && (
          <div className="bg-white p-12 rounded-2xl shadow-md border max-w-2xl mx-auto text-center flex flex-col items-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              <Scan
                className="absolute inset-0 m-auto text-blue-500 animate-pulse"
                size={32}
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Memproses Citra Medis...
            </h2>
            <p className="text-slate-500 mb-6">
              AI sedang menganalisis gambar Anda
            </p>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="preview"
                className="max-h-64 opacity-60 rounded-lg"
              />
            )}
          </div>
        )}

        {/* RESULT SECTION */}
        {result?.result?.findings && (
          <div ref={resultsRef}>
            <ResultSection
              result={result}
              imagePreview={imagePreview}
              onReset={handleReset}
              onExport={handleExportPDF}
              exporting={exporting}
              setDoctorBoxes={setDoctorBoxes}
              doctorBoxes={doctorBoxes}
              doctorNotes={doctorNotes}
              setDoctorNotes={setDoctorNotes}
              analysisType={analysisType}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
