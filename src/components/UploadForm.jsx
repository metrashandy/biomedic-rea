import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Trash2, RefreshCw, FileImage } from "lucide-react";
import toast from "react-hot-toast";

// Helper: apakah jenis pemeriksaan yang dipilih CT Scan (yang boleh DICOM)
const isCTScan = (analysisType = "") => {
  const t = analysisType.toLowerCase();
  return t.includes("ct") || t.includes("computed");
};

// Validasi file berdasarkan tipe analisis
const validateFile = (file, analysisType) => {
  const allowedImages = ["image/jpeg", "image/png"];
  const isDicom =
    file.name.toLowerCase().endsWith(".dcm") ||
    file.name.toLowerCase().endsWith(".dicom") ||
    file.type === "application/dicom";

  if (isDicom) {
    if (!isCTScan(analysisType)) {
      return `File DICOM (.dcm) hanya diperbolehkan untuk CT Scan. Pilih "CT Scan" sebagai jenis pemeriksaan.`;
    }
    return null; // valid
  }

  if (!allowedImages.includes(file.type)) {
    return `Format ${file.name} tidak didukung. Gunakan JPG, PNG, atau DCM (CT Scan).`;
  }

  const maxSize = isCTScan(analysisType) ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return `File ${file.name} terlalu besar (maks ${isCTScan(analysisType) ? "200MB" : "10MB"})`;
  }

  return null;
};

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
  // ── Props baru untuk multi-file & DICOM ──
  analysisType = "X-Ray",
  selectedFiles,
  setSelectedFiles,
  imagePreviews,
  setImagePreviews,
  activePreviewIndex,
  setActivePreviewIndex,
  isMultiMode = false,  // true = pakai multi-file mode
}) {
  const isCtMode = isCTScan(analysisType);

  // Tentukan accept berdasarkan jenis pemeriksaan
  const acceptConfig = isCtMode
    ? {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "application/dicom": [".dcm", ".dicom"],
        "application/octet-stream": [".dcm", ".dicom"],
      }
    : {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
      };

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      if (isMultiMode) {
        // Multi-file mode (PatientDetail)
        if (acceptedFiles.length > 10) {
          toast.error("Maksimal 10 file per sesi");
          return;
        }

        // Validasi semua file
        for (const file of acceptedFiles) {
          const err = validateFile(file, analysisType);
          if (err) { toast.error(err); return; }
        }

        setSelectedFiles?.(acceptedFiles);
        setActivePreviewIndex?.(0);

        // Generate preview — DICOM tidak bisa preview langsung, pakai placeholder
        const previews = acceptedFiles.map((file) => {
          const isDicom =
            file.name.toLowerCase().endsWith(".dcm") ||
            file.name.toLowerCase().endsWith(".dicom");
          return isDicom ? null : URL.createObjectURL(file);
        });
        setImagePreviews?.(previews);

      } else {
        // Single-file mode (lama, backward compat)
        const file = acceptedFiles[0];
        const err = validateFile(file, analysisType);
        if (err) { toast.error(err); return; }

        const isDicom =
          file.name.toLowerCase().endsWith(".dcm") ||
          file.name.toLowerCase().endsWith(".dicom");

        setSelectedFile?.(file);
        setImagePreview?.(isDicom ? null : URL.createObjectURL(file));
      }
    },
    [analysisType, isMultiMode, setSelectedFile, setImagePreview, setSelectedFiles, setImagePreviews, setActivePreviewIndex]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const err = fileRejections[0]?.errors[0];
      if (err?.code === "file-too-large") {
        toast.error(`File terlalu besar`);
      } else if (err?.code === "file-invalid-type") {
        toast.error(
          isCtMode
            ? "Format harus JPG, PNG, atau DCM (DICOM)"
            : "Format harus JPG atau PNG"
        );
      } else {
        toast.error("File tidak valid");
      }
    },
    accept: acceptConfig,
    multiple: isMultiMode,
    maxSize: isCtMode ? 200 * 1024 * 1024 : 10 * 1024 * 1024,
  });

  // Tentukan file/preview yang ditampilkan
  const displayFiles = isMultiMode ? (selectedFiles || []) : (selectedFile ? [selectedFile] : []);
  const displayPreviews = isMultiMode ? (imagePreviews || []) : (imagePreview ? [imagePreview] : []);
  const hasFiles = displayFiles.length > 0;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
        Analisis Citra Medis
      </h2>
      <p className="text-center text-slate-500 mb-2">
        Unggah gambar radiologi untuk mendapatkan hasil analisis AI
      </p>
      {isCtMode && (
        <p className="text-center text-blue-600 text-sm font-medium mb-6 bg-blue-50 py-2 px-4 rounded-xl">
          🧠 CT Scan — mendukung format DICOM (.dcm) dan JPG/PNG
        </p>
      )}

      {/* DROPZONE */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:bg-slate-50 hover:border-blue-400"
        }`}
      >
        <input {...getInputProps()} />

        {hasFiles ? (
          <div className="w-full">
            {isMultiMode && displayFiles.length > 1 ? (
              /* Multi-file preview */
              <div>
                <p className="font-bold text-slate-700 mb-3">
                  {displayFiles.length} file dipilih:
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 justify-center flex-wrap">
                  {displayFiles.map((file, idx) => {
                    const isDicom =
                      file.name.toLowerCase().endsWith(".dcm") ||
                      file.name.toLowerCase().endsWith(".dicom");
                    const preview = displayPreviews[idx];
                    return (
                      <div
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setActivePreviewIndex?.(idx); }}
                        className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          activePreviewIndex === idx
                            ? "border-blue-500 scale-105"
                            : "border-slate-200 opacity-70 hover:opacity-100"
                        }`}
                      >
                        {preview ? (
                          <img src={preview} alt={file.name} className="w-20 h-16 object-cover" />
                        ) : (
                          <div className="w-20 h-16 bg-slate-800 flex flex-col items-center justify-center">
                            <FileImage size={20} className="text-blue-400" />
                            <span className="text-[9px] text-slate-400 font-bold mt-1">DICOM</span>
                          </div>
                        )}
                        <div className={`absolute bottom-0 left-0 right-0 text-[9px] font-black text-center py-0.5 ${activePreviewIndex === idx ? "bg-blue-500 text-white" : "bg-black/60 text-white"}`}>
                          #{idx + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Preview gambar aktif */}
                {displayPreviews[activePreviewIndex ?? 0] ? (
                  <img
                    src={displayPreviews[activePreviewIndex ?? 0]}
                    alt="Preview"
                    className="max-h-64 rounded-lg object-contain mx-auto mt-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="mt-4 bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-2">
                    <FileImage size={48} className="text-blue-400" />
                    <p className="text-slate-400 font-bold text-sm">
                      {displayFiles[activePreviewIndex ?? 0]?.name}
                    </p>
                    <p className="text-slate-500 text-xs">
                      File DICOM — preview akan ditampilkan setelah diproses
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Single file preview */
              (() => {
                const file = displayFiles[0];
                const preview = displayPreviews[0];
                const isDicom =
                  file?.name?.toLowerCase().endsWith(".dcm") ||
                  file?.name?.toLowerCase().endsWith(".dicom");
                return preview ? (
                  <img src={preview} alt="Preview" className="max-h-80 rounded-lg object-contain mx-auto" />
                ) : (
                  <div className="bg-slate-900 rounded-xl p-10 flex flex-col items-center gap-3">
                    <FileImage size={56} className="text-blue-400" />
                    <p className="text-white font-bold">{file?.name}</p>
                    <p className="text-slate-400 text-sm">File DICOM siap diproses</p>
                  </div>
                );
              })()
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-blue-500 group-hover:text-blue-600">
              <UploadCloud size={48} strokeWidth={1.5} />
            </div>
            <p className="text-slate-700 font-medium mb-2 text-lg">
              Klik untuk upload atau seret file ke sini
            </p>
            <p className="text-slate-400 text-sm">
              {isCtMode
                ? "JPG, PNG, atau DICOM (.dcm) — maks 200MB"
                : `JPG atau PNG — maks 10MB${isMultiMode ? " · hingga 10 file" : ""}`}
            </p>
          </>
        )}
      </div>

      {/* ACTION BUTTONS */}
      {hasFiles && (
        <div className="flex justify-between mt-4 px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isMultiMode) {
                setSelectedFiles?.([]);
                setImagePreviews?.([]);
                setActivePreviewIndex?.(0);
              } else {
                onReset?.();
              }
            }}
            className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium"
          >
            <Trash2 size={18} /> Hapus
          </button>
          <label className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium cursor-pointer">
            <RefreshCw size={18} /> Ganti
            <input
              type="file"
              className="hidden"
              accept={isCtMode ? ".jpg,.jpeg,.png,.dcm,.dicom" : ".jpg,.jpeg,.png"}
              multiple={isMultiMode}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                onDrop(files);
              }}
            />
          </label>
        </div>
      )}

      {/* SYMPTOMS */}
      <div className="mt-6">
        <label className="block text-md font-medium text-slate-700 mb-2">
          Gejala/Riwayat Pasien (Opsional)
        </label>
        <textarea
          rows="3"
          className="w-full border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Contoh: Pria 40 tahun, perokok kronis, batuk 2 minggu..."
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
        />
      </div>

      {onTest && (
        <button onClick={onTest} className="mt-4 text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded">
          Test UI (Data Dummy)
        </button>
      )}

      {/* ANALYZE BUTTON */}
      <div className="mt-6">
        <button
          onClick={onAnalyze}
          className={`w-full font-bold py-4 rounded-xl transition-colors shadow-sm text-lg ${
            !hasFiles
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          disabled={!hasFiles}
        >
          {isMultiMode && displayFiles.length > 1
            ? `Analisis ${displayFiles.length} File Sekarang`
            : "Analisis Sekarang"}
        </button>
      </div>
    </div>
  );
}