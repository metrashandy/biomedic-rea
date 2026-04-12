import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle, Activity, Pill, User, Scan, Maximize, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RecordDetail() {
  const { recordId } = useParams();
  const navigate = useNavigate();

  // ===== DATA DUMMY MASA LALU (Seolah-olah ini data JSON yang tersimpan di Database) =====
  const mockSavedData = {
    patientName: "Budi Santoso",
    date: "10 Apr 2026",
    type: "X-Ray Paru",
    segmentation_image: null, // Asumsikan ini base64 dari database (kita kosongkan biar pakai fallback kotak abu-abu atau gambar asli)
    original_image: "https://images.unsplash.com/photo-1559706164-c15b15b3d681?q=80&w=400&auto=format&fit=crop",
    ai_metadata: {
      age: 45.0, gender: "Laki-laki", view: "PA", ctr_ratio: 0.48,
      pneumonia_status: "Terdeteksi Pneumonia", pneumonia_confidence: "92.5%"
    },
    result: {
      analysis: {
        findings: "Terdapat pola konsolidasi pada lobus paru kanan bawah. Batas jantung normal, tidak tampak kardiomegali.",
        potential_abnormalities: "Infiltrat paru, suspect Pneumonia",
        observations: "Tampak perselubungan homogen di hemithorax dextra bawah."
      },
      risk_assessment: {
        overall_health_risk_percentage: 78,
        assessment_explanation: "Risiko cukup tinggi karena infeksi aktif pada paru-paru yang mengganggu fungsi pernapasan."
      },
      technical_assessment: { positioning: "Simetris (Good)", exposure: "Normal", artifacts: "None" },
      specific_response: "Gambaran radiologi sangat mendukung adanya infeksi paru (Pneumonia).",
      treatment_recommendations: {
        general_approach: "Terapi antibiotik empiris dan rawat inap jika sesak memburuk.",
        possible_treatments: "Antibiotik spektrum luas (misal: Levofloxacin atau Amoxicillin-Clavulanate), Oksigenasi.",
        follow_up: "Rontgen ulang 7-14 hari pasca terapi."
      },
      recommendations: "Segera konsultasikan dengan Dokter Spesialis Paru (Sp.P) untuk tatalaksana lebih lanjut.",
      disclaimer: "Laporan ini dihasilkan oleh sistem AI dan harus divalidasi oleh dokter radiologi."
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto px-6 py-12">
      
      {/* HEADER KEMBALI */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-600 font-medium hover:underline mb-6">
        <ArrowLeft size={18} /> Kembali ke Profil Pasien
      </button>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Detail Rekam Medis: {recordId}</h1>
          <p className="text-slate-500">Pasien: <span className="font-semibold text-slate-700">{mockSavedData.patientName}</span> • Tanggal: {mockSavedData.date}</p>
        </div>
        <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-300">
          <Download size={18} /> Download Laporan Ini
        </button>
      </div>

      {/* ===== BAGIAN PROFILING AI (Sama persis dengan halaman AI) ===== */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
          <Scan className="text-blue-500" /> Hasil Profiling & Segmentasi AI
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* KIRI: GAMBAR */}
          <div>
            <div className="bg-slate-900 rounded-xl p-2 flex justify-center">
              <img src={mockSavedData.original_image} alt="Medical Scan" className="max-h-80 rounded-lg object-contain" />
            </div>
          </div>

          {/* KANAN: METADATA */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1"><User size={14}/> Umur AI</span>
                <p className="font-bold text-lg text-slate-800">{mockSavedData.ai_metadata.age} Thn</p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1"><User size={14}/> Gender AI</span>
                <p className="font-bold text-lg text-slate-800">{mockSavedData.ai_metadata.gender}</p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1"><Maximize size={14}/> Posisi X-Ray</span>
                <p className="font-bold text-lg text-slate-800">{mockSavedData.ai_metadata.view}</p>
              </div>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-slate-500 text-sm flex items-center gap-1"><Activity size={14}/> Rasio CTR</span>
                <p className="font-bold text-lg text-slate-800">{mockSavedData.ai_metadata.ctr_ratio}</p>
              </div>
              
              <div className="col-span-2 bg-indigo-50 p-5 rounded-xl border border-indigo-200 shadow-sm mt-2">
                <span className="text-indigo-600 text-sm flex items-center gap-1 font-semibold mb-1">
                  <Scan size={16}/> Status Pneumonia (AI)
                </span>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-xl text-red-600">{mockSavedData.ai_metadata.pneumonia_status}</p>
                  <p className="font-bold text-lg text-slate-800">{mockSavedData.ai_metadata.pneumonia_confidence}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BAGIAN DETAIL KLINIS (Sama persis dengan halaman AI) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResultCard icon={<FileText />} title="Temuan Klinis" content={mockSavedData.result.analysis.findings} />
        <ResultCard icon={<AlertTriangle className="text-orange-500" />} title="Potensi Kelainan" content={mockSavedData.result.analysis.potential_abnormalities} />
        <RiskCard percentage={mockSavedData.result.risk_assessment.overall_health_risk_percentage} />
        <ResultCard icon={<Pill className="text-green-500" />} title="Rekomendasi Pengobatan" content={`Approach: ${mockSavedData.result.treatment_recommendations.general_approach}\nTreatment: ${mockSavedData.result.treatment_recommendations.possible_treatments}`} />
        <div className="md:col-span-2">
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800"><span className="font-bold">Disclaimer:</span> {mockSavedData.result.disclaimer}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Komponen Reusable
const ResultCard = ({ icon, title, content }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border h-full"><div className="flex items-center gap-3 mb-3">{icon}<h3 className="text-xl font-bold text-slate-800">{title}</h3></div><p className="text-slate-700 leading-relaxed whitespace-pre-line">{content}</p></div>
);
const RiskCard = ({ percentage }) => {
  const riskColor = percentage > 70 ? "bg-red-500" : percentage > 40 ? "bg-yellow-500" : "bg-green-500";
  const riskTextColor = percentage > 70 ? "text-red-600" : percentage > 40 ? "text-yellow-600" : "text-green-600";
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full"><div className="flex items-center gap-3 mb-3"><Activity /><h3 className="text-xl font-bold text-slate-800">Tingkat Risiko</h3></div><div className="w-full bg-slate-200 rounded-full h-5 my-2"><div className={`${riskColor} h-5 rounded-full`} style={{ width: `${percentage}%` }}></div></div><p className={`mt-2 font-bold text-2xl ${riskTextColor}`}>{percentage}%</p></div>
  );
};