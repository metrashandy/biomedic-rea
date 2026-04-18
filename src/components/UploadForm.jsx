import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Trash2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function UploadForm({
  selectedFile,
  setSelectedFile,
  imagePreview,
  setImagePreview,
  symptoms,
  setSymptoms,
  onAnalyze,
  onReset,
  onTest,
}) {
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];

    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File maksimal 5MB!");
      return;
    }

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

  return (
    <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
        Analisis Citra Medis
      </h2>
      <p className="text-center text-slate-500 mb-8">
        Unggah gambar radiologi anda untuk mendapatkan hasil instan
      </p>

      {/* DROPZONE */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
      >
        <input id="fileInput" {...getInputProps()} />

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
              Klik untuk mengunggah gambar atau seret dan lepaskan
            </p>
          </>
        )}
      </div>

      {/* ACTION PREVIEW */}
      {imagePreview && (
        <div className="flex justify-between mt-4 px-2 relative z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium"
          >
            <Trash2 size={18} /> Hapus
          </button>

          <button
            onClick={() => document.getElementById("fileInput").click()}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"
          >
            <RefreshCw size={18} /> Ganti
          </button>
        </div>
      )}

      {/* INPUT SYMPTOMS */}
      <div className="mt-6">
        <label className="block text-md font-medium text-slate-700 mb-2">
          Gejala/Riwayat Pasien (Opsional)
        </label>
        <textarea
          rows="3"
          className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Contoh : Pria 40 tahun, perokok kronis..."
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
        ></textarea>
      </div>

      {/* TEST BUTTON */}
      <button
        onClick={onTest}
        className="mt-4 text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded"
      >
        Test UI (Data Dummy)
      </button>

      {/* ANALYZE BUTTON */}
      <div className="mt-8">
        <button
          onClick={onAnalyze}
          className={`w-full font-bold py-4 rounded-xl transition-colors shadow-sm text-lg ${
            !selectedFile
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          disabled={!selectedFile}
        >
          Analisis Sekarang
        </button>
      </div>
    </div>
  );
}
