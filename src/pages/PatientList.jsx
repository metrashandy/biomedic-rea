import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import Header from "../components/Header";
import toast from "react-hot-toast";

export default function PatientList() {
  const navigate = useNavigate();

  // ===== STATE MANAGEMENT =====
  const [patients, setPatients] = useState([]); // State untuk nyimpen data asli dari DB
  const [isLoading, setIsLoading] = useState(true); // State untuk animasi loading
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  // ===== FETCH DATA DARI API BACKEND =====
  useEffect(() => {
    const fetchPatients = async () => {
      console.log("Sedang mencoba menghubungi Backend..."); // Liat di Console (F12)
      try {
        const response = await fetch("http://127.0.0.1:8000/api/patients");

        if (!response.ok) {
          throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Data diterima:", data);

        if (data.status === "success") {
          setPatients(data.data);
        }
      } catch (error) {
        console.error("Gagal konek ke API:", error);
        toast.error("Nggak bisa nyambung ke Backend. Cek terminal Python!");
      } finally {
        setIsLoading(false); // <--- INI WAJIB, biar spinner-nya berenti
      }
    };

    fetchPatients();
  }, []);

  // ===== LOGIKA PENCARIAN (SEARCH) =====
  const filteredPatients = patients.filter((patient) => {
    const nameMatch = patient.nama_pasien
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const rmMatch = patient.no_rm
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    return nameMatch || rmMatch;
  });

  // ===== LOGIKA PAGINATION =====
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredPatients.slice(startIndex, endIndex);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-100 to-indigo-100 pb-12">
      <Header />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-6 py-12"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-[#1e1b4b] flex items-center gap-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
              Daftar Pasien
            </h2>
            <p className="text-slate-500 mt-2">
              Kelola data rekam medis dan hasil citra radiologi pasien.
            </p>
          </div>

          <div className="relative w-full md:w-auto">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Cari nama atau No RM..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* TABEL DAFTAR PASIEN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#1e1b4b] text-white border-b-4 border-indigo-500 shadow-md">
                  <th className="p-4 font-semibold">No RM</th>
                  <th className="p-4 font-semibold">Nama Lengkap</th>
                  {/* Kita asumsikan backend mengirim data umur & gender, kalau tidak ada nanti kita update API-nya */}
                  <th className="p-4 font-semibold">Umur / Gender</th>
                  <th className="p-4 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="p-10 text-center text-slate-500">
                      <Loader2
                        className="animate-spin mx-auto mb-2 text-blue-500"
                        size={32}
                      />
                      Memuat data dari database...
                    </td>
                  </tr>
                ) : currentData.length > 0 ? (
                  currentData.map((patient) => (
                    <tr
                      key={patient.id_pasien}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 text-slate-500 font-medium">
                        {patient.no_rm}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {patient.nama_pasien}
                      </td>
                      <td className="p-4 text-slate-600">
                        {patient.umur || "-"} thn • {patient.gender || "-"}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() =>
                            navigate(`/patient/${patient.id_pasien}`)
                          }
                          className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl font-bold w-full transition-all shadow-sm"
                        >
                          Detail <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-10 text-center text-slate-500">
                      {searchQuery
                        ? `Tidak ada pasien bernama "${searchQuery}"`
                        : "Belum ada data pasien di database."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* KONTROL PAGINATION */}
          {!isLoading && (
            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-sm text-slate-500 font-medium">
                Menampilkan {filteredPatients.length === 0 ? 0 : startIndex + 1}{" "}
                - {Math.min(endIndex, filteredPatients.length)} dari{" "}
                {filteredPatients.length} pasien
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === 1
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                <div className="flex items-center px-4 font-medium text-slate-700">
                  Hal {currentPage} / {totalPages || 1}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === totalPages || totalPages === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
