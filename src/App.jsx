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
  Trash2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const resultsRef = useRef(null);

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setSymptoms("");
    setResult(null);
  };

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

    if (!file) return;

    // ✅ VALIDASI SIZE (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File maksimal 5MB!");
      return;
    }

    // ✅ VALIDASI TYPE
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Hanya JPG dan PNG yang diperbolehkan!");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];

      if (error?.code === "file-too-large") {
        toast.error("File terlalu besar (max 5MB)");
      } else if (error?.code === "file-invalid-type") {
        toast.error("Format file harus JPG atau PNG");
      } else {
        toast.error("File tidak valid");
      }
    },
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 5 * 1024 * 1024,
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
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      toast.error(
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - 2 * margin;

    let yPos = 20;

    const now = new Date();

    // ===== FORMAT DATE & TIME =====
    const date = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const time = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const reportId = `BR-${now.getFullYear()}${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours(),
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    // ===== TEXT WRAPPER =====
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
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 6;
      });

      yPos += spacing;
    };

    // ===== HEADER =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("MEDICAL RADIOLOGY REPORT", pageWidth / 2, yPos, {
      align: "center",
    });

    yPos += 6;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Biomedic Read AI System", pageWidth / 2, yPos, {
      align: "center",
    });

    yPos += 10;

    // ===== REPORT INFORMATION =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Report Information", margin, yPos);

    yPos += 6;

    doc.setDrawColor(180);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 6;

    // align kolom
    const labelX = margin;
    const colonX = margin + 30;
    const valueX = margin + 35;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text("Date", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text(date, valueX, yPos);
    yPos += 6;

    doc.text("Time", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text(time, valueX, yPos);
    yPos += 6;

    doc.text("Modality", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text("X-Ray Analysis", valueX, yPos);
    yPos += 6;

    doc.text("System", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text("Biomedic Read AI", valueX, yPos);
    yPos += 6;

    doc.text("Report ID", labelX, yPos);
    doc.text(":", colonX, yPos);
    doc.text(reportId, valueX, yPos);
    yPos += 10;

    // garis bawah info
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 10;

    // ===== IMAGE =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("X-Ray Image", margin, yPos);

    yPos += 6;

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);

    reader.onloadend = () => {
      const base64Image = reader.result;
      const format = selectedFile.type.includes("png") ? "PNG" : "JPEG";

      const imgProps = doc.getImageProperties(base64Image);

      const maxWidth = 110;
      const maxHeight = 80;

      let imgWidth = maxWidth;
      let imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (imgProps.width * imgHeight) / imgProps.height;
      }

      const xPos = (pageWidth - imgWidth) / 2;

      doc.addImage(base64Image, format, xPos, yPos, imgWidth, imgHeight);

      yPos += imgHeight + 5;

      // garis bawah gambar
      doc.setDrawColor(220);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      yPos += 10;

      // ===== MEDICAL ANALYSIS =====
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Medical Analysis", margin, yPos);

      yPos += 6;

      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      yPos += 8;

      // ===== CONTENT =====
      const sectionTitle = (title) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, margin, yPos);
        yPos += 6;
      };

      sectionTitle("1. Findings");
      addWrappedText(result.result.analysis.findings);

      sectionTitle("2. Potential Abnormalities");
      addWrappedText(result.result.analysis.potential_abnormalities);

      sectionTitle("3. Risk Assessment");
      addWrappedText(
        `Overall Risk: ${result.result.risk_assessment.overall_health_risk_percentage}%`,
        { isBold: true },
      );

      sectionTitle("4. Recommendation");
      addWrappedText(result.result.recommendations);

      sectionTitle("5. Disclaimer");
      addWrappedText(result.result.disclaimer, {
        fontSize: 9,
        color: [120, 120, 120],
      });

      // ===== FOOTER =====
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        "This report is generated by AI and should not replace professional medical advice.",
        margin,
        pageHeight - 10,
      );

      doc.save("Medical_Report_Biomedic_Read.pdf");
      setExporting(false);
    };
  };

  const dummyResult = {
    result: {
      analysis: {
        findings: "There is opacity in left lung...",
        potential_abnormalities: "Possible pneumonia",
      },
      risk_assessment: {
        overall_health_risk_percentage: 75,
      },
      recommendations: "Consult doctor immediately",
      disclaimer: "AI generated result",
    },
  };

  <button
    onClick={() => setResult(dummyResult)}
    className="bg-green-500 text-white px-4 py-2 rounded"
  >
    Test PDF (No API)
  </button>;

  // LANDING PAGE !!!

  if (!showApp) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              zIndex: 9999,
            },
          }}
        />
        <motion.div
          className="min-h-screen bg-sky-50"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/*HEADER*/}
          <header className="flex justify-between items-center px-8 h-16 bg-sky-100 shadow-sm border-b border-sky-200">
            <h1
              onClick={() => setShowApp(false)}
              className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer"
            >
              Biomedic <span className="text-blue-600">Read</span>
            </h1>

            <div className="space-x-6 text-slate-600 font-medium flex items-center">
              <button
                onClick={() => setShowApp(false)}
                className="hover:text-blue-600 transition"
              >
                Home
              </button>

              <button className="hover:text-blue-600 transition">
                Features
              </button>

              <button className="hover:text-blue-600 transition">About</button>

              <button
                onClick={() => setShowApp(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                Try Now
              </button>
            </div>
          </header>

          {/*HERO SECTION */}
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-6xl mx-auto px-6 py-20">
            {/*KIRI*/}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl font-extrabold text-slate-800 mb-6 leading-tight">
                Understand Your <br />
                Results <span className="text-blue-600">with AI</span>
              </h1>

              <p className="text-slate-600 mb-6">
                Upload your X-ray and get instant medical insights, risk
                analysis, and recommendations powered by AI.
              </p>

              <ul className="space-y-3 mb-8 text-slate-600">
                <li>✔ Detect lung abnormalities</li>
                <li>✔ Instant AI diagnosis support</li>
                <li>✔ Risk percentage analysis</li>
                <li>✔ Medical recommendations</li>
              </ul>

              <button
                onClick={() => setShowApp(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow"
              >
                Try it now →
              </button>
            </motion.div>

            {/*KANAN*/}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <img
                src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5"
                alt="medical ai"
                className="rounded-2xl shadow-lg"
              />
            </motion.div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            zIndex: 9999,
          },
        }}
      />
      <motion.div
        className="min-h-screen bg-sky-50"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <header className="flex justify-between items-center px-8 h-16 bg-sky-100 shadow-sm border-b border-sky-200">
          <h1
            onClick={() => setShowApp(false)}
            className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer"
          >
            Biomedic <span className="text-blue-600">Read</span>
          </h1>
          <select
            className="bg-white border border-slate-300 text-slate-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium shadow-sm"
            defaultValue="radiologi"
          >
            <option value="radiologi">Radiology (X-Ray, CT, MRI)</option>
          </select>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-16 space-y-6">
          {/*TAMBAHAN BACK BUTTON KE HOME */}
          <div className="mb-6">
            <button
              onClick={() => {
                resetForm();
                setShowApp(false);
              }}
              className="text-blue-600 font-medium hover:underline"
            >
              ← Back to Home
            </button>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
              Medical Image Analysis
            </h2>
            <p className="text-center text-slate-500 mb-8">
              Upload your radiology images to get instant analysis.
            </p>
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
            >
              <input id="fileInput" {...getInputProps()} />
              {imagePreview ? (
                <div className="flex flex-col items-center gap-4">
                  {/* IMAGE */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-80 rounded-lg object-contain"
                  />
                </div>
              ) : (
                <>
                  <div className="mb-4 text-blue-500 group-hover:text-blue-600">
                    <UploadCloud size={48} strokeWidth={1.5} />
                  </div>
                  <p className="text-slate-700 font-medium mb-2 text-lg">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-slate-400">
                    JPG, JPEG, and PNG supported
                  </p>
                </>
              )}
            </div>
            {imagePreview && (
              <div className="flex justify-between mt-4 px-2 relative z-10">
                {/* ❌ REMOVE */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 🔥 INI KUNCI
                    setSelectedFile(null);
                    setImagePreview(null);
                  }}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium"
                >
                  <Trash2 size={18} />
                  Remove
                </button>

                {/* 🔄 CHANGE */}
                <button
                  onClick={() => {
                    document.getElementById("fileInput").click();
                  }}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"
                >
                  <RefreshCw size={18} />
                  Change
                </button>
              </div>
            )}
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => setResult(dummyResult)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Test PDF (No API)
              </button>
            </div>
            <div className="mt-6">
              <label
                htmlFor="symptoms"
                className="block text-md font-medium text-slate-700 mb-2"
              >
                Patient Symptoms / History (Optional)
              </label>
              <textarea
                id="symptoms"
                rows="3"
                className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Example : 40yo male, chronic smoker, continous cough, weight loss, etc"
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
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>

          {result && (
            <div ref={resultsRef} className="mt-16 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-800">
                  Analysis Result
                </h2>
                <p className="text-slate-500 mt-1">
                  Below are the findings based on your images and data given.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResultCard
                  icon={<FileText />}
                  title="Findings"
                  content={result.result.analysis.findings}
                />
                <ResultCard
                  icon={<AlertTriangle className="text-orange-500" />}
                  title="Potential Abnormality"
                  content={result.result.analysis.potential_abnormalities}
                />
                <RiskCard
                  percentage={
                    result.result.risk_assessment.overall_health_risk_percentage
                  }
                />
                <ResultCard
                  icon={<Pill className="text-green-500" />}
                  title="Recommendation"
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
                  <RotateCcw size={18} /> Re-Diagnosis
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
                  disabled={exporting}
                >
                  <Download size={18} />{" "}
                  {exporting ? "Exporting..." : "Export to PDF"}
                </button>
              </div>
            </div>
          )}
        </main>
      </motion.div>
    </>
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
        <h3 className="text-xl font-bold text-slate-800">Risk Level</h3>
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
