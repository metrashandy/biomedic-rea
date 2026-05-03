import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, Loader2, X, Images } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
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

  const [activeIndex, setActiveIndex] = useState(0);
  const [gambarList, setGambarList] = useState([]);

  // doctorBoxesMap: { id_gambar: [box, ...] }
  const [doctorBoxesMap, setDoctorBoxesMap] = useState({});
  const [doctorNotes, setDoctorNotes] = useState({
    temuan: "",
    penyakit: "",
    risiko: "",
    rekomendasi: "",
  });

  useEffect(() => {
    setIsLoading(true);
    setActiveIndex(0);

    const fetchRecordDetail = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/records/${recordId}`,
        );
        if (!response.ok) throw new Error("Gagal mengambil detail rekam medis");
        const result = await response.json();

        if (result.status === "success") {
          const d = result.data;
          setData(d);

          const list =
            d.gambar_list && d.gambar_list.length > 0
              ? d.gambar_list
              : [
                  {
                    id_gambar: "main",
                    urutan: 1,
                    gambar_asli_url: d.gambar_asli_url,
                    gambar_hasil_url: d.gambar_hasil_url,
                    gambar_dokter_url: d.gambar_dokter_url,
                    ai_bboxes: d.ai_bboxes || [],
                    doctor_bboxes: d.doctor_bboxes || [],
                  },
                ];
          setGambarList(list);

          const boxMap = {};
          list.forEach((g) => {
            boxMap[g.id_gambar] = g.doctor_bboxes || [];
          });
          setDoctorBoxesMap(boxMap);

          setDoctorNotes(
            d.doctor_notes || {
              temuan: "",
              penyakit: "",
              risiko: "",
              rekomendasi: "",
            },
          );
        }
      } catch (error) {
        toast.error("Gagal memuat data rekam medis.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordDetail();
  }, [recordId]);

  const activeGambar = gambarList[activeIndex] || null;
  const activeImageKey = activeGambar?.id_gambar ?? activeIndex;

  const activeDoctorBoxes = doctorBoxesMap[activeImageKey] || [];
  const setActiveDoctorBoxes = (updater) => {
    setDoctorBoxesMap((prev) => ({
      ...prev,
      [activeImageKey]:
        typeof updater === "function"
          ? updater(prev[activeImageKey] || [])
          : updater,
    }));
  };

  const handleSaveDoctor = async (doctorImageBlob = null) => {
    const formData = new FormData();
    formData.append("doctor_notes", JSON.stringify(doctorNotes));
    formData.append("doctor_bboxes", JSON.stringify(activeDoctorBoxes));

    if (activeGambar && activeGambar.id_gambar !== "main") {
      formData.append("id_gambar", activeGambar.id_gambar);
    }
    if (doctorImageBlob) {
      formData.append(
        "doctor_image",
        doctorImageBlob,
        "doctor_segmentation.jpg",
      );
    }

    try {
      await fetch(
        `http://127.0.0.1:8000/api/records/${recordId}/doctor-update`,
        { method: "PUT", body: formData },
      );
      toast.success("Catatan Dokter Tersimpan!");
    } catch (e) {
      toast.error("Gagal menyimpan catatan dokter");
    }
  };

  const processDownload = async (withAI) => {
    if (!data) return;
    setShowDownloadModal(false);
    setExporting(true);
    const toastId = toast.loading("Sedang membuat PDF...");
    try {
      await exportToPDF(
        {
          ai_result: data.ai_result,
          gambar_asli_url: data.gambar_asli_url,
          gambar_hasil_url: data.gambar_hasil_url,
          gambar_dokter_url: data.gambar_dokter_url,
          doctorBoxes: activeDoctorBoxes,
          doctorNotes,
          date: data.date || new Date().toLocaleDateString(),
          gambar_list: gambarList,
        },
        {
          nama_pasien: data.patient_name || "Pasien",
          no_rm: data.no_rm || "-",
        },
        withAI,
      );
      toast.success("PDF Berhasil diunduh!", { id: toastId });
    } catch {
      toast.error("Gagal mengekspor PDF", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // ── Bangun all_images untuk ResultSection ──
  // Pakai gambar_asli_url sebagai original
  // ai_bboxes dari per-gambar untuk overlay di frontend
  const allImagesForResult = gambarList.map((g) => ({
    urutan: g.urutan,
    id_gambar: g.id_gambar,
    original_url: g.gambar_asli_url,
    // segmentation_image: null karena kita pakai overlay, bukan _ai.jpg
    segmentation_image: null,
    ai_bboxes: g.ai_bboxes || [],
  }));

  const resultForSection = data
    ? {
        result: data.ai_result,
        segmentation_image: null, // tidak pakai _ai.jpg
        all_images: allImagesForResult,
        active_image_index: activeIndex,
      }
    : null;

  const activeImagePreview =
    activeGambar?.gambar_asli_url || data?.gambar_asli_url;

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
      {showDownloadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowDownloadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              Format Laporan PDF
            </h3>
            <p className="text-slate-500 mb-6 text-sm">
              Pilih jenis informasi yang ingin disertakan.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => processDownload(true)}
                className="w-full p-4 border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl text-left transition-colors"
              >
                <p className="font-bold text-blue-700 text-lg">
                  Laporan Lengkap (AI & Dokter)
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Semua {gambarList.length} gambar, analisis AI gabungan, dan
                  catatan dokter.
                </p>
              </button>
              <button
                onClick={() => processDownload(false)}
                className="w-full p-4 border-2 border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-left transition-colors"
              >
                <p className="font-bold text-slate-800 text-lg">
                  Laporan Resmi (Hanya Dokter)
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Semua gambar asli, anotasi dokter, dan catatan dokter saja.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      <Header showBack={true} onBack={() => navigate(-1)} />

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-6 py-12"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Detail Rekam Medis
            </h1>
            {gambarList.length > 1 && (
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                <Images size={16} />
                {gambarList.length} gambar dalam sesi ini — analisis AI gabungan
              </p>
            )}
          </div>
          <button
            onClick={() => setShowDownloadModal(true)}
            disabled={exporting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md disabled:bg-slate-400"
          >
            <Download size={18} />{" "}
            {exporting ? "Mengekspor..." : "Download Laporan PDF"}
          </button>
        </div>

        {resultForSection && (
          <ResultSection
            result={resultForSection}
            imagePreview={activeImagePreview}
            onReset={() => navigate("/patients")}
            exporting={exporting}
            onExport={() => setShowDownloadModal(true)}
            setDoctorBoxes={setActiveDoctorBoxes}
            doctorBoxes={activeDoctorBoxes}
            doctorNotes={doctorNotes}
            setDoctorNotes={setDoctorNotes}
            analysisType={data?.jenis || "X-Ray"}
            handleSaveDoctorLocal={handleSaveDoctor}
            totalImages={gambarList.length}
            activeImageIndex={activeIndex}
            onImageChange={setActiveIndex}
          />
        )}
      </motion.main>
    </div>
  );
}
