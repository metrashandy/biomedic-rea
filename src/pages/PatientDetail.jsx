import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Calendar,
  Activity,
  Download,
  Image as ImageIcon,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Header from "../components/Header";

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

// ===== DATA DUMMY (MENGGUNAKAN GAMBAR LOKAL) =====
const dummyDatabase = {
  "P-001": {
    name: "Budi Santoso",
    age: 45,
    gender: "Laki-laki",
    bloodType: "O+",
    history: [
      {
        id: "IMG-01",
        type: "X-Ray",
        date: "10 Apr 2026",
        imgUrl: "/dummy-xray.jpg", // <--- PANGGIL GAMBAR LOKAL DARI FOLDER PUBLIC
        findings:
          "Tampak perselubungan homogen (opasitas) di lapang bawah paru kanan yang mengaburkan batas hemidiafragma kanan.",
        conclusion: "Klinis mendukung diagnosis Pneumonia Lobaris Dextra.",
        fullData: {
          result: {
            findings:
              "Tampak perselubungan homogen (opasitas) di lapang bawah paru kanan yang mengaburkan batas hemidiafragma kanan. Corakan bronkovaskular paru kiri dalam batas normal. Sinus kostofrenikus kiri lancip, kanan tumpul. Jantung tidak membesar (CTR < 50%). Tulang-tulang intak, tidak tampak fraktur maupun lesi litik/sklerotik. Jaringan lunak dinding dada kesan baik.",
            abnormality:
              "Berdasarkan temuan radiologis, opasitas pada lobus inferior dextra sangat mengindikasikan proses konsolidasi aktif, sangat mendukung diagnosis Pneumonia lobaris. Terdapat juga suspek efusi pleura minimal di sisi kanan yang ditandai dengan tumpulnya sinus kostofrenikus.",
            risk: 85,
            bboxes: [
              { x: 0.15, y: 0.55, width: 0.25, height: 0.3 },
              { x: 0.2, y: 0.8, width: 0.15, height: 0.1 },
            ],
            recommendation: {
              approach:
                "Pasien memerlukan observasi klinis ketat (evaluasi saturasi oksigen, frekuensi napas) dan terapi empiris sesegera mungkin untuk mencegah progresivitas infeksi dan sepsis.",
              treatment:
                "1. Pemberian antibiotik intravena spektrum luas (misal: Ceftriaxone 1x2g atau Levofloxacin 1x750mg).\n2. Terapi suportif Oksigen nasal kanul 2-4 lpm jika SpO2 < 92%.\n3. Cek laboratorium darah lengkap (Leukosit, CRP, LED) dan kultur sputum.\n4. Evaluasi foto thorax ulang 7-14 hari pasca terapi awal.",
            },
            disclaimer:
              "Analisis ini disediakan oleh sistem AI Biomedic Read berdasarkan model Segmentasi dan Bounding Box. Keputusan klinis akhir mutlak berada di tangan DPJP.",
          },
        },
      },
      {
        id: "IMG-02",
        type: "EEG",
        date: "15 Jan 2026",
        imgUrl: "/dummy-xray.jpg", // <--- PANGGIL GAMBAR LOKAL JUGA
        findings:
          "Intensitas sinyal parenkim otak normal. Sulci dan gyri baik.",
        conclusion: "Normal MRI Brain.",
        fullData: {
          result: {
            findings:
              "Parenkim otak menunjukkan intensitas sinyal yang normal pada sekuens T1 dan T2. Tidak tampak area iskemik akut, perdarahan, maupun massa (Space Occupying Lesion).",
            abnormality:
              "Tidak ada tanda-ata kelainan struktural akut maupun kronis pada area intrakranial.",
            risk: 10,
            bboxes: [],
            recommendation: {
              approach: "Edukasi pasien dan observasi klinis lanjutan.",
              treatment:
                "Tidak diperlukan intervensi medis spesifik maupun tindakan bedah saat ini.",
            },
            disclaimer:
              "Analisis ini disediakan oleh sistem AI Biomedic Read. Keputusan klinis akhir mutlak berada di tangan DPJP.",
          },
        },
      },
    ],
  },
};

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

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Semua Kategori");
  const [isDownloading, setIsDownloading] = useState(false);

  const patient = dummyDatabase[id];
  if (!patient)
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <h2 className="text-2xl font-bold text-slate-600">
          Pasien tidak ditemukan
        </h2>
      </div>
    );

  const filteredHistory =
    activeCategory === "Semua Kategori"
      ? patient.history
      : patient.history.filter((record) => record.type === activeCategory);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    const toastId = toast.loading("Menyusun Laporan PDF Gabungan...");

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

      for (let i = 0; i < patient.history.length; i++) {
        const record = patient.history[i];
        if (i > 0) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
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
        doc.text("Informasi Umum & Identitas", margin, yPos);
        yPos += 6;
        doc.setDrawColor(200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;

        const labelX = margin;
        const colonX = margin + 35;
        const valueX = margin + 40;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("ID Pasien", labelX, yPos);
        doc.text(":", colonX, yPos);
        doc.text(id, valueX, yPos);
        yPos += 6;
        doc.text("Nama Pasien", labelX, yPos);
        doc.text(":", colonX, yPos);
        doc.text(patient.name, valueX, yPos);
        yPos += 6;
        doc.text("Jenis Pemeriksaan", labelX, yPos);
        doc.text(":", colonX, yPos);
        doc.text(record.type, valueX, yPos);
        yPos += 6;
        doc.text("Tanggal Pemindaian", labelX, yPos);
        doc.text(":", colonX, yPos);
        doc.text(record.date, valueX, yPos);
        yPos += 8;
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 15;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Citra Medis (Segmentasi AI)", margin, yPos);
        yPos += 6;

        // LOAD GAMBAR KE PDF
        const base64Img = await getBase64FromUrl(record.imgUrl);
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
          addWrappedText("[Gambar Tidak Tersedia / Gagal Dimuat dari Server]", {
            isBold: true,
            color: [200, 0, 0],
          });
        }

        if (record.fullData && record.fullData.result) {
          const res = record.fullData.result;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text("Medical Analysis", margin, yPos);
          yPos += 6;
          doc.setDrawColor(220);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;

          addWrappedText("1. Temuan", { isBold: true, fontSize: 12 });
          addWrappedText(res.findings || "-", { fontSize: 10 });

          addWrappedText("2. Potensi Kelainan", { isBold: true, fontSize: 12 });
          addWrappedText(res.abnormality || "-", { fontSize: 10 });

          addWrappedText("3. Tingkat Risiko", { isBold: true, fontSize: 12 });
          addWrappedText(`Overall Risk : ${res.risk || 0}%`, { fontSize: 10 });

          addWrappedText("4. Rekomendasi Pengobatan", {
            isBold: true,
            fontSize: 12,
          });
          addWrappedText(`Approach: ${res.recommendation?.approach || "-"}`, {
            fontSize: 10,
          });
          addWrappedText(`Treatment: ${res.recommendation?.treatment || "-"}`, {
            fontSize: 10,
          });

          addWrappedText("5. Disclaimer", { isBold: true, fontSize: 12 });
          addWrappedText(res.disclaimer || "Hasil AI. Butuh validasi dokter.", {
            fontSize: 9,
            color: [100, 100, 100],
          });
        }
      }

      doc.save(`Resume_Medis_${patient.name.replace(/\s+/g, "_")}_${id}.pdf`);
      toast.success("PDF Gabungan berhasil diunduh!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Gagal membuat PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50">
      {/* ===== TAMBAHKAN HEADER DI SINI ===== */}
      <Header showBack={true} onBack={() => navigate("/patients")} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-6 py-12"
      >
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between xl:items-center mb-8 gap-6">
          <div className="flex gap-6 items-center">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                {patient.name}
              </h1>
              <div className="flex flex-wrap gap-4 mt-2 text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <User size={16} /> {patient.age} Tahun ({patient.gender})
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={16} /> Gol. Darah: {patient.bloodType}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={16} /> ID: {id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
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

            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:bg-slate-400 w-full md:w-auto whitespace-nowrap"
            >
              <Download size={18} />{" "}
              {isDownloading ? "Menyusun PDF..." : "Resume PDF"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {filteredHistory.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-2xl border border-slate-200 border-dashed text-slate-500">
              <ImageIcon className="mx-auto mb-3 text-slate-300" size={48} />
              <p>
                Tidak ada data gambar <b>{activeCategory}</b> untuk pasien ini.
              </p>
            </div>
          ) : (
            filteredHistory.map((record, index) => (
              <div
                key={index}
                onClick={() => navigate(`/record/${record.id}`)}
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
                    Temuan Utama:
                  </h3>
                  <p className="text-slate-600 mb-4">{record.findings}</p>
                  <h3 className="text-slate-800 font-bold mb-1">
                    Kesimpulan Klinis:
                  </h3>
                  <p className="text-indigo-600 font-semibold bg-indigo-50 p-3 rounded-lg border border-indigo-100 inline-block w-fit">
                    {record.conclusion}
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
