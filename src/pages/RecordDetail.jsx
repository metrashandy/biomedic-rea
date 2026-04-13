import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  Activity,
  Pill,
  User,
  Scan,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import toast from "react-hot-toast";

const getBase64FromUrl = async (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = () => {
      console.warn("Gambar gagal dimuat untuk PDF");
      resolve(null);
    };
    img.src = url;
  });
};

export default function RecordDetail() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  // ===== DATA DUMMY (MENGGUNAKAN GAMBAR LOKAL) =====
  const mockSavedData = {
    patientName: "Budi Santoso",
    date: "10 Apr 2026",
    type: "X-Ray",
    original_image: "/dummy-xray.jpg", // <--- GAMBAR LOKAL DI FOLDER PUBLIC
    result: {
      findings:
        "Tampak perselubungan homogen (opasitas) di lapang bawah paru kanan yang mengaburkan batas hemidiafragma kanan. Corakan bronkovaskular paru kiri dalam batas normal. Sinus kostofrenikus kiri lancip, kanan tumpul. Jantung tidak membesar (CTR < 50%). Tulang-tulang intak, tidak tampak fraktur.",
      abnormality:
        "Berdasarkan temuan radiologis, opasitas pada lobus inferior dextra sangat mengindikasikan proses konsolidasi aktif, sangat mendukung diagnosis Pneumonia lobaris.",
      risk: 85,
      bboxes: [
        { x: 0.15, y: 0.55, width: 0.25, height: 0.3 },
        { x: 0.2, y: 0.8, width: 0.15, height: 0.1 },
      ],
      recommendation: {
        approach:
          "Pasien memerlukan observasi klinis ketat (evaluasi saturasi oksigen) dan terapi empiris sesegera mungkin.",
        treatment:
          "1. Pemberian antibiotik intravena spektrum luas (Levofloxacin).\n2. Terapi suportif O2 nasal kanul jika SpO2 < 92%.\n3. Cek lab darah lengkap.",
      },
      disclaimer:
        "Analisis ini disediakan oleh sistem AI Biomedic Read berdasarkan model Segmentasi dan Bounding Box. Keputusan klinis akhir mutlak berada di tangan DPJP.",
    },
  };

  const result = mockSavedData;

  const handleExportPDF = async () => {
    setExporting(true);
    const toastId = toast.loading("Menyusun PDF...");

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - 2 * margin;
      let yPos = 20;

      const addWrappedText = (text, options = {}) => {
        const {
          isBold = false,
          fontSize = 11,
          color = [0, 0, 0],
          spacing = 5,
        } = options;
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, usableWidth);
        lines.forEach((line) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin + 10;
          }
          doc.text(line, margin, yPos);
          yPos += 6;
        });
        yPos += spacing;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LAPORAN RADIOLOGI MEDIS", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 6;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Sistem AI Biomedic Read", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 15;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Informasi Pemeriksaan", margin, yPos);
      yPos += 6;
      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      const labelX = margin;
      const colonX = margin + 35;
      const valueX = margin + 40;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Nama Pasien", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(result.patientName, valueX, yPos);
      yPos += 6;
      doc.text("Record ID", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(recordId, valueX, yPos);
      yPos += 6;
      doc.text("Pemeriksaan", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(result.type, valueX, yPos);
      yPos += 6;
      doc.text("Tanggal", labelX, yPos);
      doc.text(":", colonX, yPos);
      doc.text(result.date, valueX, yPos);
      yPos += 8;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Citra X-Ray (Segmentasi AI)", margin, yPos);
      yPos += 6;

      const base64Img = await getBase64FromUrl(result.original_image);

      if (base64Img) {
        const imgProps = doc.getImageProperties(base64Img);
        const maxW = 120;
        const maxH = 80;
        let finalW = maxW;
        let finalH = (imgProps.height * finalW) / imgProps.width;
        if (finalH > maxH) {
          finalH = maxH;
          finalW = (imgProps.width * finalH) / imgProps.height;
        }
        const xImg = (pageWidth - finalW) / 2;
        doc.addImage(base64Img, "JPEG", xImg, yPos, finalW, finalH);
        yPos += finalH + 15;
      } else {
        addWrappedText("[Gambar Tidak Tersedia / Gagal Dimuat]", {
          isBold: true,
          color: [200, 0, 0],
        });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Medical Analysis", margin, yPos);
      yPos += 6;
      doc.setDrawColor(220);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      addWrappedText("1. Temuan", { isBold: true, fontSize: 12 });
      addWrappedText(result.result.findings || "-", { fontSize: 10 });

      addWrappedText("2. Potensi Kelainan", { isBold: true, fontSize: 12 });
      addWrappedText(result.result.abnormality || "-", { fontSize: 10 });

      addWrappedText("3. Tingkat Risiko", { isBold: true, fontSize: 12 });
      addWrappedText(`Overall Risk : ${result.result.risk || 0}%`, {
        fontSize: 10,
      });

      addWrappedText("4. Rekomendasi Pengobatan", {
        isBold: true,
        fontSize: 12,
      });
      addWrappedText(
        `Approach: ${result.result.recommendation?.approach || "-"}`,
        { fontSize: 10 },
      );
      addWrappedText(
        `Treatment: ${result.result.recommendation?.treatment || "-"}`,
        { fontSize: 10 },
      );

      addWrappedText("5. Disclaimer", { isBold: true, fontSize: 12 });
      addWrappedText(result.result.disclaimer || "-", {
        fontSize: 9,
        color: [100, 100, 100],
      });

      doc.save(`Laporan_${recordId}.pdf`);
      toast.success("PDF berhasil diunduh!", { id: toastId });
    } catch (e) {
      toast.error("Gagal membuat PDF", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-6 py-12"
    >
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-600 font-medium hover:underline mb-6"
      >
        <ArrowLeft size={18} /> Kembali ke Profil Pasien
      </button>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Detail Rekam Medis: {recordId}
          </h1>
          <p className="text-slate-500">
            Pasien:{" "}
            <span className="font-semibold text-slate-700">
              {result.patientName}
            </span>{" "}
            • Tanggal: {result.date}
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-300"
        >
          <Download size={18} />{" "}
          {exporting ? "Menyusun PDF..." : "Download Laporan"}
        </button>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
          <Scan className="text-blue-500" /> Deteksi Visual AI (OpenAI Vision)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <div className="bg-slate-900 rounded-xl p-2 flex justify-center">
              <img
                src={result.original_image}
                alt="Medical Scan"
                className="max-h-80 rounded-lg object-contain"
              />
            </div>
            <div className="flex gap-4 mt-4 text-sm font-medium justify-center text-slate-600">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-red-600 rounded-sm"></div>{" "}
                Area Suspect (Abnormal)
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-slate-600 mb-4 leading-relaxed">
              Sistem AI telah memindai citra ini dan menandai area yang
              dicurigai memiliki kelainan (opacity, asimetri, atau perbedaan
              densitas) dengan kotak merah.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Scan size={14} /> Area Terdeteksi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {result.result.bboxes.length} Region
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <AlertTriangle size={14} /> Status Visual
                </span>
                <p
                  className={`font-bold text-lg mt-1 ${result.result.bboxes.length > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {result.result.bboxes.length > 0
                    ? "Suspect Abnormal"
                    : "Tampak Bersih"}
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Activity size={14} /> Pola Distribusi
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  {result.result.bboxes.length > 1
                    ? "Multifokal (Menyebar)"
                    : result.result.bboxes.length === 1
                      ? "Fokal"
                      : "Tidak Ada"}
                </p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <User size={14} /> Tindak Lanjut
                </span>
                <p className="font-bold text-lg text-slate-800 mt-1">
                  Validasi Radiolog
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResultCard
          icon={<FileText />}
          title="Temuan Klinis"
          content={result.result.findings}
        />
        <ResultCard
          icon={<AlertTriangle className="text-orange-500" />}
          title="Potensi Kelainan"
          content={result.result.abnormality}
        />
        <RiskCard percentage={result.result.risk} />
        <ResultCard
          icon={<Pill className="text-green-500" />}
          title="Rekomendasi Pengobatan"
          content={`Approach: ${result.result.recommendation.approach}\nTreatment: ${result.result.recommendation.treatment}`}
        />
        <div className="md:col-span-2">
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <span className="font-bold">Disclaimer:</span>{" "}
              {result.result.disclaimer || "Hasil AI. Butuh validasi dokter."}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const ResultCard = ({ icon, title, content }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
    <div className="flex items-center gap-3 mb-3">
      {icon}
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
    </div>
    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
      {content}
    </p>
  </div>
);
const RiskCard = ({ percentage }) => {
  const safePercentage = Number(percentage) || 0;
  const riskColor =
    safePercentage > 70
      ? "bg-red-500"
      : safePercentage > 40
        ? "bg-yellow-500"
        : "bg-green-500";
  const riskTextColor =
    safePercentage > 70
      ? "text-red-600"
      : safePercentage > 40
        ? "text-yellow-600"
        : "text-green-600";
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
      <div className="flex items-center gap-3 mb-3">
        <Activity />
        <h3 className="text-xl font-bold text-slate-800">Tingkat Risiko</h3>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-5 my-2">
        <div
          className={`${riskColor} h-5 rounded-full`}
          style={{ width: `${safePercentage}%` }}
        ></div>
      </div>
      <p className={`mt-2 font-bold text-2xl ${riskTextColor}`}>
        {safePercentage}%
      </p>
    </div>
  );
};
