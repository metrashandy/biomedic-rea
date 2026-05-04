import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User,
  Activity,
  Download,
  Image as ImageIcon,
  Filter,
  Loader2,
  PlusCircle,
  Scan,
  XCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Info,
  X,
  AlignLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Header from "../components/Header";
import ResultSection from "../components/ResultSection";
import { exportToPDF } from "../services/pdfExport";

const CATEGORIES = [
  "X-Ray",
  "Endoscopy",
  "EKG",
  "Fundus Retina",
  "CT Scan",
  "Lesi/Kelainan Kulit",
  "USG Payudara",
  "USG Abdominal",
];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resultsRef = useRef(null);
  const [doctorBoxesMap, setDoctorBoxesMap] = useState({});

  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua Kategori");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // ===== STATE UPLOAD MULTI-FILE BARU DARI TEMEN LU =====
  const [showUploadMode, setShowUploadMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of File objects
  const [imagePreviews, setImagePreviews] = useState([]); // Array of preview URL strings
  const [activePreviewIndex, setActivePreviewIndex] = useState(0); // Gambar aktif di preview

  // Backward compatibility untuk ResultSection biar gak error
  const selectedFile = selectedFiles[0] || null;
  const imagePreview = imagePreviews[activePreviewIndex] || null;
  const [activeResultImageIndex, setActiveResultImageIndex] = useState(0);

  const [symptoms, setSymptoms] = useState("");
  const [analysisType, setAnalysisType] = useState("X-Ray");
  const [detailLevel, setDetailLevel] = useState("medium");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [doctorBoxes, setDoctorBoxes] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState({
    temuan: "",
    penyakit: "",
    risiko: "",
    rekomendasi: "",
  });

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  // ==========================================
  // FUNGSI DOWNLOAD & FETCH DATA
  // ==========================================
  const triggerResumeDownload = () => {
    if (history.length === 0) return toast.error("Belum ada riwayat medis");
    setDownloadMode("resume");
    setShowDownloadModal(true);
  };

  const triggerSingleDownload = (record) => {
    setSelectedRecord(record);
    setDownloadMode("single");
    setShowDownloadModal(true);
  };

  const activeDoctorBoxes = doctorBoxesMap[activePreviewIndex] || [];
  const setActiveDoctorBoxes = (updater) => {
    setDoctorBoxesMap((prev) => ({
      ...prev,
      [activePreviewIndex]:
        typeof updater === "function"
          ? updater(prev[activePreviewIndex] || [])
          : updater,
    }));
  };

  const processDownload = async (withAI) => {
    setShowDownloadModal(false);
    setIsDownloading(true);
    const toastId = toast.loading(
      downloadMode === "resume"
        ? "Menyusun Resume Gabungan..."
        : "Menyiapkan Laporan...",
    );

    try {
      if (downloadMode === "resume") {
        const dataToPrint =
          activeCategory === "Semua Kategori"
            ? history
            : history.filter((r) => r.type === activeCategory);
        await exportToPDF(dataToPrint, patient, withAI);
      } else {
        const dataToPrint = {
          ai_result: selectedRecord.ai_result,
          gambar_asli_url: selectedRecord.imgUrl,
          gambar_hasil_url: selectedRecord.gambar_hasil_url,
          date: selectedRecord.date,
          doctorNotes: selectedRecord.doctor_notes || {},
          doctorBoxes: selectedRecord.doctor_bboxes || [],
        };
        await exportToPDF(dataToPrint, patient, withAI);
      }
      toast.success("PDF berhasil diunduh!", { id: toastId });
    } catch (e) {
      toast.error("Gagal membuat PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchPatientData = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/patients/${id}`);
      const data = await res.json();
      if (data.status === "success") {
        setPatient(data.patient);
        setHistory(data.history);
      }
    } catch (e) {
      toast.error("Gagal ambil data");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // LOGIKA UPLOAD MULTI FILE (DARI TEMEN LU)
  // ==========================================
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (files.length > 10) {
      toast.error("Maksimal 10 gambar per sesi");
      return;
    }
    setSelectedFiles(files);
    setActivePreviewIndex(0);

    // Generate previews untuk semua file
    const previews = [];
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      previews.push(url);
    });
    setImagePreviews(previews);
  };

  const handleAnalyzeNew = async () => {
    if (!selectedFiles || selectedFiles.length === 0)
      return toast.error("Upload gambar dulu!");
    setIsAnalyzing(true);
    const formData = new FormData();

    // Support multiple files
    selectedFiles.forEach((file) => {
      formData.append("images", file);
    });
    formData.append("symptoms", symptoms);
    formData.append("analysis_type", analysisType);
    formData.append("id_pasien", id);
    formData.append("detail_level", detailLevel);

    try {
      const res = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.result) {
        // ── Bangun all_images dari response backend ──
        // response.images = [{ urutan, original_url, ai_bboxes, ... }]
        const allImages = (data.images || []).map((img) => ({
          urutan: img.urutan,
          id_gambar: img.urutan, // pakai urutan sebagai key sementara
          original_url: img.original_url,
          segmentation_image: null, // tidak ada _ai.jpg, pakai overlay
          ai_bboxes: img.ai_bboxes || [], // ← PENTING: bbox per gambar
        }));

        // Fallback: kalau images kosong, pakai imagePreview
        if (allImages.length === 0 && imagePreview) {
          allImages.push({
            urutan: 1,
            id_gambar: 1,
            original_url: imagePreview,
            segmentation_image: null,
            ai_bboxes: data.result?.bboxes || [],
          });
        }

        // Susun uploadResult dengan struktur yang ResultSection butuhkan
        const uploadResultFormatted = {
          record_id: data.record_id,
          result: data.result, // findings, abnormality, risk, dll
          segmentation_image: null, // tidak pakai _ai.jpg
          total_images: data.total_images || allImages.length,
          all_images: allImages, // ← array gambar dengan ai_bboxes
        };

        setUploadResult(uploadResultFormatted);
        fetchPatientData();
        toast.success("Analisis AI Selesai!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Koneksi gagal");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDoctorNew = async (doctorImageBlob = null) => {
    const rId = uploadResult?.id_analisis || uploadResult?.record_id;
    if (!rId) return;

    const formData = new FormData();
    formData.append("doctor_notes", JSON.stringify(doctorNotes));
    formData.append("doctor_bboxes", JSON.stringify(activeDoctorBoxes));

    if (doctorImageBlob) {
      formData.append(
        "doctor_image",
        doctorImageBlob,
        "doctor_segmentation.jpg",
      );
    }

    try {
      await fetch(`http://127.0.0.1:8000/api/records/${rId}/doctor-update`, {
        method: "PUT",
        body: formData,
      });
      toast.success("Catatan Dokter Tersimpan!");
      setUploadResult(null);
      setShowUploadMode(false);
      setSelectedFiles([]);
      setImagePreviews([]);
      setDoctorBoxesMap({});
      fetchPatientData();
    } catch (e) {
      toast.error("Gagal simpan");
    }
  };

  const getSeverity = (risk) => {
    const r = Number(risk) || 0;
    if (r > 70)
      return {
        label: "Parah",
        color: "text-red-700 bg-red-100 border-red-300",
        icon: <ShieldAlert size={14} />,
      };
    if (r > 30)
      return {
        label: "Sedang",
        color: "text-amber-700 bg-amber-100 border-amber-300",
        icon: <AlertCircle size={14} />,
      };
    return {
      label: "Ringan",
      color: "text-emerald-700 bg-emerald-100 border-emerald-300",
      icon: <CheckCircle2 size={14} />,
    };
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-sky-400" size={48} />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-100 to-indigo-100 pb-12">
      <Header showBack={true} onBack={() => navigate("/patients")} />

      {/* POP-UP MODAL DOWNLOAD */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setShowDownloadModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black text-[#1e1b4b] mb-2">
              Format Laporan PDF
            </h3>
            <p className="text-slate-500 mb-8 font-medium">
              Pilih informasi apa yang ingin Anda masukkan ke dalam dokumen
              cetak.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => processDownload(true)}
                className="w-full p-5 border-2 border-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-2xl text-left transition-all shadow-sm"
              >
                <p className="font-black text-indigo-700 text-lg">
                  Laporan Lengkap (AI + Dokter)
                </p>
                <p className="text-sm text-indigo-600/80 mt-1 font-medium">
                  Mencakup semua hasil analisis otomatis AI dan catatan evaluasi
                  manual dokter.
                </p>
              </button>
              <button
                onClick={() => processDownload(false)}
                className="w-full p-5 border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 rounded-2xl text-left transition-all shadow-sm"
              >
                <p className="font-black text-slate-800 text-lg">
                  Laporan Resmi (Khusus Dokter)
                </p>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Menyembunyikan analisis AI. Hanya menampilkan gambar asli,
                  area hijau, dan catatan resmi dokter.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto px-6 py-8"
      >
        {/* KARTU PROFIL PASIEN */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between md:items-center mb-8 gap-6 border-b-4 border-sky-400 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-30 -mr-20 -mt-20 pointer-events-none"></div>
          <div className="flex gap-6 items-center z-10">
            <div className="w-20 h-20 bg-gradient-to-br from-sky-400 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg border border-sky-300/30">
              {patient?.nama_pasien?.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                {patient?.nama_pasien}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3 text-sky-100 font-semibold text-sm">
                <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shadow-inner">
                  <Activity size={16} className="text-sky-400" /> No RM:{" "}
                  {patient?.no_rm}
                </span>
                <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shadow-inner">
                  <User size={16} className="text-indigo-400" />{" "}
                  {patient?.umur || "-"} Thn ({patient?.gender || "-"})
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 z-10">
            <button
              onClick={() => {
                setShowUploadMode(!showUploadMode);
                setUploadResult(null);
                setDoctorNotes({
                  temuan: "",
                  penyakit: "",
                  risiko: "",
                  rekomendasi: "",
                });
                setDoctorBoxes([]);
                setSelectedFiles([]);
                setImagePreviews([]);
                setActivePreviewIndex(0);
              }}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black transition-all shadow-lg ${showUploadMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-sky-400 text-slate-900 hover:bg-sky-300"}`}
            >
              {showUploadMode ? (
                <>
                  <XCircle size={20} /> BATAL UPLOAD
                </>
              ) : (
                <>
                  <PlusCircle size={20} /> ANALISIS BARU
                </>
              )}
            </button>
            {!showUploadMode && history.length > 0 && (
              <button
                onClick={triggerResumeDownload}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg disabled:opacity-70 border border-indigo-400/50"
              >
                <Download size={20} />{" "}
                {isDownloading ? "MENYUSUN PDF..." : "RESUME PDF"}
              </button>
            )}
          </div>
        </div>

        {/* AREA UPLOAD & LOADING */}
        <AnimatePresence>
          {showUploadMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-10 overflow-hidden"
            >
              {isAnalyzing ? (
                <div className="bg-white p-12 rounded-[32px] shadow-2xl border border-indigo-100 max-w-2xl mx-auto text-center flex flex-col items-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                    <Scan
                      className="absolute inset-0 m-auto text-indigo-500 animate-pulse"
                      size={32}
                    />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">
                    Memproses {selectedFiles.length} Citra Medis...
                  </h2>
                  <p className="text-slate-500 mb-6 font-medium">
                    AI sedang menganalisis gambar Anda
                  </p>
                  {imagePreview && (
                    <div className="relative rounded-2xl overflow-hidden border-4 border-slate-900 inline-block shadow-2xl bg-slate-900 p-1">
                      <img
                        src={imagePreview}
                        alt="Scanning"
                        className="max-h-64 object-contain opacity-50 grayscale"
                      />
                      <motion.div
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="absolute left-0 w-full h-1 bg-sky-400 shadow-[0_0_20px_5px_#38bdf8]"
                      />
                    </div>
                  )}
                </div>
              ) : !uploadResult ? (
                /* === FORM UPLOAD MULTI-FILE BARU === */
                <div className="max-w-3xl mx-auto bg-white p-10 rounded-[32px] border border-indigo-100 shadow-2xl">
                  <div className="mb-8 flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Scan size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      Upload Citra Medis Baru
                    </h3>
                  </div>

                  <div className="mb-8">
                    <label className="block mb-2 font-black text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                      <FileText size={16} className="text-sky-500" /> Jenis
                      Pemeriksaan:
                    </label>
                    <select
                      value={analysisType}
                      onChange={(e) => setAnalysisType(e.target.value)}
                      className="w-full p-4 border-2 border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    >
                      {CATEGORIES.map((c, i) => (
                        <option key={i} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AREA MULTI-UPLOAD JSX TEMEN LU DIMASUKKAN DI SINI */}
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 font-black text-slate-700 text-sm uppercase tracking-wider">
                        Upload Gambar (Maks. 10)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        multiple
                        onChange={handleFileChange}
                        className="w-full p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 cursor-pointer hover:border-indigo-400 transition-all text-slate-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                    </div>

                    {imagePreviews.length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-sm font-bold text-slate-600 mb-3">
                          {imagePreviews.length} gambar dipilih:
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                          {imagePreviews.map((src, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActivePreviewIndex(idx)}
                              className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${idx === activePreviewIndex ? "border-indigo-500 shadow-md scale-105" : "border-slate-200 opacity-60 hover:opacity-100"}`}
                            >
                              <img
                                src={src}
                                alt={`Preview ${idx + 1}`}
                                className="w-20 h-20 object-cover"
                              />
                              <div
                                className={`absolute bottom-0 left-0 right-0 text-center text-[10px] font-black py-1 ${idx === activePreviewIndex ? "bg-indigo-500 text-white" : "bg-black/60 text-white"}`}
                              >
                                #{idx + 1}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center p-2">
                          <img
                            src={imagePreviews[activePreviewIndex]}
                            alt="Preview aktif"
                            className="max-h-64 object-contain rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block mb-2 font-black text-slate-700 text-sm uppercase tracking-wider">
                        Gejala / Keluhan (Opsional)
                      </label>
                      <textarea
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder="Contoh: batuk 2 minggu, demam, sesak napas..."
                        className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 outline-none focus:border-indigo-500 transition-all text-slate-700 font-medium"
                        rows={3}
                      />
                    </div>

                    <button
                      onClick={handleAnalyzeNew}
                      disabled={selectedFiles.length === 0 || isAnalyzing}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing
                        ? "MENGANALISIS..."
                        : selectedFiles.length > 1
                          ? `ANALISIS ${selectedFiles.length} GAMBAR SEKARANG`
                          : "ANALISIS GAMBAR SEKARANG"}
                    </button>
                  </div>
                </div>
              ) : (
                /* === HASIL ANALISIS === */
                <div className="bg-white p-4 rounded-[40px] border border-indigo-100 shadow-2xl overflow-hidden">
                  {(() => {
                    const allImages = uploadResult?.all_images || [];
                    const activeImg = allImages[activePreviewIndex] || null;
                    const resultWithActiveImage = {
                      ...uploadResult,
                      segmentation_image:
                        activeImg?.segmentation_image ||
                        uploadResult?.segmentation_image,
                      active_image_index: activePreviewIndex,
                      all_images: allImages,
                    };
                    const previewForActive =
                      imagePreviews[activePreviewIndex] || imagePreview;

                    return (
                      <ResultSection
                        result={resultWithActiveImage}
                        imagePreview={previewForActive}
                        onReset={() => {
                          setUploadResult(null);
                          setShowUploadMode(false);
                        }}
                        exporting={false}
                        onExport={() => exportToPDF(uploadResult, patient)}
                        onExportWithLevel={async (level) => {
                          const rId = uploadResult?.record_id;
                          if (!rId) return toast.error("ID tidak ditemukan");
                          const toastId = toast.loading("Meringkas laporan...");
                          try {
                            const res = await fetch(
                              `http://127.0.0.1:8000/api/records/${rId}/export?detail_level=${level}`,
                            );
                            const data = await res.json();
                            await exportToPDF(data.data, patient);
                            toast.success("PDF berhasil!", { id: toastId });
                          } catch {
                            toast.error("Gagal", { id: toastId });
                          }
                        }}
                        setDoctorBoxes={setActiveDoctorBoxes} // ← setter per gambar aktif
                        doctorBoxes={activeDoctorBoxes} // ← boxes gambar aktif saja
                        doctorNotes={doctorNotes}
                        setDoctorNotes={setDoctorNotes}
                        handleSaveDoctorLocal={handleSaveDoctorNew}
                        analysisType={analysisType}
                        totalImages={allImages.length}
                        activeImageIndex={activePreviewIndex}
                        onImageChange={setActivePreviewIndex}
                      />
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* LIST RIWAYAT MEDIS */}
        {!showUploadMode && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <div className="w-2 h-8 bg-sky-500 rounded-full"></div> Riwayat
                Medis Pasien
              </h2>
              <div className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
                <Filter size={18} className="text-indigo-600" />
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer w-full"
                >
                  <option value="Semua Kategori">Semua Kategori</option>
                  {CATEGORIES.map((cat, idx) => (
                    <option key={idx} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {history.filter(
              (r) =>
                activeCategory === "Semua Kategori" ||
                r.type === activeCategory,
            ).length === 0 ? (
              <div className="bg-white p-20 text-center rounded-[40px] border-2 border-dashed border-indigo-200 text-indigo-400 font-bold text-lg shadow-sm">
                Belum ada riwayat rekam medis ditemukan.
              </div>
            ) : (
              history
                .filter(
                  (r) =>
                    activeCategory === "Semua Kategori" ||
                    r.type === activeCategory,
                )
                .map((record, index) => {
                  const sev = getSeverity(record.ai_result?.risk);
                  return (
                    <motion.div
                      key={index}
                      whileHover={{ y: -3 }}
                      className="bg-white rounded-[32px] shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col md:flex-row hover:shadow-2xl hover:border-sky-300 transition-all group"
                    >
                      <div className="w-full md:w-1/4 bg-slate-900 flex items-center justify-center p-3 overflow-hidden relative">
                        <img
                          src={record.imgUrl}
                          alt="scan"
                          className="max-h-48 w-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute top-5 left-5 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20">
                          {record.type}
                        </div>
                      </div>

                      <div className="p-8 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wide shadow-sm ${sev.color}`}
                            >
                              {sev.icon} Gejala {sev.label}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-lg">
                              <Calendar size={14} className="text-indigo-500" />{" "}
                              {record.date}
                            </div>
                          </div>

                          <h3 className="font-black text-slate-800 text-xl mb-2 flex items-center gap-2">
                            {record.is_analyzed
                              ? "Analisis AI Selesai"
                              : "Menunggu Analisis AI"}
                            {record.is_analyzed && (
                              <CheckCircle2
                                size={18}
                                className="text-sky-500"
                              />
                            )}
                          </h3>
                          <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 bg-sky-50/50 p-4 rounded-2xl border border-sky-100 italic">
                            "
                            {typeof record.ai_result?.findings === "object"
                              ? Object.values(record.ai_result.findings).join(
                                  " ",
                                )
                              : record.ai_result?.findings ||
                                "Data citra medis sedang dalam antrean pemrosesan AI. Klik tombol detail untuk melihat/memulai."}
                            "
                          </p>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            onClick={() =>
                              navigate(`/record/${record.id_record}`)
                            }
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs shadow-md"
                          >
                            <Info size={14} /> DETAIL KLINIS
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerSingleDownload(record);
                            }}
                            className="flex items-center gap-2 bg-white text-slate-700 border-2 border-slate-200 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs shadow-sm hover:border-sky-300"
                          >
                            <Download size={14} /> PDF LAPORAN
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
