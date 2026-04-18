import {
  Scan,
  AlertTriangle,
  Activity,
  User,
  RotateCcw,
  Download,
} from "lucide-react";
import { useState, useRef } from "react";

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
}) {
  const imageRef = useRef(null);
  const [showSegmentation, setShowSegmentation] = useState(true);
  const [showDoctorBoxes, setShowDoctorBoxes] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);

  // State tambahan untuk re-render saat gambar sudah ter-load (agar kotak dokter muncul dengan presisi)
  const [imageLoaded, setImageLoaded] = useState(false);

  const risk = Number(result?.result?.risk) || 0;

  // ===== LOGIKA TEKS DINAMIS BERDASARKAN JENIS GAMBAR =====
  const getDynamicDescription = () => {
    const type = (analysisType || "X-Ray").toLowerCase();
    let mod = "citra medis";
    let kelainan = "kelainan atau anomali";

    if (type.includes("x-ray") || type.includes("c-arm")) {
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
      type.includes("broncoscopy") ||
      type.includes("laparoscopy")
    ) {
      mod = "citra Endoskopi";
      kelainan = "lesi mukosa, polip, inflamasi, atau pendarahan";
    } else if (
      type.includes("ekg") ||
      type.includes("eeg") ||
      type.includes("nst") ||
      type.includes("spirometri")
    ) {
      mod = "rekaman sinyal medis";
      kelainan = "pola gelombang abnormal atau deviasi ritme";
    } else if (
      type.includes("mata") ||
      type.includes("oct") ||
      type.includes("fundus") ||
      type.includes("retina")
    ) {
      mod = "citra Oftalmologi";
      kelainan = "eksudat, perdarahan mikro, atau abnormalitas makula";
    } else {
      mod = `citra ${analysisType}`;
    }

    return `Sistem AI telah memindai ${mod} ini dan menandai area yang dicurigai memiliki kelainan (${kelainan}).`;
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // hanya klik kiri

    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
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
    if (e.button !== 0) return;
    if (!drawing || !currentBox) return;

    const img = imageRef.current;
    if (!img) return;

    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const normalizedBox = {
      x: currentBox.x * scaleX,
      y: currentBox.y * scaleY,
      width: currentBox.width * scaleX,
      height: currentBox.height * scaleY,
    };

    setDoctorBoxes((prev) => [...prev, normalizedBox]);

    setDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-800">Hasil Analisis</h2>
        <p className="text-slate-500 mt-1">
          Sistem kami memadukan deteksi visual dan analisis klinis.
        </p>
      </div>

      {/* DETEKSI VISUAL */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
          <Scan className="text-blue-500" /> Deteksi Visual AI
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* IMAGE */}
          <div>
            <div
              className="relative bg-slate-900 rounded-xl overflow-hidden cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {showSegmentation && result?.segmentation_image ? (
                <img
                  ref={imageRef}
                  src={`data:image/jpeg;base64,${result.segmentation_image}`}
                  alt="Segmentasi AI"
                  draggable={false}
                  onLoad={() => setImageLoaded(true)}
                  className="w-full rounded-lg object-contain h-auto block select-none"
                />
              ) : (
                <img
                  ref={imageRef}
                  src={imagePreview}
                  alt="Original"
                  draggable={false}
                  onLoad={() => setImageLoaded(true)}
                  className="w-full rounded-lg object-contain h-auto block select-none"
                />
              )}

              {/* RENDER KOTAK DOKTER */}
              {showDoctorBoxes &&
                doctorBoxes.map((box, index) => {
                  const img = imageRef.current;
                  if (!img) return null; // 🔥 FIX NULL ERROR

                  const scaleX = img.clientWidth / (img.naturalWidth || 1);
                  const scaleY = img.clientHeight / (img.naturalHeight || 1);

                  return (
                    <div
                      key={index}
                      className="absolute border-2 border-green-500 pointer-events-none"
                      style={{
                        left: box.x * scaleX,
                        top: box.y * scaleY,
                        width: box.width * scaleX,
                        height: box.height * scaleY,
                      }}
                    />
                  );
                })}

              {/* PREVIEW BOX (SAAT DRAG) */}
              {currentBox && (
                <div
                  className="absolute border-2 border-blue-400 border-dashed pointer-events-none"
                  style={{
                    left: currentBox.x,
                    top: currentBox.y,
                    width: currentBox.width,
                    height: currentBox.height,
                  }}
                />
              )}
            </div>

            <p className="text-xs text-slate-400 text-center mt-2">
              {showSegmentation
                ? "Mode: Segmentasi Aktif"
                : "Mode: Gambar Asli"}
            </p>

            <button
              onClick={() => setDoctorBoxes([])}
              className="mt-2 w-full text-sm text-red-500 underline text-center"
            >
              Hapus Semua Segmentasi Dokter
            </button>

            <div className="flex gap-4 mt-4 text-sm font-medium justify-center text-slate-600">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-red-600 rounded-sm bg-red-500/20"></div>
                Area Suspect AI
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-500 rounded-sm"></div>
                Area Dokter
              </span>
            </div>
          </div>

          {/* INFO */}
          <div className="space-y-4">
            <p className="text-slate-600 mb-4 leading-relaxed">
              {getDynamicDescription()}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Scan size={14} /> Area Terdeteksi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {result?.result?.bboxes?.length || 0} Region
                </p>
              </div>

              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <AlertTriangle size={14} /> Status Visual
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {result?.result?.bboxes?.length > 0
                    ? "Suspect Abnormal"
                    : "Tampak Bersih"}
                </p>
              </div>

              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Activity size={14} /> Pola Distribusi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {result?.result?.bboxes?.length > 1
                    ? "Multifokal (Menyebar)"
                    : result?.result?.bboxes?.length === 1
                      ? "Fokal (Terpusat)"
                      : "Tidak Ada"}
                </p>
              </div>

              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <User size={14} /> Tindak Lanjut
                </span>
                <p className={`font-bold ${getActionColor(risk)} mt-1`}>
                  {getAction(risk)}
                </p>
              </div>
            </div>

            <div className="flex gap-6 mt-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSegmentation}
                  onChange={() => setShowSegmentation(!showSegmentation)}
                  className="w-4 h-4"
                />
                <span className="font-medium text-slate-700">
                  Tampilkan Box AI
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDoctorBoxes}
                  onChange={() => setShowDoctorBoxes(!showDoctorBoxes)}
                  className="w-4 h-4"
                />
                <span className="font-medium text-slate-700">
                  Tampilkan Box Dokter
                </span>
              </label>
            </div>

            <p className="text-xs text-slate-400 mt-4 italic">
              *Semakin banyak region terdeteksi, semakin tinggi kemungkinan
              adanya anomali.
            </p>
          </div>
        </div>
      </div>

      {/* HASIL KLINIS */}
      <div className="space-y-6">
        {/* Temuan Klinis */}
        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Temuan Klinis (AI)"
            content={result?.result?.findings || "-"}
          />
          <textarea
            placeholder="Catatan dokter terkait temuan..."
            className="w-full mt-4 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            value={doctorNotes?.temuan || ""}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, temuan: e.target.value })
            }
          />
        </div>

        {/* Kemungkinan Penyakit */}
        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Kemungkinan Penyakit (AI)"
            content={result?.result?.abnormality || "-"}
          />
          <textarea
            placeholder="Catatan dokter terkait penyakit..."
            className="w-full mt-4 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            value={doctorNotes?.penyakit || ""}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, penyakit: e.target.value })
            }
          />
        </div>

        {/* Risiko */}
        <div className="bg-white p-6 rounded-xl border">
          <RiskCard
            percentage={result?.result?.risk || 0}
            factors={result?.result?.risk_factors}
          />
          <textarea
            placeholder="Catatan dokter terkait risiko..."
            className="w-full mt-4 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            value={doctorNotes?.risiko || ""}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, risiko: e.target.value })
            }
          />
        </div>

        {/* Rekomendasi */}
        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Rekomendasi Pengobatan (AI)"
            content={`Approach: ${
              result?.result?.recommendation?.approach || "-"
            }\nTreatment: ${result?.result?.recommendation?.treatment || "-"}`}
          />
          <textarea
            placeholder="Catatan dokter terkait rekomendasi..."
            className="w-full mt-4 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            value={doctorNotes?.rekomendasi || ""}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, rekomendasi: e.target.value })
            }
          />
        </div>
      </div>

      <div className="mt-6 w-full">
        <DisclaimerCard content="Hasil ini dihasilkan oleh AI dan tidak menggantikan diagnosis medis profesional." />
      </div>

      {/* ACTION BUTTON */}
      <div className="mt-12 flex justify-center items-center gap-4">
        <button
          onClick={onReset}
          className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors"
        >
          <RotateCcw size={18} /> Diagnosis Ulang
        </button>

        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <Download size={18} />
          {exporting ? "Exporting..." : "Export to PDF"}
        </button>
      </div>
    </div>
  );
}
