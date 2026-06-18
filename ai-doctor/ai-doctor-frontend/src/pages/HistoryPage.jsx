import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

export default function HistoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const patient = location.state?.patient;

  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(null);

  useEffect(() => {
    if (!patient) return;
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/history/${patient.id}`);
      if (!res.ok) throw new Error("Gagal mengambil riwayat");
      const data = await res.json();
      setVisits(data.visits || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async (visitId) => {
    setGeneratingPdf(visitId);
    try {
      const response = await fetch(`${API}/api/generate-pdf/${visitId}`);
      if (!response.ok) throw new Error("Gagal generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan_${patient.name.replace(/\s/g, "_")}_${visitId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGeneratingPdf(null);
    }
  };

  if (!patient) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-purple-600 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            📋 Riwayat Kunjungan — {patient.name}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
            <span className="bg-gray-100 px-2 py-1 rounded">
              Umur: {patient.age} Tahun
            </span>
            <span className="bg-gray-100 px-2 py-1 rounded">
              {patient.gender}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate("/diagnosis", { state: { patient } })}
          className="text-blue-600 hover:bg-blue-50 font-medium px-4 py-2 rounded-lg transition border border-blue-200 text-sm"
        >
          ← Kembali ke Diagnosis
        </button>
      </div>

      {/* Konten */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-12 flex flex-col items-center text-gray-400">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Memuat riwayat...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl p-10 text-center text-red-500">
          <p className="text-lg font-medium">⚠️ {error}</p>
          <button
            onClick={fetchHistory}
            className="mt-4 text-sm text-blue-600 underline"
          >
            Coba lagi
          </button>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-xl p-12 flex flex-col items-center text-gray-400 text-center">
          <div className="text-5xl mb-4">🗂️</div>
          <p className="text-lg font-medium text-gray-500">
            Belum ada riwayat kunjungan tersimpan
          </p>
          <p className="text-sm mt-1">
            Gunakan tombol "Simpan ke Riwayat" setelah diagnosis.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 font-medium">
            {visits.length} kunjungan tersimpan
          </p>

          {visits.map((v, idx) => {
            const isExpanded = expandedId === v.id;
            let analisisGambar = null;
            try {
              if (v.analisis_gambar)
                analisisGambar = JSON.parse(v.analisis_gambar);
            } catch {}

            return (
              <div
                key={v.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Header card */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {visits.length - idx}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 text-sm">
                        Kunjungan #{visits.length - idx}
                      </span>
                      {v.created_at && (
                        <span className="text-xs text-gray-400 ml-2">
                          {v.created_at}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {v.keluhan || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.has_image && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        📸 Foto
                      </span>
                    )}
                    {v.chat_history?.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        💬 Chat
                      </span>
                    )}
                    <span className="text-gray-400 text-sm">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {/* Keluhan */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                          Keluhan Utama
                        </p>
                        <p className="text-sm text-blue-900">
                          {v.keluhan || "-"}
                        </p>
                        {v.gejala && (
                          <p className="text-xs text-blue-700 mt-1">
                            {v.gejala}
                          </p>
                        )}
                        {v.tanda_vital && (
                          <p className="text-xs text-gray-500 mt-1">
                            📊 {v.tanda_vital}
                          </p>
                        )}
                        {v.hasil_lab && (
                          <p className="text-xs text-gray-500 mt-1">
                            🧪 {v.hasil_lab}
                          </p>
                        )}
                      </div>

                      {/* Diagnosis AI */}
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">
                          🔍 Diagnosis AI
                        </p>
                        <p className="text-sm text-red-900 leading-relaxed">
                          {v.diagnosis_ai || "-"}
                        </p>
                      </div>
                    </div>

                    {/* Teks Bebas */}
                    {v.teks_bebas && (
                      <div className="bg-violet-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1">
                          📝 Catatan Bebas
                        </p>
                        <p className="text-sm text-violet-900 leading-relaxed">
                          {v.teks_bebas}
                        </p>
                      </div>
                    )}

                    {/* Chat History */}
                    {v.chat_history?.length > 0 && (
                      <div className="bg-sky-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-sky-700 uppercase tracking-wide mb-2">
                          💬 Riwayat Konsultasi
                        </p>
                        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                          {v.chat_history.map((turn, i) => (
                            <div
                              key={i}
                              className={`flex ${turn.role === "dokter" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs ${
                                  turn.role === "dokter"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white border border-gray-200 text-gray-700"
                                }`}
                              >
                                <p
                                  className={`font-semibold text-[10px] mb-0.5 ${turn.role === "dokter" ? "text-blue-200" : "text-emerald-600"}`}
                                >
                                  {turn.role === "dokter" ? "Dokter" : "AI"}
                                </p>
                                {turn.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ICD-10 */}
                    {v.icd10_codes?.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
                          📋 Kode ICD-10 Terpilih
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {v.icd10_codes.map((item, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="font-mono font-bold text-purple-700 text-xs bg-purple-100 px-2 py-0.5 rounded">
                                {item.kode}
                              </span>
                              <span className="text-xs text-purple-800">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rekomendasi */}
                    {v.rekomendasi_terpilih?.length > 0 && (
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                          💊 Rekomendasi Terapi
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          {v.rekomendasi_terpilih.map((rek, i) => (
                            <li
                              key={i}
                              className="text-xs text-emerald-900 leading-relaxed"
                            >
                              {rek}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Saran Pemeriksaan */}
                    {v.saran_pemeriksaan && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                          🔬 Saran Pemeriksaan Lanjutan
                        </p>
                        <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-line">
                          {v.saran_pemeriksaan}
                        </p>
                      </div>
                    )}

                    {/* Tanda Bahaya */}
                    {v.tanda_bahaya && (
                      <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">
                          ⚠️ Tanda Bahaya
                        </p>
                        <p className="text-xs text-red-900 leading-relaxed">
                          {v.tanda_bahaya}
                        </p>
                      </div>
                    )}

                    {/* Analisis Gambar */}
                    {analisisGambar && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">
                          📸 Analisis Foto / Temuan Fisik
                        </p>
                        {[
                          ["Deskripsi Visual", analisisGambar.deskripsi_gambar],
                          [
                            "Kemungkinan Temuan",
                            analisisGambar.kemungkinan_temuan,
                          ],
                          ["Rekomendasi", analisisGambar.rekomendasi_lanjut],
                        ].map(
                          ([label, val]) =>
                            val && (
                              <div key={label} className="mb-1.5">
                                <p className="text-xs font-semibold text-indigo-600">
                                  {label}
                                </p>
                                <p className="text-xs text-indigo-900">{val}</p>
                              </div>
                            ),
                        )}
                      </div>
                    )}

                    {/* Info tambahan */}
                    {(v.alergi || v.hasil_lab) && (
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t pt-2">
                        {v.alergi && (
                          <span>
                            ⚠️ Alergi:{" "}
                            <span className="font-medium text-orange-600">
                              {v.alergi}
                            </span>
                          </span>
                        )}
                        {v.hasil_lab && <span>🧪 Lab: {v.hasil_lab}</span>}
                      </div>
                    )}

                    {/* Tombol Download PDF */}
                    <button
                      onClick={() => handleDownloadPdf(v.id)}
                      disabled={generatingPdf === v.id}
                      className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                        generatingPdf === v.id
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {generatingPdf === v.id
                        ? "⏳ Membuat PDF..."
                        : "📄 Download Laporan PDF Kunjungan Ini"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
