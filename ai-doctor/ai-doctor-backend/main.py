from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from typing import List, Optional
import sqlite3 as _sqlite3
import base64
import shutil
import uuid
from datetime import datetime

# PDF
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT

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

UPLOAD_DIR = "./uploads"
PDF_DIR = "./pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)


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
    icd10_codes = Column(Text)
    rekomendasi_terpilih = Column(Text)
    tanda_bahaya = Column(Text)
    # Kolom baru
    teks_bebas = Column(Text)
    chat_history = Column(Text)          # JSON string riwayat konsultasi
    saran_pemeriksaan = Column(Text)
    image_path = Column(String)
    analisis_gambar = Column(Text)
    pdf_path = Column(String)
    created_at = Column(String)
    patient = relationship("DBPatient", back_populates="visits")


Base.metadata.create_all(bind=engine)


# ==========================================
# MIGRASI OTOMATIS
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
            ("teks_bebas", "TEXT"),
            ("chat_history", "TEXT"),
            ("saran_pemeriksaan", "TEXT"),
            ("image_path", "TEXT"),
            ("analisis_gambar", "TEXT"),
            ("pdf_path", "TEXT"),
            ("created_at", "TEXT"),
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

class ChatTurn(BaseModel):
    role: str   # "dokter" | "ai"
    content: str

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
    teks_bebas: Optional[str] = ""
    save_visit: bool = False
    conversation_history: Optional[List[ConversationTurn]] = []
    chat_konsultasi: Optional[List[ChatTurn]] = []

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
    teks_bebas: Optional[str] = ""
    chat_konsultasi: Optional[List[ChatTurn]] = []
    diagnosis_final: Optional[str] = ""
    tanda_bahaya_final: Optional[str] = ""
    saran_pemeriksaan_final: Optional[str] = ""
    selected_icd10: Optional[List[dict]] = []
    selected_rekomendasi: Optional[List[str]] = []
    image_path: Optional[str] = ""
    analisis_gambar: Optional[str] = ""

class PatientRegisterRequest(BaseModel):
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    height: Optional[float] = None

class ImageAnalysisRequest(BaseModel):
    patient_id: Optional[int] = None
    name: str
    age: int
    gender: str
    keluhan: Optional[str] = ""
    gejala: Optional[str] = ""
    image_base64: str
    image_type: Optional[str] = "image/jpeg"

class ChatRequest(BaseModel):
    patient_id: Optional[int] = None
    name: str
    age: int
    gender: str
    # Konteks dari hasil diagnosis yang sudah ada (bukan form gejala)
    diagnosis_context: Optional[dict] = None
    chat_history: Optional[List[ChatTurn]] = []
    pesan: str


# ==========================================
# AI FUNCTIONS
# ==========================================
def generate_ai_diagnosis(patient_data: dict, db_history_text: str, conversation_history: list, chat_konsultasi: list = []):
    system_prompt = """
Anda adalah asisten dokter spesialis (Clinical Decision Support System) yang sangat ahli dan akurat.
Tugas Anda adalah menganalisis data klinis pasien dan memberikan kemungkinan diagnosis beserta kode ICD-10,
rekomendasi pengobatan, saran pemeriksaan lanjutan, dan tanda bahaya yang harus diwaspadai dokter.

PERHATIAN PENTING:
- Dosis obat WAJIB mempertimbangkan Umur dan Berat Badan pasien secara spesifik.
- WAJIB periksa alergi pasien — jangan merekomendasikan obat yang termasuk dalam daftar alergi!
- Jika ada riwayat percakapan atau catatan konsultasi, gunakan sebagai konteks tambahan.
- Berikan nama obat generik beserta dosis dan durasi pemakaian yang spesifik.
- Selalu pertimbangkan diagnosis banding (differential diagnosis).
- Jika data belum cukup untuk diagnosis pasti, sampaikan dan berikan saran pemeriksaan untuk melengkapi data.

FORMAT OUTPUT:
Anda WAJIB merespons HANYA dalam format JSON berikut (tanpa teks apapun di luar JSON):
{
    "penyakit": "Penjelasan kemungkinan diagnosis utama beserta diagnosis banding dan alasan klinis dalam 2-4 kalimat.",
    "icd10": [
        {"kode": "A15.0", "label": "Tuberculosis of lung, confirmed by sputum microscopy"}
    ],
    "rekomendasi": [
        "Nama obat generik — dosis — frekuensi — durasi",
        "Tindakan non-farmakologi",
        "Pemeriksaan penunjang yang disarankan beserta alasannya"
    ],
    "saran_pemeriksaan": [
        "Pemeriksaan 1 — alasan mengapa perlu",
        "Pemeriksaan 2 — tujuan pemeriksaan"
    ],
    "pertanyaan_lanjutan": [
        "Pertanyaan relevan 1 untuk melengkapi anamnesis",
        "Pertanyaan relevan 2"
    ],
    "tanda_bahaya": "Sebutkan secara spesifik kondisi atau gejala red flag pada kasus ini yang mengharuskan rujukan segera ke IGD atau spesialis.",
    "kelengkapan_data": "Singkat: apakah data sudah cukup untuk diagnosis atau masih memerlukan informasi tambahan."
}

ATURAN:
- Berikan 2-4 kode ICD-10 yang paling relevan.
- Rekomendasi minimal 3 poin: farmakologi, non-farmakologi, dan penunjang.
- Saran pemeriksaan: 2-4 pemeriksaan lanjutan yang perlu dilakukan.
- Pertanyaan lanjutan: 2-3 pertanyaan untuk anamnesis lebih lanjut.
- Keputusan klinis final adalah wewenang dokter pemeriksa.
"""

    messages = [{"role": "system", "content": system_prompt}]

    for turn in conversation_history:
        messages.append({"role": "user", "content": turn["user"] if isinstance(turn, dict) else turn.user})
        messages.append({"role": "assistant", "content": turn["assistant"] if isinstance(turn, dict) else turn.assistant})

    # Susun chat konsultasi sebagai bagian dari prompt
    chat_text = ""
    if chat_konsultasi:
        chat_lines = []
        for t in chat_konsultasi:
            role = t["role"] if isinstance(t, dict) else t.role
            content = t["content"] if isinstance(t, dict) else t.content
            prefix = "Dokter" if role == "dokter" else "AI"
            chat_lines.append(f"{prefix}: {content}")
        chat_text = "\n".join(chat_lines)

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
- Teks Bebas / Keterangan Tambahan: {patient_data.get('teks_bebas') or 'Tidak ada'}

{f'RIWAYAT KONSULTASI INTERAKTIF:{chr(10)}{chat_text}' if chat_text else ''}

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

    defaults = {
        "icd10": [],
        "rekomendasi": [],
        "saran_pemeriksaan": [],
        "pertanyaan_lanjutan": [],
        "tanda_bahaya": "Tidak ada tanda bahaya kritis yang teridentifikasi. Tetap monitor kondisi pasien.",
        "kelengkapan_data": "Data telah dianalisis."
    }
    for key, val in defaults.items():
        if key not in result:
            result[key] = val

    return result


def analyze_image_with_ai(image_base64: str, image_type: str, patient_data: dict):
    system_prompt = """
Anda adalah asisten dokter yang membantu menganalisis temuan fisik dari foto/gambar umum.
Foto ini bukan hasil alat medis khusus, melainkan foto biasa dari pasien.

Analisis gambar secara umum dan hubungkan dengan keluhan pasien jika ada.

FORMAT OUTPUT (WAJIB JSON):
{
    "deskripsi_gambar": "Deskripsi visual apa yang terlihat pada gambar secara objektif.",
    "kemungkinan_temuan": "Kemungkinan kondisi medis berdasarkan temuan visual, dikaitkan dengan keluhan.",
    "rekomendasi_lanjut": "Apakah perlu pemeriksaan lebih lanjut berdasarkan temuan gambar.",
    "catatan": "Catatan penting bahwa analisis ini hanya pendukung, bukan diagnosis pasti."
}

BATASAN: Jangan memberikan diagnosis pasti hanya dari foto. Selalu sarankan pemeriksaan langsung oleh dokter.
"""

    keluhan_info = f"Keluhan: {patient_data.get('keluhan', '-')}" if patient_data.get('keluhan') else ""
    gejala_info = f"Gejala tambahan: {patient_data.get('gejala', '-')}" if patient_data.get('gejala') else ""

    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{image_type};base64,{image_base64}"
            }
        },
        {
            "type": "text",
            "text": f"""Analisis foto temuan fisik pasien berikut:
Pasien: {patient_data.get('name', '-')}, {patient_data.get('age', '-')} tahun, {patient_data.get('gender', '-')}
{keluhan_info}
{gejala_info}

Berikan analisis dalam format JSON."""
        }
    ]

    response = client.chat.completions.create(
        model="gpt-5.4",
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    )

    return json.loads(response.choices[0].message.content)


# ==========================================
# PDF GENERATOR
# ==========================================
def generate_pdf_report(visit_data: dict, patient_data: dict) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"laporan_{patient_data['id']}_{timestamp}.pdf"
    filepath = os.path.join(PDF_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    # Style kustom
    style_title = ParagraphStyle('CustomTitle', parent=styles['Title'],
        fontSize=16, spaceAfter=6, textColor=colors.HexColor('#1d4ed8'), alignment=TA_CENTER)
    style_subtitle = ParagraphStyle('Subtitle', parent=styles['Normal'],
        fontSize=10, spaceAfter=12, textColor=colors.grey, alignment=TA_CENTER)
    style_h2 = ParagraphStyle('H2', parent=styles['Heading2'],
        fontSize=12, spaceBefore=14, spaceAfter=4,
        textColor=colors.HexColor('#1e40af'),
        borderPad=4)
    style_body = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, spaceAfter=4, leading=14)
    style_small = ParagraphStyle('Small', parent=styles['Normal'],
        fontSize=9, textColor=colors.grey, spaceAfter=2)
    style_bold = ParagraphStyle('Bold', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica-Bold', spaceAfter=4)
    style_disclaimer = ParagraphStyle('Disclaimer', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#dc2626'),
        borderColor=colors.HexColor('#fca5a5'),
        backColor=colors.HexColor('#fef2f2'),
        borderPad=6, borderWidth=1, alignment=TA_CENTER)

    story = []
    now = datetime.now().strftime("%d %B %Y, %H:%M")

    # ===== HEADER =====
    story.append(Paragraph("LAPORAN ANALISIS KLINIS", style_title))
    story.append(Paragraph("AI Doctor — Clinical Decision Support System", style_subtitle))
    story.append(Paragraph(f"Tanggal: {now}", style_subtitle))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1d4ed8'), spaceAfter=14))

    # ===== DATA PASIEN =====
    story.append(Paragraph("1. Identitas Pasien", style_h2))
    patient_table_data = [
        ["Nama", ":", patient_data.get('name', '-')],
        ["Umur / Gender", ":", f"{patient_data.get('age', '-')} tahun / {patient_data.get('gender', '-')}"],
        ["Berat / Tinggi", ":", f"{patient_data.get('weight') or '-'} kg / {patient_data.get('height') or '-'} cm"],
        ["No. RM", ":", f"RM-{str(patient_data.get('id', 0)).zfill(3)}"],
    ]
    pt = Table(patient_table_data, colWidths=[4*cm, 0.5*cm, 12*cm])
    pt.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(pt)
    story.append(Spacer(1, 10))

    # ===== ANAMNESIS =====
    story.append(Paragraph("2. Anamnesis & Pemeriksaan", style_h2))

    fields = [
        ("Keluhan Utama", visit_data.get('keluhan', '-')),
        ("Gejala Tambahan", visit_data.get('gejala') or '-'),
        ("Tanda Vital", visit_data.get('tanda_vital') or '-'),
        ("Hasil Laboratorium", visit_data.get('hasil_lab') or '-'),
        ("Alergi", visit_data.get('alergi') or '-'),
    ]
    for label, val in fields:
        story.append(Paragraph(f"<b>{label}:</b> {val}", style_body))

    if visit_data.get('teks_bebas'):
        story.append(Spacer(1, 6))
        story.append(Paragraph("<b>Catatan Bebas Dokter / Keterangan Tambahan:</b>", style_body))
        story.append(Paragraph(visit_data['teks_bebas'], style_body))

    story.append(Spacer(1, 10))

    # ===== CHAT KONSULTASI =====
    chat_history = []
    if visit_data.get('chat_history'):
        try:
            chat_history = json.loads(visit_data['chat_history'])
        except:
            chat_history = []

    if chat_history:
        story.append(Paragraph("3. Riwayat Konsultasi Interaktif", style_h2))
        for i, turn in enumerate(chat_history):
            role = turn.get('role', '')
            content = turn.get('content', '')
            prefix = "Dokter" if role == "dokter" else "AI"
            color_hex = '#1e40af' if role == 'dokter' else '#065f46'
            bubble_style = ParagraphStyle(f'bubble_{i}', parent=styles['Normal'],
                fontSize=9, leading=13,
                textColor=colors.HexColor(color_hex),
                leftIndent=10 if role == 'ai' else 0,
                rightIndent=0 if role == 'ai' else 10,
                spaceAfter=3)
            story.append(Paragraph(f"<b>[{prefix}]</b> {content}", bubble_style))
        story.append(Spacer(1, 10))

    # ===== HASIL AI =====
    section_num = 4 if chat_history else 3
    story.append(Paragraph(f"{section_num}. Hasil Analisis AI", style_h2))
    story.append(Paragraph(f"<b>Kemungkinan Diagnosis:</b>", style_bold))
    story.append(Paragraph(visit_data.get('diagnosis_ai', '-'), style_body))
    story.append(Spacer(1, 6))

    if visit_data.get('kelengkapan_data'):
        story.append(Paragraph(f"<b>Kelengkapan Data:</b> {visit_data['kelengkapan_data']}", style_body))
        story.append(Spacer(1, 6))

    # ICD-10
    icd10_list = []
    if visit_data.get('icd10_codes'):
        try:
            icd10_list = json.loads(visit_data['icd10_codes'])
        except:
            icd10_list = []

    if icd10_list:
        story.append(Paragraph("<b>Kode ICD-10:</b>", style_bold))
        for item in icd10_list:
            story.append(Paragraph(f"• {item.get('kode', '')} — {item.get('label', '')}", style_body))
        story.append(Spacer(1, 6))

    # Rekomendasi
    rek_list = []
    if visit_data.get('rekomendasi_terpilih'):
        try:
            rek_list = json.loads(visit_data['rekomendasi_terpilih'])
        except:
            rek_list = []

    if rek_list:
        story.append(Paragraph("<b>Rekomendasi Terapi:</b>", style_bold))
        for rek in rek_list:
            story.append(Paragraph(f"• {rek}", style_body))
        story.append(Spacer(1, 6))

    # Saran Pemeriksaan
    if visit_data.get('saran_pemeriksaan'):
        story.append(Paragraph("<b>Saran Pemeriksaan Lanjutan:</b>", style_bold))
        story.append(Paragraph(visit_data['saran_pemeriksaan'], style_body))
        story.append(Spacer(1, 6))

    # Tanda Bahaya
    if visit_data.get('tanda_bahaya'):
        story.append(Paragraph("<b>Tanda Bahaya / Indikasi Rujukan:</b>", style_bold))
        danger_style = ParagraphStyle('danger', parent=styles['Normal'],
            fontSize=10, textColor=colors.HexColor('#dc2626'),
            backColor=colors.HexColor('#fef2f2'),
            borderColor=colors.HexColor('#fca5a5'),
            borderWidth=1, borderPad=6, spaceAfter=6)
        story.append(Paragraph(visit_data['tanda_bahaya'], danger_style))
        story.append(Spacer(1, 6))

    # ===== ANALISIS GAMBAR =====
    if visit_data.get('analisis_gambar'):
        section_num += 1
        story.append(Paragraph(f"{section_num}. Analisis Foto / Temuan Fisik", style_h2))
        try:
            img_result = json.loads(visit_data['analisis_gambar'])
            fields_img = [
                ("Deskripsi Visual", img_result.get('deskripsi_gambar', '-')),
                ("Kemungkinan Temuan", img_result.get('kemungkinan_temuan', '-')),
                ("Rekomendasi", img_result.get('rekomendasi_lanjut', '-')),
                ("Catatan", img_result.get('catatan', '-')),
            ]
            for label, val in fields_img:
                story.append(Paragraph(f"<b>{label}:</b> {val}", style_body))
        except:
            story.append(Paragraph(visit_data['analisis_gambar'], style_body))
        story.append(Spacer(1, 10))

    # ===== FOOTER DISCLAIMER =====
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey, spaceBefore=16, spaceAfter=10))
    story.append(Paragraph(
        "⚠️ DISCLAIMER: Hasil analisis ini hanya sebagai Clinical Decision Support System (CDSS). "
        "Keputusan medis, diagnosis akhir, dan resep obat mutlak merupakan tanggung jawab dokter pemeriksa. "
        "Sistem AI tidak menggantikan pemeriksaan langsung oleh tenaga medis yang kompeten.",
        style_disclaimer
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Dicetak oleh: AI Doctor System | {now}", style_small))

    doc.build(story)
    return filepath


# ==========================================
# HELPER
# ==========================================
def get_or_create_patient(db, patient_id, name, age, gender, weight, height):
    patient = None
    if patient_id:
        patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
    if not patient:
        patient = db.query(DBPatient).filter(
            DBPatient.name == name, DBPatient.age == age, DBPatient.gender == gender
        ).first()
    if not patient:
        patient = DBPatient(name=name, age=age, gender=gender, weight=weight, height=height)
        db.add(patient)
        db.commit()
        db.refresh(patient)
    return patient


# ==========================================
# ENDPOINTS — LAMA (tidak berubah)
# ==========================================
@app.post("/api/patients/register")
def register_patient(req: PatientRegisterRequest):
    db = SessionLocal()
    try:
        existing = db.query(DBPatient).filter(
            DBPatient.name == req.name, DBPatient.age == req.age, DBPatient.gender == req.gender
        ).first()
        if existing:
            return {"patient": {"id": existing.id, "name": existing.name,
                "age": existing.age, "gender": existing.gender,
                "weight": existing.weight, "height": existing.height}}
        patient = DBPatient(name=req.name, age=req.age, gender=req.gender,
            weight=req.weight, height=req.height)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return {"patient": {"id": patient.id, "name": patient.name,
            "age": patient.age, "gender": patient.gender,
            "weight": patient.weight, "height": patient.height}}
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
                "id": p.id, "name": p.name, "age": p.age, "gender": p.gender,
                "weight": p.weight, "height": p.height,
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
                    "teks_bebas": v.teks_bebas or "",
                    "diagnosis_ai": v.diagnosis_ai,
                    "tanda_bahaya": v.tanda_bahaya or "",
                    "saran_pemeriksaan": v.saran_pemeriksaan or "",
                    "icd10_codes": json.loads(v.icd10_codes) if v.icd10_codes else [],
                    "rekomendasi_terpilih": json.loads(v.rekomendasi_terpilih) if v.rekomendasi_terpilih else [],
                    "chat_history": json.loads(v.chat_history) if v.chat_history else [],
                    "analisis_gambar": v.analisis_gambar or "",
                    "has_image": bool(v.image_path),
                    "created_at": v.created_at or "",
                    "pdf_path": v.pdf_path or "",
                }
                for v in reversed(visits)
            ]
        }
    finally:
        db.close()


# ==========================================
# ENDPOINT ANALISIS UTAMA (diperkaya)
# ==========================================
@app.post("/api/analyze")
def analyze_diagnosis(req: DiagnosisRequest):
    db = SessionLocal()
    try:
        patient = get_or_create_patient(
            db, req.patient_id, req.name, req.age, req.gender, req.weight, req.height
        )

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
            req.conversation_history or [],
            req.chat_konsultasi or []
        )

        ai_result["db_patient_id"] = patient.id
        return ai_result

    finally:
        db.close()


# ==========================================
# ENDPOINT BARU: Analisis Gambar
# ==========================================
@app.post("/api/analyze-image")
def analyze_image(req: ImageAnalysisRequest):
    patient_data = {
        "name": req.name,
        "age": req.age,
        "gender": req.gender,
        "keluhan": req.keluhan,
        "gejala": req.gejala,
    }
    result = analyze_image_with_ai(req.image_base64, req.image_type, patient_data)

    # Simpan gambar ke disk
    try:
        img_bytes = base64.b64decode(req.image_base64)
        ext = req.image_type.split("/")[-1] if "/" in req.image_type else "jpg"
        img_filename = f"{uuid.uuid4().hex}.{ext}"
        img_path = os.path.join(UPLOAD_DIR, img_filename)
        with open(img_path, "wb") as f:
            f.write(img_bytes)
        result["saved_image_path"] = img_path
    except Exception as e:
        result["saved_image_path"] = ""

    return result


# ==========================================
# ENDPOINT BARU: Simpan kunjungan (diperkaya)
# ==========================================
@app.post("/api/save-visit")
def save_visit(req: SaveVisitRequest):
    db = SessionLocal()
    try:
        patient = get_or_create_patient(
            db, req.patient_id, req.name, req.age, req.gender, req.weight, req.height
        )

        chat_json = json.dumps(
            [t.dict() if hasattr(t, 'dict') else t for t in (req.chat_konsultasi or [])],
            ensure_ascii=False
        )

        new_visit = DBVisit(
            patient_id=patient.id,
            keluhan=req.keluhan,
            gejala=req.gejala,
            tanda_vital=req.tandaVital,
            hasil_lab=req.hasilLab,
            alergi=req.alergi,
            teks_bebas=req.teks_bebas or "",
            chat_history=chat_json,
            diagnosis_ai=req.diagnosis_final or "",
            tanda_bahaya=req.tanda_bahaya_final or "",
            saran_pemeriksaan=req.saran_pemeriksaan_final or "",
            icd10_codes=json.dumps(req.selected_icd10 or [], ensure_ascii=False),
            rekomendasi_terpilih=json.dumps(req.selected_rekomendasi or [], ensure_ascii=False),
            image_path=req.image_path or "",
            analisis_gambar=req.analisis_gambar or "",
            created_at=datetime.now().strftime("%d/%m/%Y %H:%M"),
        )
        db.add(new_visit)
        db.commit()
        db.refresh(new_visit)

        return {"success": True, "patient_id": patient.id, "visit_id": new_visit.id}

    finally:
        db.close()


# ==========================================
# ENDPOINT BARU: Generate PDF
# ==========================================
@app.get("/api/generate-pdf/{visit_id}")
def generate_pdf(visit_id: int):
    db = SessionLocal()
    try:
        visit = db.query(DBVisit).filter(DBVisit.id == visit_id).first()
        if not visit:
            return {"error": "Kunjungan tidak ditemukan"}

        patient = db.query(DBPatient).filter(DBPatient.id == visit.patient_id).first()

        visit_data = {
            "keluhan": visit.keluhan,
            "gejala": visit.gejala,
            "tanda_vital": visit.tanda_vital,
            "hasil_lab": visit.hasil_lab,
            "alergi": visit.alergi,
            "teks_bebas": visit.teks_bebas,
            "chat_history": visit.chat_history,
            "diagnosis_ai": visit.diagnosis_ai,
            "tanda_bahaya": visit.tanda_bahaya,
            "saran_pemeriksaan": visit.saran_pemeriksaan,
            "icd10_codes": visit.icd10_codes,
            "rekomendasi_terpilih": visit.rekomendasi_terpilih,
            "analisis_gambar": visit.analisis_gambar,
            "kelengkapan_data": "",
        }
        patient_data = {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "weight": patient.weight,
            "height": patient.height,
        }

        pdf_path = generate_pdf_report(visit_data, patient_data)

        # Update path PDF di DB
        visit.pdf_path = pdf_path
        db.commit()

        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=os.path.basename(pdf_path),
            headers={"Content-Disposition": f"attachment; filename={os.path.basename(pdf_path)}"}
        )
    finally:
        db.close()


# ==========================================
# ENDPOINT BARU: Chat konsultasi
# Konteks = hasil diagnosis yang sudah ada, bukan form gejala
# ==========================================
@app.post("/api/chat")
def chat_konsultasi(req: ChatRequest):
    """
    Chat tanya-jawab bebas berdasarkan hasil diagnosis yang sudah muncul.
    Yang dikirim ke AI adalah:
      - Identitas pasien
      - Hasil diagnosis sebelumnya (penyakit, ICD-10, rekomendasi, saran, tanda bahaya)
      - Riwayat percakapan chat sebelumnya
      - Pesan terbaru dari dokter
    """
    system_prompt = """
Anda adalah asisten dokter yang membantu menjawab pertanyaan lanjutan seputar hasil diagnosis yang sudah diberikan.
Anda sudah memiliki konteks hasil analisis klinis pasien. Jawab pertanyaan dokter secara ringkas, jelas, dan klinis.

PANDUAN:
- Jawab spesifik sesuai pertanyaan, jangan mengulang seluruh diagnosis.
- Jika ditanya tentang obat, sebutkan dosis dan durasi yang sesuai kondisi pasien.
- Jika ditanya pemeriksaan tambahan, jelaskan tujuan dan urgensinya.
- Jika pertanyaan di luar konteks medis, arahkan kembali ke topik klinis.
- Selalu ingatkan bahwa keputusan akhir ada di tangan dokter pemeriksa.
- Jawaban maksimal 3-5 kalimat kecuali perlu penjelasan lebih.
"""

    # Susun konteks diagnosis sebagai pesan system tambahan
    ctx = req.diagnosis_context
    context_text = ""
    if ctx:
        icd_text = ", ".join([f"{x.get('kode')} ({x.get('label')})" for x in (ctx.get("icd10") or [])])
        rek_text = " | ".join(ctx.get("rekomendasi") or [])
        saran_text = " | ".join(ctx.get("saran_pemeriksaan") or [])
        context_text = f"""
KONTEKS HASIL DIAGNOSIS PASIEN:
- Pasien: {req.name}, {req.age} tahun, {req.gender}
- Diagnosis: {ctx.get('penyakit', '-')}
- ICD-10: {icd_text or '-'}
- Rekomendasi terapi: {rek_text or '-'}
- Saran pemeriksaan: {saran_text or '-'}
- Tanda bahaya: {ctx.get('tanda_bahaya', '-')}
"""
    else:
        context_text = f"Pasien: {req.name}, {req.age} tahun, {req.gender}. Belum ada hasil diagnosis sebelumnya."

    # Bangun messages: system + riwayat chat + pesan baru
    messages = [
        {"role": "system", "content": system_prompt + "\n" + context_text}
    ]

    # Tambah riwayat chat sebelumnya (kecuali pesan terakhir yang baru masuk)
    prior_history = (req.chat_history or [])[:-1]  # Exclude pesan terakhir (sudah di req.pesan)
    for turn in prior_history:
        role_map = "user" if (turn.role if hasattr(turn, "role") else turn["role"]) == "dokter" else "assistant"
        content = turn.content if hasattr(turn, "content") else turn["content"]
        messages.append({"role": role_map, "content": content})

    # Pesan terbaru dari dokter
    messages.append({"role": "user", "content": req.pesan})

    response = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0.3,
        messages=messages
    )

    reply = response.choices[0].message.content.strip()
    return {"reply": reply}