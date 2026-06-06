import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const EMPTY_FORM = {
  keluhan: "",
  gejala: "",
  tandaVital: "",
  hasilLab: "",
  alergi: "",
  riwayat: "",
  catatan: "",
};

export default function DiagnosisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const patient = location.state?.patient;
  const bottomRef = useRef(null);

  if (!patient) {
    navigate("/");
    return null;
  }

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dbPatientId, setDbPatientId] = useState(patient.id || null);

  // Riwayat percakapan dalam satu sesi
  const [conversationHistory, setConversationHistory] = useState([]);

  // Selective memory: checkbox per poin hasil AI
  const [memoryChecks, setMemoryChecks] = useState(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);

  const memoryCount = memoryChecks
    ? [
        ...(memoryChecks.icd10 || []),
        ...(memoryChecks.rekomendasi || []),
      ].filter(Boolean).length
    : 0;

  useEffect(() => {
    if (aiResult) {
      setMemoryChecks({
        icd10: (aiResult.icd10 || []).map(() => true),
        rekomendasi: (aiResult.rekomendasi || []).map(() => true),
      });
      setShowMemoryPanel(false);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }, [aiResult]);

  // =============================================
  // Helper: bangun history terfilter berdasarkan checkbox
  // Dipakai oleh handleAnalisis DAN handleUlangi
  // =============================================
  const buildFilteredHistory = (currentForm) => {
    if (!aiResult || !memoryChecks) return conversationHistory;

    const selectedIcd = (aiResult.icd10 || [])
      .filter((_, i) => memoryChecks.icd10[i])
      .map((x) => `${x.kode} - ${x.label}`)
      .join(", ");

    const selectedRek = (aiResult.rekomendasi || [])
      .filter((_, i) => memoryChecks.rekomendasi[i])
      .join("; ");

    const assistantSummary = [
      `Diagnosis: ${aiResult.penyakit}`,
      selectedIcd ? `ICD-10: ${selectedIcd}` : null,
      selectedRek ? `Rekomendasi: ${selectedRek}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return [
      ...conversationHistory,
      {
        user: `Keluhan: ${currentForm.keluhan}. Gejala: ${currentForm.gejala || "-"}`,
        assistant: assistantSummary || "Tidak ada poin dipilih.",
      },
    ];
  };

  // =============================================
  // Analisis utama
  // =============================================
  const handleAnalisis = async () => {
    if (!formData.keluhan) return alert("Keluhan utama harus diisi!");

    // Snapshot form sebelum analisis untuk disimpan ke history
    const formSnapshot = { ...formData };

    // Bangun history dengan filter checkbox dari hasil sebelumnya
    const historyToSend = buildFilteredHistory(formSnapshot);

    setIsLoading(true);
    setAiResult(null);
    setMemoryChecks(null);
    setSavedSuccess(false);

    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
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
          save_visit: false,
          conversation_history: historyToSend,
        }),
      });

      if (!response.ok) throw new Error("Gagal terhubung ke server backend");
      const data = await response.json();
      setAiResult(data);

      if (data.db_patient_id) {
        setDbPatientId(data.db_patient_id);
        try {
          const stored = JSON.parse(
            localStorage.getItem("clinic_patients") || "[]",
          );
          const updated = stored.map((p) =>
            p.id === patient.id ? { ...p, id: data.db_patient_id } : p,
          );
          localStorage.setItem("clinic_patients", JSON.stringify(updated));
        } catch {}
      }

      // Update history untuk giliran berikutnya
      setConversationHistory(historyToSend);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan sistem: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // Ulangi diagnosis — pakai selective memory yang sama
  // =============================================
  const handleUlangi = async () => {
    if (!formData.keluhan) return alert("Keluhan utama harus diisi!");

    setAiResult(null);
    setMemoryChecks(null);
    setSavedSuccess(false);
    setIsLoading(true);

    // Gunakan buildFilteredHistory yang sama seperti handleAnalisis
    const historyToSend = buildFilteredHistory({ ...formData });

    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
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
          save_visit: false,
          conversation_history: historyToSend,
        }),
      });
      if (!response.ok) throw new Error("Gagal");
      const data = await response.json();
      setAiResult(data);
    } catch (err) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // Simpan ke DB
  // =============================================
  const handleSimpan = async () => {
    if (!aiResult) return;
    setIsSaving(true);
    try {
      await fetch("http://localhost:8000/api/analyze", {
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
          save_visit: true,
          conversation_history: [],
        }),
      });
      setSavedSuccess(true);
      setFormData(EMPTY_FORM);
      setAiResult(null);
      setMemoryChecks(null);
    } catch (e) {
      alert("Gagal menyimpan: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // =============================================
  // Sesi baru — reset semua state
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
    setSavedSuccess(false);
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
            <span className="bg-gray-100 px-2 py-1 rounded">
              👤 {patient.age} Tahun
            </span>
            <span className="bg-gray-100 px-2 py-1 rounded">
              ⚧ {patient.gender}
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              ⚖️ BB: {patient.weight || "-"} kg
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
              📏 TB: {patient.height || "-"} cm
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {memoryCount > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-3 py-2 rounded-lg">
              🧠 {memoryCount} poin dalam memori
            </div>
          )}
          {conversationHistory.length > 0 && (
            <div className="text-xs text-gray-400 border border-gray-200 px-3 py-2 rounded-lg flex items-center">
              💬 {conversationHistory.length} konteks sesi ini
            </div>
          )}
          <button
            onClick={() =>
              navigate("/history", {
                state: { patient: { ...patient, id: dbPatientId } },
              })
            }
            disabled={isLoading}
            className="text-purple-600 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg transition border border-purple-200 text-sm disabled:opacity-40"
          >
            📋 Riwayat Kunjungan
          </button>
          <button
            onClick={handleNewSession}
            disabled={isLoading}
            className="text-orange-600 hover:bg-orange-50 font-medium px-4 py-2 rounded-lg transition border border-orange-200 text-sm disabled:opacity-40"
          >
            ✦ Sesi Baru
          </button>
          <button
            onClick={() => navigate("/")}
            disabled={isLoading}
            className="text-blue-600 hover:bg-blue-50 font-medium px-4 py-2 rounded-lg transition border border-blue-200 text-sm disabled:opacity-40"
          >
            ← Ganti Pasien
          </button>
        </div>
      </div>

      {/* ===== RINGKASAN SESI AKTIF ===== */}
      {conversationHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-400">
          <p className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
            🧠 Konteks Sesi Aktif
            <span className="font-normal text-amber-600 text-xs">
              ({conversationHistory.length} giliran tersimpan dalam memori)
            </span>
          </p>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {conversationHistory.map((turn, idx) => (
              <div
                key={idx}
                className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-2"
              >
                <span className="font-semibold text-blue-600">
                  Dokter #{idx + 1}:
                </span>{" "}
                <span className="text-gray-600">
                  {turn.user.length > 100
                    ? turn.user.slice(0, 100) + "..."
                    : turn.user}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== FORM INPUT ===== */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-5">
          Data Klinis & Pemeriksaan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kolom Kiri */}
          <div className="space-y-4">
            <h4 className="font-semibold text-blue-700 bg-blue-50 p-2 rounded text-sm">
              1. Anamnesis
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keluhan Utama <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[80px] disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Contoh: Batuk berdahak lebih dari 3 hari..."
                value={formData.keluhan}
                disabled={isLoading}
                onChange={(e) =>
                  setFormData({ ...formData, keluhan: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gejala Tambahan{" "}
                <span className="text-gray-400 font-normal text-xs">
                  (opsional — semakin lengkap semakin akurat)
                </span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[80px] disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Contoh: Demam ringan, badan pegal-pegal, tidak nafsu makan..."
                value={formData.gejala}
                disabled={isLoading}
                onChange={(e) =>
                  setFormData({ ...formData, gejala: e.target.value })
                }
              />
            </div>

            <h4 className="font-semibold text-orange-700 bg-orange-50 p-2 rounded text-sm mt-2">
              3. Riwayat Pasien
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alergi{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (opsional)
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-orange-500 disabled:bg-gray-50"
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
                  Riwayat Penyakit{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (opsional)
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-orange-500 disabled:bg-gray-50"
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

          {/* Kolom Kanan */}
          <div className="space-y-4">
            <h4 className="font-semibold text-emerald-700 bg-emerald-50 p-2 rounded text-sm">
              2. Pemeriksaan Fisik & Penunjang
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanda Vital{" "}
                <span className="text-gray-400 font-normal text-xs">
                  (opsional — sangat dianjurkan)
                </span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-emerald-500 disabled:bg-gray-50"
                placeholder="Contoh: TD: 120/80, Nadi: 80x, Suhu: 38°C, RR: 20x"
                value={formData.tandaVital}
                disabled={isLoading}
                onChange={(e) =>
                  setFormData({ ...formData, tandaVital: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasil Laboratorium{" "}
                <span className="text-gray-400 font-normal text-xs">
                  (opsional)
                </span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-emerald-500 min-h-[80px] disabled:bg-gray-50"
                placeholder="Contoh: Leukosit 15.000, Hb 12.5, Trombosit 90.000..."
                value={formData.hasilLab}
                disabled={isLoading}
                onChange={(e) =>
                  setFormData({ ...formData, hasilLab: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                Catatan Tambahan Medis{" "}
                <span className="text-gray-400 font-normal text-xs">
                  (opsional)
                </span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-gray-500 min-h-[80px] disabled:bg-gray-50"
                placeholder="Observasi visual, kondisi umum pasien, atau info lain..."
                value={formData.catatan}
                disabled={isLoading}
                onChange={(e) =>
                  setFormData({ ...formData, catatan: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Tombol Analisis */}
        <div className="mt-8 border-t pt-6">
          <button
            onClick={handleAnalisis}
            disabled={isLoading}
            className={`w-full font-bold py-4 rounded-xl transition duration-200 shadow-md text-lg ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isLoading
              ? "Memproses Analisis AI..."
              : "Minta Analisis Diagnosis AI ✨"}
          </button>
        </div>
      </div>

      {/* ===== HASIL AI ===== */}
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[250px]"
        ref={bottomRef}
      >
        <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-3 flex items-center gap-2">
          <span>🤖</span> Respons AI Asisten Medis
        </h3>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-medium animate-pulse">
              AI sedang menganalisis seluruh data klinis pasien...
            </p>
          </div>
        ) : aiResult ? (
          <div className="flex flex-col gap-5">
            {/* 3 Kolom Hasil Utama */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Diagnosis */}
              <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-inner">
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span className="bg-red-100 p-1.5 rounded-lg text-sm">
                    🔍
                  </span>
                  Kemungkinan Diagnosis
                </h4>
                <p className="text-red-900 text-sm leading-relaxed">
                  {aiResult.penyakit}
                </p>
              </div>

              {/* ICD-10 — Kolom Terpisah */}
              <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl shadow-inner">
                <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                  <span className="bg-purple-100 p-1.5 rounded-lg text-sm">
                    📋
                  </span>
                  Kode ICD-10
                </h4>
                <div className="space-y-2">
                  {(aiResult.icd10 || []).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-purple-700 text-sm mt-0.5 bg-purple-100 px-2 py-0.5 rounded flex-shrink-0">
                        {item.kode}
                      </span>
                      <span className="text-purple-900 text-xs leading-relaxed">
                        {item.label}
                      </span>
                    </div>
                  ))}
                  {(!aiResult.icd10 || aiResult.icd10.length === 0) && (
                    <p className="text-purple-400 text-xs italic">
                      Tidak ada kode ICD-10
                    </p>
                  )}
                </div>
              </div>

              {/* Rekomendasi */}
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-inner">
                <h4 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                  <span className="bg-emerald-100 p-1.5 rounded-lg text-sm">
                    💊
                  </span>
                  Rekomendasi Terapi
                </h4>
                <ul className="list-disc pl-4 text-emerald-900 space-y-1.5 text-sm">
                  {(aiResult.rekomendasi || []).map((rek, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {rek}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tanda Bahaya — Full Width */}
            {aiResult.tanda_bahaya && (
              <div className="bg-red-100 border-2 border-red-400 p-5 rounded-xl">
                <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                  <span className="bg-red-200 p-1.5 rounded-lg text-sm">
                    ⚠️
                  </span>
                  Tanda Bahaya & Indikasi Rujukan Segera
                </h4>
                <p className="text-red-900 text-sm leading-relaxed">
                  {aiResult.tanda_bahaya}
                </p>
              </div>
            )}

            {/* Selective Memory Panel */}
            {memoryChecks && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                <button
                  onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <span className="text-sm font-semibold text-amber-800">
                    🧠 Kelola Memori Konteks ({memoryCount} poin aktif)
                  </span>
                  <span className="ml-auto text-amber-500 text-xs">
                    {showMemoryPanel ? "▲ Sembunyikan" : "▼ Pilih poin"}
                  </span>
                </button>

                {showMemoryPanel && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
                        Kode ICD-10
                      </p>
                      <div className="space-y-2">
                        {(aiResult.icd10 || []).map((item, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={memoryChecks.icd10[idx] || false}
                              onChange={() => {
                                const updated = [...memoryChecks.icd10];
                                updated[idx] = !updated[idx];
                                setMemoryChecks({
                                  ...memoryChecks,
                                  icd10: updated,
                                });
                              }}
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
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                        Rekomendasi Terapi
                      </p>
                      <div className="space-y-2">
                        {(aiResult.rekomendasi || []).map((rek, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={memoryChecks.rekomendasi[idx] || false}
                              onChange={() => {
                                const updated = [...memoryChecks.rekomendasi];
                                updated[idx] = !updated[idx];
                                setMemoryChecks({
                                  ...memoryChecks,
                                  rekomendasi: updated,
                                });
                              }}
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

                <p className="text-xs text-amber-600 mt-3">
                  Poin yang dicentang akan disertakan sebagai konteks ke
                  analisis berikutnya dalam sesi ini.
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 text-center bg-gray-50 py-3 rounded-lg border border-gray-100">
              ⚠️ <span className="font-semibold">Disclaimer:</span> Hasil AI
              hanya sebagai Clinical Decision Support. Keputusan medis dan resep
              obat mutlak merupakan tanggung jawab dokter pemeriksa.
            </p>

            {/* Tombol Simpan & Ulangi */}
            {!isSaving ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSimpan}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition shadow-md text-base flex items-center justify-center gap-2"
                >
                  💾 Simpan Analisis ke Riwayat
                </button>
                <button
                  onClick={handleUlangi}
                  disabled={isLoading}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl transition shadow-md text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  🔄 Ulangi Diagnosis
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 gap-3 text-gray-500">
                <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Menyimpan...</span>
              </div>
            )}

            {savedSuccess && (
              <div className="text-center text-emerald-700 font-medium bg-emerald-50 py-3 rounded-lg border border-emerald-200">
                ✅ Kunjungan berhasil disimpan ke riwayat pasien!
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center">
            <svg
              className="w-16 h-16 mb-4 text-gray-200"
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
            <p className="text-lg">Hasil analisis AI akan muncul di sini.</p>
            <p className="text-sm mt-1">
              Silakan lengkapi form di atas dan klik tombol analisis.
            </p>
          </div>
        )}
      </div>
      <br />
    </div>
  );
}
