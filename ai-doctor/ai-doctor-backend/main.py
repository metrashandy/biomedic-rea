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
import sqlite3 as _sqlite3

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
    icd10_codes = Column(Text)           # JSON string — pilihan dokter
    rekomendasi_terpilih = Column(Text)  # JSON string — pilihan dokter
    tanda_bahaya = Column(Text)          # teks tanda bahaya dari AI
    patient = relationship("DBPatient", back_populates="visits")

Base.metadata.create_all(bind=engine)

# ==========================================
# MIGRASI OTOMATIS — aman untuk DB lama
# Tambah kolom baru tanpa hapus data lama
# ==========================================
def _migrate_db():
    try:
        con = _sqlite3.connect("./clinic.db")
        cur = con.cursor()
        existing = [row[1] for row in cur.execute("PRAGMA table_info(visits)").fetchall()]
        migrations = [
            ("icd10_codes", "TEXT"),
            ("rekomendasi_terpilih", "TEXT"),
            ("tanda_bahaya", "TEXT"),
        ]
        for col_name, col_type in migrations:
            if col_name not in existing:
                cur.execute(f"ALTER TABLE visits ADD COLUMN {col_name} {col_type}")
                print(f"[migrate] kolom '{col_name}' ditambahkan")
        con.commit()
        con.close()
        print("[migrate] selesai")
    except Exception as e:
        print(f"[migrate] error: {e}")

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
    gejala: Optional[str] = ""
    tandaVital: Optional[str] = ""
    hasilLab: Optional[str] = ""
    alergi: Optional[str] = ""
    riwayat: Optional[str] = ""
    catatan: Optional[str] = ""
    save_visit: bool = False
    conversation_history: Optional[List[ConversationTurn]] = []

class SaveVisitRequest(BaseModel):
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
    diagnosis_final: Optional[str] = ""
    tanda_bahaya_final: Optional[str] = ""
    selected_icd10: Optional[List[dict]] = []
    selected_rekomendasi: Optional[List[str]] = []

class PatientRegisterRequest(BaseModel):
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    height: Optional[float] = None


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
        "Nama obat generik — dosis — frekuensi — durasi",
        "Tindakan non-farmakologi",
        "Pemeriksaan penunjang yang disarankan beserta alasannya"
    ],
    "tanda_bahaya": "Sebutkan secara spesifik kondisi atau gejala red flag pada kasus ini yang mengharuskan rujukan segera ke IGD atau spesialis."
}

ATURAN:
- Berikan 2-4 kode ICD-10 yang paling relevan.
- Rekomendasi minimal 3 poin: farmakologi, non-farmakologi, dan penunjang.
- Tanda bahaya harus spesifik untuk kondisi pasien ini.
- Keputusan klinis final adalah wewenang dokter pemeriksa.
"""

    messages = [{"role": "system", "content": system_prompt}]

    for turn in conversation_history:
        messages.append({
            "role": "user",
            "content": turn["user"] if isinstance(turn, dict) else turn.user
        })
        messages.append({
            "role": "assistant",
            "content": turn["assistant"] if isinstance(turn, dict) else turn.assistant
        })

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

Berikan analisis diagnosis lengkap dalam format JSON.
"""

    messages.append({"role": "user", "content": user_prompt})

    response = client.chat.completions.create(
        model="gpt-5.4",
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=messages
    )

    result = json.loads(response.choices[0].message.content)

    if "icd10" not in result:
        result["icd10"] = []
    if "rekomendasi" not in result:
        result["rekomendasi"] = []
    if "tanda_bahaya" not in result:
        result["tanda_bahaya"] = "Tidak ada tanda bahaya kritis yang teridentifikasi. Tetap monitor kondisi pasien."

    return result


# ==========================================
# HELPER — ambil atau buat pasien di DB
# ==========================================
def get_or_create_patient(db, patient_id, name, age, gender, weight, height):
    patient = None
    if patient_id:
        patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
    if not patient:
        patient = db.query(DBPatient).filter(
            DBPatient.name == name,
            DBPatient.age == age,
            DBPatient.gender == gender
        ).first()
    if not patient:
        patient = DBPatient(
            name=name, age=age, gender=gender,
            weight=weight, height=height
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
    return patient


# ==========================================
# ENDPOINTS
# ==========================================

@app.post("/api/patients/register")
def register_patient(req: PatientRegisterRequest):
    db = SessionLocal()
    try:
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
                    "tanda_bahaya": v.tanda_bahaya or "",
                    "icd10_codes": json.loads(v.icd10_codes) if v.icd10_codes else [],
                    "rekomendasi_terpilih": json.loads(v.rekomendasi_terpilih) if v.rekomendasi_terpilih else [],
                }
                for v in reversed(visits)
            ]
        }
    finally:
        db.close()


@app.post("/api/analyze")
def analyze_diagnosis(req: DiagnosisRequest):
    """Hanya untuk analisis AI — tidak simpan ke DB."""
    db = SessionLocal()
    try:
        patient = get_or_create_patient(
            db, req.patient_id, req.name, req.age, req.gender, req.weight, req.height
        )

        # Ambil riwayat kunjungan dari DB untuk konteks jangka panjang
        db_history_text = "Belum ada riwayat kunjungan sebelumnya."
        past_visits = db.query(DBVisit).filter(DBVisit.patient_id == patient.id).all()
        if past_visits:
            db_history_text = "\n".join([
                f"- Keluhan: '{v.keluhan}' | Diagnosis: '{v.diagnosis_ai}' | ICD-10: {v.icd10_codes or '[]'}"
                for v in past_visits
            ])

        patient_dict = req.dict()
        ai_result = generate_ai_diagnosis(
            patient_dict,
            db_history_text,
            req.conversation_history or []
        )

        ai_result["db_patient_id"] = patient.id
        return ai_result

    finally:
        db.close()


@app.post("/api/save-visit")
def save_visit(req: SaveVisitRequest):
    """Simpan kunjungan ke DB — TANPA panggil OpenAI, langsung simpan pilihan dokter."""
    db = SessionLocal()
    try:
        patient = get_or_create_patient(
            db, req.patient_id, req.name, req.age, req.gender, req.weight, req.height
        )

        new_visit = DBVisit(
            patient_id=patient.id,
            keluhan=req.keluhan,
            gejala=req.gejala,
            tanda_vital=req.tandaVital,
            hasil_lab=req.hasilLab,
            alergi=req.alergi,
            diagnosis_ai=req.diagnosis_final or "",
            tanda_bahaya=req.tanda_bahaya_final or "",
            icd10_codes=json.dumps(req.selected_icd10 or [], ensure_ascii=False),
            rekomendasi_terpilih=json.dumps(req.selected_rekomendasi or [], ensure_ascii=False),
        )
        db.add(new_visit)
        db.commit()

        return {"success": True, "patient_id": patient.id, "visit_id": new_visit.id}

    finally:
        db.close()