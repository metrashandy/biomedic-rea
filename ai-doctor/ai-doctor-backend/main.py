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
    diagnosis_ai = Column(Text)       # Teks narasi diagnosis
    icd10_codes = Column(Text)        # Kode ICD-10 yang disimpan (JSON string)
    rekomendasi_terpilih = Column(Text)  # Rekomendasi terapi yang disimpan (JSON string)
    patient = relationship("DBPatient", back_populates="visits")

Base.metadata.create_all(bind=engine)

# Migrasi: tambah kolom baru jika belum ada (aman untuk DB lama)
import sqlite3 as _sqlite3
def _migrate_db():
    try:
        con = _sqlite3.connect("./clinic.db")
        cur = con.cursor()
        existing = [row[1] for row in cur.execute("PRAGMA table_info(visits)").fetchall()]
        if "icd10_codes" not in existing:
            cur.execute("ALTER TABLE visits ADD COLUMN icd10_codes TEXT")
            print("[migrate] kolom icd10_codes ditambahkan")
        if "rekomendasi_terpilih" not in existing:
            cur.execute("ALTER TABLE visits ADD COLUMN rekomendasi_terpilih TEXT")
            print("[migrate] kolom rekomendasi_terpilih ditambahkan")
        con.commit()
        con.close()
    except Exception as e:
        print(f"[migrate] skip: {e}")
_migrate_db()


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
    gejala: str
    tandaVital: Optional[str] = ""
    hasilLab: Optional[str] = ""
    alergi: Optional[str] = ""
    riwayat: Optional[str] = ""
    catatan: Optional[str] = ""
    save_visit: bool = True
    conversation_history: Optional[List[ConversationTurn]] = []
    # Pilihan dokter via checkbox selective memory
    icd10_terpilih: Optional[List[dict]] = None
    rekomendasi_terpilih: Optional[List[str]] = None


# ==========================================
# AI DIAGNOSIS dengan Contextual Memory + ICD-10
# ==========================================
def generate_ai_diagnosis(patient_data: dict, db_history_text: str, conversation_history: list):
    system_prompt = """
Anda adalah asisten dokter spesialis (Clinical Decision Support System) yang sangat ahli dan akurat.
Tugas Anda adalah menganalisis data klinis pasien dan memberikan kemungkinan diagnosis beserta kode ICD-10 dan rekomendasi pengobatan.

PERHATIAN PENTING:
- Dosis obat harus mempertimbangkan Umur dan Berat Badan pasien.
- Wajib periksa dan perhatikan alergi obat yang disebutkan!
- Jika ada riwayat percakapan sebelumnya, gunakan sebagai konteks tambahan.

FORMAT OUTPUT:
Anda WAJIB merespons HANYA dalam format JSON berikut (tanpa tambahan apapun di luar JSON):
{
    "penyakit": "Penjelasan singkat kemungkinan diagnosis medis dalam 1-3 kalimat...",
    "icd10": [
        {"kode": "A15.0", "label": "Tuberculosis of lung, confirmed by sputum microscopy"},
        {"kode": "A15.3", "label": "Tuberculosis of lung, confirmed by unspecified means"}
    ],
    "rekomendasi": [
        "Rekomendasi 1 dengan dosis spesifik jika obat...",
        "Rekomendasi 2...",
        "Rekomendasi tindakan penunjang..."
    ]
}

Berikan 2-4 kode ICD-10 yang paling relevan sebagai opsi pilihan dokter.
"""

    # Bangun messages array dengan history percakapan
    messages = [{"role": "system", "content": system_prompt}]

    # Tambahkan riwayat percakapan dari sesi ini (selective memory dari frontend)
    for turn in conversation_history:
        messages.append({"role": "user", "content": turn["user"] if isinstance(turn, dict) else turn.user})
        messages.append({"role": "assistant", "content": turn["assistant"] if isinstance(turn, dict) else turn.assistant})

    # Prompt utama untuk kunjungan saat ini
    user_prompt = f"""
DATA PASIEN:
- Nama: {patient_data['name']}
- Umur: {patient_data['age']} Tahun
- Gender: {patient_data['gender']}
- Berat Badan: {patient_data.get('weight') or '-'} kg
- Tinggi Badan: {patient_data.get('height') or '-'} cm
- Alergi: {patient_data.get('alergi') or 'Tidak ada'}
- Riwayat Penyakit Pribadi: {patient_data.get('riwayat') or 'Tidak ada'}

RIWAYAT KUNJUNGAN DATABASE (kunjungan sebelumnya):
{db_history_text}

KONDISI SAAT INI:
- Keluhan Utama: {patient_data['keluhan']}
- Gejala Tambahan: {patient_data['gejala']}
- Tanda Vital: {patient_data.get('tandaVital') or 'Tidak diisi'}
- Hasil Laboratorium: {patient_data.get('hasilLab') or 'Tidak ada'}
- Catatan Dokter: {patient_data.get('catatan') or 'Tidak ada'}

Berikan diagnosis, kode ICD-10 (2-4 opsi paling relevan), dan rekomendasi terapi dalam format JSON.
"""

    messages.append({"role": "user", "content": user_prompt})

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=messages
    )

    result = json.loads(response.choices[0].message.content)

    # Pastikan field icd10 selalu ada meski AI tidak mengeluarkannya
    if "icd10" not in result:
        result["icd10"] = []
    if "rekomendasi" not in result:
        result["rekomendasi"] = []

    return result


# ==========================================
# ENDPOINT
# ==========================================
class PatientRegisterRequest(BaseModel):
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    height: Optional[float] = None


@app.post("/api/patients/register")
def register_patient(req: PatientRegisterRequest):
    db = SessionLocal()
    try:
        # Cek duplikat by nama+umur+gender
        existing = db.query(DBPatient).filter(
            DBPatient.name == req.name,
            DBPatient.age == req.age,
            DBPatient.gender == req.gender
        ).first()
        if existing:
            return {"patient": {
                "id": existing.id, "name": existing.name,
                "age": existing.age, "gender": existing.gender,
                "weight": existing.weight, "height": existing.height,
            }}
        patient = DBPatient(
            name=req.name, age=req.age, gender=req.gender,
            weight=req.weight, height=req.height
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return {"patient": {
            "id": patient.id, "name": patient.name,
            "age": patient.age, "gender": patient.gender,
            "weight": patient.weight, "height": patient.height,
        }}
    finally:
        db.close()


@app.get("/api/patients")
def get_all_patients():
    db = SessionLocal()
    try:
        patients = db.query(DBPatient).all()
        result = []
        for p in patients:
            visits = db.query(DBVisit).filter(DBVisit.patient_id == p.id).all()
            last_visit = visits[-1] if visits else None
            result.append({
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "weight": p.weight,
                "height": p.height,
                "total_kunjungan": len(visits),
                "keluhan_terakhir": last_visit.keluhan if last_visit else None,
                "diagnosis_terakhir": last_visit.diagnosis_ai if last_visit else None,
            })
        return {"patients": result}
    finally:
        db.close()


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
                    "icd10_codes": json.loads(v.icd10_codes) if v.icd10_codes else [],
                    "rekomendasi_terpilih": json.loads(v.rekomendasi_terpilih) if v.rekomendasi_terpilih else [],
                }
                for v in reversed(visits)  # terbaru dulu
            ]
        }
    finally:
        db.close()


@app.post("/api/analyze")
def analyze_diagnosis(req: DiagnosisRequest):
    db = SessionLocal()

    try:
        # Cari pasien lama untuk ambil riwayat DB
        patient = None
        if req.patient_id:
            patient = db.query(DBPatient).filter(DBPatient.id == req.patient_id).first()

        # Ambil riwayat kunjungan dari DB (konteks jangka panjang)
        db_history_text = "Belum ada riwayat kunjungan sebelumnya."
        if patient:
            past_visits = db.query(DBVisit).filter(DBVisit.patient_id == patient.id).all()
            if past_visits:
                db_history_text = "\n".join([
                    f"- Keluhan: '{v.keluhan}' → Diagnosis AI: '{v.diagnosis_ai}'"
                    for v in past_visits
                ])

        # Panggil AI dengan conversation history
        patient_dict = req.dict()
        ai_result = generate_ai_diagnosis(
            patient_dict,
            db_history_text,
            req.conversation_history or []
        )

        # Pastikan pasien selalu ada di DB agar db_patient_id bisa dikembalikan ke frontend
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

        # Simpan kunjungan ke DB hanya kalau save_visit = True
        if req.save_visit:
            # Pakai pilihan dokter jika ada, fallback ke semua hasil AI
            icd10_dipilih = req.icd10_terpilih if req.icd10_terpilih is not None else ai_result.get("icd10", [])
            rekomendasi_dipilih = req.rekomendasi_terpilih if req.rekomendasi_terpilih is not None else ai_result.get("rekomendasi", [])

            new_visit = DBVisit(
                patient_id=patient.id,
                keluhan=req.keluhan,
                gejala=req.gejala,
                tanda_vital=req.tandaVital,
                hasil_lab=req.hasilLab,
                alergi=req.alergi,
                diagnosis_ai=ai_result["penyakit"],
                icd10_codes=json.dumps(icd10_dipilih, ensure_ascii=False),
                rekomendasi_terpilih=json.dumps(rekomendasi_dipilih, ensure_ascii=False)
            )
            db.add(new_visit)
            db.commit()

        # Selalu kembalikan db_patient_id agar frontend bisa sinkron ID
        ai_result["db_patient_id"] = patient.id
        return ai_result

    finally:
        db.close()