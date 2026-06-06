from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from typing import List, Optional

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="AI Doctor Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# DATABASE
# ==========================================
SQLALCHEMY_DATABASE_URL = "sqlite:///./clinic.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBPatient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    gender = Column(String)
    weight = Column(Float)
    height = Column(Float)
    visits = relationship("DBVisit", back_populates="patient")

class DBVisit(Base):
    __tablename__ = "visits"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    keluhan = Column(Text)
    gejala = Column(Text)
    tanda_vital = Column(String)
    hasil_lab = Column(Text)
    alergi = Column(String)
    diagnosis_ai = Column(Text)
    patient = relationship("DBPatient", back_populates="visits")

Base.metadata.create_all(bind=engine)


# ==========================================
# SCHEMAS
# ==========================================
class ConversationTurn(BaseModel):
    user: str
    assistant: str

class DiagnosisRequest(BaseModel):
    patient_id: Optional[int] = None
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    height: Optional[float] = None
    keluhan: str
    gejala: Optional[str] = ""
    tandaVital: Optional[str] = ""
    hasilLab: Optional[str] = ""
    alergi: Optional[str] = ""
    riwayat: Optional[str] = ""
    catatan: Optional[str] = ""
    save_visit: bool = True
    conversation_history: Optional[List[ConversationTurn]] = []


# ==========================================
# AI DIAGNOSIS
# ==========================================
def generate_ai_diagnosis(patient_data: dict, db_history_text: str, conversation_history: list):
    system_prompt = """
Anda adalah asisten dokter spesialis (Clinical Decision Support System) yang sangat ahli dan akurat.
Tugas Anda adalah menganalisis data klinis pasien dan memberikan kemungkinan diagnosis beserta kode ICD-10,
rekomendasi pengobatan, dan tanda bahaya yang harus diwaspadai dokter.

PERHATIAN PENTING:
- Dosis obat WAJIB mempertimbangkan Umur dan Berat Badan pasien secara spesifik.
- WAJIB periksa alergi pasien — jangan merekomendasikan obat yang termasuk dalam daftar alergi!
- Jika ada riwayat percakapan sebelumnya, gunakan sebagai konteks tambahan untuk diagnosis yang lebih akurat.
- Berikan nama obat generik beserta dosis dan durasi pemakaian yang spesifik.
- Selalu pertimbangkan diagnosis banding (differential diagnosis).

FORMAT OUTPUT:
Anda WAJIB merespons HANYA dalam format JSON berikut (tanpa teks apapun di luar JSON):
{
    "penyakit": "Penjelasan kemungkinan diagnosis utama beserta diagnosis banding dan alasan klinis dalam 2-4 kalimat.",
    "icd10": [
        {"kode": "A15.0", "label": "Tuberculosis of lung, confirmed by sputum microscopy"},
        {"kode": "A15.3", "label": "Tuberculosis of lung, confirmed by unspecified means"}
    ],
    "rekomendasi": [
        "Nama obat generik — dosis — frekuensi — durasi (contoh: Paracetamol 500mg — 3x sehari — selama 3 hari)",
        "Tindakan non-farmakologi yang direkomendasikan",
        "Pemeriksaan penunjang yang disarankan beserta alasannya"
    ],
    "tanda_bahaya": "Sebutkan secara spesifik kondisi atau gejala red flag pada kasus ini yang mengharuskan rujukan segera ke IGD atau spesialis, beserta alasan klinisnya."
}

ATURAN TAMBAHAN:
- Berikan 2-4 kode ICD-10 yang paling relevan sebagai opsi pilihan dokter.
- Rekomendasi minimal 3 poin: farmakologi, non-farmakologi, dan penunjang.
- Tanda bahaya harus spesifik untuk kondisi pasien ini, bukan pernyataan umum.
- Selalu akhiri dengan catatan bahwa keputusan klinis final adalah wewenang dokter pemeriksa.
"""

    messages = [{"role": "system", "content": system_prompt}]

    # Tambahkan riwayat percakapan terfilter dari frontend (selective memory)
    for turn in conversation_history:
        messages.append({
            "role": "user",
            "content": turn["user"] if isinstance(turn, dict) else turn.user
        })
        messages.append({
            "role": "assistant",
            "content": turn["assistant"] if isinstance(turn, dict) else turn.assistant
        })

    # Prompt utama kunjungan saat ini
    user_prompt = f"""
DATA PASIEN:
- Nama: {patient_data['name']}
- Umur: {patient_data['age']} Tahun
- Gender: {patient_data['gender']}
- Berat Badan: {patient_data.get('weight') or '-'} kg
- Tinggi Badan: {patient_data.get('height') or '-'} cm
- Alergi: {patient_data.get('alergi') or 'Tidak ada / tidak diketahui'}
- Riwayat Penyakit Pribadi: {patient_data.get('riwayat') or 'Tidak ada / tidak diketahui'}

RIWAYAT KUNJUNGAN SEBELUMNYA (dari database):
{db_history_text}

KONDISI KUNJUNGAN SAAT INI:
- Keluhan Utama: {patient_data['keluhan']}
- Gejala Tambahan: {patient_data.get('gejala') or 'Tidak disebutkan'}
- Tanda Vital: {patient_data.get('tandaVital') or 'Tidak diukur'}
- Hasil Laboratorium: {patient_data.get('hasilLab') or 'Tidak ada'}
- Catatan Dokter: {patient_data.get('catatan') or 'Tidak ada'}

Berikan analisis diagnosis lengkap dalam format JSON yang sudah ditentukan.
"""

    messages.append({"role": "user", "content": user_prompt})

    response = client.chat.completions.create(
        model="gpt-5.4",
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=messages
    )

    result = json.loads(response.choices[0].message.content)

    # Pastikan semua field selalu ada
    if "icd10" not in result:
        result["icd10"] = []
    if "rekomendasi" not in result:
        result["rekomendasi"] = []
    if "tanda_bahaya" not in result:
        result["tanda_bahaya"] = "Tidak ada tanda bahaya kritis yang teridentifikasi pada kasus ini. Tetap monitor kondisi pasien."

    return result


# ==========================================
# ENDPOINTS
# ==========================================
@app.get("/api/history/{patient_id}")
def get_history(patient_id: int):
    db = SessionLocal()
    try:
        patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
        if not patient:
            return {"visits": []}
        visits = db.query(DBVisit).filter(DBVisit.patient_id == patient_id).all()
        return {
            "visits": [
                {
                    "id": v.id,
                    "keluhan": v.keluhan,
                    "gejala": v.gejala,
                    "tanda_vital": v.tanda_vital,
                    "hasil_lab": v.hasil_lab,
                    "alergi": v.alergi,
                    "diagnosis_ai": v.diagnosis_ai,
                }
                for v in reversed(visits)
            ]
        }
    finally:
        db.close()


@app.post("/api/analyze")
def analyze_diagnosis(req: DiagnosisRequest):
    db = SessionLocal()

    try:
        patient = None
        if req.patient_id:
            patient = db.query(DBPatient).filter(DBPatient.id == req.patient_id).first()

        # Ambil riwayat kunjungan dari DB untuk konteks jangka panjang
        db_history_text = "Belum ada riwayat kunjungan sebelumnya."
        if patient:
            past_visits = db.query(DBVisit).filter(DBVisit.patient_id == patient.id).all()
            if past_visits:
                db_history_text = "\n".join([
                    f"- Keluhan: '{v.keluhan}' → Diagnosis AI: '{v.diagnosis_ai}'"
                    for v in past_visits
                ])

        patient_dict = req.dict()
        ai_result = generate_ai_diagnosis(
            patient_dict,
            db_history_text,
            req.conversation_history or []
        )

        # Pastikan pasien ada di DB
        if not patient:
            patient = db.query(DBPatient).filter(
                DBPatient.name == req.name,
                DBPatient.age == req.age,
                DBPatient.gender == req.gender
            ).first()
        if not patient:
            patient = DBPatient(
                name=req.name, age=req.age, gender=req.gender,
                weight=req.weight, height=req.height
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)

        # Simpan ke DB hanya jika save_visit = True
        if req.save_visit:
            icd_summary = ", ".join([f"{i['kode']}" for i in ai_result.get("icd10", [])])
            new_visit = DBVisit(
                patient_id=patient.id,
                keluhan=req.keluhan,
                gejala=req.gejala,
                tanda_vital=req.tandaVital,
                hasil_lab=req.hasilLab,
                alergi=req.alergi,
                diagnosis_ai=f"{ai_result['penyakit']} [{icd_summary}]"
            )
            db.add(new_visit)
            db.commit()

        ai_result["db_patient_id"] = patient.id
        return ai_result

    finally:
        db.close()