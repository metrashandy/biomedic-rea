import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

const EMPTY_FORM = {
  keluhan: "",
  gejala: "",
  tandaVital: "",
  hasilLab: "",
  alergi: "",
  riwayat: "",
  catatan: "",
  teks_bebas: "",
};

export default function DiagnosisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const patient = location.state?.patient;
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!patient) {
    navigate("/");
    return null;
  }

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [dbPatientId, setDbPatientId] = useState(patient.id || null);

  // Riwayat multi-giliran
  const [conversationHistory, setConversationHistory] = useState([]);
  const [memoryChecks, setMemoryChecks] = useState(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(null);

  // ===== CHAT — endpoint terpisah, konteks = hasil diagnosis =====
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // ===== GAMBAR (inline di form, pendukung gejala) =====
  const [imageBase64, setImageBase64] = useState(null);
  const [imageType, setImageType] = useState("image/jpeg");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [savedImagePath, setSavedImagePath] = useState("");

  // Catatan lanjutan (di bawah hasil AI)
  const [catatanLanjutan, setCatatanLanjutan] = useState("");

  const memoryCount = memoryChecks
    ? [
        ...(memoryChecks.icd10 || []),
        ...(memoryChecks.rekomendasi || []),
      ].filter(Boolean).length
    : 0;

  useEffect(() => {
    if (aiResult) {
      setShowMemoryPanel(false);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }, [aiResult]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      setTimeout(
        () => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }, [chatHistory]);

  // =============================================
  // Build history untuk analisis lanjutan
  // =============================================
  const buildHistoryToSend = (currentHistory, snapshot) => {
    if (!snapshot) return [...currentHistory];
    const {
      aiResult: prevResult,
      memoryChecks: prevChecks,
      formInput: prevForm,
    } = snapshot;

    const userMessage = [
      `Keluhan: ${prevForm.keluhan}`,
      prevForm.gejala ? `Gejala: ${prevForm.gejala}` : null,
      prevForm.tandaVital ? `Vital: ${prevForm.tandaVital}` : null,
      prevForm.hasilLab ? `Lab: ${prevForm.hasilLab}` : null,
      prevForm.teks_bebas ? `Catatan bebas: ${prevForm.teks_bebas}` : null,
      catatanLanjutan ? `Catatan lanjutan: ${catatanLanjutan}` : null,
    ]
      .filter(Boolean)
      .join(". ");

    const selectedIcd = (prevResult.icd10 || [])
      .filter((_, i) => prevChecks.icd10[i])
      .map((x) => `${x.kode} ${x.label}`)
      .join(", ");
    const selectedRek = (prevResult.rekomendasi || [])
      .filter((_, i) => prevChecks.rekomendasi[i])
      .join("; ");

    const assistantSummary = [
      `Dx: ${prevResult.penyakit}`,
      selectedIcd ? `ICD: ${selectedIcd}` : null,
      selectedRek ? `Tx: ${selectedRek}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return [
      ...currentHistory,
      { user: userMessage, assistant: assistantSummary },
    ];
  };

  // =============================================
  // Analisis Utama
  // =============================================
  const handleAnalisis = async () => {
    if (!formData.keluhan) return alert("Keluhan utama harus diisi!");
    const formSnapshot = { ...formData };
    const historyToSend = buildHistoryToSend(conversationHistory, lastSnapshot);

    setIsLoading(true);
    setAiResult(null);
    setMemoryChecks(null);
    setSavedSuccess(false);
    setSavedVisitId(null);

    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          weight: patient.weight ? parseFloat(patient.weight) : null,
          height: patient.height ? parseFloat(patient.height) : null,
          keluhan: formSnapshot.keluhan,
          gejala: formSnapshot.gejala,
          tandaVital: formSnapshot.tandaVital,
          hasilLab: formSnapshot.hasilLab,
          alergi: formSnapshot.alergi,
          riwayat: formSnapshot.riwayat,
          catatan: formSnapshot.catatan,
          teks_bebas: formSnapshot.teks_bebas,
          save_visit: false,
          conversation_history: historyToSend,
          chat_konsultasi: chatHistory,
        }),
      });
      if (!response.ok) throw new Error("Gagal terhubung ke server backend");
      const data = await response.json();

      const initialChecks = {
        icd10: (data.icd10 || []).map(() => true),
        rekomendasi: (data.rekomendasi || []).map(() => true),
      };
      setConversationHistory(historyToSend);
      setMemoryChecks(initialChecks);
      setLastSnapshot({
        aiResult: data,
        memoryChecks: initialChecks,
        formInput: formSnapshot,
      });
      setAiResult(data);
      setCatatanLanjutan("");
      if (data.db_patient_id) setDbPatientId(data.db_patient_id);
    } catch (err) {
      alert("Terjadi kesalahan sistem: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // Ulangi Diagnosis
  // =============================================
  const handleUlangi = async () => {
    if (!formData.keluhan) return alert("Keluhan utama harus diisi!");
    setIsLoading(true);
    setSavedSuccess(false);
    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          weight: patient.weight ? parseFloat(patient.weight) : null,
          height: patient.height ? parseFloat(patient.height) : null,
          keluhan: formData.keluhan,
          gejala: formData.gejala,
          tandaVital: formData.tandaVital,
          hasilLab: formData.hasilLab,
          alergi: formData.alergi,
          riwayat: formData.riwayat,
          catatan: formData.catatan,
          teks_bebas: formData.teks_bebas,
          save_visit: false,
          conversation_history: conversationHistory,
          chat_konsultasi: chatHistory,
        }),
      });
      if (!response.ok) throw new Error("Gagal");
      const data = await response.json();
      const initialChecks = {
        icd10: (data.icd10 || []).map(() => true),
        rekomendasi: (data.rekomendasi || []).map(() => true),
      };
      setMemoryChecks(initialChecks);
      setLastSnapshot({
        aiResult: data,
        memoryChecks: initialChecks,
        formInput: { ...formData },
      });
      setAiResult(data);
    } catch (err) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // Lanjutkan analisis dengan catatan baru
  // =============================================
  const handleLanjutkanAnalisis = async () => {
    if (!catatanLanjutan.trim())
      return alert("Isi catatan lanjutan terlebih dahulu!");
    const updatedForm = {
      ...formData,
      catatan:
        formData.catatan +
        (formData.catatan ? "\n[Lanjutan]: " : "[Lanjutan]: ") +
        catatanLanjutan,
    };
    const historyToSend = buildHistoryToSend(conversationHistory, lastSnapshot);
    setIsLoading(true);
    setSavedSuccess(false);
    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          weight: patient.weight ? parseFloat(patient.weight) : null,
          height: patient.height ? parseFloat(patient.height) : null,
          keluhan: updatedForm.keluhan,
          gejala: updatedForm.gejala,
          tandaVital: updatedForm.tandaVital,
          hasilLab: updatedForm.hasilLab,
          alergi: updatedForm.alergi,
          riwayat: updatedForm.riwayat,
          catatan: updatedForm.catatan,
          teks_bebas: updatedForm.teks_bebas,
          save_visit: false,
          conversation_history: historyToSend,
          chat_konsultasi: chatHistory,
        }),
      });
      if (!response.ok) throw new Error("Gagal");
      const data = await response.json();
      const initialChecks = {
        icd10: (data.icd10 || []).map(() => true),
        rekomendasi: (data.rekomendasi || []).map(() => true),
      };
      setConversationHistory(historyToSend);
      setMemoryChecks(initialChecks);
      setLastSnapshot({
        aiResult: data,
        memoryChecks: initialChecks,
        formInput: updatedForm,
      });
      setAiResult(data);
      setFormData(updatedForm);
      setCatatanLanjutan("");
    } catch (err) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // CHAT — endpoint khusus, kirim history diagnosis sebagai konteks
  // =============================================
  const handleKirimChat = async () => {
    if (!chatInput.trim()) return;
    const pesanDokter = chatInput.trim();
    setChatInput("");

    const newChatHistory = [
      ...chatHistory,
      { role: "dokter", content: pesanDokter },
    ];
    setChatHistory(newChatHistory);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          // Konteks chat: hasil diagnosis yang sudah ada (bukan form gejala)
          diagnosis_context: aiResult
            ? {
                penyakit: aiResult.penyakit,
                icd10: aiResult.icd10,
                rekomendasi: aiResult.rekomendasi,
                saran_pemeriksaan: aiResult.saran_pemeriksaan,
                tanda_bahaya: aiResult.tanda_bahaya,
              }
            : null,
          chat_history: newChatHistory,
          pesan: pesanDokter,
        }),
      });
      if (!response.ok) throw new Error("Gagal");
      const data = await response.json();
      setChatHistory([...newChatHistory, { role: "ai", content: data.reply }]);
    } catch (err) {
      setChatHistory([
        ...newChatHistory,
        { role: "ai", content: "Maaf, terjadi kesalahan. Coba lagi." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // =============================================
  // Upload Gambar (inline di form)
  // =============================================
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target.result;
      setImagePreview(result);
      setImageBase64(result.split(",")[1]);
      setImageAnalysis(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalisisGambar = async () => {
    if (!imageBase64) return;
    setIsAnalyzingImage(true);
    try {
      const response = await fetch(`${API}/api/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          keluhan: formData.keluhan,
          gejala: formData.gejala,
          image_base64: imageBase64,
          image_type: imageType,
        }),
      });
      if (!response.ok) throw new Error("Gagal menganalisis gambar");
      const data = await response.json();
      setImageAnalysis(data);
      setSavedImagePath(data.saved_image_path || "");
    } catch (err) {
      alert("Error analisis gambar: " + err.message);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleHapusGambar = () => {
    setImageBase64(null);
    setImagePreview(null);
    setImageAnalysis(null);
    setSavedImagePath("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // =============================================
  // Simpan ke DB
  // =============================================
  const handleSimpan = async () => {
    if (!aiResult) return;
    setIsSaving(true);
    const selectedIcd = (aiResult.icd10 || []).filter(
      (_, i) => memoryChecks?.icd10[i],
    );
    const selectedRekomendasi = (aiResult.rekomendasi || []).filter(
      (_, i) => memoryChecks?.rekomendasi[i],
    );
    const saranText = (aiResult.saran_pemeriksaan || []).join("\n");
    try {
      const res = await fetch(`${API}/api/save-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: dbPatientId || null,
          name: patient.name,
          age: parseInt(patient.age),
          gender: patient.gender,
          weight: patient.weight ? parseFloat(patient.weight) : null,
          height: patient.height ? parseFloat(patient.height) : null,
          keluhan: formData.keluhan,
          gejala: formData.gejala,
          tandaVital: formData.tandaVital,
          hasilLab: formData.hasilLab,
          alergi: formData.alergi,
          teks_bebas: formData.teks_bebas,
          chat_konsultasi: chatHistory,
          diagnosis_final: aiResult.penyakit,
          tanda_bahaya_final: aiResult.tanda_bahaya || "",
          saran_pemeriksaan_final: saranText,
          selected_icd10: selectedIcd,
          selected_rekomendasi: selectedRekomendasi,
          image_path: savedImagePath,
          analisis_gambar: imageAnalysis ? JSON.stringify(imageAnalysis) : "",
        }),
      });
      const data = await res.json();
      setSavedSuccess(true);
      setSavedVisitId(data.visit_id);
      setFormData(EMPTY_FORM);
      setAiResult(null);
      setMemoryChecks(null);
      setLastSnapshot(null);
      setCatatanLanjutan("");
      setChatHistory([]);
      setImageBase64(null);
      setImagePreview(null);
      setImageAnalysis(null);
      setSavedImagePath("");
    } catch (e) {
      alert("Gagal menyimpan: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // =============================================
  // Generate PDF
  // =============================================
  const handleGeneratePdf = async () => {
    if (!savedVisitId) return;
    setIsGeneratingPdf(true);
    try {
      const response = await fetch(`${API}/api/generate-pdf/${savedVisitId}`);
      if (!response.ok) throw new Error("Gagal generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan_${patient.name.replace(/\s/g, "_")}_${savedVisitId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generate PDF: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // =============================================
  // Sesi Baru
  // =============================================
  const handleNewSession = () => {
    if (
      conversationHistory.length > 0 &&
      !confirm("Mulai sesi baru? Riwayat percakapan sesi ini akan direset.")
    )
      return;
    setConversationHistory([]);
    setFormData(EMPTY_FORM);
    setAiResult(null);
    setMemoryChecks(null);
    setLastSnapshot(null);
    setSavedSuccess(false);
    setSavedVisitId(null);
    setCatatanLanjutan("");
    setChatHistory([]);
    setImageBase64(null);
    setImagePreview(null);
    setImageAnalysis(null);
    setSavedImagePath("");
  };

  const updateIcd10Check = (idx) => {
    const updated = [...memoryChecks.icd10];
    updated[idx] = !updated[idx];
    const newChecks = { ...memoryChecks, icd10: updated };
    setMemoryChecks(newChecks);
    setLastSnapshot((prev) =>
      prev ? { ...prev, memoryChecks: newChecks } : null,
    );
  };

  const updateRekomendasiCheck = (idx) => {
    const updated = [...memoryChecks.rekomendasi];
    updated[idx] = !updated[idx];
    const newChecks = { ...memoryChecks, rekomendasi: updated };
    setMemoryChecks(newChecks);
    setLastSnapshot((prev) =>
      prev ? { ...prev, memoryChecks: newChecks } : null,
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* ===== HEADER PASIEN ===== */}
      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-blue-600 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Pasien: {patient.name}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600 font-medium">
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              Umur: {patient.age} Tahun
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              {patient.gender}
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              BB: {patient.weight || "-"} kg
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              TB: {patient.height || "-"} cm
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {memoryCount > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-3 py-2 rounded-lg">
              🧠 {memoryCount} poin memori
            </div>
          )}
          {conversationHistory.length > 0 && (
            <div className="text-xs text-gray-400 border border-gray-200 px-3 py-2 rounded-lg flex items-center">
              💬 {conversationHistory.length} giliran
            </div>
          )}
          <button
            onClick={() =>
              navigate("/history", {
                state: { patient: { ...patient, id: dbPatientId } },
              })
            }
            className="text-purple-600 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg transition border border-purple-200 text-sm"
          >
            📋 Riwayat
          </button>
          <button
            onClick={handleNewSession}
            className="text-orange-600 hover:bg-orange-50 font-medium px-4 py-2 rounded-lg transition border border-orange-200 text-sm"
          >
            ✦ Sesi Baru
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 hover:bg-blue-50 font-medium px-4 py-2 rounded-lg transition border border-blue-200 text-sm"
          >
            ← Ganti Pasien
          </button>
        </div>
      </div>

      {/* ===== LAYOUT UTAMA: 2 KOLOM ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== KOLOM KIRI: INPUT (3/5) ===== */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-800 border-b pb-3 mb-5">
              📋 Data Klinis & Pemeriksaan
            </h3>
            <div className="flex flex-col gap-5">
              {/* 1. Anamnesis */}
              <div>
                <h4 className="font-semibold text-blue-700 bg-blue-50 p-2 rounded text-sm mb-3">
                  1. Anamnesis
                </h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Keluhan Utama <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[70px] text-sm disabled:bg-gray-50"
                      placeholder="Contoh: Demam 3 hari, sakit kepala, lemas..."
                      value={formData.keluhan}
                      disabled={isLoading}
                      onChange={(e) =>
                        setFormData({ ...formData, keluhan: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gejala Tambahan
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[60px] text-sm disabled:bg-gray-50"
                      placeholder="Contoh: Mual, nyeri sendi, bintik merah di kulit..."
                      value={formData.gejala}
                      disabled={isLoading}
                      onChange={(e) =>
                        setFormData({ ...formData, gejala: e.target.value })
                      }
                    />
                  </div>

                  {/* ===== FOTO PENDUKUNG — tepat di bawah gejala ===== */}
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                      📸 Foto Pendukung Gejala
                      <span className="font-normal text-gray-400">
                        (bercak, ruam, benjolan, lebam — opsional)
                      </span>
                    </p>

                    {!imagePreview ? (
                      /* Area upload kosong — kecil, tidak dominan */
                      <div
                        className="border border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <p className="text-xs text-gray-400">
                          Klik untuk upload foto
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Preview + hapus */}
                        <div className="flex gap-3 items-start">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                          />
                          <div className="flex-1 flex flex-col gap-1.5">
                            <p className="text-xs text-gray-500">
                              Foto terpilih
                            </p>
                            <button
                              onClick={handleAnalisisGambar}
                              disabled={isAnalyzingImage}
                              className={`text-xs font-semibold py-1.5 px-3 rounded-lg transition w-fit ${
                                isAnalyzingImage
                                  ? "bg-gray-200 text-gray-400"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                              }`}
                            >
                              {isAnalyzingImage
                                ? "⏳ Menganalisis..."
                                : "🔬 Analisis Gambar"}
                            </button>
                            <button
                              onClick={handleHapusGambar}
                              className="text-xs text-red-500 hover:text-red-700 w-fit"
                            >
                              × Hapus foto
                            </button>
                          </div>
                        </div>

                        {/* Hasil analisis gambar — muncul di bawah preview, tetap di dalam form */}
                        {imageAnalysis && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex flex-col gap-1.5">
                            <p className="text-xs font-bold text-indigo-700">
                              Hasil Analisis Foto:
                            </p>
                            {imageAnalysis.deskripsi_gambar && (
                              <p className="text-xs text-indigo-900">
                                <span className="font-semibold">Visual: </span>
                                {imageAnalysis.deskripsi_gambar}
                              </p>
                            )}
                            {imageAnalysis.kemungkinan_temuan && (
                              <p className="text-xs text-indigo-900">
                                <span className="font-semibold">Temuan: </span>
                                {imageAnalysis.kemungkinan_temuan}
                              </p>
                            )}
                            {imageAnalysis.rekomendasi_lanjut && (
                              <p className="text-xs text-indigo-900">
                                <span className="font-semibold">Saran: </span>
                                {imageAnalysis.rekomendasi_lanjut}
                              </p>
                            )}
                            {imageAnalysis.catatan && (
                              <p className="text-xs text-gray-400 italic">
                                {imageAnalysis.catatan}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>

                  {/* Alergi & Riwayat */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alergi
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-orange-500 text-sm min-h-[50px]"
                        placeholder="Contoh: Amoxicillin"
                        value={formData.alergi}
                        disabled={isLoading}
                        onChange={(e) =>
                          setFormData({ ...formData, alergi: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Riwayat Penyakit
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-orange-500 text-sm min-h-[50px]"
                        placeholder="Contoh: Asma, Hipertensi"
                        value={formData.riwayat}
                        disabled={isLoading}
                        onChange={(e) =>
                          setFormData({ ...formData, riwayat: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Pemeriksaan Fisik & Lab */}
              <div>
                <h4 className="font-semibold text-emerald-700 bg-emerald-50 p-2 rounded text-sm mb-3">
                  2. Pemeriksaan Fisik & Lab
                </h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanda Vital
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[60px] text-sm disabled:bg-gray-50"
                      placeholder="TD: 120/80, Nadi: 80x, Suhu: 38°C, RR: 20x"
                      value={formData.tandaVital}
                      disabled={isLoading}
                      onChange={(e) =>
                        setFormData({ ...formData, tandaVital: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hasil Laboratorium
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-emerald-500 min-h-[60px] text-sm"
                      placeholder="Leukosit 15.000, Hb 12.5, Trombosit 90.000..."
                      value={formData.hasilLab}
                      disabled={isLoading}
                      onChange={(e) =>
                        setFormData({ ...formData, hasilLab: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 3. Catatan Bebas */}
              <div>
                <h4 className="font-semibold text-violet-700 bg-violet-50 p-2 rounded text-sm mb-2 flex items-center gap-2">
                  3. Catatan Bebas
                  <span className="font-normal text-violet-500 text-xs">
                    (kronologi, konteks, observasi tambahan)
                  </span>
                </h4>
                <textarea
                  className="w-full border border-violet-200 rounded-lg p-3 outline-none focus:border-violet-500 min-h-[80px] text-sm bg-violet-50/30"
                  placeholder="Tulis apapun yang relevan: kronologi penyakit, kondisi sosial pasien, informasi yang tidak masuk form di atas..."
                  value={formData.teks_bebas}
                  disabled={isLoading}
                  onChange={(e) =>
                    setFormData({ ...formData, teks_bebas: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Konteks & Observasi Dokter
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-gray-500 min-h-[60px] text-sm"
                  placeholder="Pasien dari daerah endemik, obat saat ini, kondisi klinis umum..."
                  value={formData.catatan}
                  disabled={isLoading}
                  onChange={(e) =>
                    setFormData({ ...formData, catatan: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={handleAnalisis}
                disabled={isLoading}
                className={`w-full font-bold py-4 rounded-xl transition shadow-md text-base ${
                  isLoading
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isLoading ? "⏳ Memproses Analisis AI..." : "🔍 Analisis AI"}
              </button>
            </div>
          </div>

          {/* ===== CHAT KONSULTASI — di bawah form, kirim ke /api/chat ===== */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
              💬 Chat Konsultasi
              {!aiResult && (
                <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Tersedia setelah analisis pertama
                </span>
              )}
            </h3>

            {/* Area chat */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 min-h-[180px] max-h-80 overflow-y-auto flex flex-col gap-2 mb-3">
              {chatHistory.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center">
                  <div className="text-gray-400">
                    <div className="text-3xl mb-1">💬</div>
                    <p className="text-xs">
                      {aiResult
                        ? "Tanyakan apa saja seputar hasil diagnosis di atas."
                        : "Lakukan analisis AI terlebih dahulu, lalu chat untuk tanya-jawab lanjutan."}
                    </p>
                  </div>
                </div>
              ) : (
                chatHistory.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex ${turn.role === "dokter" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        turn.role === "dokter"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      <p
                        className={`font-semibold mb-0.5 text-[10px] ${turn.role === "dokter" ? "text-blue-200" : "text-emerald-600"}`}
                      >
                        {turn.role === "dokter" ? "Dokter" : "🤖 AI"}
                      </p>
                      {turn.content.split("\n").map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-0.5" : ""}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">
                      AI sedang merespons...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={
                  aiResult
                    ? "Tanya seputar diagnosis, obat, pemeriksaan lanjutan..."
                    : "Lakukan analisis AI dulu..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleKirimChat()
                }
                disabled={isChatLoading || !aiResult}
              />
              <button
                onClick={handleKirimChat}
                disabled={isChatLoading || !chatInput.trim() || !aiResult}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Kirim
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              💡 Chat ini menggunakan konteks hasil diagnosis yang sudah muncul
              di sebelah kanan
            </p>
          </div>
        </div>

        {/* ===== KOLOM KANAN: OUTPUT AI (2/5) ===== */}
        <div className="lg:col-span-2 flex flex-col gap-5" ref={bottomRef}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4">
            <h3 className="text-base font-bold text-gray-800 mb-4 border-b pb-3">
              🤖 Hasil Analisis AI
            </h3>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium animate-pulse">
                  Menganalisis data klinis...
                </p>
              </div>
            ) : aiResult ? (
              <div className="flex flex-col gap-4">
                {/* Kelengkapan data */}
                {aiResult.kelengkapan_data && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">
                      📊 Status Data
                    </p>
                    <p className="text-xs text-blue-900">
                      {aiResult.kelengkapan_data}
                    </p>
                  </div>
                )}

                {/* Diagnosis */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="font-bold text-red-800 mb-2 text-sm flex items-center gap-1.5">
                    🔍 Kemungkinan Diagnosis
                  </h4>
                  <p className="text-red-900 text-xs leading-relaxed">
                    {aiResult.penyakit}
                  </p>
                </div>

                {/* Pertanyaan Lanjutan */}
                {aiResult.pertanyaan_lanjutan?.length > 0 && (
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                    <h4 className="font-bold text-sky-800 mb-2 text-sm flex items-center gap-1.5">
                      ❓ Pertanyaan Lanjutan
                    </h4>
                    <ul className="space-y-1">
                      {aiResult.pertanyaan_lanjutan.map((q, i) => (
                        <li
                          key={i}
                          className="text-xs text-sky-900 flex items-start gap-1.5"
                        >
                          <span className="text-sky-400 flex-shrink-0 mt-0.5">
                            •
                          </span>{" "}
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ICD-10 */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-bold text-purple-800 mb-2 text-sm">
                    📋 Kode ICD-10
                  </h4>
                  <div className="space-y-1.5">
                    {(aiResult.icd10 || []).map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="font-mono font-bold text-purple-700 text-xs bg-purple-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {item.kode}
                        </span>
                        <span className="text-purple-900 text-xs leading-relaxed">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rekomendasi */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <h4 className="font-bold text-emerald-800 mb-2 text-sm">
                    💊 Rekomendasi Terapi
                  </h4>
                  <ul className="space-y-1">
                    {(aiResult.rekomendasi || []).map((rek, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-emerald-900 flex items-start gap-1.5 leading-relaxed"
                      >
                        <span className="text-emerald-400 flex-shrink-0 mt-0.5">
                          •
                        </span>{" "}
                        {rek}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Saran Pemeriksaan */}
                {aiResult.saran_pemeriksaan?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="font-bold text-amber-800 mb-2 text-sm">
                      🔬 Saran Pemeriksaan Lanjutan
                    </h4>
                    <ul className="space-y-1">
                      {aiResult.saran_pemeriksaan.map((s, i) => (
                        <li
                          key={i}
                          className="text-xs text-amber-900 flex items-start gap-1.5 leading-relaxed"
                        >
                          <span className="text-amber-500 flex-shrink-0 font-semibold">
                            {i + 1}.
                          </span>{" "}
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tanda Bahaya */}
                {aiResult.tanda_bahaya && (
                  <div className="bg-red-100 border-2 border-red-400 rounded-xl p-4">
                    <h4 className="font-bold text-red-800 mb-1.5 text-sm">
                      ⚠️ Tanda Bahaya
                    </h4>
                    <p className="text-red-900 text-xs leading-relaxed">
                      {aiResult.tanda_bahaya}
                    </p>
                  </div>
                )}

                {/* Selective Memory */}
                {memoryChecks && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                    <button
                      onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <span className="text-xs font-semibold text-amber-800">
                        🧠 Pilih untuk disimpan ({memoryCount} aktif)
                      </span>
                      <span className="ml-auto text-amber-500 text-xs">
                        {showMemoryPanel ? "▲" : "▼"}
                      </span>
                    </button>
                    {showMemoryPanel && (
                      <div className="mt-3 flex flex-col gap-3">
                        <div>
                          <p className="text-xs font-bold text-purple-700 mb-1.5">
                            Kode ICD-10
                          </p>
                          <div className="space-y-1.5">
                            {(aiResult.icd10 || []).map((item, idx) => (
                              <label
                                key={idx}
                                className="flex items-start gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={memoryChecks.icd10[idx] || false}
                                  onChange={() => updateIcd10Check(idx)}
                                  className="mt-0.5 accent-purple-600 w-4 h-4 flex-shrink-0"
                                />
                                <span className="text-xs text-gray-700">
                                  <span className="font-mono font-bold text-purple-700">
                                    {item.kode}
                                  </span>{" "}
                                  — {item.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-700 mb-1.5">
                            Rekomendasi Terapi
                          </p>
                          <div className="space-y-1.5">
                            {(aiResult.rekomendasi || []).map((rek, idx) => (
                              <label
                                key={idx}
                                className="flex items-start gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    memoryChecks.rekomendasi[idx] || false
                                  }
                                  onChange={() => updateRekomendasiCheck(idx)}
                                  className="mt-0.5 accent-emerald-600 w-4 h-4 flex-shrink-0"
                                />
                                <span className="text-xs text-gray-700 leading-relaxed">
                                  {rek}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Catatan Lanjutan */}
                <div className="border border-sky-200 bg-sky-50 rounded-xl p-4">
                  <h4 className="font-semibold text-sky-800 mb-1 text-sm">
                    📝 Catatan Lanjutan
                  </h4>
                  <p className="text-xs text-sky-600 mb-2">
                    Tambah info baru → AI perbarui analisis dengan konteks ini.
                  </p>
                  <textarea
                    className="w-full border border-sky-200 rounded-lg p-2.5 text-xs outline-none focus:border-sky-500 min-h-[65px] bg-white"
                    placeholder="Contoh: Pasien sebut demam naik turun, berkeringat malam, sudah 5 hari..."
                    value={catatanLanjutan}
                    onChange={(e) => setCatatanLanjutan(e.target.value)}
                  />
                  <button
                    onClick={handleLanjutkanAnalisis}
                    disabled={isLoading || !catatanLanjutan.trim()}
                    className="mt-2 w-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold py-2.5 rounded-lg transition disabled:opacity-40"
                  >
                    🔄 Lanjutkan Analisis
                  </button>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-gray-500 text-center bg-gray-50 py-2.5 rounded-lg border border-gray-100">
                  ⚠️ Hasil AI hanya sebagai Clinical Decision Support. Keputusan
                  medis mutlak tanggung jawab dokter.
                </p>

                {/* Tombol Aksi */}
                {!isSaving ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSimpan}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow text-sm"
                    >
                      💾 Simpan ke Riwayat
                    </button>
                    <button
                      onClick={handleUlangi}
                      disabled={isLoading}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition shadow text-sm disabled:opacity-50"
                    >
                      🔄 Ulangi Diagnosis
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-3 gap-2 text-gray-500 text-sm">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </div>
                )}

                {/* Sukses + PDF */}
                {savedSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-3">
                    <p className="text-center text-emerald-700 font-semibold text-sm">
                      ✅ Kunjungan berhasil disimpan!
                    </p>
                    <button
                      onClick={handleGeneratePdf}
                      disabled={isGeneratingPdf}
                      className={`w-full font-bold py-3 rounded-xl transition shadow text-sm ${
                        isGeneratingPdf
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {isGeneratingPdf
                        ? "⏳ Membuat PDF..."
                        : "📄 Download Laporan PDF"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center">
                <svg
                  className="w-14 h-14 mb-3 text-gray-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-sm">
                  Hasil analisis AI akan muncul di sini.
                </p>
                <p className="text-xs mt-1">
                  Lengkapi form di kiri dan klik Analisis AI.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Konteks Sesi Aktif */}
      {conversationHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-400">
          <p className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
            🧠 Konteks Sesi Aktif
            <span className="font-normal text-amber-600 text-xs">
              ({conversationHistory.length} giliran)
            </span>
          </p>
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {conversationHistory.map((turn, idx) => (
              <div
                key={idx}
                className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-2"
              >
                <span className="font-semibold text-blue-600">
                  Giliran #{idx + 1}:
                </span>{" "}
                <span className="text-gray-600">
                  {turn.user.length > 120
                    ? turn.user.slice(0, 120) + "..."
                    : turn.user}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <br />
    </div>
  );
}
