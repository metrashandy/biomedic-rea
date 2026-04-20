import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User,
  Calendar,
  Activity,
  Download,
  Image as ImageIcon,
  Filter,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Header from "../components/Header";

// 1. IMPORT FUNGSI MASTER PDF
import { exportToPDF } from "../services/pdfExport";

const CATEGORIES = [
  "Endoscopy",
  "Broncoscopy",
  "ESWL",
  "Cathlab",
  "URS",
  "EKG",
  "USG Ginekologi",
  "Endoscopy THT",
  "Echo",
  "Treadmile",
  "Laparoscopy",
  "Colposcopy",
  "Spirometri",
  "Colonoscopy",
  "USG Mata",
  "OCT",
  "Foto Fundus",
  "Yog Laser",
  "Laser Retina",
  "Fluoresint",
  "Phaco",
  "USG Urologi",
  "USG Vaskuler",
  "Uroflow",
  "USG Obstetri",
  "USG 4D Fetomaternal",
  "USG 4D Ginekologi - Onkologi",
  "X-Ray",
  "NST",
  "USG Doppler Jantung Extremitas Inferior",
  "USG Doppler Jantung Extremitas Superior",
  "Echo Bayi",
  "EEG",
  "C-ARM",
];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua Kategori");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  const fetchPatientData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/patients/${id}`);
      const data = await response.json();
      if (data.status === "success") {
        setPatient(data.patient);
        setHistory(data.history);
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat data pasien.");
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================
  // 🔥 FUNGSI DOWNLOAD RESUME (PANGGIL MASTER PDF)
  // ========================================================
  const handleDownloadResume = async () => {
    if (history.length === 0) {
      toast.error("Belum ada riwayat medis untuk dicetak.");
      return;
    }

    try {
      setIsDownloading(true);
      const toastId = toast.loading("Menyusun Resume PDF Gabungan...");

      // Filter riwayat berdasarkan kategori yang lagi aktif (opsional, tapi bagus buat UX)
      const dataToPrint =
        activeCategory === "Semua Kategori"
          ? history
          : history.filter((r) => r.type === activeCategory);

      if (dataToPrint.length === 0) {
        setIsDownloading(false);
        toast.error(`Tidak ada data ${activeCategory} untuk diprint`, {
          id: toastId,
        });
        return;
      }

      // PANGGIL MASTER: Kirim array dataToPrint dan info patient
      await exportToPDF(dataToPrint, patient);

      toast.success("Resume berhasil diunduh!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengekspor PDF Resume");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sky-50">
        <h2 className="text-2xl font-bold text-slate-600">
          Pasien tidak ditemukan
        </h2>
      </div>
    );
  }

  const filteredHistory =
    activeCategory === "Semua Kategori"
      ? history
      : history.filter((record) => record.type === activeCategory);

  return (
    <div className="min-h-screen bg-sky-50">
      <Header showBack={true} onBack={() => navigate("/patients")} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-6 py-8"
      >
        {/* HEADER PROFIL PASIEN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between xl:items-center mb-8 gap-6">
          <div className="flex gap-6 items-center">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
              {patient.nama_pasien?.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                {patient.nama_pasien}
              </h1>
              <div className="flex flex-wrap gap-4 mt-2 text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <Activity size={16} /> No RM: {patient.no_rm}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={16} /> ID Pasien: {id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 bg-sky-50 px-4 py-2.5 rounded-xl border border-sky-100 w-full md:w-auto">
              <Filter size={18} className="text-sky-600" />
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer w-full"
              >
                <option value="Semua Kategori">Semua Kategori</option>
                {CATEGORIES.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 🔥 TOMBOL DOWNLOAD RESUME (GABUNGAN) */}
            <button
              onClick={handleDownloadResume}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:bg-slate-400 w-full md:w-auto whitespace-nowrap"
            >
              <Download size={18} />{" "}
              {isDownloading ? "Menyusun..." : "Download Resume PDF"}
            </button>
          </div>
        </div>

        {/* LIST RIWAYAT */}
        <div className="space-y-6">
          {filteredHistory.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-2xl border border-slate-200 border-dashed text-slate-500">
              <ImageIcon className="mx-auto mb-3 text-slate-300" size={48} />
              <p>Tidak ada riwayat medis ditemukan.</p>
            </div>
          ) : (
            filteredHistory.map((record, index) => (
              <div
                key={index}
                onClick={() => navigate(`/record/${record.id_record}`)}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="w-full md:w-1/3 bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                  <img
                    src={record.imgUrl}
                    alt={record.type}
                    className="max-h-64 object-contain rounded-lg group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="w-full md:w-2/3 p-6 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {record.type}
                    </span>
                    <span className="text-slate-500 text-sm flex items-center gap-1">
                      <Calendar size={14} /> {record.date}
                    </span>
                  </div>
                  <h3 className="text-slate-800 font-bold mb-1">
                    Status Pemeriksaan:
                  </h3>
                  <p
                    className={
                      record.is_analyzed
                        ? "text-green-600 font-medium"
                        : "text-amber-600 font-medium"
                    }
                  >
                    {record.is_analyzed
                      ? "Analisis AI Selesai"
                      : "Belum Dianalisis"}
                  </p>
                  <p className="text-blue-500 text-sm font-medium mt-4 group-hover:underline">
                    Klik untuk melihat detail &rarr;
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
