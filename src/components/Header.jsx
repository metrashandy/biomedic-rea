import { Link } from "react-router-dom";

export default function Header({ onReset, showBack = false, onBack }) {
  return (
    <header className="flex justify-between items-center px-8 h-16 bg-sky-100 shadow-sm border-b border-sky-200 sticky top-0 z-50">
      <h1
        className="text-2xl font-extrabold text-slate-800 tracking-tight cursor-pointer"
        onClick={onReset}
      >
        Biomedic <span className="text-blue-600">Read</span>
      </h1>

      <div className="space-x-6 text-slate-600 font-medium flex items-center">
        {showBack && (
          <button onClick={onBack} className="text-blue-600 hover:underline">
            ← Kembali
          </button>
        )}

        <Link
          to="/"
          onClick={onReset}
          className="hover:text-blue-600 transition"
        >
          Analisis AI Baru
        </Link>

        <Link to="/patients" className="hover:text-blue-600 transition">
          Daftar Pasien
        </Link>
      </div>
    </header>
  );
}
