import React, { useState, useCallback, useRef, useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import RecordDetail from "./pages/RecordDetail";
import PatientDetail from "./pages/PatientDetail";
import PatientList from "./pages/PatientList";
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
  const risk = Number(result?.result?.risk) || 0;
  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
    setLoading(false); // Pastikan loading mati saat reset
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

    // Aktifkan mode loading untuk menghilangkan form upload
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
        setLoading(false); // Kembalikan form kalau error
        return;
      }
      if (!data.result || !data.result.findings) {
        setResult(null);
        toast.error("Gambar tidak dapat dianalisis (bukan X-ray)");
        setLoading(false); // Kembalikan form kalau error
        return;
      }
      setResult(data);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      toast.error(
        "Gagal terhubung ke server. Pastikan backend Python sudah berjalan!",
      );
      setLoading(false); // Kembalikan form kalau error
    } finally {
      // Ingat: Di sini setLoading(false) akan memunculkan UI Hasil Analisis
      setLoading(false);
    }
  };

  const handleReset = () => {
    resetForm();
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
    yPos += 15;

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

    // Catatan: PDF Metadata dikurangi karena umur/gender dari HF sudah dihapus
    if (result.result && result.result.bboxes) {
      doc.text("Area Terdeteksi", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(`${result.result.bboxes.length} Region`, valueX, yPos);
      yPos += 6;
      doc.text("Status Visual", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(
        result.result.bboxes.length > 0 ? "Suspect Abnormal" : "Tampak Bersih",
        valueX,
        yPos,
      );
      yPos += 6;
    }

    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

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
        `data:image/jpeg;base64,${result.segmentation_image}`,
        "JPEG",
      );
      continuePDFGeneration();
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
      return;
    }

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
      addWrappedText(result?.result?.findings || "-");
      sectionTitle("2. Potensi Kelainan");
      addWrappedText(result?.result?.abnormality || "-");
      sectionTitle("3. Tingkat Risiko");
      addWrappedText(`Overall Risk : ${result?.result?.risk ?? "-"}%`);
      addWrappedText(
        `Perhitungan:\n` +
          `Area: ${result?.result?.risk_factors?.area || "-"}\n` +
          `Region: ${result?.result?.risk_factors?.region_count || "-"}\n` +
          `Intensitas: ${result?.result?.risk_factors?.intensity || "-"}\n` +
          `→ ${result?.result?.risk_factors?.calculation || "-"}`,
      );
      sectionTitle("4. Rekomendasi Pengobatan");
      addWrappedText(
        `Approach : ${result?.result?.recommendation?.approach || "-"}`,
      );
      addWrappedText(
        `Treatment : ${result?.result?.recommendation?.treatment || "-"}`,
      );
      sectionTitle("5. Disclaimer");
      addWrappedText(
        result?.result?.disclaimer ||
          "Analisis ini disediakan oleh sistem AI dan tidak boleh menggantikan diagnosis medis profesional. Persentase risiko dan rekomendasi pengobatan hanyalah perkiraan dan saran umum. Pasien harus berkonsultasi dengan penyedia layanan kesehatan yang berkualifikasi untuk mendapatkan nasihat, diagnosis, dan pengobatan medis yang tepat.",
        { fontSize: 9, color: [120, 120, 120] },
      );

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

  // ===== DATA DUMMY TEST UI =====
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
        "Analisis ini disediakan oleh sistem AI dan tidak boleh menggantikan diagnosis medis profesional. Persentase risiko dan rekomendasi pengobatan hanyalah perkiraan dan saran umum. Pasien harus berkonsultasi dengan penyedia layanan kesehatan yang berkualifikasi untuk mendapatkan nasihat, diagnosis, dan pengobatan medis yang tepat.",
    },
  };

  const handleTestUI = () => {
    setLoading(true);
    setTimeout(() => {
      setResult(dummyResult);
      setLoading(false);
    }, 2500); // Simulasi loading 2.5 detik
  };

  // ===== LANDING PAGE =====
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

  // ===== MAIN APP =====
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
          <h1
            className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer"
            onClick={handleReset}
          >
            Biomedic <span className="text-blue-600">Read</span>
          </h1>
          <div className="space-x-6 text-slate-600 font-medium flex items-center">
            <Link
              to="/"
              onClick={handleReset}
              className="hover:text-blue-600 transition"
            >
              Analisis AI Baru
            </Link>
            <Link to="/patients" className="hover:text-blue-600 transition">
              Daftar Pasien
            </Link>
          </div>
        </header>

        <Routes>
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

                {/* ===== FASE 1: FORM UPLOAD (Muncul jika tidak loading dan tidak ada hasil) ===== */}
                {!loading && !result && (
                  <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-3xl mx-auto animate-fade-in">
                    <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
                      Analisis Citra Medis
                    </h2>
                    <p className="text-center text-slate-500 mb-8">
                      Unggah gambar radiologi anda untuk mendapatkan hasil
                      instan
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

                    <button
                      onClick={handleTestUI}
                      className="mt-4 text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded"
                    >
                      Test UI (Data Dummy)
                    </button>

                    <div className="mt-8">
                      <button
                        onClick={handleAnalyze}
                        className={`w-full font-bold py-4 rounded-xl transition-colors shadow-sm text-lg ${!selectedFile ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
                        disabled={!selectedFile}
                      >
                        Analisis Sekarang
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== FASE 2: LOADING ANIMATION (Menggantikan Form Upload) ===== */}
                {loading && (
                  <div className="bg-white p-12 rounded-2xl shadow-md border border-slate-200 max-w-2xl mx-auto text-center animate-fade-in flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                      <Scan
                        className="absolute inset-0 m-auto text-blue-500 animate-pulse"
                        size={32}
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2 animate-pulse">
                      Memproses Citra Medis...
                    </h2>
                    <p className="text-slate-500 mb-8">
                      AI sedang mendeteksi anomali, densitas, dan mengekstrak
                      temuan klinis.
                    </p>

                    {/* Gambar X-Ray dengan efek Scanning Garis */}
                    {imagePreview && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-300 inline-block shadow-inner bg-slate-900 p-2">
                        <img
                          src={imagePreview}
                          alt="Scanning"
                          className="max-h-64 object-contain opacity-60 grayscale"
                        />
                        <motion.div
                          animate={{ top: ["0%", "100%", "0%"] }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_4px_#60a5fa]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ===== FASE 3: HASIL ANALISIS ===== */}
                {result?.result?.findings && (
                  <div ref={resultsRef} className="animate-fade-in">
                    <div className="text-center mb-10">
                      <h2 className="text-3xl font-bold text-slate-800">
                        Hasil Analisis
                      </h2>
                      <p className="text-slate-500 mt-1">
                        Sistem kami memadukan deteksi visual dan analisis
                        klinis.
                      </p>
                    </div>

                    {/* KOTAK DETEKSI VISUAL OPENAI */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
                        <Scan className="text-blue-500" /> Deteksi Visual AI
                        (OpenAI Vision)
                      </h3>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div>
                          <div className="bg-slate-900 rounded-xl p-2">
                            {result.segmentation_image ? (
                              <img
                                src={`data:image/jpeg;base64,${result.segmentation_image}`}
                                alt="Segmentasi AI"
                                className="w-full rounded-lg object-contain h-auto"
                              />
                            ) : (
                              <img
                                src={imagePreview}
                                alt="Original"
                                className="w-full rounded-lg object-contain h-auto"
                              />
                            )}
                          </div>
                          <div className="flex gap-4 mt-4 text-sm font-medium justify-center text-slate-600">
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-red-600 rounded-sm"></div>{" "}
                              Area Suspect (Abnormal)
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-slate-600 mb-4 leading-relaxed">
                            Sistem AI telah memindai citra X-Ray ini dan
                            menandai area yang dicurigai memiliki kelainan
                            (opacity, asimetri, atau perbedaan densitas) dengan
                            kotak merah.
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                              <span className="text-slate-500 text-sm flex items-center gap-1">
                                <Scan size={14} /> Area Terdeteksi
                              </span>
                              <p className="font-bold text-lg text-slate-800 mt-1">
                                {result?.result?.bboxes?.length || 0} Region
                              </p>
                            </div>

                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                              <span className="text-slate-500 text-sm flex items-center gap-1">
                                <AlertTriangle size={14} /> Status Visual
                              </span>
                              <p className="font-bold text-lg text-slate-800 mt-1">
                                {result?.result?.bboxes?.length > 0
                                  ? "Suspect Abnormal"
                                  : "Tampak Bersih"}
                              </p>
                            </div>

                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                              <span className="text-slate-500 text-sm flex items-center gap-1">
                                <Activity size={14} /> Pola Distribusi
                              </span>
                              <p className="font-bold text-lg text-slate-800 mt-1">
                                {result?.result?.bboxes?.length > 1
                                  ? "Multifokal (Menyebar)"
                                  : result?.result?.bboxes?.length === 1
                                    ? "Fokal (Terpusat)"
                                    : "Tidak Ada"}
                              </p>
                            </div>

                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                              <span className="text-slate-500 text-sm flex items-center gap-1">
                                <User size={14} /> Tindak Lanjut
                              </span>
                              <p
                                className={`font-bold ${getActionColor(risk)}`}
                              >
                                {getAction(risk)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-4 italic">
                            *Semakin banyak region kotak merah yang terdeteksi,
                            semakin tinggi kemungkinan adanya infeksi atau
                            anomali pada paru-paru.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* KOTAK KLINIS BAWAH */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ResultCard
                        icon={<FileText />}
                        title="Temuan Klinis"
                        content={result?.result?.findings || "-"}
                      />
                      <ResultCard
                        icon={<AlertTriangle className="text-orange-500" />}
                        title="Potensi Kelainan"
                        content={result?.result?.abnormality || "-"}
                      />
                      <RiskCard
                        percentage={result?.result?.risk || 0}
                        factors={result?.result?.risk_factors}
                      />
                      <ResultCard
                        icon={<Pill className="text-green-500" />}
                        title="Rekomendasi Pengobatan"
                        content={`Approach: ${result?.result?.recommendation?.approach || "-"}\nTreatment: ${result?.result?.recommendation?.treatment || "-"}`}
                      />
                      <div className="md:col-span-2">
                        <DisclaimerCard content="Hasil ini dihasilkan oleh AI dan tidak menggantikan diagnosis medis profesional." />
                      </div>
                    </div>

                    <div className="mt-12 flex justify-center items-center gap-4">
                      {/* TOMBOL DIAGNOSIS ULANG MENGEMBALIKAN KE FORM UPLOAD */}
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

const RiskCard = ({ percentage, factors }) => {
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
      {factors && (
        <div className="mt-4 text-sm text-slate-600 space-y-1">
          <p>
            <b>Perhitungan:</b>
          </p>
          <p>• Area: {factors?.area || "-"}</p>
          <p>• Jumlah area: {factors?.region_count || "-"}</p>
          <p>• Intensitas: {factors?.intensity || "-"}</p>
          <p className="italic text-slate-500">
            → {factors?.calculation || "-"}
          </p>
        </div>
      )}
    </div>
  );
};

const getAction = (risk) => {
  const r = Number(risk) || 0;

  if (r > 70) return "Perlu Evaluasi Medis Segera";
  if (r > 30) return "Disarankan Pemantauan Klinis";
  return "Cukup Observasi dan Pencegahan";
};

const getActionColor = (risk) => {
  const r = Number(risk) || 0;

  if (r > 70) return "text-red-600";
  if (r > 30) return "text-yellow-600";
  return "text-green-600";
};

const DisclaimerCard = ({ content }) => (
  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
    <p className="text-sm text-yellow-800">
      <span className="font-bold">Disclaimer:</span> {content}
    </p>
  </div>
);

export default App;
