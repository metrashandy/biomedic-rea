import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan } from "lucide-react";
import toast from "react-hot-toast";
import { exportToPDF } from "../services/pdfExport";

import Header from "../components/Header";
import UploadForm from "../components/UploadForm";
import ResultSection from "../components/ResultSection";

export default function AnalyzePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analysisType, setAnalysisType] = useState("xray");

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

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Silakan upload gambar terlebih dahulu");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("symptoms", symptoms);
    formData.append("analysis_type", analysisType);

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      if (!data.result || !data.result.findings) {
        setResult(null);
        toast.error("Gambar tidak dapat dianalisis (bukan X-ray)");
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      toast.error(
        "Gagal terhubung ke server. Pastikan backend Python sudah berjalan!",
      );
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
    if (!result || !selectedFile) {
      toast.error("Data belum lengkap");
      return;
    }

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
      console.error(error);
      toast.error("Gagal export PDF");
    } finally {
      setExporting(false);
    }
  };

  // ===== DATA DUMMY =====
  const dummyResult = {
    segmentation_image: "",
    result: {
      findings: "Terdapat pola konsolidasi pada lapang paru...",
      abnormality: "Possible pneumonia",
      risk: 75,
      bboxes: [
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 0, y: 0, width: 1, height: 1 },
      ],
      recommendation: { approach: "Antibiotics", treatment: "Amoxicillin" },
      disclaimer:
        "Analisis ini hanya simulasi dan tidak menggantikan diagnosis medis.",
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
        className="max-w-6xl mx-auto px-6 py-16 space-y-6"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {!loading && !result && (
          <>
            <div className="mb-4">
              <label className="block mb-2 font-medium">Jenis Analisis</label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="xray">X-Ray Paru</option>
                <option value="fundus">Fundus Retina</option>
                <option value="ct">CT Scan</option>
                <option value="usg">Ultrasound</option>
              </select>
            </div>
            {/* ===== UPLOAD FORM ===== */}
            {!loading && !result && (
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
            )}
          </>
        )}

        {/* ===== LOADING ===== */}
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

        {/* ===== RESULT ===== */}
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
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
