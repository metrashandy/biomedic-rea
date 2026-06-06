import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_PATIENTS = [
  {
    id: 1,
    name: "Budi Santoso",
    age: 45,
    gender: "Laki-laki",
    weight: 70,
    height: 170,
  },
  {
    id: 2,
    name: "Siti Aminah",
    age: 32,
    gender: "Perempuan",
    weight: 55,
    height: 158,
  },
];

const STORAGE_KEY = "clinic_patients";

function loadPatients() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_PATIENTS;
}

function savePatients(patients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export default function PatientPage() {
  const navigate = useNavigate();
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patients, setPatients] = useState(loadPatients);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    gender: "Laki-laki",
    weight: "",
    height: "",
  });

  useEffect(() => {
    savePatients(patients);
  }, [patients]);

  const handleLanjut = () => {
    let patientData = null;

    if (isNewPatient) {
      if (!newPatient.name || !newPatient.age)
        return alert("Mohon lengkapi nama dan umur pasien!");

      const newId = Date.now();
      patientData = {
        ...newPatient,
        id: newId,
        age: parseInt(newPatient.age),
        weight: newPatient.weight ? parseFloat(newPatient.weight) : null,
        height: newPatient.height ? parseFloat(newPatient.height) : null,
      };

      const updatedPatients = [...patients, patientData];
      setPatients(updatedPatients);
      savePatients(updatedPatients);
    } else {
      if (!selectedPatientId) return alert("Mohon pilih pasien!");
      patientData = patients.find((p) => p.id === parseInt(selectedPatientId));
    }

    navigate("/diagnosis", { state: { patient: patientData } });
  };

  const handleHapusPasien = (id, name) => {
    if (!confirm(`Hapus pasien "${name}" dari daftar?`)) return;
    const updated = patients.filter((p) => p.id !== id);
    setPatients(updated);
    if (selectedPatientId === String(id)) setSelectedPatientId("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-800 mb-2 text-center">
          AI Doctor
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Registrasi Kunjungan Pasien
        </p>

        {/* Toggle Pasien Lama / Baru */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            className={`flex-1 py-2 rounded-md font-medium transition ${
              !isNewPatient ? "bg-white shadow text-blue-600" : "text-gray-500"
            }`}
            onClick={() => setIsNewPatient(false)}
          >
            Pasien Lama
          </button>
          <button
            className={`flex-1 py-2 rounded-md font-medium transition ${
              isNewPatient ? "bg-white shadow text-blue-600" : "text-gray-500"
            }`}
            onClick={() => setIsNewPatient(true)}
          >
            Pasien Baru
          </button>
        </div>

        {/* Form Pasien Lama */}
        {!isNewPatient && (
          <div className="space-y-4 mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Pilih Pasien
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="">-- Pilih Pasien --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.age} th) - {p.gender}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              {patients.length} pasien terdaftar
            </p>

            {/* Daftar pasien dengan tombol hapus */}
            {patients.length > 0 && (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2 border-b border-gray-100">
                  Daftar Pasien
                </p>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {patients.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition ${
                        selectedPatientId === String(p.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => setSelectedPatientId(String(p.id))}
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {p.name}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {p.age} th · {p.gender}
                        </span>
                      </button>
                      <button
                        onClick={() => handleHapusPasien(p.id, p.name)}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition ml-2 flex-shrink-0"
                        title="Hapus dari daftar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Pasien Baru */}
        {isNewPatient && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 mt-1"
                placeholder="Masukkan nama pasien"
                value={newPatient.name}
                onChange={(e) =>
                  setNewPatient({ ...newPatient, name: e.target.value })
                }
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">
                  Umur <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 mt-1"
                  placeholder="Thn"
                  value={newPatient.age}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, age: e.target.value })
                  }
                />
              </div>
              <div className="flex-[1.5]">
                <label className="block text-sm font-medium text-gray-700">
                  Gender
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 mt-1"
                  value={newPatient.gender}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, gender: e.target.value })
                  }
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">
                  Berat Badan (kg)
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 mt-1"
                  placeholder="kg"
                  value={newPatient.weight}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, weight: e.target.value })
                  }
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">
                  Tinggi (cm)
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 mt-1"
                  placeholder="cm"
                  value={newPatient.height}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, height: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLanjut}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-200"
        >
          Lanjut ke Diagnosis →
        </button>
      </div>
    </div>
  );
}
