import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptoms, setSymptoms] = useState(''); // ===== TAMBAHAN BARU: State untuk menyimpan teks gejala =====
  
  //dev nambah baru
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file)); 
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/dicom': [],
    },
    multiple: false,
  });

  const handleAnalyze = async () => {
  if (!selectedFile) return;

  setLoading(true);

  const formData = new FormData();
  formData.append("image", selectedFile);
  formData.append("symptoms", symptoms);

  try {
    const response = await fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log(data); // debug
    setResult(data);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans pb-12">
      
      {/* ===== HEADER (Tidak berubah) ===== */}
      <header className="flex justify-between items-center px-8 py-5 bg-white shadow-sm border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Biomedic <span className="text-blue-600">Read</span>
          </h1>
        </div>
        <div>
          <select 
            className="bg-white border border-slate-300 text-slate-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium shadow-sm transition-all"
            defaultValue="radiologi"
          >
            <option value="radiologi">Radiologi (X-Ray, CT, MRI)</option>
            <option value="ecg" disabled>ECG (Coming Soon)</option>
            <option value="skin" disabled>Skin/Kulit (Coming Soon)</option>
          </select>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto mt-12">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
          
          <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
            X-ray, CT scans, MRI, and Ultrasound
          </h2>

          <div {...getRootProps()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group">
            <input {...getInputProps()} />
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="max-h-80 rounded-lg object-contain" />
            ) : (
              <>
                <div className="mb-4 text-blue-500 group-hover:text-blue-600 transition-colors">
                  <UploadCloud className="w-12 h-12" strokeWidth={1.5} />
                </div>
                <p className="text-slate-700 font-medium mb-2 text-lg">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-400">
                  JPG, JPEG, PNG, or DICOM files supported
                </p>
              </>
            )}
          </div>
          
          {/* ===== TAMBAHAN BARU: Kolom Input Gejala ===== */}
          <div className="mt-6">
            <label htmlFor="symptoms" className="block text-md font-medium text-slate-700 mb-2">
              Tambahkan Gejala atau Catatan (Opsional)
            </label>
            <textarea
              id="symptoms"
              name="symptoms"
              rows="3"
              className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Contoh: Batuk selama 2 minggu, sesak napas saat malam hari..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            ></textarea>
          </div>
          {/* ===== END TAMBAHAN BARU ===== */}


          <div className="mt-8">
            <button 
              onClick={handleAnalyze}
              className={`w-full font-bold py-4 px-4 rounded-xl transition-colors shadow-sm text-lg tracking-wide ${
                selectedFile 
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!selectedFile || loading}
            >
              {loading ? "Analyzing..." : "AI Read"}
            </button>
          </div>

          {result && result.result && (
  <div className="mt-10 space-y-6">

    {/* 🧾 HASIL ANALISIS */}
    <div className="bg-white p-6 rounded-xl shadow border">
      <h3 className="text-xl font-bold mb-3 text-slate-800">
        🧾 Findings
      </h3>
      <p className="text-slate-700">
        {result.result.analysis.findings}
      </p>
    </div>

    {/* ⚠️ ABNORMALITAS */}
    <div className="bg-white p-6 rounded-xl shadow border">
      <h3 className="text-xl font-bold mb-3 text-slate-800">
        ⚠️ Potential Issues
      </h3>
      <p className="text-slate-700">
        {result.result.analysis.potential_abnormalities}
      </p>
    </div>

    {/* 📊 RISK */}
    <div className="bg-white p-6 rounded-xl shadow border">
      <h3 className="text-xl font-bold mb-3 text-slate-800">
        📊 Risk Level
      </h3>

      <div className="w-full bg-slate-200 rounded-full h-4">
        <div
          className="bg-red-500 h-4 rounded-full"
          style={{
            width: `${result.result.risk_assessment.overall_health_risk_percentage}%`
          }}
        ></div>
      </div>

      <p className="mt-2 font-semibold text-red-600">
        {result.result.risk_assessment.overall_health_risk_percentage}%
      </p>
    </div>

    {/* 💊 REKOMENDASI */}
    <div className="bg-white p-6 rounded-xl shadow border">
      <h3 className="text-xl font-bold mb-3 text-slate-800">
        💊 Recommendations
      </h3>
      <p className="text-slate-700">
        {result.result.recommendations}
      </p>
    </div>

    {/* ⚠️ DISCLAIMER */}
    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
      <p className="text-sm text-yellow-800">
        ⚠️ {result.result.disclaimer}
      </p>
    </div>

  </div>
)}

        </div>
      </main>
      
    </div>
  );
}

export default App;