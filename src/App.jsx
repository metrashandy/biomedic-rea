import React, { useState, useCallback, useRef, useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import RecordDetail from './pages/RecordDetail';
import PatientDetail from './pages/PatientDetail';
import PatientList from "./pages/PatientList"; // Import file yang baru kita buat
import { useDropzone } from "react-dropzone";
import jsPDF from "jspdf";
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  Activity,
  Pill,
  RotateCcw,
  Download,
  Trash2,
  RefreshCw,
  User,
  Scan,
  Maximize,
} from "lucide-react";
import { motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const resultsRef = useRef(null);

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
  };

  useEffect(() => {
    if (result) {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [result]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];

    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File maksimal 5MB!");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Hanya JPG dan PNG yang diperbolehkan!");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      if (error?.code === "file-too-large") {
        toast.error("File terlalu besar (max 5MB)");
      } else if (error?.code === "file-invalid-type") {
        toast.error("Format file harus JPG atau PNG");
      } else {
        toast.error("File tidak valid");
      }
    },
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

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
        return;
      }
      if (!data.result || !data.result.analysis) {
        setResult(null);
        toast.error("Gambar tidak dapat dianalisis (bukan X-ray)");
        return;
      }
      setResult(data);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      toast.error(
        "Gagal terhubung ke server. Pastikan backend Python sudah berjalan!",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportPDF = () => {
    if (!result || !selectedFile) return;
    setExporting(true);

    const doc = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - 2 * margin;
    let yPos = 20;
    const now = new Date();

    const date = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const reportId = `BR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    const addWrappedText = (text, options = {}) => {
      const {
        isBold = false,
        fontSize = 11,
        color = [0, 0, 0],
        spacing = 5,
      } = options;
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);

      const lines = doc.splitTextToSize(text, usableWidth);
      lines.forEach((line) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 6;
      });
      yPos += spacing;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LAPORAN RADIOLOGI MEDIS", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 6;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Sistem AI Biomedic Read", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Informasi Umum & Profil AI", margin, yPos);
    yPos += 6;
    doc.setDrawColor(180);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    const labelX = margin;
    const colonX = margin + 35;
    const valueX = margin + 40;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Tanggal / Waktu", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text(`${date} ${time}`, valueX, yPos);
    yPos += 6;
    doc.text("Report ID", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text(reportId, valueX, yPos);
    yPos += 6;

    if (result.ai_metadata) {
      doc.text("AI Tebakan Umur", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(`${result.ai_metadata.age} Tahun`, valueX, yPos);
      yPos += 6;
      doc.text("AI Tebakan Gender", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(result.ai_metadata.gender, valueX, yPos);
      yPos += 6;
      doc.text("Posisi X-Ray", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(result.ai_metadata.view, valueX, yPos);
      yPos += 6;
      doc.text("Rasio CTR", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(String(result.ai_metadata.ctr_ratio), valueX, yPos);
      yPos += 6;
    }

    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // GAMBAR (Menggunakan Segmentasi HF jika ada, jika tidak pakai asli)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Citra X-Ray (Segmentasi AI)", margin, yPos);
    yPos += 6;

    const renderImageToPDF = (base64Img, format) => {
      const imgProps = doc.getImageProperties(base64Img);
      const maxWidth = 110;
      const maxHeight = 80;
      let imgWidth = maxWidth;
      let imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (imgProps.width * imgHeight) / imgProps.height;
      }
      const xPos = (pageWidth - imgWidth) / 2;
      doc.addImage(base64Img, format, xPos, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 5;
    };

    if (result.segmentation_image) {
      renderImageToPDF(
        `data:image/png;base64,${result.segmentation_image}`,
        "PNG",
      );
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = () => {
        renderImageToPDF(
          reader.result,
          selectedFile.type.includes("png") ? "PNG" : "JPEG",
        );
        continuePDFGeneration();
      };
      return; // Tunggu FileReader selesai
    }

    continuePDFGeneration();

    function continuePDFGeneration() {
      doc.setDrawColor(220);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Medical Analysis", margin, yPos);
      yPos += 6;
      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      const sectionTitle = (title) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, margin, yPos);
        yPos += 6;
      };

      sectionTitle("1. Temuan");
      addWrappedText(result?.result?.analysis?.findings || "-");
      sectionTitle("2. Potensi Kelainan");
      addWrappedText(result?.result?.analysis?.potential_abnormalities || "-");
      sectionTitle("3. Observasi");
      addWrappedText(result?.result?.analysis?.observations || "-");
      sectionTitle("4. Tingkat Risiko");
      addWrappedText(
        `Overall Risk : ${result?.result?.risk_assessment?.overall_health_risk_percentage ?? "-"}%`,
      );
      addWrappedText(
        result?.result?.risk_assessment?.assessment_explanation || "-",
      );
      sectionTitle("5. Penilaian Teknis");
      addWrappedText(
        `Positioning : ${result?.result?.technical_assessment?.positioning || "-"}`,
      );
      addWrappedText(
        `Exposure    : ${result?.result?.technical_assessment?.exposure || "-"}`,
      );
      addWrappedText(
        `Artifacts   : ${result?.result?.technical_assessment?.artifacts || "-"}`,
      );
      sectionTitle("6. Interpretasi Klinis");
      addWrappedText(result?.result?.specific_response || "-");
      sectionTitle("7. Rekomendasi Pengobatan");
      addWrappedText(
        `General Approach : ${result?.result?.treatment_recommendations?.general_approach || "-"}`,
      );
      addWrappedText(
        `Possible Treatments : ${result?.result?.treatment_recommendations?.possible_treatments || "-"}`,
      );
      addWrappedText(
        `Follow Up : ${result?.result?.treatment_recommendations?.follow_up || "-"}`,
      );
      sectionTitle("8. Rekomendasi Secara Umum");
      addWrappedText(result?.result?.recommendations || "-");
      sectionTitle("9. Disclaimer");
      addWrappedText(result?.result?.disclaimer || "-", {
        fontSize: 9,
        color: [120, 120, 120],
      });

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        "This report is generated by AI and should not replace professional medical advice.",
        margin,
        pageHeight - 10,
      );
      doc.save(`Medical_Report_${reportId}.pdf`);
      setExporting(false);
    }
  };

  const dummyResult = {
    segmentation_image: "", // Base64 terlalu panjang untuk dummy
    ai_metadata: {
      age: 45.5,
      gender: "Laki-laki",
      view: "PA",
      ctr_ratio: 0.48,
    },
    result: {
      analysis: {
        findings: "Terdapat pola konsolidasi pada paru-paru...",
        potential_abnormalities: "Possible pneumonia",
        observations: "Normal heart size",
      },
      risk_assessment: {
        overall_health_risk_percentage: 75,
        assessment_explanation: "Risiko tinggi karena pola konsolidasi.",
      },
      technical_assessment: {
        positioning: "Good",
        exposure: "Normal",
        artifacts: "None",
      },
      specific_response: "Kondisi konsisten dengan infeksi paru.",
      treatment_recommendations: {
        general_approach: "Antibiotics",
        possible_treatments: "Amoxicillin",
        follow_up: "1 week",
      },
      recommendations: "Konsultasikan segera dengan dokter.",
      disclaimer: "AI generated result.",
    },
  };

  if (!showApp) {
    return (
      <>
        <Toaster position="top-right" />
        <motion.div
          className="min-h-screen bg-sky-50"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <header className="flex justify-between items-center px-8 h-16 bg-sky-100 shadow-sm border-b border-sky-200 sticky top-0 z-50">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer">
              Biomedic <span className="text-blue-600">Read</span>
            </h1>

            <div className="space-x-6 text-slate-600 font-medium flex items-center">
              <Link to="/" className="hover:text-blue-600 transition">
                Analisis AI Baru
              </Link>
              <Link to="/patients" className="hover:text-blue-600 transition">
                Daftar Pasien
              </Link>
            </div>
          </header>
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-6xl mx-auto px-6 py-20">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl font-extrabold text-slate-800 mb-6 leading-tight">
                Pahami Hasil <br /> Anda{" "}
                <span className="text-blue-600">dengan AI</span>
              </h1>
              <p className="text-slate-600 mb-6">
                Unggah hasil X-ray Anda dan dapatkan analisis medis, tingkat
                risiko, serta rekomendasi secara instan berbasis AI.
              </p>
              <button
                onClick={() => setShowApp(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow"
              >
                Coba Sekarang →
              </button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <img
                src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5"
                alt="medical ai"
                className="rounded-2xl shadow-lg"
              />
            </motion.div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <motion.div
        className="min-h-screen bg-sky-50"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <header className="flex justify-between items-center px-8 h-16 bg-sky-100 shadow-sm border-b border-sky-200 sticky top-0 z-50">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer">
            Biomedic <span className="text-blue-600">Read</span>
          </h1>

          <div className="space-x-6 text-slate-600 font-medium flex items-center">
            <Link to="/" className="hover:text-blue-600 transition">
              Analisis AI Baru
            </Link>
            <Link to="/patients" className="hover:text-blue-600 transition">
              Daftar Pasien
            </Link>
          </div>
        </header>

        <Routes>
          {/* Route 1: Halaman Daftar Pasien */}
          <Route path="/patients" element={<PatientList />} />
           <Route path="/patient/:id" element={<PatientDetail />} />
           <Route path="/record/:recordId" element={<RecordDetail />} />

          <Route
            path="/"
            element={
              <main className="max-w-6xl mx-auto px-6 py-16 space-y-6">
                <div className="mb-6">
                  <button
                    onClick={() => {
                      resetForm();
                      setShowApp(false);
                    }}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    ← Kembali
                  </button>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-3xl mx-auto">
                  <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
                    Analisis Citra Medis
                  </h2>
                  <p className="text-center text-slate-500 mb-8">
                    Unggah gambar radiologi anda untuk mendapatkan hasil instan
                  </p>
                  <div
                    {...getRootProps()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
                  >
                    <input id="fileInput" {...getInputProps()} />
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-80 rounded-lg object-contain"
                      />
                    ) : (
                      <>
                        <div className="mb-4 text-blue-500 group-hover:text-blue-600">
                          <UploadCloud size={48} strokeWidth={1.5} />
                        </div>
                        <p className="text-slate-700 font-medium mb-2 text-lg">
                          Klik untuk mengunggah gambar atau seret dan lepaskan
                        </p>
                      </>
                    )}
                  </div>
                  {imagePreview && (
                    <div className="flex justify-between mt-4 px-2 relative z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resetForm();
                        }}
                        className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium"
                      >
                        <Trash2 size={18} /> Hapus
                      </button>
                      <button
                        onClick={() =>
                          document.getElementById("fileInput").click()
                        }
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"
                      >
                        <RefreshCw size={18} /> Ganti
                      </button>
                    </div>
                  )}
                  <div className="mt-6">
                    <label
                      htmlFor="symptoms"
                      className="block text-md font-medium text-slate-700 mb-2"
                    >
                      Gejala/Riwayat Pasien (Opsional)
                    </label>
                    <textarea
                      id="symptoms"
                      rows="3"
                      className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh : Pria 40 tahun, perokok kronis..."
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Tombol Test PDF Sementara (Bisa dihapus nanti) */}
                  <button
                    onClick={() => setResult(dummyResult)}
                    className="mt-4 text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded"
                  >
                    Test UI (Data Dummy)
                  </button>

                  <div className="mt-8">
                    <button
                      onClick={handleAnalyze}
                      className={`w-full font-bold py-4 rounded-xl transition-colors shadow-sm text-lg ${!selectedFile ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
                      disabled={!selectedFile || loading}
                    >
                      {loading ? "Menganalisis & Segmentasi AI..." : "Analisis"}
                    </button>
                  </div>
                </div>

                {result?.result?.analysis && (
                  <div ref={resultsRef} className="mt-16 animate-fade-in">
                    <div className="text-center mb-10">
                      <h2 className="text-3xl font-bold text-slate-800">
                        Hasil Analsis
                      </h2>
                      <p className="text-slate-500 mt-1">
                        Sistem kami memadukan segmentasi visual dan analisis
                        klinis.
                      </p>
                    </div>

                    {/* ===== NEW: BAGIAN SEGMENTASI & PROFIL AI (HUGGING FACE) ===== */}
                    {(result.segmentation_image || result.ai_metadata) && (
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
                          <Scan className="text-blue-500" /> Hasil Profiling &
                          Segmentasi AI
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                          {/* Kiri: Gambar Overlay */}
                          <div>
                            {result.segmentation_image ? (
                              <div className="bg-slate-900 rounded-xl p-2">
                                <img
                                  src={`data:image/png;base64,${result.segmentation_image}`}
                                  alt="Segmentasi AI"
                                  className="w-full rounded-lg object-contain h-auto"
                                />
                              </div>
                            ) : (
                              <div className="h-64 bg-slate-100 flex items-center justify-center rounded-xl text-slate-400 border border-dashed">
                                Gambar Segmentasi Tidak Tersedia
                              </div>
                            )}

                            {/* Legend Warna */}
                            <div className="flex gap-4 mt-4 text-sm font-medium justify-center text-slate-600">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-[rgb(255,191,0)] rounded-full"></div>{" "}
                                Paru Kanan
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-[rgb(0,255,0)] rounded-full"></div>{" "}
                                Paru Kiri
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-[rgb(0,0,255)] rounded-full"></div>{" "}
                                Jantung
                              </span>
                            </div>
                          </div>

                          {/* Kanan: Data Metadata AI */}
                          <div className="space-y-4">
                            <p className="text-slate-600 mb-4 leading-relaxed">
                              Model AI (Hugging Face) telah memindai citra X-Ray
                              ini dan berhasil mengekstrak profil pasien
                              berdasarkan struktur tulang dan organ:
                            </p>

                            {result.ai_metadata && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                  <span className="text-slate-500 text-sm flex items-center gap-1">
                                    <User size={14} /> Prediksi Umur
                                  </span>
                                  <p className="font-bold text-lg text-slate-800 mt-1">
                                    {result.ai_metadata.age} Tahun
                                  </p>
                                </div>
                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                  <span className="text-slate-500 text-sm flex items-center gap-1">
                                    <User size={14} /> Gender
                                  </span>
                                  <p className="font-bold text-lg text-slate-800 mt-1">
                                    {result.ai_metadata.gender}
                                  </p>
                                </div>
                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                  <span className="text-slate-500 text-sm flex items-center gap-1">
                                    <Maximize size={14} /> Posisi X-Ray
                                  </span>
                                  <p className="font-bold text-lg text-slate-800 mt-1">
                                    {result.ai_metadata.view}
                                  </p>
                                </div>
                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                  <span className="text-slate-500 text-sm flex items-center gap-1">
                                    <Activity size={14} /> Rasio CTR (Jantung)
                                  </span>
                                  <p className="font-bold text-lg text-slate-800 mt-1">
                                    {result.ai_metadata.ctr_ratio}
                                  </p>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-slate-400 mt-4 italic">
                              *CTR (Cardiothoracic Ratio) di atas 0.5 dapat
                              mengindikasikan pembengkakan jantung
                              (Kardiomegali).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* ===== END OF NEW SECTION ===== */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ResultCard
                        icon={<FileText />}
                        title="Temuan Klinis"
                        content={result?.result?.analysis?.findings || "-"}
                      />
                      <ResultCard
                        icon={<AlertTriangle className="text-orange-500" />}
                        title="Potensi Kelainan"
                        content={
                          result?.result?.analysis?.potential_abnormalities ||
                          "-"
                        }
                      />
                      <RiskCard
                        percentage={
                          result?.result?.risk_assessment
                            ?.overall_health_risk_percentage || 0
                        }
                      />
                      <ResultCard
                        icon={<Pill className="text-green-500" />}
                        title="Rekomendasi Pengobatan"
                        content={`Approach: ${result?.result?.treatment_recommendations?.general_approach || "-"}\nTreatment: ${result?.result?.treatment_recommendations?.possible_treatments || "-"}`}
                      />
                      <div className="md:col-span-2">
                        <DisclaimerCard
                          content={result?.result?.disclaimer || "-"}
                        />
                      </div>
                    </div>

                    <div className="mt-12 flex justify-center items-center gap-4">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
                      >
                        <RotateCcw size={18} /> Diagnosis Ulang
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
                        disabled={exporting}
                      >
                        <Download size={18} />{" "}
                        {exporting ? "Exporting..." : "Export to PDF"}
                      </button>
                    </div>
                  </div>
                )}
              </main>
            }
          />
        </Routes>
      </motion.div>
    </>
  );
}

const ResultCard = ({ icon, title, content }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
    <div className="flex items-center gap-3 mb-3">
      {icon}
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
    </div>
    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
      {content}
    </p>
  </div>
);

const RiskCard = ({ percentage }) => {
  const safePercentage = Number(percentage) || 0;
  const riskColor =
    safePercentage > 70
      ? "bg-red-500"
      : safePercentage > 40
        ? "bg-yellow-500"
        : "bg-green-500";
  const riskTextColor =
    safePercentage > 70
      ? "text-red-600"
      : safePercentage > 40
        ? "text-yellow-600"
        : "text-green-600";
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
      <div className="flex items-center gap-3 mb-3">
        <Activity />
        <h3 className="text-xl font-bold text-slate-800">Tingkat Risiko</h3>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-5 my-2">
        <div
          className={`${riskColor} h-5 rounded-full`}
          style={{ width: `${safePercentage}%` }}
        ></div>
      </div>
      <p className={`mt-2 font-bold text-2xl ${riskTextColor}`}>
        {safePercentage}%
      </p>
    </div>
  );
};

const DisclaimerCard = ({ content }) => (
  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
    <p className="text-sm text-yellow-800">
      <span className="font-bold">Disclaimer:</span> {content}
    </p>
  </div>
);

export default App;
