import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Activity, Download, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf'; // Import jsPDF

// ===== DATA DUMMY DATABASE PASIEN (Diperlengkap untuk PDF) =====
const dummyDatabase = {
  "P-001": {
    name: "Budi Santoso", age: 45, gender: "Laki-laki", bloodType: "O+",
    history:[
      {
        id: "IMG-01", type: "X-Ray Paru", date: "10 Apr 2026",
        imgUrl: "https://images.unsplash.com/photo-1559706164-c15b15b3d681?q=80&w=400&auto=format&fit=crop", 
        findings: "Terdapat indikasi infiltrat pada lobus kanan bawah.",
        conclusion: "Suspect Pneumonia ringan.",
        // Data full untuk dicetak ke PDF
        fullData: {
          ai_metadata: { age: 45.0, gender: "Laki-laki", view: "PA", ctr_ratio: 0.48, pneumonia_status: "Terdeteksi Pneumonia", pneumonia_confidence: "92.5%" },
          result: {
            analysis: { findings: "Terdapat pola konsolidasi pada lobus paru kanan bawah.", potential_abnormalities: "Infiltrat paru, suspect Pneumonia", observations: "Tampak perselubungan homogen di hemithorax dextra bawah." },
            risk_assessment: { overall_health_risk_percentage: 78, assessment_explanation: "Risiko cukup tinggi karena infeksi aktif." },
            treatment_recommendations: { general_approach: "Terapi antibiotik empiris.", possible_treatments: "Levofloxacin / Amoxicillin.", follow_up: "Rontgen ulang 7 hari." },
            recommendations: "Konsultasikan dengan Dokter Spesialis Paru."
          }
        }
      },
      {
        id: "IMG-02", type: "CT Scan Kepala", date: "15 Jan 2026",
        imgUrl: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=400&auto=format&fit=crop",
        findings: "Tidak ditemukan pendarahan intrakranial. Struktur otak normal.",
        conclusion: "Normal CT Scan Kepala.",
        fullData: {
          ai_metadata: null,
          result: {
            analysis: { findings: "Sulci dan gyri tampak normal. Sistem ventrikel tidak melebar.", potential_abnormalities: "Tidak ada kelainan.", observations: "Struktur otak dalam batas normal." },
            risk_assessment: { overall_health_risk_percentage: 10, assessment_explanation: "Risiko rendah, tidak ada kondisi gawat darurat." },
            treatment_recommendations: { general_approach: "Observasi.", possible_treatments: "Tidak butuh obat spesifik.", follow_up: "Sesuai gejala klinis." },
            recommendations: "Pasien dalam kondisi sehat secara neurologis."
          }
        }
      }
    ]
  }
};

// Fungsi bantuan untuk mengubah URL gambar menjadi Base64 (Syarat wajib untuk jsPDF)
const getBase64FromUrl = async (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null); // Lewati jika gagal (CORS)
    img.src = url;
  });
};

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [isDownloading, setIsDownloading] = useState(false);

  const patient = dummyDatabase[id];

  if (!patient) {
    return <div className="min-h-screen flex items-center justify-center bg-sky-50"><h2 className="text-2xl font-bold text-slate-600">Pasien tidak ditemukan</h2></div>;
  }

  const filteredHistory = activeTab === 'all' ? patient.history : patient.history.filter(record => record.type.toLowerCase().includes(activeTab));

  // ===== FUNGSI DOWNLOAD PDF GABUNGAN =====
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    const toastId = toast.loading("Menyusun Laporan PDF...");

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - 2 * margin;

      let yPos = 20;

      // Fungsi bantuan menulis teks berparagraf
      const addWrappedText = (text, options = {}) => {
        const { isBold = false, fontSize = 11, color =[0, 0, 0], spacing = 5 } = options;
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);

        const lines = doc.splitTextToSize(text, usableWidth);
        lines.forEach((line) => {
          if (yPos > pageHeight - margin) { doc.addPage(); yPos = margin; }
          doc.text(line, margin, yPos);
          yPos += 6;
        });
        yPos += spacing;
      };

      // HALAMAN 1: IDENTITAS PASIEN
      doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("RESUME REKAM MEDIS RADIOLOGI", pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text("Sistem AI Biomedic Read", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      doc.setDrawColor(180); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 8;
      
      const labelX = margin; const colonX = margin + 35; const valueX = margin + 40;
      doc.text("ID Pasien", labelX, yPos); doc.text(":", colonX, yPos); doc.text(id, valueX, yPos); yPos += 6;
      doc.text("Nama Pasien", labelX, yPos); doc.text(":", colonX, yPos); doc.setFont("helvetica", "bold"); doc.text(patient.name, valueX, yPos); doc.setFont("helvetica", "normal"); yPos += 6;
      doc.text("Umur / Gender", labelX, yPos); doc.text(":", colonX, yPos); doc.text(`${patient.age} Tahun / ${patient.gender}`, valueX, yPos); yPos += 6;
      doc.text("Gol. Darah", labelX, yPos); doc.text(":", colonX, yPos); doc.text(patient.bloodType, valueX, yPos); yPos += 6;
      doc.text("Total Riwayat", labelX, yPos); doc.text(":", colonX, yPos); doc.text(`${patient.history.length} Pemeriksaan`, valueX, yPos); yPos += 8;
      
      doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 15;

      // LOOPING UNTUK SETIAP RIWAYAT GAMBAR
      for (let i = 0; i < patient.history.length; i++) {
        const record = patient.history[i];
        
        // Mulai riwayat baru di halaman baru (Kecuali riwayat pertama yg muat di Hal 1)
        if (i > 0) {
            doc.addPage();
            yPos = 20;
        }

        // Judul Riwayat
        doc.setFillColor(240, 248, 255); // Warna blok biru muda
        doc.rect(margin, yPos - 5, usableWidth, 10, 'F');
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 0, 200);
        doc.text(`Pemeriksaan #${i+1}: ${record.type} (${record.date})`, margin + 2, yPos + 2);
        yPos += 15;
        doc.setTextColor(0, 0, 0);

        // Ambil dan Masukkan Gambar (Tunggu sampai ter-download via internet)
        const base64Img = await getBase64FromUrl(record.imgUrl);
        if (base64Img) {
            const imgProps = doc.getImageProperties(base64Img);
            const maxW = 100; const maxH = 70;
            let finalW = maxW; let finalH = (imgProps.height * finalW) / imgProps.width;
            if (finalH > maxH) { finalH = maxH; finalW = (imgProps.width * finalH) / imgProps.height; }
            
            const xImg = (pageWidth - finalW) / 2;
            doc.addImage(base64Img, 'JPEG', xImg, yPos, finalW, finalH);
            yPos += finalH + 10;
        } else {
            addWrappedText("[Gambar tidak dapat dimuat]", { color: [150,0,0], isBold: true });
        }

        // Tulis Data Analisis
        if(record.fullData) {
            const fd = record.fullData;
            
            if(fd.ai_metadata) {
                addWrappedText("▶ Profiling AI (Hugging Face):", { isBold: true });
                addWrappedText(`Umur Prediksi: ${fd.ai_metadata.age} | Gender: ${fd.ai_metadata.gender} | Posisi: ${fd.ai_metadata.view}`, { fontSize: 10 });
                addWrappedText(`Status Pneumonia: ${fd.ai_metadata.pneumonia_status} (${fd.ai_metadata.pneumonia_confidence})`, { fontSize: 10, color:[200,0,0] });
                yPos += 5;
            }

            const res = fd.result;
            addWrappedText("▶ Hasil Diagnosis Klinis:", { isBold: true });
            addWrappedText("Temuan:", { isBold: true, fontSize: 10 }); addWrappedText(res.analysis.findings, { fontSize: 10 });
            addWrappedText("Potensi Kelainan:", { isBold: true, fontSize: 10 }); addWrappedText(res.analysis.potential_abnormalities, { fontSize: 10 });
            
            addWrappedText(`Tingkat Risiko: ${res.risk_assessment.overall_health_risk_percentage}%`, { isBold: true, fontSize: 10, color:[200,100,0] });
            addWrappedText(res.risk_assessment.assessment_explanation, { fontSize: 10 });

            addWrappedText("Rekomendasi Pengobatan:", { isBold: true, fontSize: 10 }); 
            addWrappedText(res.treatment_recommendations.general_approach, { fontSize: 10 });
            addWrappedText(res.treatment_recommendations.possible_treatments, { fontSize: 10 });
            yPos += 5;
        } else {
            addWrappedText("Temuan Singkat:", { isBold: true });
            addWrappedText(record.findings);
            addWrappedText("Kesimpulan:", { isBold: true });
            addWrappedText(record.conclusion);
        }
      }

      // Footer
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text("Laporan ini dihasilkan secara otomatis oleh Biomedic Read AI.", margin, pageHeight - 10);

      // Simpan File
      doc.save(`Resume_Medis_${patient.name.replace(/\s+/g, '_')}_${id}.pdf`);
      
      toast.success("PDF berhasil diunduh!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Gagal membuat PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto px-6 py-12">
      
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-600 font-medium hover:underline mb-6">
        <ArrowLeft size={18} /> Kembali ke Daftar Pasien
      </button>

      {/* HEADER PROFIL PASIEN */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div className="flex gap-6 items-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
            {patient.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{patient.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-slate-600 font-medium">
              <span className="flex items-center gap-1"><User size={16}/> {patient.age} Tahun ({patient.gender})</span>
              <span className="flex items-center gap-1"><Activity size={16}/> Gol. Darah: {patient.bloodType}</span>
              <span className="flex items-center gap-1"><Calendar size={16}/> ID: {id}</span>
            </div>
          </div>
        </div>
        
        {/* TOMBOL DOWNLOAD GABUNGAN */}
        <button 
          onClick={handleDownloadPDF} 
          disabled={isDownloading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm disabled:bg-slate-400"
        >
          <Download size={18} /> {isDownloading ? "Menyusun PDF..." : "Download Resume Medis (PDF)"}
        </button>
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'all', label: 'Semua Kategori' }, { id: 'xray', label: 'X-Ray' }, { id: 'mri', label: 'MRI' }, { id: 'ct', label: 'CT Scan' }, { id: 'ultrasound', label: 'Ultrasound' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab.label}</button>
        ))}
      </div>

      <div className="space-y-6">
        {filteredHistory.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl border border-slate-200 border-dashed text-slate-500"><ImageIcon className="mx-auto mb-3 text-slate-300" size={48} /><p>Tidak ada data gambar medis untuk kategori ini.</p></div>
        ) : (
          filteredHistory.map((record, index) => (
            <div key={index} onClick={() => navigate(`/record/${record.id}`)} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-full md:w-1/3 bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                <img src={record.imgUrl} alt="Medical Scan" className="max-h-64 object-contain rounded-lg group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="w-full md:w-2/3 p-6 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-4">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{record.type}</span>
                  <span className="text-slate-500 text-sm flex items-center gap-1"><Calendar size={14}/> {record.date}</span>
                </div>
                <h3 className="text-slate-800 font-bold mb-1">Temuan Utama:</h3>
                <p className="text-slate-600 mb-4">{record.findings}</p>
                <h3 className="text-slate-800 font-bold mb-1">Kesimpulan AI:</h3>
                <p className="text-indigo-600 font-semibold bg-indigo-50 p-3 rounded-lg border border-indigo-100 inline-block w-fit">{record.conclusion}</p>
                <p className="text-blue-500 text-sm font-medium mt-4 group-hover:underline">Klik untuk melihat detail analisis AI lengkap &rarr;</p>
              </div>
            </div>
          ))
        )}
      </div>

    </motion.div>
  );
}