import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import jsPDF from "jspdf";
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  Activity,
  Pill,
  RotateCcw,
  Download,
} from "lucide-react";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (result) {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [result]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/dicom": [] },
    multiple: false,
  });

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setResult(null);

    // 1. Siapkan FormData (karena backend butuh multipart/form-data)
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("symptoms", symptoms);

    try {
      // 2. Kirim ke API sungguhan
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // 3. Terima response JSON dari backend
      const data = await response.json();

      // 4. Update state result dengan data asli dari server
      setResult(data);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      alert(
        "Gagal terhubung ke server. Pastikan backend Python sudah berjalan!",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===== FUNGSI EXPORT PDF YANG SUDAH DIPERBAIKI =====
  const handleExportPDF = () => {
    if (!result || !selectedFile) return;
    setExporting(true);

    const doc = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight(); // Ambil tinggi kertas
    const usableWidth = pageWidth - 2 * margin;
    let yPos = 20;

    // Fungsi cerdas untuk menulis teks: bisa otomatis bikin halaman baru kalau teks kepanjangan
    const addWrappedText = (
      text,
      isBold = false,
      fontSize = 11,
      textColor = [0, 0, 0],
    ) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const lines = doc.splitTextToSize(text, usableWidth);
      const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor; // Tinggi tiap baris
      const blockHeight = lines.length * lineHeight;

      // Cek apakah posisi Y saat ini + teks baru akan melebihi batas bawah kertas
      if (yPos + blockHeight > pageHeight - margin) {
        doc.addPage(); // Bikin halaman baru
        yPos = margin + 10; // Reset posisi Y di halaman baru
      }

      doc.text(lines, margin, yPos);
      yPos += blockHeight + 5; // Spasi setelah paragraf
    };

    // 1. Judul Dokumen
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(
      "Laporan Analisis Radiologi - Biomedic Read",
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    yPos += 15;

    // 2. Gambar (Diperkecil dan ditaruh di tengah)
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = () => {
      const base64Image = reader.result;
      const imgProps = doc.getImageProperties(base64Image);

      // Batasi ukuran maksimal gambar agar tidak memenuhi kertas
      const maxImgWidth = 110; // Maksimal lebar 11cm
      const maxImgHeight = 80; // Maksimal tinggi 8cm
      let finalImgWidth = imgProps.width;
      let finalImgHeight = imgProps.height;

      // Logika untuk resize gambar tapi tetap proporsional (aspect ratio)
      if (finalImgWidth > maxImgWidth) {
        const ratio = maxImgWidth / finalImgWidth;
        finalImgWidth = maxImgWidth;
        finalImgHeight = finalImgHeight * ratio;
      }
      if (finalImgHeight > maxImgHeight) {
        const ratio = maxImgHeight / finalImgHeight;
        finalImgHeight = maxImgHeight;
        finalImgWidth = finalImgWidth * ratio;
      }

      // Hitung posisi X agar gambar ada persis di tengah
      const xPos = (pageWidth - finalImgWidth) / 2;

      // Cek halaman sebelum render gambar
      if (yPos + finalImgHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      doc.addImage(
        base64Image,
        "JPEG",
        xPos,
        yPos,
        finalImgWidth,
        finalImgHeight,
      );
      yPos += finalImgHeight + 15; // Spasi setelah gambar

      // 3. Menulis Hasil Analisis secara berurutan
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Hasil Analisis:", margin, yPos);
      yPos += 8;

      addWrappedText("Temuan (Findings):", true, 11);
      addWrappedText(result.result.analysis.findings, false, 11);

      addWrappedText("Potensi Abnormalitas:", true, 11);
      addWrappedText(result.result.analysis.potential_abnormalities, false, 11);

      addWrappedText(
        `Level Risiko: ${result.result.risk_assessment.overall_health_risk_percentage}%`,
        true,
        11,
      );
      yPos += 2; // Spasi ekstra

      addWrappedText("Rekomendasi:", true, 11);
      addWrappedText(result.result.recommendations, false, 11);

      // 4. Footer / Disclaimer (warna abu-abu)
      yPos += 10;
      addWrappedText(
        `Disclaimer: ${result.result.disclaimer}`,
        false,
        9,
        [120, 120, 120],
      );

      // 5. Simpan file
      doc.save("Laporan-Analisis-Biomedic-Read.pdf");
      setExporting(false);
    };
  };

  return (
    <div className="min-h-screen bg-sky-50 font-sans pb-20">
      <header className="flex justify-between items-center px-8 py-5 bg-sky-100 shadow-sm border-b border-sky-200">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          Biomedic <span className="text-blue-600">Read</span>
        </h1>
        <select
          className="bg-white border border-slate-300 text-slate-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium shadow-sm"
          defaultValue="radiologi"
        >
          <option value="radiologi">Radiologi (X-Ray, CT, MRI)</option>
        </select>
      </header>

      <main className="max-w-4xl mx-auto mt-12 px-6">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
            Analisis Gambar Medis (AI)
          </h2>
          <p className="text-center text-slate-500 mb-8">
            Unggah gambar radiologi Anda untuk mendapatkan analisis instan.
          </p>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
          >
            <input {...getInputProps()} />
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-80 rounded-lg object-contain"
              />
            ) : (
              <>
                <div className="mb-4 text-blue-500 group-hover:text-blue-600">
                  <UploadCloud size={48} strokeWidth={1.5} />
                </div>
                <p className="text-slate-700 font-medium mb-2 text-lg">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-400">
                  JPG, JPEG, PNG, or DICOM supported
                </p>
              </>
            )}
          </div>
          <div className="mt-6">
            <label
              htmlFor="symptoms"
              className="block text-md font-medium text-slate-700 mb-2"
            >
              Tambahkan Gejala atau Catatan (Opsional)
            </label>
            <textarea
              id="symptoms"
              rows="3"
              className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Batuk selama 2 minggu, sesak napas..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            ></textarea>
          </div>
          <div className="mt-8">
            <button
              onClick={handleAnalyze}
              className={`w-full font-bold py-4 rounded-xl transition-colors shadow-sm text-lg ${!selectedFile ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
              disabled={!selectedFile || loading}
            >
              {loading ? "Menganalisis..." : "Analisis dengan AI"}
            </button>
          </div>
        </div>

        {result && (
          <div ref={resultsRef} className="mt-16 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-800">
                Hasil Analisis
              </h2>
              <p className="text-slate-500 mt-1">
                Berikut adalah temuan berdasarkan gambar dan data yang Anda
                berikan.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResultCard
                icon={<FileText />}
                title="Temuan (Findings)"
                content={result.result.analysis.findings}
              />
              <ResultCard
                icon={<AlertTriangle className="text-orange-500" />}
                title="Potensi Abnormalitas"
                content={result.result.analysis.potential_abnormalities}
              />
              <RiskCard
                percentage={
                  result.result.risk_assessment.overall_health_risk_percentage
                }
              />
              <ResultCard
                icon={<Pill className="text-green-500" />}
                title="Rekomendasi"
                content={result.result.recommendations}
              />
              <div className="md:col-span-2">
                <DisclaimerCard content={result.result.disclaimer} />
              </div>
            </div>

            <div className="mt-12 flex justify-center items-center gap-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
              >
                <RotateCcw size={18} /> Diagnosis Ulang
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
                disabled={exporting}
              >
                <Download size={18} />{" "}
                {exporting ? "Mengekspor..." : "Export ke PDF"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const ResultCard = ({ icon, title, content }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
    <div className="flex items-center gap-3 mb-3">
      {icon}
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
    </div>
    <p className="text-slate-700 leading-relaxed">{content}</p>
  </div>
);
const RiskCard = ({ percentage }) => {
  const riskColor =
    percentage > 70
      ? "bg-red-500"
      : percentage > 40
        ? "bg-yellow-500"
        : "bg-green-500";
  const riskTextColor =
    percentage > 70
      ? "text-red-600"
      : percentage > 40
        ? "text-yellow-600"
        : "text-green-600";
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
      <div className="flex items-center gap-3 mb-3">
        <Activity />
        <h3 className="text-xl font-bold text-slate-800">Level Risiko</h3>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-5 my-2">
        <div
          className={`${riskColor} h-5 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className={`mt-2 font-bold text-2xl ${riskTextColor}`}>
        {percentage}%
      </p>
    </div>
  );
};
const DisclaimerCard = ({ content }) => (
  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
    <p className="text-sm text-yellow-800">
      <span className="font-bold">Disclaimer:</span> {content}
    </p>
  </div>
);

export default App;
