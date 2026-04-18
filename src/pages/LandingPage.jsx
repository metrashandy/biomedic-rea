import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-sky-50">
      <Header />

      <motion.div
        className="grid md:grid-cols-2 gap-10 items-center max-w-6xl mx-auto px-6 py-20"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* TEXT */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-5xl font-extrabold text-slate-800 mb-6 leading-tight">
            Pahami Hasil <br />
            Anda <span className="text-blue-600">dengan AI</span>
          </h1>

          <p className="text-slate-600 mb-6">
            Unggah hasil X-ray Anda dan dapatkan analisis medis, tingkat risiko,
            serta rekomendasi secara instan berbasis AI.
          </p>

          <button
            onClick={() => navigate("/analyze")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow"
          >
            Coba Sekarang →
          </button>
        </motion.div>

        {/* IMAGE */}
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
      </motion.div>
    </div>
  );
}
console.log("berhasilberjalan");
