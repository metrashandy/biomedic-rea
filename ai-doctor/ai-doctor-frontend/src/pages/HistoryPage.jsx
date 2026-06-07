import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function HistoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const patient = location.state?.patient;

  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patient) return;
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://localhost:8000/api/history/${patient.id}`,
      );
      if (!res.ok) throw new Error("Gagal mengambil riwayat");
      const data = await res.json();
      setVisits(data.visits || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
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
              Umur : {patient.age} Tahun
            </span>
            <span className="bg-gray-100 px-2 py-1 rounded">
              Jenis Kelamin : {patient.gender}
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
            Gunakan tombol "Simpan Analisis ke Riwayat" setelah diagnosis untuk
            mencatat kunjungan.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 font-medium">
            {visits.length} kunjungan tersimpan
          </p>
          {visits.map((v, idx) => (
            <div
              key={v.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-3"
            >
              {/* Header card kunjungan */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {visits.length - idx}
                  </div>
                  <span className="font-semibold text-gray-700">
                    Kunjungan #{visits.length - idx}
                  </span>
                </div>
                {v.created_at && (
                  <span className="text-xs text-gray-400">{v.created_at}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Keluhan & Gejala */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                    Keluhan Utama
                  </p>
                  <p className="text-sm text-blue-900">{v.keluhan || "-"}</p>
                  {v.gejala && (
                    <p className="text-xs text-blue-700 mt-1">{v.gejala}</p>
                  )}
                  {v.tanda_vital && (
                    <p className="text-xs text-gray-500 mt-1">
                      📊 {v.tanda_vital}
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

              {/* ICD-10 yang dipilih dokter */}
              {v.icd10_codes && v.icd10_codes.length > 0 && (
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

              {/* Rekomendasi yang dipilih dokter */}
              {v.rekomendasi_terpilih && v.rekomendasi_terpilih.length > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                    💊 Rekomendasi Terapi Terpilih
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

              {/* Info tambahan jika ada */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
