import { Link } from "react-router-dom";

export default function Header({ onReset, showBack = false, onBack }) {
  return (
    <header className="flex justify-between items-center px-8 h-16 bg-slate-900 shadow-lg sticky top-0 z-50 border-b border-indigo-500/30">
      <h1
        className="text-2xl font-extrabold text-white tracking-tight cursor-pointer flex items-center gap-1"
        onClick={onReset}
      >
        Biomedic <span className="text-sky-400">Read</span>
      </h1>

      <div className="space-x-6 text-sky-100 font-medium flex items-center text-sm">
        {showBack && (
          <button onClick={onBack} className="text-sky-400 hover:text-white transition-colors bg-sky-900/40 px-3 py-1.5 rounded-lg border border-sky-700/50">
            ← Kembali
          </button>
        )}

        <Link
          to="/"
          onClick={onReset}
          className="hover:text-white transition-colors"
        >
          Analisis AI Baru
        </Link>

        <Link 
          to="/patients" 
          className="hover:text-white transition-colors bg-indigo-600/80 px-4 py-1.5 rounded-lg border border-indigo-500 hover:bg-indigo-500"
        >
          Daftar Pasien
        </Link>
      </div>
    </header>
  );
}