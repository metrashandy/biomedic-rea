import React, { useState, useCallback } from 'react'; // Tambah useState & useCallback
import { useDropzone } from 'react-dropzone'; // Tambah hook dari library
import { UploadCloud } from 'lucide-react';

function App() {
  // ===== State Management =====
  // State untuk menyimpan file yang diupload (misal: gambar.jpg)
  const [selectedFile, setSelectedFile] = useState(null);
  // State untuk menyimpan URL preview dari gambar yang diupload
  const [imagePreview, setImagePreview] = useState(null);

  // Fungsi ini akan dijalankan saat gambar berhasil di-drop atau dipilih
  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      // Membuat URL sementara untuk preview gambar
      setImagePreview(URL.createObjectURL(file)); 
    }
  }, []);

  // Inisialisasi hook useDropzone
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/dicom': [], // Kamu bisa sesuaikan tipe file di sini
    },
    multiple: false, // Hanya izinkan 1 file
  });

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
      
      {/* ===== MAIN CONTENT (Area Kerja) ===== */}
      <main className="max-w-4xl mx-auto mt-12">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
          
          <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
            X-ray, CT scans, MRI, and Ultrasound
          </h2>

          {/* ===== Area Kotak Drag & Drop yang Sudah Fungsional ===== */}
          {/* getRootProps akan menambahkan event listener (onClick, onDrop, dll) */}
          <div {...getRootProps()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group">
            
            {/* getInputProps akan membuat input file tersembunyi */}
            <input {...getInputProps()} />

            {/* ===== Tampilan Berubah: Jika ada gambar, tampilkan preview. Jika tidak, tampilkan ikon upload ===== */}
            {imagePreview ? (
              // Tampilan saat ada gambar
              <img src={imagePreview} alt="Preview" className="max-h-80 rounded-lg object-contain" />
            ) : (
              // Tampilan default (saat belum ada gambar)
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

          {/* ===== Tombol AI Read yang Sudah Dinamis ===== */}
          <div className="mt-8">
            <button 
              className={`w-full font-bold py-4 px-4 rounded-xl transition-colors shadow-sm text-lg tracking-wide ${
                selectedFile 
                ? 'bg-blue-500 hover:bg-blue-600 text-white'  // Style saat aktif
                : 'bg-slate-200 text-slate-400 cursor-not-allowed' // Style saat disabled
              }`}
              disabled={!selectedFile} // Tombol disable jika selectedFile kosong
            >
              AI Read
            </button>
          </div>

        </div>
      </main>
      
    </div>
  );
}

export default App;