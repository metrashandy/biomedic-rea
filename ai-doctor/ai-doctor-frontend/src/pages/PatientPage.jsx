import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";
const formatRM = (id) => `RM-${String(id).padStart(3, "0")}`;
const PAGE_SIZE = 8;

function ModalTambahPasien({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "Laki-laki",
    weight: "",
    height: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const overlayRef = useRef(null);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleDaftar = async () => {
    if (!form.name || !form.age) return alert("Nama dan umur wajib diisi!");
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/patients/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          age: parseInt(form.age),
          gender: form.gender,
          weight: form.weight ? parseFloat(form.weight) : null,
          height: form.height ? parseFloat(form.height) : null,
        }),
      });
      if (!res.ok) throw new Error("Gagal mendaftarkan pasien");
      const data = await res.json();
      onSuccess(data.patient);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header modal */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-base">
              Daftarkan Pasien Baru
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">
              Data tersimpan otomatis ke sistem
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center hover:bg-white/30 transition text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Masukkan nama lengkap pasien"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Umur <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="Tahun"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none bg-white focus:border-blue-500 transition"
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Berat Badan (kg)
              </label>
              <input
                type="number"
                placeholder="kg"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tinggi (cm)
              </label>
              <input
                type="number"
                placeholder="cm"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              onClick={handleDaftar}
              disabled={isLoading}
              className={`flex-[2] py-3 rounded-lg text-sm font-semibold text-white transition ${
                isLoading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? "Mendaftarkan..." : "Daftarkan & Buka Diagnosis →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPatients();
  }, []);

  // Reset ke halaman 1 setiap kali search berubah
  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/patients`);
      const data = await res.json();
      setPatients(data.patients || []);
    } catch {
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePilihPasien = (p) => {
    navigate("/diagnosis", { state: { patient: p } });
  };

  const handlePasienBaru = (patient) => {
    setShowModal(false);
    navigate("/diagnosis", { state: { patient } });
  };

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      formatRM(p.id).toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Buat array nomor halaman yang ditampilkan (max 5 angka)
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Topbar — logo + judul halaman + tombol dalam satu baris */}
      <div className="bg-blue-600 px-6 flex items-center justify-between h-16 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-base">
            ⚕️
          </div>
          <span className="font-bold text-white text-base">AI Doctor</span>
          <span className="text-blue-300 text-lg font-light select-none mx-1">
            |
          </span>
          <div>
            <span className="text-white font-semibold text-sm">
              Daftar Pasien
            </span>
            <span className="text-blue-200 text-xs ml-2 hidden sm:inline">
              Pilih pasien untuk memulai sesi diagnosis
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm"
        >
          + Daftar Pasien Baru
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-5">
        {/* Search + stats bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-base pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Cari nama atau No RM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-blue-200 rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500 bg-white shadow-sm transition"
            />
          </div>
          {!isLoading && (
            <div className="bg-white border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-sm whitespace-nowrap">
              {filtered.length} pasien
            </div>
          )}
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          {/* Header tabel — biru muda, konsisten dengan nuansa modal */}
          <div className="grid grid-cols-[90px_1fr_130px_100px_1fr] bg-blue-600 px-5 py-3 gap-3">
            {[
              "No RM",
              "Nama Lengkap",
              "Umur / Gender",
              "Kunjungan",
              "Keluhan Terakhir",
            ].map((h) => (
              <span
                key={h}
                className="text-blue-100 text-xs font-semibold uppercase tracking-wide"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Memuat data pasien...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 text-center">
              <div className="text-4xl mb-3">🗂️</div>
              <p className="text-gray-500 font-medium text-sm">
                {search
                  ? "Pasien tidak ditemukan"
                  : "Belum ada pasien terdaftar"}
              </p>
              {!search && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-100 transition"
                >
                  + Daftarkan pasien pertama
                </button>
              )}
            </div>
          ) : (
            paginated.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => handlePilihPasien(p)}
                className={`grid grid-cols-[90px_1fr_130px_100px_1fr] px-5 py-3.5 gap-3 items-center cursor-pointer hover:bg-blue-50 transition ${
                  idx > 0 ? "border-t border-blue-50" : ""
                }`}
              >
                {/* No RM */}
                <span className="font-mono text-blue-600 text-xs font-bold">
                  {formatRM(p.id)}
                </span>

                {/* Nama */}
                <div>
                  <p className="font-semibold text-gray-800 text-sm m-0 leading-tight">
                    {p.name}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {p.weight ? `${p.weight} kg` : "-"} ·{" "}
                    {p.height ? `${p.height} cm` : "-"}
                  </p>
                </div>

                {/* Umur / Gender */}
                <div className="text-sm text-gray-600 flex items-center gap-1.5">
                  <span>{p.age ? `${p.age} thn` : "-"}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      p.gender === "Perempuan"
                        ? "bg-pink-50 text-pink-700 border border-pink-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {p.gender === "Perempuan" ? "P" : "L"}
                  </span>
                </div>

                {/* Kunjungan */}
                <span
                  className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border w-fit ${
                    p.total_kunjungan > 0
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  {p.total_kunjungan}x
                </span>

                {/* Keluhan terakhir */}
                <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {p.keluhan_terakhir || (
                    <span className="text-gray-300 italic">
                      Belum ada kunjungan
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ===== PAGINATION ===== */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between">
            {/* Info */}
            <p className="text-xs text-blue-400 font-medium">
              Halaman {page} dari {totalPages} · {filtered.length} pasien
            </p>

            {/* Tombol */}
            <div className="flex items-center gap-1.5">
              {/* Prev */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  page === 1
                    ? "border-blue-100 text-blue-200 cursor-not-allowed bg-white"
                    : "border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white bg-white shadow-sm"
                }`}
              >
                ← Prev
              </button>

              {/* Nomor halaman */}
              {getPageNumbers().map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold border transition ${
                    n === page
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  {n}
                </button>
              ))}

              {/* Next */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  page === totalPages
                    ? "border-blue-100 text-blue-200 cursor-not-allowed bg-white"
                    : "border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white bg-white shadow-sm"
                }`}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Footer count — kalau cuma 1 halaman */}
        {!isLoading && filtered.length > 0 && totalPages <= 1 && (
          <p className="text-center text-blue-300 text-xs">
            {filtered.length} pasien ditampilkan
          </p>
        )}
      </div>

      {showModal && (
        <ModalTambahPasien
          onClose={() => setShowModal(false)}
          onSuccess={handlePasienBaru}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
