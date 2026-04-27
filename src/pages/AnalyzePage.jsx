import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, Filter, AlignLeft, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { exportToPDF } from "../services/pdfExport";
import { useParams } from "react-router-dom";

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
  const [recordId, setRecordId] = useState(null);
  const [detailLevel, setDetailLevel] = useState("medium"); // <--- STATE BARU
  const { id } = useParams();
  const idToUse = result?.record_id;

  const resultsRef = useRef(null);

  const handleSaveDoctorLocal = async () => {
    console.log("SAVE CLICKED");
    console.log("RECORD ID:", recordId);

    console.log("ID FINAL:", idToUse);

    if (!idToUse) {
      console.error("ID TIDAK ADA ❌");
      return;
    }

    const formData = new FormData();
    formData.append("doctor_notes", JSON.stringify(doctorNotes));
    formData.append("doctor_bboxes", JSON.stringify(doctorBoxes));

    try {
      const res = await fetch(
        `http://localhost:8000/api/records/${recordId}/doctor-update`,
        {
          method: "PUT",
          body: formData,
        },
      );

      if (!res.ok) {
        console.error("SAVE ERROR:", await res.text());
        return;
      }

      const data = await res.json();
      console.log("SAVE SUCCESS:", data);
    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  };

  const handleSaveDoctor = async () => {
    console.log("SAVE CLICKED");

    const formData = new FormData();
    formData.append("doctor_notes", JSON.stringify(doctorNotes));
    formData.append("doctor_bboxes", JSON.stringify(doctorBoxes));

    const res = await fetch(
      `http://localhost:8000/api/records/${recordId}/doctor-update`,
      {
        method: "PUT",
        body: formData,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("SAVE ERROR:", err);
      return;
    }

    const data = await res.json();
    console.log("SAVE SUCCESS:", data);
  };

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
    if (!selectedPatientId) {
      toast.error("Pilih Pasien dulu!");
      return;
    }
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("symptoms", symptoms);
    formData.append("analysis_type", analysisType);
    formData.append("id_pasien", selectedPatientId);
    formData.append("detail_level", detailLevel);

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
      setRecordId(data.record_id);
      console.log("FULL RESPONSE:", data);
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

  const handleExportPDF = () => {
    const record = {
      result: result.result, // hasil AI
      segmentation_image: result.segmentation_image,

      // 🔥 INI YANG PENTING
      selectedFile: selectedFile, // gambar asli (upload)
      imagePreview: imagePreview, // preview gambar
      doctorBoxes: doctorBoxes,
      doctorNotes: doctorNotes, // hasil gambar dokter

      date: new Date().toLocaleDateString(),
    };

    console.log("RECORD KE PDF:", record);

    exportToPDF(record);
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-100 to-indigo-100 pb-12">
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
            {/* BUNGKUS DENGAN GRID AGAR KIRI-KANAN (SEJAJAR) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Dropdown 1: Jenis Pemeriksaan */}
              <div>
                <label className="block mb-2 font-black text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-sky-500" /> Jenis
                  Pemeriksaan:
                </label>
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full p-4 border-2 border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                  {CATEGORIES.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 2: Detail Level Laporan */}
              <div>
                <label className="block mb-2 font-black text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <AlignLeft size={16} className="text-sky-500" /> Tingkat
                  Detail Laporan AI:
                </label>
                <select
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value)}
                  className="w-full p-4 border-2 border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="short">Pendek (Ringkas & Cepat)</option>
                  <option value="medium">Sedang (Standar Diagnostik)</option>
                  <option value="long">Panjang (Sangat Detail)</option>
                </select>
              </div>
            </div>

            <div className="mb-8 max-w-3xl mx-auto bg-white p-6 rounded-3xl border border-indigo-100 shadow-lg shadow-slate-200/50">
              <label className="block mb-3 font-black text-[#1e1b4b] text-sm uppercase tracking-wider">
                Pilih Pasien:
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full p-3 border-2 border-slate-100 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
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
        {result && (
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
            handleSaveDoctorLocal={() => handleSaveDoctorLocal()}
          />
        )}
      </motion.div>
    </div>
  );
}
