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
    catatan: Optional[str] = ""      # Catatan dokter — bisa berisi arahan "cek lab dulu, belum yakin"
    teks_bebas: Optional[str] = ""
    save_visit: bool = False
    conversation_history: Optional[List[ConversationTurn]] = []
    chat_konsultasi: Optional[List[ChatTurn]] = []
    # Gambar pendukung keluhan — dikirim langsung ke prompt utama bersama keluhan
    image_base64: Optional[str] = None
    image_type: Optional[str] = "image/jpeg"

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
    # Konteks hasil diagnosis sesi ini
    diagnosis_context: Optional[dict] = None
    # Memori sesi: riwayat analisis multi-giliran
    conversation_history: Optional[List[ConversationTurn]] = []
    # Riwayat chat dalam sesi ini
    chat_history: Optional[List[ChatTurn]] = []
    pesan: str


# ==========================================
# AI FUNCTIONS
# ==========================================
def generate_ai_diagnosis(patient_data: dict, db_history_text: str, conversation_history: list,
                           chat_konsultasi: list = [], image_base64: str = None, image_type: str = "image/jpeg"):
    """
    Analisis diagnosis utama.
    - Gambar (jika ada) dikirim DALAM prompt yang sama sebagai pendukung keluhan — bukan terpisah.
    - Catatan dokter (catatan field) dibaca AI untuk menentukan apakah perlu periksa dulu
      sebelum diagnosis pasti (contoh: "cek lab dulu, belum yakin").
    - Chat history (memori sesi) dipakai sebagai konteks multi-giliran.
    """
    system_prompt = """
Anda adalah asisten dokter spesialis (Clinical Decision Support System) yang sangat ahli dan akurat.
Tugas Anda adalah menganalisis SEMUA data klinis pasien — termasuk keluhan, gejala, tanda vital,
hasil lab, foto temuan fisik (jika ada), dan catatan dokter — lalu memberikan output yang tepat.

INSTRUKSI PENTING — BACA CATATAN DOKTER:
Catatan dokter adalah arahan dari dokter pemeriksa. Jika dokter menulis sesuatu seperti:
  - "belum yakin", "cek lab dulu", "perlu pemeriksaan lebih lanjut", "tunggu hasil lab"
  - atau indikasi serupa bahwa data belum lengkap
Maka AI WAJIB:
  1. Menyatakan diagnosis masih tentatif/belum pasti di field "penyakit"
  2. Mengutamakan saran pemeriksaan di field "saran_pemeriksaan"
  3. Mengisi "kelengkapan_data" dengan penjelasan data apa yang masih kurang
  4. Tetap berikan kemungkinan awal, tapi sampaikan ketidakpastiannya

INSTRUKSI FOTO / GAMBAR PENDUKUNG:
Jika ada foto temuan fisik yang diberikan (ruam, benjolan, bercak, lebam, luka, dll):
  - Analisis foto sebagai bagian dari data klinis, bukan terpisah
  - Hubungkan temuan visual dengan keluhan dan gejala pasien
  - Sebutkan temuan foto secara singkat di bagian "penyakit" jika relevan

PERHATIAN UMUM:
- Dosis obat WAJIB mempertimbangkan Umur dan Berat Badan pasien.
- WAJIB periksa alergi — jangan rekomendasikan obat yang ada di daftar alergi.
- Pertimbangkan diagnosis banding (differential diagnosis).

FORMAT OUTPUT — WAJIB JSON SAJA (tanpa teks di luar JSON):
{
    "penyakit": "Diagnosis kemungkinan beserta alasan klinis. Jika belum yakin karena data kurang/catatan dokter minta periksa dulu, nyatakan dengan jelas bahwa ini masih tentatif.",
    "icd10": [
        {"kode": "A90", "label": "Dengue fever"}
    ],
    "rekomendasi": [
        "Nama obat generik — dosis — frekuensi — durasi",
        "Tindakan non-farmakologi",
        "Pemeriksaan penunjang spesifik"
    ],
    "saran_pemeriksaan": [
        "Nama pemeriksaan — alasan spesifik mengapa perlu untuk kasus ini"
    ],
    "pertanyaan_lanjutan": [
        "Pertanyaan anamnesis yang masih perlu dijawab pasien"
    ],
    "tanda_bahaya": "Red flag spesifik untuk kasus ini yang butuh rujukan segera.",
    "kelengkapan_data": "Status data: cukup/belum cukup. Jika belum, sebutkan data apa yang masih diperlukan."
}

ATURAN OUTPUT:
- 2-4 kode ICD-10 paling relevan.
- Rekomendasi minimal 3 poin: farmakologi, non-farmakologi, penunjang.
- Saran pemeriksaan: 2-4 item, spesifik sesuai kasus.
- Pertanyaan lanjutan: 2-3 pertanyaan untuk anamnesis lebih lanjut.
- Keputusan klinis final adalah wewenang dokter pemeriksa.
"""

    # Susun chat history sebagai konteks multi-giliran (memori sesi)
    messages = [{"role": "system", "content": system_prompt}]
    for turn in conversation_history:
        messages.append({"role": "user", "content": turn["user"] if isinstance(turn, dict) else turn.user})
        messages.append({"role": "assistant", "content": turn["assistant"] if isinstance(turn, dict) else turn.assistant})

    # Susun teks chat konsultasi sesi ini
    chat_text = ""
    if chat_konsultasi:
        lines = []
        for t in chat_konsultasi:
            role = t["role"] if isinstance(t, dict) else t.role
            content_val = t["content"] if isinstance(t, dict) else t.content
            lines.append(f"{'Dokter' if role == 'dokter' else 'AI'}: {content_val}")
        chat_text = "\n".join(lines)

    text_prompt = f"""
DATA PASIEN:
- Nama: {patient_data['name']}
- Umur: {patient_data['age']} Tahun
- Gender: {patient_data['gender']}
- Berat Badan: {patient_data.get('weight') or '-'} kg
- Tinggi Badan: {patient_data.get('height') or '-'} cm
- Alergi: {patient_data.get('alergi') or 'Tidak ada / tidak diketahui'}
- Riwayat Penyakit Pribadi: {patient_data.get('riwayat') or 'Tidak ada / tidak diketahui'}

RIWAYAT KUNJUNGAN SEBELUMNYA (database):
{db_history_text}

DATA KLINIS KUNJUNGAN SAAT INI:
- Keluhan Utama: {patient_data['keluhan']}
- Gejala Tambahan: {patient_data.get('gejala') or 'Tidak disebutkan'}
- Tanda Vital: {patient_data.get('tandaVital') or 'Tidak diukur'}
- Hasil Laboratorium: {patient_data.get('hasilLab') or 'Belum ada'}
- Catatan / Arahan Dokter: {patient_data.get('catatan') or 'Tidak ada'}
- Keterangan Tambahan: {patient_data.get('teks_bebas') or 'Tidak ada'}
{"" if not image_base64 else "- Foto Temuan Fisik: Terlampir (lihat gambar)"}

{f"RIWAYAT CHAT SESI INI:{chr(10)}{chat_text}" if chat_text else ""}

{"Analisis seluruh data di atas TERMASUK foto yang terlampir sebagai satu kesatuan." if image_base64 else "Berikan analisis diagnosis lengkap."} Output harus JSON.
"""

    # Bangun content pesan — gabungkan teks + gambar jika ada dalam satu message
    if image_base64:
        user_content = [
            {"type": "text", "text": text_prompt},
            {"type": "image_url", "image_url": {"url": f"data:{image_type};base64,{image_base64}"}},
        ]
    else:
        user_content = text_prompt

    messages.append({"role": "user", "content": user_content})

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
# PDF GENERATOR — hitam putih, rata kanan-kiri, profesional
# ==========================================
def generate_pdf_report(visit_data: dict, patient_data: dict) -> str:
    from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.platypus import KeepTogether

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"laporan_{patient_data['id']}_{timestamp}.pdf"
    filepath = os.path.join(PDF_DIR, filename)

    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        rightMargin=2.5*cm, leftMargin=2.5*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm
    )

    styles = getSampleStyleSheet()
    BLACK  = colors.black
    GRAY   = colors.HexColor('#555555')
    LGRAY  = colors.HexColor('#999999')

    # ---- Style definitions ----
    s_title = ParagraphStyle('s_title', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=14, leading=18,
        alignment=TA_CENTER, spaceAfter=2, textColor=BLACK)

    s_subtitle = ParagraphStyle('s_subtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=12,
        alignment=TA_CENTER, spaceAfter=2, textColor=GRAY)

    s_h2 = ParagraphStyle('s_h2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=11, leading=14,
        spaceBefore=14, spaceAfter=4, textColor=BLACK)

    s_body = ParagraphStyle('s_body', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14,
        alignment=TA_JUSTIFY, spaceAfter=4, textColor=BLACK)

    s_body_bold = ParagraphStyle('s_body_bold', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=14,
        alignment=TA_JUSTIFY, spaceAfter=2, textColor=BLACK)

    s_bullet = ParagraphStyle('s_bullet', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14,
        alignment=TA_JUSTIFY, leftIndent=12, spaceAfter=3, textColor=BLACK)

    s_small = ParagraphStyle('s_small', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11,
        alignment=TA_CENTER, textColor=LGRAY)

    s_chat_dokter = ParagraphStyle('s_chat_d', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13,
        alignment=TA_JUSTIFY, leftIndent=0, rightIndent=20,
        spaceAfter=3, textColor=BLACK)

    s_chat_ai = ParagraphStyle('s_chat_ai', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13,
        alignment=TA_JUSTIFY, leftIndent=20, rightIndent=0,
        spaceAfter=3, textColor=GRAY)

    s_disclaimer = ParagraphStyle('s_disclaimer', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11,
        alignment=TA_JUSTIFY, textColor=GRAY)

    story = []
    now = datetime.now().strftime("%d %B %Y, %H:%M")

    # ===== HEADER =====
    story.append(Paragraph("LAPORAN ANALISIS KLINIS", s_title))
    story.append(Paragraph("Clinical Decision Support System — AI Doctor", s_subtitle))
    story.append(Paragraph(f"Tanggal Cetak: {now}", s_subtitle))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BLACK, spaceAfter=10))

    # ===== 1. IDENTITAS PASIEN =====
    story.append(Paragraph("1. Identitas Pasien", s_h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=6))

    tbl_data = [
        [Paragraph("<b>Nama</b>", s_body),       Paragraph(":", s_body), Paragraph(patient_data.get('name', '-'), s_body)],
        [Paragraph("<b>Umur / Gender</b>", s_body), Paragraph(":", s_body),
         Paragraph(f"{patient_data.get('age', '-')} tahun / {patient_data.get('gender', '-')}", s_body)],
        [Paragraph("<b>Berat / Tinggi</b>", s_body), Paragraph(":", s_body),
         Paragraph(f"{patient_data.get('weight') or '-'} kg / {patient_data.get('height') or '-'} cm", s_body)],
        [Paragraph("<b>No. RM</b>", s_body), Paragraph(":", s_body),
         Paragraph(f"RM-{str(patient_data.get('id', 0)).zfill(3)}", s_body)],
    ]
    tbl = Table(tbl_data, colWidths=[4*cm, 0.6*cm, 11.4*cm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('LINEBELOW', (0,-1), (-1,-1), 0.3, LGRAY),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8))

    # ===== 2. ANAMNESIS & PEMERIKSAAN =====
    story.append(Paragraph("2. Anamnesis & Pemeriksaan", s_h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=6))

    fields_anam = [
        ("Keluhan Utama",       visit_data.get('keluhan') or '-'),
        ("Gejala Tambahan",     visit_data.get('gejala') or '-'),
        ("Tanda Vital",         visit_data.get('tanda_vital') or '-'),
        ("Hasil Laboratorium",  visit_data.get('hasil_lab') or '-'),
        ("Alergi",              visit_data.get('alergi') or '-'),
    ]
    for label, val in fields_anam:
        story.append(Paragraph(f"<b>{label}:</b>", s_body_bold))
        story.append(Paragraph(val, s_body))

    if visit_data.get('teks_bebas'):
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>Catatan Bebas Dokter / Keterangan Tambahan:</b>", s_body_bold))
        story.append(Paragraph(visit_data['teks_bebas'], s_body))

    story.append(Spacer(1, 8))

    # ===== 3. RIWAYAT KONSULTASI (jika ada) =====
    chat_history = []
    if visit_data.get('chat_history'):
        try:
            chat_history = json.loads(visit_data['chat_history'])
        except:
            chat_history = []

    section_num = 3
    if chat_history:
        story.append(Paragraph(f"{section_num}. Riwayat Konsultasi Interaktif", s_h2))
        story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=6))
        for turn in chat_history:
            role    = turn.get('role', '')
            msg     = turn.get('content', '')
            prefix  = "Dokter" if role == "dokter" else "AI"
            st      = s_chat_dokter if role == "dokter" else s_chat_ai
            story.append(Paragraph(f"<b>[{prefix}]</b> {msg}", st))
        story.append(Spacer(1, 8))
        section_num += 1

    # ===== 4. HASIL ANALISIS AI =====
    story.append(Paragraph(f"{section_num}. Hasil Analisis AI", s_h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=6))
    section_num += 1

    # Kemungkinan Diagnosis
    story.append(Paragraph("<b>Kemungkinan Diagnosis:</b>", s_body_bold))
    story.append(Paragraph(visit_data.get('diagnosis_ai') or '-', s_body))
    story.append(Spacer(1, 6))

    # Kelengkapan data
    if visit_data.get('kelengkapan_data'):
        story.append(Paragraph("<b>Status Kelengkapan Data:</b>", s_body_bold))
        story.append(Paragraph(visit_data['kelengkapan_data'], s_body))
        story.append(Spacer(1, 6))

    # Kode ICD-10
    icd10_list = []
    if visit_data.get('icd10_codes'):
        try:
            icd10_list = json.loads(visit_data['icd10_codes'])
        except:
            icd10_list = []
    if icd10_list:
        story.append(Paragraph("<b>Kode ICD-10:</b>", s_body_bold))
        for item in icd10_list:
            story.append(Paragraph(
                f"• {item.get('kode', '')} — {item.get('label', '')}",
                s_bullet))
        story.append(Spacer(1, 6))

    # Rekomendasi Terapi
    rek_list = []
    if visit_data.get('rekomendasi_terpilih'):
        try:
            rek_list = json.loads(visit_data['rekomendasi_terpilih'])
        except:
            rek_list = []
    if rek_list:
        story.append(Paragraph("<b>Rekomendasi Terapi:</b>", s_body_bold))
        for i, rek in enumerate(rek_list, 1):
            story.append(Paragraph(f"{i}. {rek}", s_bullet))
        story.append(Spacer(1, 6))

    # Saran Pemeriksaan Lanjutan
    if visit_data.get('saran_pemeriksaan'):
        story.append(Paragraph("<b>Saran Pemeriksaan Lanjutan:</b>", s_body_bold))
        for line in visit_data['saran_pemeriksaan'].split("\n"):
            if line.strip():
                story.append(Paragraph(f"• {line.strip()}", s_bullet))
        story.append(Spacer(1, 6))

    # Tanda Bahaya — kotak garis hitam tipis, teks hitam
    if visit_data.get('tanda_bahaya'):
        story.append(Paragraph("<b>Tanda Bahaya / Indikasi Rujukan Segera:</b>", s_body_bold))
        tb_data = [[Paragraph(visit_data['tanda_bahaya'], s_body)]]
        tb_tbl = Table(tb_data, colWidths=[16*cm])
        tb_tbl.setStyle(TableStyle([
            ('BOX',        (0,0), (-1,-1), 0.8, BLACK),
            ('TOPPADDING',  (0,0), (-1,-1), 6),
            ('BOTTOMPADDING',(0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING',(0,0), (-1,-1), 8),
        ]))
        story.append(tb_tbl)
        story.append(Spacer(1, 8))

    # ===== 5. FOTO & ANALISIS (jika ada) =====
    image_path = visit_data.get('image_path') or ''
    has_image_file = image_path and os.path.isfile(image_path)
    has_image_analysis = bool(visit_data.get('analisis_gambar'))

    if has_image_file or has_image_analysis:
        story.append(Paragraph(f"{section_num}. Foto & Analisis Temuan Fisik", s_h2))
        story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=6))

        # Foto: tampilkan di atas, analisis teks di bawah
        if has_image_file:
            try:
                from reportlab.platypus import Image as RLImage
                from PIL import Image as PILImage

                pil_img = PILImage.open(image_path)
                orig_w, orig_h = pil_img.size

                # Max lebar 10cm atau penuh jika landscape, tinggi proporsional max 8cm
                MAX_W = 10 * cm
                MAX_H = 8 * cm
                ratio = orig_h / orig_w if orig_w > 0 else 1
                img_w = MAX_W
                img_h = img_w * ratio
                if img_h > MAX_H:
                    img_h = MAX_H
                    img_w = img_h / ratio

                story.append(Paragraph("<b>Foto Pendukung Gejala:</b>", s_body_bold))
                story.append(Spacer(1, 4))
                story.append(RLImage(image_path, width=img_w, height=img_h))
                story.append(Spacer(1, 8))

            except Exception as e:
                story.append(Paragraph(f"<i>[Foto tidak dapat ditampilkan: {e}]</i>", s_body))

        # Analisis teks dari AI — selalu tampil jika ada, baik dengan atau tanpa foto
        if has_image_analysis:
            try:
                img_result = json.loads(visit_data['analisis_gambar'])
                img_fields = [
                    ("Deskripsi Visual",   img_result.get('deskripsi_gambar', '')),
                    ("Kemungkinan Temuan", img_result.get('kemungkinan_temuan', '')),
                    ("Rekomendasi Lanjut", img_result.get('rekomendasi_lanjut', '')),
                    ("Catatan",            img_result.get('catatan', '')),
                ]
                story.append(Paragraph("<b>Analisis AI Terhadap Foto:</b>", s_body_bold))
                for label, val in img_fields:
                    if val and val not in ('-', ''):
                        story.append(Paragraph(f"• <b>{label}:</b> {val}", s_bullet))
            except Exception:
                story.append(Paragraph(visit_data['analisis_gambar'], s_body))

        story.append(Spacer(1, 8))

    # ===== FOOTER =====
    story.append(HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceBefore=12, spaceAfter=6))
    story.append(Paragraph(
        "Hasil analisis ini hanya sebagai Clinical Decision Support System (CDSS) dan bukan pengganti "
        "penilaian klinis dokter. Keputusan medis, diagnosis akhir, dan tata laksana terapi sepenuhnya "
        "merupakan tanggung jawab dokter pemeriksa berdasarkan pemeriksaan langsung.",
        s_disclaimer))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Dicetak oleh: AI Doctor System  |  {now}", s_small))

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
                    "image_url": f"/api/image/{v.id}" if v.image_path and os.path.isfile(v.image_path) else None,
                    "created_at": v.created_at or "",
                    "pdf_path": v.pdf_path or "",
                }
                for v in reversed(visits)
            ]
        }
    finally:
        db.close()


# ==========================================
# ENDPOINT: Serve gambar berdasarkan visit_id
# ==========================================
@app.get("/api/image/{visit_id}")
def get_image(visit_id: int):
    db = SessionLocal()
    try:
        visit = db.query(DBVisit).filter(DBVisit.id == visit_id).first()
        if not visit or not visit.image_path:
            return {"error": "Gambar tidak ditemukan"}
        if not os.path.isfile(visit.image_path):
            return {"error": "File gambar tidak ada di server"}
        # Deteksi media type dari ekstensi
        ext = visit.image_path.rsplit('.', 1)[-1].lower()
        media_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                       "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
        media_type = media_types.get(ext, "image/jpeg")
        return FileResponse(path=visit.image_path, media_type=media_type)
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
        # Simpan gambar ke disk jika ada, sebelum dikirim ke AI
        saved_image_path = ""
        if req.image_base64:
            try:
                img_bytes = base64.b64decode(req.image_base64)
                ext = (req.image_type or "image/jpeg").split("/")[-1]
                img_filename = f"{uuid.uuid4().hex}.{ext}"
                img_path = os.path.join(UPLOAD_DIR, img_filename)
                with open(img_path, "wb") as f_img:
                    f_img.write(img_bytes)
                saved_image_path = img_path
            except Exception:
                pass

        ai_result = generate_ai_diagnosis(
            patient_dict,
            db_history_text,
            req.conversation_history or [],
            req.chat_konsultasi or [],
            image_base64=req.image_base64,
            image_type=req.image_type or "image/jpeg"
        )
        ai_result["saved_image_path"] = saved_image_path

        ai_result["db_patient_id"] = patient.id
        return ai_result

    finally:
        db.close()



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
# ENDPOINT: Serve foto visit
# ==========================================
@app.get("/api/visit-image/{visit_id}")
def get_visit_image(visit_id: int):
    """Return file foto yang tersimpan untuk kunjungan tertentu."""
    db = SessionLocal()
    try:
        visit = db.query(DBVisit).filter(DBVisit.id == visit_id).first()
        if not visit or not visit.image_path:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"error": "Tidak ada foto"})
        if not os.path.isfile(visit.image_path):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"error": "File tidak ditemukan"})
        ext = visit.image_path.rsplit(".", 1)[-1].lower()
        media_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                     "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
        media_type = media_map.get(ext, "image/jpeg")
        return FileResponse(path=visit.image_path, media_type=media_type)
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
            "image_path": visit.image_path or "",
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
    Chat konsultasi berbasis memori sesi (conversationHistory).
    Konteks yang dikirim ke AI:
      - Identitas pasien
      - Hasil diagnosis sesi ini (dari diagnosis_context)
      - Seluruh conversation_history (memori multi-giliran sesi)
      - Riwayat chat sebelumnya dalam sesi
      - Pesan terbaru dari dokter
    """
    system_prompt = """
Anda adalah asisten dokter yang membantu menjawab pertanyaan lanjutan berdasarkan hasil diagnosis
dan riwayat konsultasi yang sudah ada. Gunakan semua konteks yang diberikan untuk menjawab.

PANDUAN:
- Jawab spesifik sesuai pertanyaan, tidak perlu mengulang seluruh diagnosis.
- Jika ditanya obat: sebutkan dosis dan durasi sesuai kondisi pasien.
- Jika ditanya pemeriksaan: jelaskan tujuan dan urgensinya.
- Manfaatkan riwayat percakapan sebelumnya — jangan tanya ulang hal yang sudah dibahas.
- Jawaban ringkas 2-4 kalimat kecuali perlu lebih panjang.
- Selalu ingatkan keputusan akhir ada di tangan dokter pemeriksa.
"""

    # Bangun konteks dari hasil diagnosis + memori sesi
    ctx = req.diagnosis_context or {}
    icd_text = ", ".join([f"{x.get('kode')} ({x.get('label')})" for x in (ctx.get("icd10") or [])])
    rek_text = " | ".join(ctx.get("rekomendasi") or [])
    saran_text = " | ".join(ctx.get("saran_pemeriksaan") or [])

    context_block = f"""KONTEKS PASIEN & DIAGNOSIS SESI INI:
- Pasien: {req.name}, {req.age} tahun, {req.gender}
- Diagnosis saat ini: {ctx.get('penyakit') or 'Belum ada diagnosis'}
- ICD-10: {icd_text or '-'}
- Rekomendasi terapi: {rek_text or '-'}
- Saran pemeriksaan: {saran_text or '-'}
- Tanda bahaya: {ctx.get('tanda_bahaya') or '-'}
- Status data: {ctx.get('kelengkapan_data') or '-'}"""

    # Tambahkan memori sesi (conversationHistory multi-giliran) sebagai konteks
    session_memory = ""
    if req.conversation_history:
        turns = []
        for i, turn in enumerate(req.conversation_history):
            u = turn.user if hasattr(turn, "user") else turn.get("user", "")
            a = turn.assistant if hasattr(turn, "assistant") else turn.get("assistant", "")
            turns.append(f"[Giliran {i+1}] Dokter: {u[:200]} | AI: {a[:200]}")
        session_memory = "\nMEMORI SESI (riwayat analisis):\n" + "\n".join(turns)

    messages = [{"role": "system", "content": system_prompt + "\n\n" + context_block + session_memory}]

    # Riwayat chat sebelumnya (exclude pesan terakhir yang ada di req.pesan)
    prior = (req.chat_history or [])[:-1]
    for turn in prior:
        role = turn.role if hasattr(turn, "role") else turn.get("role", "dokter")
        msg = turn.content if hasattr(turn, "content") else turn.get("content", "")
        messages.append({"role": "user" if role == "dokter" else "assistant", "content": msg})

    # Pesan terbaru dokter
    messages.append({"role": "user", "content": req.pesan})

    response = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0.3,
        messages=messages
    )

    reply = response.choices[0].message.content.strip()
    return {"reply": reply}