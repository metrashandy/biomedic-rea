from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import json
import numpy as np
import cv2
import base64
from dotenv import load_dotenv
from typing import Optional
from deep_translator import GoogleTranslator
from openai import OpenAI
from PIL import Image
import io
import os
from fastapi.staticfiles import StaticFiles
from fastapi import Depends
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from pydantic import BaseModel
import shutil
import uuid
import json
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# Perintah ini yang akan mengeksekusi pembuatan file medis.db & tabelnya
models.Base.metadata.create_all(bind=engine)
def seed_everything():
    db = SessionLocal()
    # Seed 10 Pasien Lengkap
    if db.query(models.Pasien).count() == 0:
        data_pasien =[
            {"nama": "Budi Santoso", "umur": 45, "gender": "Laki-laki", "goldar": "O+"},
            {"nama": "Siti Aminah", "umur": 32, "gender": "Perempuan", "goldar": "A+"},
            {"nama": "Ahmad Wijaya", "umur": 58, "gender": "Laki-laki", "goldar": "B+"},
            {"nama": "Rina Kartika", "umur": 29, "gender": "Perempuan", "goldar": "AB+"},
            {"nama": "Dewi Lestari", "umur": 41, "gender": "Perempuan", "goldar": "O-"},
            {"nama": "Eko Prasetyo", "umur": 55, "gender": "Laki-laki", "goldar": "A-"},
            {"nama": "Andi Hermawan", "umur": 37, "gender": "Laki-laki", "goldar": "B+"},
            {"nama": "Sari Maya", "umur": 24, "gender": "Perempuan", "goldar": "O+"},
            {"nama": "Rully Hidayat", "umur": 62, "gender": "Laki-laki", "goldar": "AB-"},
            {"nama": "Lina Marlina", "umur": 50, "gender": "Perempuan", "goldar": "A+"},
        ]
        for i, p in enumerate(data_pasien):
            db.add(models.Pasien(no_rm=f"RM-00{i+1}", nama_pasien=p["nama"], umur=p["umur"], gender=p["gender"], blood_type=p["goldar"]))
        print("✅ SEED: 10 Pasien Lengkap Berhasil Dibuat.")
    
    if db.query(models.Jenis).count() == 0:
        kategori =["X-Ray", "CT Scan", "Retina Scan", "Endoscopy"]
        for k in kategori:
            db.add(models.Jenis(nama_jenis=k))
        print("✅ SEED: 4 Kategori pemeriksaan berhasil dibuat.")
    
    db.commit()
    db.close()


# ================== INIT APP ==================
app = FastAPI()
UPLOAD_DIR = "uploads"

class CORSMiddlewareForStatic(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/uploads"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from prompts import (
    get_prompt_xrays,
    get_prompt_fundus,
    get_prompt_ct,
    get_prompt_endoscopy
)

# ================== FOLDER STRUCTURE HELPERS ==================

def sanitize_folder_name(name: str) -> str:
    """Bersihkan nama untuk dipakai sebagai nama folder (hapus karakter spesial)."""
    name = name.strip()
    # Ganti spasi dengan underscore, hapus karakter selain huruf/angka/underscore/dash
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'[^\w\-]', '', name)
    return name

def sanitize_jenis_name(jenis: str) -> str:
    """Ubah nama jenis pemeriksaan jadi nama folder yang bersih."""
    jenis = jenis.strip().lower()
    jenis = re.sub(r'\s+', '_', jenis)
    jenis = re.sub(r'[^\w\-]', '', jenis)
    return jenis  # contoh: "X-Ray" → "x-ray", "CT Scan" → "ct_scan"

def get_next_sequence(folder_path: str, prefix: str) -> int:
    """
    Hitung nomor urut berikutnya berdasarkan file _original yang sudah ada.
    Setiap sesi upload = 1 file original. Jadi kita cukup hitung file _original.
    Contoh: sudah ada _001_original → return 2
    """
    if not os.path.exists(folder_path):
        return 1
    # Hitung hanya file original (1 per sesi upload)
    original_files = [
        f for f in os.listdir(folder_path)
        if f.startswith(prefix) and "_original." in f
    ]
    return len(original_files) + 1

def build_patient_jenis_dir(no_rm: str, nama_pasien: str, jenis: str) -> str:
    """
    Buat dan kembalikan path folder:
    uploads/patients/RM-001_BudiSantoso/xray/
    """
    patient_folder = f"{sanitize_folder_name(no_rm)}_{sanitize_folder_name(nama_pasien)}"
    jenis_folder = sanitize_jenis_name(jenis)
    dir_path = os.path.join(UPLOAD_DIR, "patients", patient_folder, jenis_folder)
    os.makedirs(dir_path, exist_ok=True)
    return dir_path

def build_filename(no_rm: str, nama_pasien: str, jenis: str, seq: int, suffix: str, ext: str) -> str:
    """
    Buat nama file dengan format:
    RM-001_BudiSantoso_xray_001_original.jpg
    RM-001_BudiSantoso_xray_001_ai.jpg
    RM-001_BudiSantoso_xray_001_doctor.jpg

    suffix: "original" | "ai" | "doctor"
    """
    rm_clean = sanitize_folder_name(no_rm)
    nama_clean = sanitize_folder_name(nama_pasien)
    jenis_clean = sanitize_jenis_name(jenis)
    seq_str = str(seq).zfill(3)
    return f"{rm_clean}_{nama_clean}_{jenis_clean}_{seq_str}_{suffix}.{ext}"

def get_patient_info_from_db(db, id_pasien: int):
    """Ambil no_rm dan nama pasien dari database."""
    pasien = db.query(models.Pasien).filter(models.Pasien.id_pasien == id_pasien).first()
    if not pasien:
        raise HTTPException(status_code=404, detail=f"Pasien dengan ID {id_pasien} tidak ditemukan")
    return pasien.no_rm, pasien.nama_pasien

# ================== IMAGE UTILS ==================

def to_base64(image):
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')

def refine_bbox_with_opencv(image, bboxes):
    refined_boxes = []
    h_img, w_img, _ = image.shape
    for bbox in bboxes:
        x = int(bbox["x"] * w_img)
        y = int(bbox["y"] * h_img)
        w = int(bbox["width"] * w_img)
        h = int(bbox["height"] * h_img)
        roi = image[y:y+h, x:x+w]
        if roi.size == 0:
            continue
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5,5), 0)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        kernel = np.ones((5,5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            if cv2.contourArea(cnt) > 300:
                x2, y2, w2, h2 = cv2.boundingRect(cnt)
                refined_boxes.append((x + x2, y + y2, w2, h2))
    return refined_boxes

# ================== LOAD ENV ==================
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ================== MIDDLEWARE ==================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CORSMiddlewareForStatic)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ================== FUNGSI BANTUAN ==================
def translate_text(text):
    if not text: return text
    try: return GoogleTranslator(source="en", target="id").translate(text)
    except Exception: return text 
    
def translate_to_english(text):
    if not text: return text
    try: return GoogleTranslator(source='auto', target='en').translate(text)
    except: return text

def draw_boxes(image, boxes):
    img = image.copy()
    for (x, y, w, h) in boxes:
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 2)
    return img

def get_clean_url(path):
    if not path: return None
    clean_path = path.replace("\\", "/")
    return f"http://localhost:8000/{clean_path}"

# ================== MAIN ENDPOINT ==================
@app.post("/analyze")
async def analyze_xray(
    image: UploadFile = File(...),
    symptoms: Optional[str] = Form(None),
    analysis_type: Optional[str] = Form("xray"),
    id_pasien: int = Form(...),
    detail_level: str = Form("medium"),
    db: Session = Depends(get_db)
):  
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API key tidak ditemukan")

    allowed_types = ["image/jpeg", "image/png"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File harus JPG atau PNG")

    contents = await image.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 100MB")

    # ================== AMBIL INFO PASIEN ==================
    no_rm, nama_pasien = get_patient_info_from_db(db, id_pasien)

    # ================== LOAD IMAGE ==================
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # ================== OPENAI ==================
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG")
    image_base64 = base64.b64encode(buffered.getvalue()).decode()
    mime_type = "image/jpeg"

    tipe_lower = analysis_type.lower().strip()
    if "xray" in tipe_lower or "x-ray" in tipe_lower:
        prompt = get_prompt_xrays(detail_level)
    elif "fundus" in tipe_lower or "retina" in tipe_lower:
        prompt = get_prompt_fundus(detail_level)
    elif "ct" in tipe_lower:
        prompt = get_prompt_ct(detail_level)
    elif "endoscopy" in tipe_lower:
        prompt = get_prompt_endoscopy(detail_level)
    else:
        prompt = get_prompt_xrays(detail_level)
    
    if symptoms:
        symptoms_en = translate_to_english(symptoms)
        prompt += f"\nPatient symptoms: {symptoms_en}\n"
        
    mime_type = image.content_type
    
    response = client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": f"data:{mime_type};base64,{image_base64}"}
                ]
            }
        ],
        temperature=0.3
    )

    try:
        content = response.output[0].content[0].text
        content = re.sub(r"```json|```", "", content).strip()
        print("RAW AI:", content)
        ai_result = json.loads(content)
        
        if "risk_factors" not in ai_result:
            ai_result["risk_factors"] = {
                "area": "-", "region_count": "-", "intensity": "-", "calculation": "Tidak tersedia"
            }

        # ================== SETUP FOLDER & FILENAME ==================
        file_ext = image.filename.split(".")[-1].lower()
        
        # Tentukan jenis yang bersih untuk nama folder & file
        jenis_bersih = analysis_type.strip()
        
        # Buat folder: uploads/patients/RM-001_BudiSantoso/xray/
        img_dir = build_patient_jenis_dir(no_rm, nama_pasien, jenis_bersih)
        
        # Hitung nomor urut dari file yang sudah ada
        prefix = f"{sanitize_folder_name(no_rm)}_{sanitize_folder_name(nama_pasien)}_{sanitize_jenis_name(jenis_bersih)}_"
        seq = get_next_sequence(img_dir, prefix)
        
        # ================== SIMPAN GAMBAR ORIGINAL ==================
        # Format: RM-001_BudiSantoso_xray_001_original.jpg
        file_name_original = build_filename(no_rm, nama_pasien, jenis_bersih, seq, "original", file_ext)
        file_path_original = os.path.join(img_dir, file_name_original)
        with open(file_path_original, "wb") as f:
            f.write(contents)
        print(f"✅ Gambar Original Tersimpan: {file_path_original}")

        # ================== SIMPAN KE DATABASE ==================
        new_pem = models.Pemeriksaan(
            id_pasien=id_pasien, 
            no_reg=f"REG-{uuid.uuid4().hex[:6].upper()}", 
            id_dokter=1
        )
        db.add(new_pem)
        db.flush() 

        # Cari atau buat Jenis di DB
        jenis_db = db.query(models.Jenis).filter(models.Jenis.nama_jenis.ilike(jenis_bersih)).first()
        if jenis_db:
            id_j = jenis_db.id_jenis
        else:
            print(f"Kategori '{jenis_bersih}' belum ada di DB. Membuat kategori baru...")
            kategori_baru = models.Jenis(nama_jenis=jenis_bersih)
            db.add(kategori_baru)
            db.commit()
            db.refresh(kategori_baru)
            id_j = kategori_baru.id_jenis

        new_anal = models.Analisis(
            id_pemeriksaan=new_pem.id_pemeriksaan,
            id_jenis=id_j,
            gambar_asli=file_path_original,       # Path gambar original
            gambar_hasil=None,                     # Diisi setelah bbox digambar
            gambar_dokter=None,                    # Diisi saat dokter simpan anotasi
            teks_hasil_analisis=json.dumps(ai_result),
            ai_bboxes=json.dumps(ai_result.get("bboxes", [])),
            doctor_bboxes=json.dumps([]),            
            status="Selesai"
        )
        db.add(new_anal)
        db.commit()
        print(f"✅ Data Tersimpan di DB. Record ID: {new_anal.id_analisis}")

        # ================== TRANSLATE RESULT ==================
        ai_result["findings"] = translate_text(ai_result.get("findings"))
        ai_result["abnormality"] = translate_text(ai_result.get("abnormality"))
        ai_result["recommendation"]["approach"] = translate_text(ai_result["recommendation"].get("approach"))
        ai_result["recommendation"]["treatment"] = translate_text(ai_result["recommendation"].get("treatment"))
        ai_result["risk_factors"]["calculation"] = translate_text(ai_result["risk_factors"].get("calculation"))
        ai_result["risk_factors"]["area"] = translate_text(ai_result["risk_factors"].get("area"))
        ai_result["risk_factors"]["region_count"] = translate_text(str(ai_result["risk_factors"].get("region_count")))
        ai_result["risk_factors"]["intensity"] = translate_text(ai_result["risk_factors"].get("intensity"))

        required_keys = ["findings", "abnormality", "risk", "bboxes", "recommendation"]
        for key in required_keys:
            if key not in ai_result:
                raise HTTPException(status_code=500, detail=f"{key} tidak ada di response AI")

    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Format AI tidak valid")
    
    # ================== BBOX & SEGMENTASI ==================
    bboxes = ai_result.get("bboxes", [])
    if not bboxes:
        print("AI tidak mendeteksi area abnormal")

    overlay = np.array(pil_image)

    if analysis_type == "xray":
        refined_boxes = refine_bbox_with_opencv(overlay, bboxes)
    else:
        refined_boxes = []

    if refined_boxes:
        overlay = draw_boxes(overlay, refined_boxes)
    else:
        print("Fallback ke bbox AI")

    h, w, _ = overlay.shape
    for bbox in bboxes:
        x = int(bbox["x"] * w)
        y = int(bbox["y"] * h)
        bw = int(bbox["width"] * w)
        bh = int(bbox["height"] * h)
        overlay = draw_boxes(overlay, [(x, y, bw, bh)])

    # ================== SIMPAN GAMBAR HASIL AI ==================
    # Format: RM-001_BudiSantoso_xray_001_ai.jpg
    file_name_ai = build_filename(no_rm, nama_pasien, jenis_bersih, seq, "ai", "jpg")
    file_path_ai = os.path.join(img_dir, file_name_ai)
    cv2.imwrite(file_path_ai, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
    print(f"✅ Gambar AI Tersimpan: {file_path_ai}")

    # ================== UPDATE DB: GAMBAR HASIL AI ==================
    analisis_baru = db.query(models.Analisis).filter(models.Analisis.id_analisis == new_anal.id_analisis).first()
    if analisis_baru:
        analisis_baru.gambar_hasil = file_path_ai
        db.commit()

    # ================== FINAL ==================
    overlay = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    base64_img = to_base64(overlay)
    
    return {
        "record_id": analisis_baru.id_analisis if analisis_baru else None,
        "result": ai_result,
        "segmentation_image": base64_img
    }


# ================== PATIENT ENDPOINTS ==================

class PasienCreate(BaseModel):
    no_rm: str
    nama_pasien: str

@app.get("/api/patients")
def get_all_patients(db: Session = Depends(get_db)):
    patients = db.query(models.Pasien).all()
    result = []
    for p in patients:
        result.append({
            "id_pasien": p.id_pasien,
            "no_rm": p.no_rm,
            "nama_pasien": p.nama_pasien,
            "age": p.umur,
            "gender": p.gender,
            "bloodType": p.blood_type
        })
    return {"status": "success", "data": result}

class JenisCreate(BaseModel):
    nama_jenis: str

@app.post("/api/jenis")
def create_jenis(jenis: JenisCreate, db: Session = Depends(get_db)):
    db_jenis = models.Jenis(nama_jenis=jenis.nama_jenis)
    db.add(db_jenis)
    db.commit()
    db.refresh(db_jenis)
    return {"message": "Jenis berhasil ditambahkan", "data": db_jenis}

@app.get("/api/jenis")
def get_all_jenis(db: Session = Depends(get_db)):
    jenis_list = db.query(models.Jenis).all()
    return {"status": "success", "data": jenis_list}


# ================== SAVE ANALYSIS (MANUAL UPLOAD) ==================
@app.post("/api/save-analysis")
async def save_analysis(
    id_pasien: int = Form(...),
    id_jenis: int = Form(...),
    teks_hasil_analisis: Optional[str] = Form(None), 
    gambar_asli: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Ambil info pasien & jenis dari DB
    no_rm, nama_pasien = get_patient_info_from_db(db, id_pasien)
    
    jenis_db = db.query(models.Jenis).filter(models.Jenis.id_jenis == id_jenis).first()
    jenis_nama = jenis_db.nama_jenis if jenis_db else "umum"

    # Buat folder & nama file
    file_ext = gambar_asli.filename.split(".")[-1].lower()
    img_dir = build_patient_jenis_dir(no_rm, nama_pasien, jenis_nama)
    prefix = f"{sanitize_folder_name(no_rm)}_{sanitize_folder_name(nama_pasien)}_{sanitize_jenis_name(jenis_nama)}_"
    seq = get_next_sequence(img_dir, prefix)

    file_name = build_filename(no_rm, nama_pasien, jenis_nama, seq, "original", file_ext)
    file_path = os.path.join(img_dir, file_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(gambar_asli.file, buffer)

    no_reg = f"REG-{uuid.uuid4().hex[:8].upper()}"
    pemeriksaan_baru = models.Pemeriksaan(id_pasien=id_pasien, no_reg=no_reg, id_dokter=1)
    db.add(pemeriksaan_baru)
    db.commit()

    analisis_baru = models.Analisis(
        id_pemeriksaan=pemeriksaan_baru.id_pemeriksaan,
        id_jenis=id_jenis,
        gambar_asli=file_path,
        teks_hasil_analisis=teks_hasil_analisis,
        status="Selesai"
    )
    db.add(analisis_baru)
    db.commit()
    return {"status": "success", "id_analisis": analisis_baru.id_analisis}


# ================== PATIENT DETAIL & HISTORY ==================
@app.get("/api/patients/{id_pasien}")
def get_patient_detail(id_pasien: int, db: Session = Depends(get_db)):
    pasien = db.query(models.Pasien).filter(models.Pasien.id_pasien == id_pasien).first()
    if not pasien: raise HTTPException(status_code=404)
    
    patient_data = {
        "id_pasien": pasien.id_pasien,
        "no_rm": pasien.no_rm,
        "nama_pasien": pasien.nama_pasien,
        "age": pasien.umur,
        "gender": pasien.gender,
        "bloodType": pasien.blood_type
    }
    
    history = []
    records = db.query(models.Analisis).join(models.Pemeriksaan).filter(models.Pemeriksaan.id_pasien == id_pasien).all()
    
    for r in records:
        history.append({
            "id_record": r.id_analisis,
            "type": r.jenis.nama_jenis if r.jenis else "Umum",
            "date": r.pemeriksaan.tgl_pemeriksaan.strftime("%d %b %Y"),
            "imgUrl": get_clean_url(r.gambar_asli),
            "is_analyzed": bool(r.teks_hasil_analisis),
            "ai_result": json.loads(r.teks_hasil_analisis) if r.teks_hasil_analisis else None,
            "doctor_notes": json.loads(r.doctor_notes) if r.doctor_notes else None,
            "doctor_bboxes": json.loads(r.doctor_bboxes) if r.doctor_bboxes else [],
            "gambar_hasil_url": get_clean_url(r.gambar_hasil),
            "gambar_dokter_url": get_clean_url(r.gambar_dokter) if hasattr(r, 'gambar_dokter') else None,
        })
            
    return {"status": "success", "patient": patient_data, "history": history}


# ================== RECORD DETAIL ==================
@app.get("/api/records/{id_analisis}")
async def get_record_detail(id_analisis: int, db: Session = Depends(get_db)):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data analisis tidak ditemukan")

    if not analisis.teks_hasil_analisis:
        return {"message": "Belum ada hasil analisis"}

    try:
        clean_json_str = analisis.teks_hasil_analisis.strip()
        hasil_json = json.loads(clean_json_str)
        if isinstance(hasil_json, str):
            hasil_json = json.loads(hasil_json)
    except Exception as e:
        print(f"Gagal parse JSON dari DB: {e}")
        hasil_json = {
            "findings": "Data di database kotor/corrupted",
            "abnormality": "Butuh Analisis Ulang",
            "risk": 0,
            "recommendation": {"approach": "-", "treatment": "-"}
        }
    
    return {
        "status": "success",
        "data": {
            "id_analisis": analisis.id_analisis,
            "gambar_asli_url": get_clean_url(analisis.gambar_asli),
            "gambar_hasil_url": get_clean_url(analisis.gambar_hasil),
            # ✅ URL gambar anotasi dokter (file disimpan saat doctor-update)
            "gambar_dokter_url": get_clean_url(analisis.gambar_dokter) if hasattr(analisis, 'gambar_dokter') else None,
            "ai_result": hasil_json,
            "doctor_notes": json.loads(analisis.doctor_notes) if analisis.doctor_notes else None,
            "ai_bboxes": json.loads(analisis.ai_bboxes) if analisis.ai_bboxes else [],
            "doctor_bboxes": json.loads(analisis.doctor_bboxes) if analisis.doctor_bboxes else [],
        }
    }


# ================== DOCTOR UPDATE (+ SIMPAN GAMBAR DOKTER) ==================
@app.put("/api/records/{id_analisis}/doctor-update")
async def update_doctor_data(
    id_analisis: int,
    doctor_notes: Optional[str] = Form(None),
    doctor_bboxes: Optional[str] = Form(None),
    # ✅ BARU: Terima gambar hasil anotasi dokter (opsional)
    # Frontend bisa kirim file gambar hasil canvas dokter sebagai FormData
    doctor_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    if doctor_bboxes is not None:
        analisis.doctor_bboxes = doctor_bboxes

    if doctor_notes is not None:
        analisis.doctor_notes = doctor_notes

    # ✅ SIMPAN GAMBAR DOKTER JIKA ADA
    if doctor_image is not None:
        # Ambil info pasien & jenis dari relasi analisis
        pemeriksaan = analisis.pemeriksaan
        pasien = pemeriksaan.pasien
        no_rm = pasien.no_rm
        nama_pasien = pasien.nama_pasien
        jenis_nama = analisis.jenis.nama_jenis if analisis.jenis else "umum"

        file_ext = doctor_image.filename.split(".")[-1].lower() if doctor_image.filename else "jpg"
        img_dir = build_patient_jenis_dir(no_rm, nama_pasien, jenis_nama)

        # Cari nomor urut dari nama gambar_asli yang sudah ada
        # Format gambar_asli: .../RM-001_Budi_xray_001_original.jpg
        # Kita ambil nomor urut dari nama file gambar_asli
        seq = 1
        if analisis.gambar_asli:
            base_name = os.path.basename(analisis.gambar_asli)
            # Cari pola _NNN_ dari nama file
            match = re.search(r'_(\d{3})_original', base_name)
            if match:
                seq = int(match.group(1))

        # Simpan dengan suffix "doctor"
        # Format: RM-001_BudiSantoso_xray_001_doctor.jpg
        file_name_doctor = build_filename(no_rm, nama_pasien, jenis_nama, seq, "doctor", file_ext)
        file_path_doctor = os.path.join(img_dir, file_name_doctor)
        
        img_contents = await doctor_image.read()
        with open(file_path_doctor, "wb") as f:
            f.write(img_contents)
        
        print(f"✅ Gambar Dokter Tersimpan: {file_path_doctor}")

        # Simpan path ke DB (butuh kolom gambar_dokter di model Analisis)
        if hasattr(analisis, 'gambar_dokter'):
            analisis.gambar_dokter = file_path_doctor

    db.commit()
    db.refresh(analisis)
    return {"status": "success"}


# ================== DEBUG RESET ==================
@app.get("/api/debug/reset/{id_analisis}")
def reset_analysis(id_analisis: int, db: Session = Depends(get_db)):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if analisis:
        analisis.teks_hasil_analisis = None
        analisis.gambar_hasil = None
        db.commit()
        return {"msg": "Data direset, silakan refresh halaman Detail di React"}


# ================== SEEDING DATA DUMMY ==================
seed_everything()