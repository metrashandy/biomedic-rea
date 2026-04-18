import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Header from '../components/Header';

// ===== DATA DUMMY PASIEN (Diperbanyak untuk test pagination) =====
const dummyPatients = Array.from({ length: 25 }, (_, i) => ({
  id: `P-${String(i + 1).padStart(3, '0')}`,
  name: i === 0 ? "Budi Santoso" : i === 1 ? "Siti Aminah" : i === 2 ? "Ahmad Wijaya" : i === 3 ? "Rina Kartika" : i === 4 ? "Dewi Lestari" : `Pasien Anonim ${i + 1}`,
  age: Math.floor(Math.random() * 40) + 20,
  gender: i % 2 === 0 ? "Laki-laki" : "Perempuan",
  lastVisit: `${(i % 28) + 1} Apr 2026`,
  totalImages: Math.floor(Math.random() * 5) + 1
}));

export default function PatientList() {
  const navigate = useNavigate();

  // ===== STATE MANAGEMENT =====
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7; // Jumlah baris yang ditampilkan per halaman

  // ===== LOGIKA PENCARIAN (SEARCH) =====
  // Filter data berdasarkan nama ATAU ID pasien
  const filteredPatients = dummyPatients.filter(patient => 
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ===== LOGIKA PAGINATION =====
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  
  // Data yang benar-benar ditampilkan di layar saat ini
  const currentData = filteredPatients.slice(startIndex, endIndex);

  // Fungsi saat user mengetik di search bar
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset ke halaman 1 setiap kali mencari data baru
  };

  return (
     <div className="min-h-screen bg-sky-50"> 
      {/* ===== TAMBAHKAN HEADER DI SINI ===== */}
      <Header />
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-6xl mx-auto px-6 py-12"
    >
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            Daftar Pasien
          </h2>
          <p className="text-slate-500 mt-2">Kelola data rekam medis dan hasil citra radiologi pasien.</p>
        </div>
        
        {/* ===== KOTAK PENCARIAN YANG SUDAH FUNGSIONAL ===== */}
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari nama atau ID (P-001)..." 
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-72 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Tabel Daftar Pasien */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-4 font-semibold">ID Pasien</th>
                <th className="p-4 font-semibold">Nama Lengkap</th>
                <th className="p-4 font-semibold">Umur / Gender</th>
                <th className="p-4 font-semibold">Kunjungan Terakhir</th>
                <th className="p-4 font-semibold">Jumlah Citra</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((patient) => (
                  <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500 font-medium">{patient.id}</td>
                    <td className="p-4 font-bold text-slate-800">{patient.name}</td>
                    <td className="p-4 text-slate-600">{patient.age} thn • {patient.gender}</td>
                    <td className="p-4 text-slate-600">{patient.lastVisit}</td>
                    <td className="p-4">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {patient.totalImages} File
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => navigate(`/patient/${patient.id}`)}
                        className="flex items-center justify-center gap-1 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 px-4 py-2 rounded-lg font-medium w-full transition-all shadow-sm"
                      >
                        Detail <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-500">
                    Tidak ada pasien yang cocok dengan pencarian "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== KONTROL PAGINATION ===== */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <span className="text-sm text-slate-500 font-medium">
            Menampilkan {filteredPatients.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, filteredPatients.length)} dari {filteredPatients.length} pasien
          </span>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === 1 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            
            <div className="flex items-center px-4 font-medium text-slate-700">
              Hal {currentPage} / {totalPages || 1}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      
    </motion.div>
    </div>
  );
}