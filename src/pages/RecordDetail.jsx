import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { X } from 'lucide-react';

// IMPORT FUNGSI MASTER PDF NYA DI SINI
import { exportToPDF } from "../services/pdfExport";

import Header from "../components/Header";
import ResultSection from "../components/ResultSection";

export default function RecordDetail() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // States untuk menampung data dari ResultSection
  const [doctorBoxes, setDoctorBoxes] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState({
    temuan: "",
    penyakit: "",
    risiko: "",
    rekomendasi: "",
  });

  useEffect(() => {
    const fetchRecordDetail = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/records/${recordId}`,
        );
        if (!response.ok) throw new Error("Gagal mengambil detail rekam medis");

        const result = await response.json();
        if (result.status === "success") {
          setData(result.data);
          // Isi state dokter jika data lama sudah ada di database
          if (result.data.doctor_notes)
            setDoctorNotes(result.data.doctor_notes);
          if (result.data.doctor_bboxes)
            setDoctorBoxes(result.data.doctor_bboxes);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Gagal memuat data rekam medis.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordDetail();
  }, [recordId]);

  // ========================================================
  // 🔥 INI DIA PEMANGGILAN FUNGSI PDF NYA (YANG TADI GUE LUPA)
  // ========================================================
  const handleExportSinglePDF = async () => {
    if (!data) return;

    try {
      setExporting(true);
      const toastId = toast.loading("Sedang membuat PDF...");

      // 1. Susun data record satuan biar strukturnya sama kayak yg diminta pdfExport.js
      const recordToPrint = {
        ai_result: data.ai_result,
        gambar_asli_url: data.gambar_asli_url,
        gambar_hasil_url: data.gambar_hasil_url,
        doctorBoxes: doctorBoxes, // Ambil dari state terbaru
        doctorNotes: doctorNotes, // Ambil dari state terbaru
        date: data.date || new Date().toLocaleDateString(),
      };

      // 2. Susun info pasien
      const patientInfo = {
        nama_pasien: data.patient_name || "Pasien",
        no_rm: data.no_rm || "-",
      };

      // 3. Panggil fungsi Masternya
      await exportToPDF(recordToPrint, patientInfo);

      toast.success("PDF Berhasil diunduh!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengekspor PDF");
    } finally {
      setExporting(false);
    }
  };

  const processDownload = async (withAI) => {
    if (!data) return;
    try {
      setShowDownloadModal(false);
      setExporting(true);
      const toastId = toast.loading("Sedang membuat PDF...");

      const recordToPrint = {
        ai_result: data.ai_result,
        gambar_asli_url: data.gambar_asli_url,
        gambar_hasil_url: data.gambar_hasil_url,
        doctorBoxes: doctorBoxes, 
        doctorNotes: doctorNotes, 
        date: data.date || new Date().toLocaleDateString(),
      };
      const patientInfo = { nama_pasien: data.patient_name || "Pasien", no_rm: data.no_rm || "-" };

      // Panggil Master PDF dengan parameter ke-3 (includeAI)
      await exportToPDF(recordToPrint, patientInfo, withAI);
      toast.success("PDF Berhasil diunduh!", { id: toastId });
    } catch (error) {
      toast.error("Gagal mengekspor PDF");
    } finally {
      setExporting(false);
    }
  };

  // 🔥 TAMBAHAN: FUNGSI UNTUK MENYIMPAN CATATAN DOKTER DI HALAMAN RECORD
  const handleSaveDoctor = async () => {
    const formData = new FormData();
    formData.append("doctor_notes", JSON.stringify(doctorNotes));
    formData.append("doctor_bboxes", JSON.stringify(doctorBoxes));

    try {
      await fetch(
        `http://127.0.0.1:8000/api/records/${recordId}/doctor-update`,
        {
          method: "PUT",
          body: formData,
        },
      );
      toast.success("Catatan Dokter Berhasil Disimpan!");
    } catch (e) {
      toast.error("Gagal menyimpan catatan dokter");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-sky-50">
       {/* --- POP-UP MODAL DOWNLOAD --- */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowDownloadModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><X size={24}/></button>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Format Laporan PDF</h3>
            <p className="text-slate-500 mb-6 text-sm">Pilih jenis informasi yang ingin disertakan dalam file PDF.</p>
            
            <div className="space-y-3">
              <button onClick={() => processDownload(true)} className="w-full p-4 border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl text-left transition-colors">
                <p className="font-bold text-blue-700 text-lg">Laporan Lengkap (AI & Dokter)</p>
                <p className="text-sm text-blue-600 mt-1">Mencakup semua hasil analisis otomatis AI dan catatan manual dokter.</p>
              </button>
              
              <button onClick={() => processDownload(false)} className="w-full p-4 border-2 border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-left transition-colors">
                <p className="font-bold text-slate-800 text-lg">Laporan Resmi (Hanya Dokter)</p>
                <p className="text-sm text-slate-500 mt-1">Hanya menampilkan gambar asli, kotak hijau dokter, dan catatan dokter.</p>
              </button>
            </div>
          </div>
        </div>
      )}
      <Header showBack={true} onBack={() => navigate(-1)} />
      <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-2xl font-bold text-slate-800">Detail Rekam Medis</h1></div>
          
          <button
            onClick={() => setShowDownloadModal(true)} // <-- Buka Modal Pop-Up
            disabled={exporting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md disabled:bg-slate-400"
          >
            <Download size={18} /> {exporting ? "Mengekspor..." : "Download Laporan PDF"}
          </button>
        </div>

        <ResultSection
          result={{ result: data.ai_result, segmentation_image: data.gambar_hasil_url || data.gambar_asli_url }}
          imagePreview={data.gambar_asli_url}
          onReset={() => navigate("/patients")}
          exporting={exporting}
          onExport={() => setShowDownloadModal(true)} // <-- Ubah yang di dalam ResultSection juga
          setDoctorBoxes={setDoctorBoxes}
          doctorBoxes={doctorBoxes}
          doctorNotes={doctorNotes}
          setDoctorNotes={setDoctorNotes}
          analysisType="X-Ray"
        />
      </motion.main>
    </div>
  );
}
