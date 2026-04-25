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
  handleSaveDoctor,
  handleSaveDoctorLocal,
}) {
  const imageRef = useRef(null);
  const [showSegmentation, setShowSegmentation] = useState(true);
  const [showDoctorBoxes, setShowDoctorBoxes] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const risk = Number(result?.result?.risk) || 0;

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
    } else {
      mod = `citra ${analysisType}`;
    }
    return `Sistem AI telah memindai ${mod} ini dan menandai area yang dicurigai memiliki kelainan (${kelainan}).`;
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

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
          <Scan className="text-blue-500" /> Deteksi Visual AI
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <div
              className="relative bg-slate-900 rounded-xl overflow-hidden cursor-crosshair border border-slate-200 shadow-inner"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {showSegmentation && result?.segmentation_image ? (
                <img
                  ref={imageRef}
                  // FIX: Cek apakah ini URL (http) atau Base64
                  src={
                    result.segmentation_image.startsWith("http")
                      ? result.segmentation_image
                      : `data:image/jpeg;base64,${result.segmentation_image}`
                  }
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

              {showDoctorBoxes &&
                doctorBoxes.map((box, index) => {
                  const img = imageRef.current;
                  if (!img) return null;
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

              {currentBox && (
                <div
                  className="absolute border-2 border-blue-400 border-dashed pointer-events-none bg-blue-400/20"
                  style={{
                    left: currentBox.x,
                    top: currentBox.y,
                    width: currentBox.width,
                    height: currentBox.height,
                  }}
                />
              )}
            </div>

            {/* KONTROL & LEGENDA DITENGAH KOTAK PUTIH */}
            <div className="mt-6 flex flex-col items-center justify-center bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap gap-8 justify-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    checked={showSegmentation}
                    onChange={() => setShowSegmentation(!showSegmentation)}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                  <div className="w-5 h-5 border-2 border-red-600 rounded-sm bg-red-600/20"></div>
                  <span className="font-bold text-slate-800 text-base">
                    Area AI (Abnormal)
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    checked={showDoctorBoxes}
                    onChange={() => setShowDoctorBoxes(!showDoctorBoxes)}
                    className="w-5 h-5 accent-green-600 cursor-pointer"
                  />
                  <div className="w-5 h-5 border-2 border-green-500 rounded-sm bg-green-500/20"></div>
                  <span className="font-bold text-slate-800 text-base">
                    Area Dokter
                  </span>
                </label>
              </div>
              {doctorBoxes.length > 0 && (
                <button
                  onClick={() => setDoctorBoxes([])}
                  className="mt-4 text-sm font-bold text-red-500 hover:text-red-700 underline"
                >
                  Hapus Semua Segmentasi Dokter
                </button>
              )}
            </div>
          </div>

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
                <p
                  className={`font-bold text-lg mt-1 ${result?.result?.bboxes?.length > 0 ? "text-red-600" : "text-green-600"}`}
                >
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
                <p className={`font-bold mt-1 ${getActionColor(risk)}`}>
                  {getAction(risk)}
                </p>
              </div>
            </div>

            <div className="flex gap-6 mt-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSegmentation}
                  onChange={() => setShowSegmentation(!showSegmentation)}
                  className="w-4 h-4 accent-blue-600"
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
                  className="w-4 h-4 accent-green-600"
                />
                <span className="font-medium text-slate-700">
                  Tampilkan Box Dokter
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* HASIL KLINIS & CATATAN DOKTER */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <ResultCard
            title="Temuan Klinis (AI)"
            content={result?.result?.findings || "-"}
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
            content={result?.result?.abnormality || "-"}
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
            content={`Approach: ${result?.result?.recommendation?.approach || "-"}\nTreatment: ${result?.result?.recommendation?.treatment || "-"}`}
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

      {/* ACTION BUTTON */}
      <div className="mt-10 flex flex-wrap justify-center items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <button
          onClick={onReset}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <RotateCcw size={18} /> Analisis Ulang
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof handleSaveDoctorLocal === "function") {
              handleSaveDoctorLocal();
            }
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm transition-colors"
        >
          Simpan Catatan Dokter
        </button>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm transition-colors disabled:opacity-50"
        >
          <Download size={18} />{" "}
          {exporting ? "Menyiapkan PDF..." : "Download Laporan PDF"}
        </button>
      </div>
    </div>
  );
}
