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
}) {
  const imageRef = useRef(null);
  const [showSegmentation, setShowSegmentation] = useState(true);
  const risk = Number(result?.result?.risk) || 0;
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // hanya klik kiri

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    setDrawing(true);
  };
  const [currentBox, setCurrentBox] = useState(null);
  const handleMouseMove = (e) => {
    if (!drawing || !startPoint) return;

    const img = imageRef.current;
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

  const [showDoctorBoxes, setShowDoctorBoxes] = useState(true);

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
              {" "}
              {showSegmentation && result.segmentation_image ? (
                <img
                  ref={imageRef}
                  src={`data:image/jpeg;base64,${result.segmentation_image}`}
                  alt="Segmentasi AI"
                  draggable={false}
                  className="w-full rounded-lg object-contain h-auto block select-none"
                />
              ) : (
                <img
                  ref={imageRef}
                  src={imagePreview}
                  alt="Original"
                  draggable={false}
                  className="w-full rounded-lg object-contain h-auto block select-none"
                />
              )}
              {showDoctorBoxes &&
                doctorBoxes.map((box, index) => {
                  const img = imageRef.current;

                  if (!img) return null; // 🔥 FIX NULL ERROR

                  const scaleX = img.clientWidth / img.naturalWidth;
                  const scaleY = img.clientHeight / img.naturalHeight;

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
              className="mt-2 text-sm text-red-500 underline"
            >
              Hapus Semua Segmentasi Dokter
            </button>

            <div className="flex gap-4 mt-4 text-sm font-medium justify-center text-slate-600">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-red-600 rounded-sm"></div>
                Area Suspect (Abnormal)
              </span>
            </div>
          </div>

          {/* INFO */}
          <div className="space-y-4">
            <p className="text-slate-600 mb-4 leading-relaxed">
              Sistem AI telah memindai citra X-Ray ini dan menandai area yang
              dicurigai memiliki kelainan (opacity, asimetri, atau perbedaan
              densitas).
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
                <p className={`font-bold ${getActionColor(risk)}`}>
                  {getAction(risk)}
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <label>
                <input
                  type="checkbox"
                  checked={showSegmentation}
                  onChange={() => setShowSegmentation(!showSegmentation)}
                />
                AI
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={showDoctorBoxes}
                  onChange={() => setShowDoctorBoxes(!showDoctorBoxes)}
                />
                Dokter
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
        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Temuan Klinis (AI)"
            content={result?.result?.findings || "-"}
          />

          <textarea
            placeholder="Catatan dokter..."
            className="w-full mt-4 p-3 border rounded-lg"
            value={doctorNotes.temuan}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, temuan: e.target.value })
            }
          />
        </div>

        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Kemungkinan Penyakit (AI)"
            content={result?.result?.abnormality || "-"}
          />

          <textarea
            placeholder="Catatan dokter..."
            className="w-full mt-4 p-3 border rounded-lg"
            value={doctorNotes.penyakit}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, penyakit: e.target.value })
            }
          />
        </div>
        <div className="bg-white p-6 rounded-xl border">
          <RiskCard
            percentage={result?.result?.risk || 0}
            factors={result?.result?.risk_factors}
          />

          <textarea
            placeholder="Catatan dokter..."
            className="w-full mt-4 p-3 border rounded-lg"
            value={doctorNotes.risiko}
            onChange={(e) =>
              setDoctorNotes({ ...doctorNotes, risiko: e.target.value })
            }
          />
        </div>
        <div className="bg-white p-6 rounded-xl border">
          <ResultCard
            title="Rekomendasi Pengobatan (AI)"
            content={`Approach: ${
              result?.result?.recommendation?.approach || "-"
            }\nTreatment: ${result?.result?.recommendation?.treatment || "-"}`}
          />

          <textarea
            placeholder="Catatan dokter..."
            className="w-full mt-4 p-3 border rounded-lg"
            value={doctorNotes.rekomendasi}
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
          className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg shadow-sm"
        >
          <RotateCcw size={18} /> Diagnosis Ulang
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-sm"
          disabled={exporting}
        >
          <Download size={18} />
          {exporting ? "Exporting..." : "Export to PDF"}
        </button>
      </div>
    </div>
  );
}
