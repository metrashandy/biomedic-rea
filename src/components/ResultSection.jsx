import {
  Scan,
  AlertTriangle,
  Activity,
  User,
  RotateCcw,
  Download,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { exportToPDF } from "../services/pdfExport";

import ResultCard from "./ResultCard";
import RiskCard from "./RiskCard";
import DisclaimerCard from "./DisclaimerCard";

const getAction = (risk) => {
  const r = Number(risk) || 0;
  if (r > 70) return "Perlu Evaluasi Medis Segera";
  if (r > 30) return "Disarankan Pemantauan Klinis";
  return "Cukup Observasi dan Pencegahan";
};

const getActionColor = (risk) => {
  const r = Number(risk) || 0;
  if (r > 70) return "text-red-600";
  if (r > 30) return "text-yellow-600";
  return "text-green-600";
};

export default function ResultSection({
  result,
  imagePreview,
  onReset,
  onExport,
  exporting,
  setDoctorBoxes,
  doctorBoxes,
  doctorNotes,
  setDoctorNotes,
  analysisType,
  handleSaveDoctorLocal,
  totalImages,
  activeImageIndex,
  onImageChange,
  onDetailLevelChange,
  onExportWithLevel,
}) {
  const imageRef = useRef(null);
  const [showAIBoxes, setShowAIBoxes] = useState(true);
  const [showDoctorBoxes, setShowDoctorBoxes] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [detailLevel, setDetailLevel] = useState("long");

  // ── Resolve data gambar aktif ──────────────────────────────
  const allImages = result?.all_images || [];
  const hasMultipleImages = (totalImages || allImages.length) > 1;
  const currentIndex = activeImageIndex ?? 0;
  const activeImgData = allImages[currentIndex] || null;

  // Gambar yang ditampilkan: selalu original
  const currentOriginal = activeImgData?.original_url || imagePreview || null;

  // ── KUNCI: Resolve ai_bboxes ───────────────────────────────
  // Prioritas:
  // 1. ai_bboxes dari gambar aktif (per-gambar, hasil single prompt)
  // 2. bboxes dari result.result (fallback untuk single image)
  // 3. array kosong
  const currentAiBboxes = (() => {
    // Dari all_images[currentIndex].ai_bboxes
    if (activeImgData?.ai_bboxes && activeImgData.ai_bboxes.length > 0) {
      return activeImgData.ai_bboxes;
    }
    // Fallback: dari result.result.bboxes (single image dari upload lama)
    if (result?.result?.bboxes && result.result.bboxes.length > 0) {
      return result.result.bboxes;
    }
    return [];
  })();

  console.log("🔍 DEBUG ResultSection:", {
    currentIndex,
    activeImgData,
    currentAiBboxes,
    allImagesCount: allImages.length,
    resultBboxes: result?.result?.bboxes,
  });

  const getDynamicDescription = () => {
    const type = (analysisType || "X-Ray").toLowerCase();
    let mod = "citra medis";
    let kelainan = "kelainan atau anomali";
    if (
      type.includes("x-ray") ||
      type.includes("xray") ||
      type.includes("c-arm")
    ) {
      mod = "citra X-Ray";
      kelainan = "opacity, asimetri, atau perbedaan densitas";
    } else if (
      type.includes("usg") ||
      type.includes("echo") ||
      type.includes("ultrasound")
    ) {
      mod = "citra Ultrasound (USG)";
      kelainan = "nodul, massa, atau iregularitas echogenicity";
    } else if (
      type.includes("endoscopy") ||
      type.includes("colonoscopy") ||
      type.includes("broncoscopy")
    ) {
      mod = "citra Endoskopi";
      kelainan = "lesi mukosa, polip, inflamasi, atau pendarahan";
    } else if (
      type.includes("ekg") ||
      type.includes("eeg") ||
      type.includes("nst")
    ) {
      mod = "rekaman sinyal medis";
      kelainan = "pola gelombang abnormal atau deviasi ritme";
    } else if (
      type.includes("mata") ||
      type.includes("oct") ||
      type.includes("fundus")
    ) {
      mod = "citra Oftalmologi";
      kelainan = "eksudat, perdarahan mikro, atau abnormalitas makula";
    } else if (
      type.includes("otoscopic") ||
      type.includes("oto") ||
      type.includes("telinga")
    ) {
      mod = "citra Otoskopik (telinga)";
      kelainan = "kelainan membran timpani, infeksi, atau perforasi";
    } else {
      mod = `citra ${analysisType}`;
    }
    const suffix = hasMultipleImages
      ? ` Analisis mencakup ${totalImages || allImages.length} gambar dari sesi yang sama.`
      : "";
    return `Sistem AI telah memindai ${mod} ini dan menandai area yang dicurigai memiliki kelainan (${kelainan}).${suffix}`;
  };

  // Export: gambar original + overlay bbox AI + bbox dokter dibakar ke canvas
  const exportDoctorImageAsBlob = useCallback(() => {
    return new Promise((resolve) => {
      const img = imageRef.current;
      if (!img) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.clientWidth;
      canvas.height = img.naturalHeight || img.clientHeight;
      const ctx = canvas.getContext("2d");
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.onload = () => {
        ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

        // Gambar bbox AI (biru)
        if (showAIBoxes && currentAiBboxes.length > 0) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = Math.max(2, canvas.width * 0.003);
          ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
          currentAiBboxes.forEach((bbox) => {
            const x = bbox.x * canvas.width;
            const y = bbox.y * canvas.height;
            const w = bbox.width * canvas.width;
            const h = bbox.height * canvas.height;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          });
        }

        // Gambar bbox dokter (hijau)
        if (doctorBoxes.length > 0) {
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = Math.max(2, canvas.width * 0.003);
          ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
          doctorBoxes.forEach((box) => {
            const x = box.x * canvas.width;
            const y = box.y * canvas.height;
            const w = box.width * canvas.width;
            const h = box.height * canvas.height;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          });
        }

        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
      };
      baseImg.onerror = () => resolve(null);
      baseImg.src = currentOriginal;
    });
  }, [doctorBoxes, currentAiBboxes, currentOriginal, showAIBoxes]);

  const handleSaveClick = async () => {
    const blob = await exportDoctorImageAsBlob();
    if (typeof handleSaveDoctorLocal === "function")
      handleSaveDoctorLocal(blob);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setStartPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!drawing || !startPoint) return;
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentBox({
      x: Math.min(startPoint.x, x),
      y: Math.min(startPoint.y, y),
      width: Math.abs(x - startPoint.x),
      height: Math.abs(y - startPoint.y),
    });
  };

  const handleMouseUp = (e) => {
    if (e.button !== 0 || !drawing || !currentBox) return;
    const img = imageRef.current;
    if (!img) return;
    setDoctorBoxes((prev) => [
      ...prev,
      {
        x: currentBox.x / img.clientWidth,
        y: currentBox.y / img.clientHeight,
        width: currentBox.width / img.clientWidth,
        height: currentBox.height / img.clientHeight,
      },
    ]);
    setDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);
  };

  const goPrev = () =>
    onImageChange && onImageChange(Math.max(0, currentIndex - 1));
  const goNext = () =>
    onImageChange &&
    onImageChange(
      Math.min((totalImages || allImages.length) - 1, currentIndex + 1),
    );

  const ImageRenderer = ({ isFull = false }) => (
    <div
      className={`relative flex justify-center items-start bg-slate-900 rounded-xl overflow-hidden border border-slate-300 shadow-inner ${isFull ? "h-[85vh]" : "w-full"}`}
    >
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setIsFullScreen(!isFullScreen);
        }}
        className="absolute top-4 right-4 z-50 bg-black/60 text-white p-2 rounded-lg hover:bg-black/80 transition-colors cursor-pointer"
      >
        {isFull ? <X size={20} /> : <Maximize2 size={20} />}
      </button>

      <div
        className="relative inline-block"
        style={{ cursor: isFull ? "default" : "crosshair", lineHeight: 0 }}
        onMouseDown={isFull ? undefined : handleMouseDown}
        onMouseUp={isFull ? undefined : handleMouseUp}
        onMouseMove={isFull ? undefined : handleMouseMove}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Gambar ORIGINAL — bbox sebagai overlay div */}
        <img
          ref={imageRef}
          key={currentOriginal}
          src={currentOriginal}
          alt="Medis"
          draggable={false}
          className={`block select-none ${isFull ? "max-h-[85vh] w-auto" : "w-full h-auto max-h-[500px] object-contain"}`}
        />

        {/* ══ OVERLAY BBOX AI (BIRU) ══ */}
        {showAIBoxes &&
          currentAiBboxes.map((bbox, i) => (
            <div
              key={`ai-${i}`}
              className="absolute border-2 border-blue-500 pointer-events-none bg-blue-500/10"
              style={{
                left: `${bbox.x * 100}%`,
                top: `${bbox.y * 100}%`,
                width: `${bbox.width * 100}%`,
                height: `${bbox.height * 100}%`,
              }}
            />
          ))}

        {/* ══ OVERLAY BBOX DOKTER (HIJAU) ══ */}
        {showDoctorBoxes &&
          doctorBoxes.map((box, i) => (
            <div
              key={`doc-${i}`}
              className="absolute border-2 border-green-500 pointer-events-none bg-green-500/20"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
            />
          ))}

        {/* Box sedang digambar */}
        {!isFull && currentBox && (
          <div
            className="absolute border-2 border-green-400 border-dashed pointer-events-none bg-green-400/20"
            style={{
              left: currentBox.x,
              top: currentBox.y,
              width: currentBox.width,
              height: currentBox.height,
            }}
          />
        )}
      </div>
    </div>
  );

  // Helper: pastikan value selalu string sebelum di-render React
  const safeText = (val) => {
    if (val === null || val === undefined) return "-";
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    if (typeof val === "object")
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    return String(val);
  };
  const risk = Number(result?.result?.risk) || 0;

  const getVisualStatus = () => {
    if (currentAiBboxes.length > 0) {
      return {
        label: "Suspect Abnormal",
        color: "text-red-600",
        isAbnormal: true,
      };
    }
    if (risk > 25) {
      return {
        label: "Perlu Evaluasi",
        color: "text-amber-600",
        isAbnormal: true,
      };
    }
    return {
      label: "Tampak Bersih",
      color: "text-green-600",
      isAbnormal: false,
    };
  };
  const visualStatus = getVisualStatus();

  const totalImagesCount = totalImages || allImages.length || 1;

  return (
    <div className="animate-fade-in">
      {isFullScreen && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
          <ImageRenderer isFull={true} />
          <p className="text-white/60 mt-4 text-sm">
            Klik X untuk menutup layar penuh.
          </p>
        </div>
      )}

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-800">Hasil Analisis</h2>
        <p className="text-slate-500 mt-1">
          Sistem kami memadukan deteksi visual dan analisis klinis.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
          <Scan className="text-blue-500" /> Deteksi Visual AI
          {hasMultipleImages && (
            <span className="ml-auto text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Gambar {currentIndex + 1} / {totalImagesCount}
            </span>
          )}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* KOLOM KIRI */}
          <div>
            <ImageRenderer isFull={false} />

            {/* Navigasi multi-gambar */}
            {hasMultipleImages && allImages.length > 0 && (
              <div className="mt-4 bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => onImageChange && onImageChange(idx)}
                      className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentIndex
                          ? "border-blue-500 shadow-md scale-105"
                          : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400"
                      }`}
                    >
                      <img
                        src={img.original_url}
                        alt={`Gambar ${idx + 1}`}
                        className="w-16 h-14 object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      {/* Badge jumlah bbox per gambar */}
                      {img.ai_bboxes?.length > 0 && (
                        <div className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                          {img.ai_bboxes.length}
                        </div>
                      )}
                      <div
                        className={`absolute bottom-0 left-0 right-0 text-center text-[10px] font-black py-0.5 ${
                          idx === currentIndex
                            ? "bg-blue-500 text-white"
                            : "bg-black/50 text-white"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronLeft size={16} /> Sebelumnya
                  </button>
                  <button
                    onClick={goNext}
                    disabled={currentIndex === totalImagesCount - 1}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Berikutnya <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* KOLOM KANAN */}
          {/* KOLOM KANAN */}
          <div className="space-y-4">
            <p className="text-slate-600 mb-4 leading-relaxed">
              {getDynamicDescription()}
            </p>

            {/* 4 kotak analisis */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Scan size={14} /> Area Terdeteksi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {currentAiBboxes.length > 0
                    ? `${currentAiBboxes.length} Region`
                    : risk > 25
                      ? "Terdeteksi (no bbox)"
                      : "Tidak Ada"}
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <AlertTriangle size={14} /> Status Visual
                </span>
                <p className={`font-bold text-lg mt-1 ${visualStatus.color}`}>
                  {visualStatus.label}
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Activity size={14} /> Pola Distribusi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {currentAiBboxes.length > 1
                    ? "Multifokal (Menyebar)"
                    : currentAiBboxes.length === 1
                      ? "Fokal (Terpusat)"
                      : risk > 25
                        ? "Difus (tanpa lokalisasi)"
                        : "Tidak Ada"}
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <User size={14} /> Tindak Lanjut
                </span>
                <p className={`font-bold mt-1 ${getActionColor(risk)}`}>
                  {getAction(risk)}
                </p>
              </div>
            </div>

            {/* Legend — di bawah 4 kotak, tanpa checkbox */}
            {/* Checkbox toggle — fungsional, styling rapi */}
            <div className="flex items-center gap-6 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tampilkan:
              </span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAIBoxes}
                  onChange={() => setShowAIBoxes(!showAIBoxes)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <div className="w-4 h-4 border-2 border-blue-500 bg-blue-500/10 rounded-sm"></div>
                <span className="text-sm font-semibold text-slate-700">
                  Area AI
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDoctorBoxes}
                  onChange={() => setShowDoctorBoxes(!showDoctorBoxes)}
                  className="w-4 h-4 accent-green-600 cursor-pointer"
                />
                <div className="w-4 h-4 border-2 border-green-500 bg-green-500/20 rounded-sm"></div>
                <span className="text-sm font-semibold text-slate-700">
                  Area Dokter
                </span>
              </label>
              {doctorBoxes.length > 0 && (
                <button
                  onClick={() => setDoctorBoxes([])}
                  className="ml-auto text-xs font-bold text-red-500 hover:text-red-700"
                >
                  Hapus Anotasi
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HASIL KLINIS */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <ResultCard
            title="Temuan Klinis (AI)"
            content={safeText(result?.result?.findings)}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <label className="block text-xl font-bold text-[#1e1b4b] mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Temuan Klinis
              (Dokter):
            </label>
            <textarea
              placeholder="Tambahkan catatan atau koreksi dokter terkait temuan di sini..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              rows={3}
              value={doctorNotes?.temuan || ""}
              onChange={(e) =>
                setDoctorNotes({ ...doctorNotes, temuan: e.target.value })
              }
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <ResultCard
            title="Kemungkinan Penyakit (AI)"
            content={safeText(result?.result?.abnormality)}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <label className="block text-xl font-bold text-[#1e1b4b] mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Kemungkinan Penyakit
              (Dokter):
            </label>
            <textarea
              placeholder="Tambahkan diagnosis banding dari dokter di sini..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              rows={3}
              value={doctorNotes?.penyakit || ""}
              onChange={(e) =>
                setDoctorNotes({ ...doctorNotes, penyakit: e.target.value })
              }
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <RiskCard
            percentage={result?.result?.risk || 0}
            factors={result?.result?.risk_factors}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <label className="block text-xl font-bold text-[#1e1b4b] mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Penilaian Risiko
              (Dokter):
            </label>
            <textarea
              placeholder="Tambahkan evaluasi risiko klinis menurut dokter..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              rows={3}
              value={doctorNotes?.risiko || ""}
              onChange={(e) =>
                setDoctorNotes({ ...doctorNotes, risiko: e.target.value })
              }
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <ResultCard
            title="Rekomendasi Pengobatan (AI)"
            content={`Pendekatan: ${safeText(result?.result?.recommendation?.approach)}\nPengobatan: ${safeText(result?.result?.recommendation?.treatment)}`}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <label className="block text-xl font-bold text-[#1e1b4b] mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Rekomendasi
              Pengobatan (Dokter):
            </label>
            <textarea
              placeholder="Tuliskan resep, tindakan lanjutan, atau rujukan dari dokter..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              rows={3}
              value={doctorNotes?.rekomendasi || ""}
              onChange={(e) =>
                setDoctorNotes({ ...doctorNotes, rekomendasi: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-6 w-full">
        <DisclaimerCard content="Hasil ini dihasilkan oleh AI dan tidak menggantikan diagnosis medis profesional. Catatan yang ditambahkan oleh dokter akan menjadi rekam medis resmi." />
      </div>

      <div className="mt-10 flex flex-wrap justify-center items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        {/* Selector panjang laporan — menyatu dengan tombol */}

        <button
          onClick={onReset}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <RotateCcw size={18} /> Analisis Ulang
        </button>
        <button
          onClick={handleSaveClick}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm transition-colors"
        >
          Simpan Catatan Dokter
        </button>
        <button
          onClick={() => {
            if (onExportWithLevel) {
              onExportWithLevel(detailLevel);
            } else if (onExport) {
              onExport();
            }
          }}
          disabled={exporting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm transition-colors disabled:opacity-50"
        >
          <Download size={18} />
          {exporting ? "Menyiapkan PDF..." : "Download Laporan PDF"}
        </button>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-slate-500">
            📄 Laporan:
          </span>
          <select
            value={detailLevel}
            onChange={(e) => {
              setDetailLevel(e.target.value);
              onDetailLevelChange?.(e.target.value);
            }}
            className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-sm pr-2 border-none appearance-none"
          >
            <option value="short">⚡ Pendek</option>
            <option value="medium">📋 Sedang</option>
            <option value="long">📝 Panjang</option>
          </select>
          <span className="text-slate-400 text-xs pointer-events-none">▾</span>
        </div>
      </div>
    </div>
  );
}
