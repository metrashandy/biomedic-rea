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
    # Seed Pasien Lengkap
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
            db.add(models.Pasien(
                no_rm=f"RM-00{i+1}", 
                nama_pasien=p["nama"],
                umur=p["umur"],
                gender=p["gender"],
                blood_type=p["goldar"]
            ))
        print("✅ SEED: 10 Pasien Lengkap Berhasil Dibuat.")
    
    # Seed Jenis Pemeriksaan
    if db.query(models.Jenis).count() == 0:
        kategori =["X-Ray", "MRI", "CT Scan", "Endoscopy", "Ultrasound", "EKG", "EEG", "Fundus Retina"]
        for k in kategori:
            db.add(models.Jenis(nama_jenis=k))
        print("✅ SEED: Kategori pemeriksaan berhasil dibuat.")
    
    db.commit()
    db.close()


# ================== INIT APP ==================
app = FastAPI()
UPLOAD_DIR = "uploads"
IMG_DIR = os.path.join(UPLOAD_DIR, "images")
PDF_DIR = os.path.join(UPLOAD_DIR, "pdfs")

class CORSMiddlewareForStatic(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/uploads"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

# Otomatis bikin folder kalau belum ada
os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)

# Dependency untuk membuka & menutup sesi database otomatis
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



def to_base64(image):
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')

def refine_bbox_with_opencv(image, bboxes):
    refined_boxes = []

    h_img, w_img, _ = image.shape

    for bbox in bboxes:
        # convert normalized → pixel
        x = int(bbox["x"] * w_img)
        y = int(bbox["y"] * h_img)
        w = int(bbox["width"] * w_img)
        h = int(bbox["height"] * h_img)

        roi = image[y:y+h, x:x+w]

        if roi.size == 0:
            continue

        # grayscale
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

        # threshold (area putih)
        gray = cv2.GaussianBlur(gray, (5,5), 0)

        thresh = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )

        # hilangkan noise
        kernel = np.ones((5,5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        # cari kontur
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            if cv2.contourArea(cnt) > 300:
                x2, y2, w2, h2 = cv2.boundingRect(cnt)

                refined_boxes.append((
                    x + x2,
                    y + y2,
                    w2,
                    h2
                ))

    return refined_boxes

# ================== LOAD ENV ==================
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ================== INIT APP ==================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Mengizinkan semua origin (termasuk localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],  # Mengizinkan semua method (GET, POST, dll)
    allow_headers=["*"],  # Mengizinkan semua header
)
app.add_middleware(CORSMiddlewareForStatic)

# Mount folder agar bisa diakses public via URL (misal: http://127.0.0.1:8000/uploads/images/foto.jpg)
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

# ================== MAIN ENDPOINT ==================
@app.post("/analyze")
async def analyze_xray(
    image: UploadFile = File(...),
    symptoms: Optional[str] = Form(None),
    analysis_type: Optional[str] = Form("xray"),  # ✅ TAMBAHKAN INI
    id_pasien: int = Form(...), # <--- Tambah ini
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

    # ================== LOAD IMAGE ==================
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # ================== SEGMENTASI (UNET KAGGLE) ==================
    #base64_img = to_base64(overlay)
    
    # ================== OPENAI ==================
    image_base64 = base64.b64encode(contents).decode("utf-8")

    prompt_xray = """
    Analyze this chest X-ray image.

    Focus ONLY on lung fields.

    Do NOT analyze:
    - heart (cardiac silhouette)
    - bones
    - diaphragm

    ------------------------
    TASK
    ------------------------
    1. Identify visible abnormalities in lung regions
    2. Describe findings in professional radiology style
    3. Estimate risk level
    4. Suggest most likely disease (NOT definitive diagnosis)
    5. Provide clinical recommendation

    ------------------------
    FINDINGS RULES
    ------------------------
    - Write in detailed radiology narrative style
    - Minimum 3–5 sentences
    - Must read like a professional radiology report
    - Include:
    - location (left/right, upper/middle/lower zone)
    - pattern (linear, patchy, diffuse)
    - severity (mild/moderate/severe)
    - Explain findings clearly (not bullet-like)
    - Use natural medical language flow

    Normal case:
    - Clearly state lungs appear normal
    - Avoid uncertain or speculative language
    
    - Use semi-technical language (mix of medical + easy explanation)
    - Avoid overly complex terminology
    - Make it understandable for non-medical users

    ABNORMALITY RULES:
    - Must list 1–3 most likely diseases
    - Use numbered format:

    Example:
    1. Pneumonia (infeksi paru-paru)
    → Penjelasan sederhana

    2. Tuberculosis (TBC)
    → Penjelasan sederhana

    - Each disease must include:
    - medical name
    - simple explanation in layman terms (Indonesian-friendly)

    - Avoid technical terms without explanation
    - If using medical terms (e.g. atelectasis), MUST explain meaning in simple language

    - If normal:
    "Tidak ditemukan kelainan yang signifikan pada paru-paru"
    ------------------------
    BOUNDING BOX RULES
    ------------------------
    - Detect ALL suspicious regions
    - Maximum 5 boxes
    - Must be tight and minimal
    - Avoid healthy areas
    - Coordinates normalized (0–1)
    - If normal: return empty []

    ------------------------
    RISK ESTIMATION
    ------------------------
    - Range: 0–100
    - Based on:
    - affected area
    - number of regions
    - opacity intensity (low/medium/high)
    - Provide simple explainable reasoning

    ------------------------
    RECOMMENDATION RULES
    ------------------------
    - Write in natural, patient-friendly clinical explanation
    - Avoid overly formal or textbook language
    - Must feel like a doctor explaining to a patient

    Structure:
    - Use 2 parts:
    1. Approach (penjelasan kondisi & langkah selanjutnya)
    2. Treatment (opsi penanganan)

    Style:
    - Use simple and clear language
    - Avoid phrases like:
    "korelasi klinis dianjurkan"
    "penatalaksanaan harus dipandu"
    - Replace with more natural explanations

    Content:
    - Explain what might be happening in the body
    - Explain what the patient should do next
    - Give practical and understandable advice

    Length:
    - Each part must be 2–3 sentences
    - Total should feel explanatory, not robotic

    Risk-based behavior:

    LOW RISK:
    - Reassure the user
    - Suggest monitoring only
    - No urgent tone

    MEDIUM RISK:
    - Suggest follow-up if symptoms persist
    - Explain why monitoring is needed

    HIGH RISK:
    - Suggest immediate medical attention
    - Explain possible seriousness clearly

    Tone:
    - Calm, informative, and helpful
    - Not too technical, not too casual

    ------------------------
    OUTPUT FORMAT
    ------------------------
    Return ONLY valid JSON. No explanation, no markdown.

    {
    "findings": "...",
    "abnormality": "...",
    "risk": 0-100,
    "risk_factors": {
        "area": "...",
        "region_count": "...",
        "intensity": "...",
        "calculation": "..."
    },
    "bboxes": [
        {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
    ],
    "recommendation": {
        "approach": "...",
        "treatment": "..."
    }
    }
    """
    
    
    prompt_fundus = """
    Analyze this retinal fundus image.

    Focus ONLY on retinal structures.

    Do NOT analyze:
    - non-retinal artifacts
    - image borders or noise

    ------------------------
    TASK
    ------------------------
    1. Identify visible retinal abnormalities
    2. Describe findings in detailed ophthalmology narrative
    3. Estimate risk level
    4. Suggest most likely disease(s) (NOT definitive diagnosis)
    5. Provide clear clinical recommendation

    ------------------------
    FINDINGS RULES
    ------------------------
    - Write in detailed ophthalmology narrative style
    - Minimum 4–6 sentences
    - Must read like a professional eye examination report
    - Use flowing sentences (NOT bullet points)

    Include:
    - location (macula, optic disc, vascular arcades, peripheral retina)
    - lesion type (microaneurysm, hemorrhage, exudate, cotton wool spot, neovascularization)
    - distribution (localized, scattered, diffuse)
    - severity (mild, moderate, severe)

    Style:
    - Use semi-technical language (medical + simple explanation)
    - Avoid overly complex jargon
    - Make it understandable for non-medical users

    Normal case:
    - Clearly state retina appears normal
    - Mention absence of lesions
    - Avoid uncertainty language

    ------------------------
    ABNORMALITY RULES
    ------------------------
    - MUST list 1–3 most likely diseases
    - Use numbered format:

    Example:
    1. Diabetic Retinopathy (kerusakan retina akibat diabetes)
    → Jelaskan dengan bahasa sederhana

    2. Hypertensive Retinopathy (gangguan retina akibat tekanan darah tinggi)
    → Jelaskan dengan bahasa sederhana

    Requirements:
    - Each disease MUST include:
    - medical name
    - simple explanation (bahasa Indonesia)
    - Avoid unexplained medical terms

    If normal:
    "Tidak ditemukan kelainan signifikan pada retina"

    ------------------------
    BOUNDING BOX RULES
    ------------------------
    - Detect ALL suspicious lesions
    - Maximum 5 boxes
    - Tight and minimal (jangan terlalu besar)
    - Focus only on abnormal areas
    - Coordinates normalized (0–1)
    - If normal: return []

    ------------------------
    RISK ESTIMATION
    ------------------------
    - Range: 0–100
    - Based on:
    - number of lesions
    - distribution (localized vs diffuse)
    - severity of lesions

    - Provide simple reasoning:
    explain why risk is low / medium / high

    ------------------------
    RECOMMENDATION RULES
    ------------------------
    - Write like a doctor explaining to a patient
    - Use natural, simple language

    Structure:
    1. Approach → penjelasan kondisi & langkah selanjutnya
    2. Treatment → opsi penanganan

    Length:
    - Each part: 2–3 sentences

    Risk-based tone:

    LOW RISK:
    - Reassure patient
    - Suggest monitoring

    MEDIUM RISK:
    - Suggest follow-up
    - Explain why monitoring needed

    HIGH RISK:
    - Suggest urgent ophthalmology evaluation
    - Explain possible seriousness

    Tone:
    - Calm, informative, not robotic

    ------------------------
    OUTPUT FORMAT
    ------------------------
    Return ONLY valid JSON. No explanation, no markdown.

    {
    "findings": "...",
    "abnormality": "...",
    "risk": 0-100,
    "risk_factors": {
        "lesion_count": "...",
        "distribution": "...",
        "severity": "...",
        "calculation": "..."
    },
    "bboxes": [
        {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
    ],
    "recommendation": {
        "approach": "...",
        "treatment": "..."
    }
    }
    """
    
    
    prompt_ct = """
    Analyze this non-contrast brain CT scan.

    Focus ONLY on intracranial structures.

    Do NOT analyze:
    - skull fractures (unless clearly related to intracranial pathology)
    - external artifacts
    - non-brain regions

    ------------------------
    TASK
    ------------------------
    1. Identify visible intracranial abnormalities
    2. Describe findings in detailed radiology narrative
    3. Estimate risk level
    4. Suggest most likely diagnosis (NOT definitive)
    5. Provide clinical recommendation

    ------------------------
    FINDINGS RULES
    ------------------------
    - Write in detailed neuroradiology narrative style
    - Minimum 4–6 sentences
    - Must read like a professional CT scan report
    - Use flowing sentences (NOT bullet points)

    Include:
    - location (lobar region: frontal, parietal, temporal, occipital, cerebellum, brainstem)
    - side (left/right/bilateral)
    - density (hyperdense, hypodense, isodense)
    - pattern (focal, diffuse, mass effect)
    - severity (mild, moderate, severe)

    Also mention if present:
    - midline shift
    - ventricular compression or dilation
    - edema
    - hemorrhage patterns

    Style:
    - Use semi-technical language
    - Explain complex terms briefly
    - Keep understandable for non-medical users

    Normal case:
    - Clearly state no acute intracranial abnormality
    - Mention:
    - no hemorrhage
    - no mass effect
    - no midline shift

    ------------------------
    ABNORMALITY RULES
    ------------------------
    - MUST list 1–3 most likely conditions
    - Use numbered format:

    Example:
    1. Intracerebral Hemorrhage (perdarahan di dalam otak)
    → Jelaskan secara sederhana

    2. Ischemic Stroke (stroke akibat sumbatan pembuluh darah)
    → Jelaskan secara sederhana

    3. Brain Edema (pembengkakan jaringan otak)
    → Jelaskan secara sederhana

    Requirements:
    - Include medical name + simple explanation (Bahasa Indonesia)
    - Avoid unexplained jargon

    If normal:
    "Tidak ditemukan kelainan intrakranial yang signifikan"

    ------------------------
    BOUNDING BOX RULES
    ------------------------
    - Detect ALL suspicious regions
    - Maximum 5 boxes
    - Tight and minimal
    - Focus on abnormal areas only
    - Coordinates normalized (0–1)
    - If normal: return []

    ------------------------
    RISK ESTIMATION
    ------------------------
    - Range: 0–100
    - Based on:
    - size of lesion
    - location (critical area or not)
    - presence of mass effect or midline shift
    - number of abnormalities

    - Provide explainable reasoning

    ------------------------
    RECOMMENDATION RULES
    ------------------------
    - Write like a doctor explaining to patient
    - Use clear and calm language

    Structure:
    1. Approach → penjelasan kondisi
    2. Treatment → langkah penanganan

    Length:
    - Each part: 2–3 sentences

    Risk-based tone:

    LOW RISK:
    - Monitoring
    - No urgent action

    MEDIUM RISK:
    - Suggest further imaging / follow-up
    - Explain need for observation

    HIGH RISK:
    - Urgent medical attention
    - Explain potential danger clearly

    Tone:
    - Informative, calm, not robotic

    ------------------------
    OUTPUT FORMAT
    ------------------------
    Return ONLY valid JSON. No explanation, no markdown.

    {
    "findings": "...",
    "abnormality": "...",
    "risk": 0-100,
    "risk_factors": {
        "lesion_size": "...",
        "location": "...",
        "mass_effect": "...",
        "calculation": "..."
    },
    "bboxes": [
        {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
    ],
    "recommendation": {
        "approach": "...",
        "treatment": "..."
    }
    }
    """
    analysis_type = analysis_type.lower().strip()
    
    if "xray" in analysis_type:
        prompt = prompt_xray
    elif "fundus" in analysis_type or "retina" in analysis_type:
        prompt = prompt_fundus
    elif "ct" in analysis_type:
        prompt = prompt_ct
    else:
        prompt = prompt_xray
    if symptoms:
        symptoms_en = translate_to_english(symptoms)
        prompt += f"\nPatient symptoms: {symptoms_en}\n"
    
    response = client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{image_base64}"
                    }
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
                "area": "-",
                "region_count": "-",
                "intensity": "-",
                "calculation": "Tidak tersedia"
            }

         # 3. SIMPAN GAMBAR KE FOLDER (Ini yang tadi ilang!)
        file_ext = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4().hex}.{file_ext}"
        file_path = os.path.join(IMG_DIR, file_name)
        with open(file_path, "wb") as f:
            f.write(contents)
        print(f"✅ File Tersimpan di: {file_path}")

        # 4. SIMPAN KE DATABASE (Tabel Pemeriksaan & Analisis)
        new_pem = models.Pemeriksaan(id_pasien=id_pasien, no_reg=f"REG-{uuid.uuid4().hex[:6].upper()}", id_dokter=1)
        db.add(new_pem)
        db.flush() 

        # Cari ID Jenis (X-Ray, dll)
        jenis_db = db.query(models.Jenis).filter(models.Jenis.nama_jenis == analysis_type).first()
        id_j = jenis_db.id_jenis if jenis_db else 1

        new_anal = models.Analisis(
            id_pemeriksaan=new_pem.id_pemeriksaan,
            id_jenis=id_j,
            gambar_asli=file_path,
            teks_hasil_analisis=json.dumps(ai_result),
            ai_bboxes=json.dumps(ai_result.get("bboxes", [])),
            doctor_bboxes=json.dumps([]),            
            status="Selesai"
        )
        db.add(new_anal)
        db.commit() # Simpan permanen ke medis.db
        print(f"✅ Data Tersimpan di DB. Record ID: {new_anal.id_analisis}")
        
        ai_result["findings"] = translate_text(ai_result.get("findings"))
        ai_result["abnormality"] = translate_text(ai_result.get("abnormality"))

        ai_result["recommendation"]["approach"] = translate_text(
            ai_result["recommendation"].get("approach")
        )

        ai_result["recommendation"]["treatment"] = translate_text(
            ai_result["recommendation"].get("treatment")
        )

        # optional (biar lengkap)
        ai_result["risk_factors"]["calculation"] = translate_text(
            ai_result["risk_factors"].get("calculation")
        )
        
        ai_result["risk_factors"]["area"] = translate_text(
        ai_result["risk_factors"].get("area")
)

        ai_result["risk_factors"]["region_count"] = translate_text(
            str(ai_result["risk_factors"].get("region_count"))
        )

        ai_result["risk_factors"]["intensity"] = translate_text(
            ai_result["risk_factors"].get("intensity")
        )

        required_keys = ["findings", "abnormality", "risk", "bboxes", "recommendation"]

        for key in required_keys:
            if key not in ai_result:
                raise HTTPException(status_code=500, detail=f"{key} tidak ada di response AI")

    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Format AI tidak valid")
    
    # ================== SEGMENTASI ==================
    #mask = predict_mask(pil_image)
    #overlay = overlay_mask(pil_image, mask)
    #overlay = np.array(pil_image)

    # ================== BBOX ==================
    bboxes = ai_result.get("bboxes", [])

    if not bboxes:
        print("AI tidak mendeteksi area abnormal")

    overlay = np.array(pil_image)

    # ✅ HANYA UNTUK XRAY
    if analysis_type == "xray":
        refined_boxes = refine_bbox_with_opencv(overlay, bboxes)
    else:
        refined_boxes = []

    # ================= DRAW =================
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
            
    # ✅ TAMBAHAN: SIMPAN GAMBAR HASIL KOTAK MERAH KE FOLDER
    file_name_hasil = f"hasil_{uuid.uuid4().hex}.jpg"
    file_path_hasil = os.path.join(IMG_DIR, file_name_hasil)
    # Convert RGB to BGR untuk OpenCV save
    cv2.imwrite(file_path_hasil, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

    # ================== UPDATE DATABASE ==================
    # Kita update baris yang udah dibuat di atas dengan gambar hasil
    analisis_baru = db.query(models.Analisis).filter(models.Analisis.gambar_asli == file_path).first()
    if analisis_baru:
        analisis_baru.gambar_hasil = file_path_hasil
        db.commit()

    # ================== FINAL ==================
    overlay = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    base64_img = to_base64(overlay)
    
    # ================== RETURN ==================
    return {
        "record_id": analisis_baru.id_analisis if analisis_baru else None,
        "result": ai_result,
        "segmentation_image": base64_img
    }

# Skema Pydantic untuk validasi input Pasien Baru
class PasienCreate(BaseModel):
    no_rm: str
    nama_pasien: str

# 1. API UNTUK NAMBAH PASIEN (CREATE)
@app.get("/api/patients")
def get_all_patients(db: Session = Depends(get_db)):
    patients = db.query(models.Pasien).all()
    
    result =[]
    for p in patients:
        result.append({
            "id_pasien": p.id_pasien,
            "no_rm": p.no_rm,
            "nama_pasien": p.nama_pasien,
            "age": p.umur,             # <-- Map ke 'age' biar sama kayak React lu
            "gender": p.gender,
            "bloodType": p.blood_type  # <-- Map ke 'bloodType'
        })
        
    return {"status": "success", "data": result}

# 2. API UNTUK MENGAMBIL LIST SEMUA PASIEN (READ)
@app.get("/api/patients")
def get_all_patients(db: Session = Depends(get_db)):
    patients = db.query(models.Pasien).all()
    
    # Bikin format yang cocok buat frontend React lu nanti
    result =[]
    for p in patients:
        result.append({
            "id_pasien": p.id_pasien,
            "no_rm": p.no_rm,
            "nama_pasien": p.nama_pasien
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

# ==========================================
# API UNTUK SIMPAN PEMERIKSAAN & ANALISIS
# ==========================================
@app.post("/api/save-analysis")
async def save_analysis(
    id_pasien: int = Form(...),
    id_jenis: int = Form(...),
    # teks_hasil_analisis kita buat Optional agar Auto-Analyze bisa ke-trigger nanti
    teks_hasil_analisis: Optional[str] = Form(None), 
    gambar_asli: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Logika simpan gambar sama seperti sebelumnya...
    no_reg = f"REG-{uuid.uuid4().hex[:8].upper()}"
    pemeriksaan_baru = models.Pemeriksaan(id_pasien=id_pasien, no_reg=no_reg, id_dokter=1)
    db.add(pemeriksaan_baru)
    db.commit()

    file_ext = gambar_asli.filename.split(".")[-1]
    file_path = os.path.join(IMG_DIR, f"{uuid.uuid4().hex}.{file_ext}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(gambar_asli.file, buffer)

    analisis_baru = models.Analisis(
        id_pemeriksaan=pemeriksaan_baru.id_pemeriksaan,
        id_jenis=id_jenis,
        gambar_asli=file_path,
        teks_hasil_analisis=teks_hasil_analisis, # Kalo dikosongin dari UI, ini jadi NULL (Bagus!)
        status="Selesai"
    )
    db.add(analisis_baru)
    db.commit()
    return {"status": "success", "id_analisis": analisis_baru.id_analisis}

# ==========================================
# API: GET PROFIL PASIEN & RIWAYAT PEMERIKSAAN
# ==========================================
@app.get("/api/patients/{id_pasien}")
def get_patient_detail(id_pasien: int, db: Session = Depends(get_db)):
    pasien = db.query(models.Pasien).filter(models.Pasien.id_pasien == id_pasien).first()
    if not pasien: raise HTTPException(status_code=404)
    
    # Format data pasien biar lengkap pas ditarik ke halaman Detail
    patient_data = {
        "id_pasien": pasien.id_pasien,
        "no_rm": pasien.no_rm,
        "nama_pasien": pasien.nama_pasien,
        "age": pasien.umur,
        "gender": pasien.gender,
        "bloodType": pasien.blood_type
    }
    
    history =[]
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
            "gambar_hasil_url": get_clean_url(r.gambar_hasil)
        })
            
    return {
        "status": "success", 
        "patient": patient_data, 
        "history": history
    }
# ==========================================
# API: GET DETAIL RECORD (WITH AUTO-ANALYZE)
# ==========================================
@app.get("/api/records/{id_analisis}")
async def get_record_detail(id_analisis: int, db: Session = Depends(get_db)):
    # 1. Cari data analisis di database
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data analisis tidak ditemukan")

    # ========================================================
    # JIKA BELUM ADA HASIL AI (TRIGGER AUTO-ANALYZE OPENAI)
    # ========================================================
    if not analisis.teks_hasil_analisis:
        print(f"Menginisiasi Auto-Analyze AI untuk Record ID: {id_analisis}...")
        
        file_path = analisis.gambar_asli
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File gambar fisik tidak ditemukan di server")
            
        with open(file_path, "rb") as image_file:
            contents = image_file.read()
        
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        image_base64 = base64.b64encode(contents).decode("utf-8")

        # Ambil jenis analisis dari relasi DB untuk nentuin prompt
        jenis = db.query(models.Jenis).filter(models.Jenis.id_jenis == analisis.id_jenis).first()
        analysis_type = jenis.nama_jenis.lower() if jenis else "xray"

        # --- PROMPT DARI TEMEN LO ---
        prompt_xray = """
        Analyze this chest X-ray image.
        Focus ONLY on lung fields.
        Do NOT analyze:
        - heart (cardiac silhouette)
        - bones
        - diaphragm
        ------------------------
        TASK
        ------------------------
        1. Identify visible abnormalities in lung regions
        2. Describe findings in professional radiology style
        3. Estimate risk level
        4. Suggest most likely disease (NOT definitive diagnosis)
        5. Provide clinical recommendation
        ------------------------
        FINDINGS RULES
        ------------------------
        - Write in detailed radiology narrative style
        - Minimum 3–5 sentences
        - Must read like a professional radiology report
        - Include: location, pattern, severity
        - Explain findings clearly (not bullet-like)
        - Use natural medical language flow
        Normal case:
        - Clearly state lungs appear normal
        - Avoid uncertain or speculative language
        - Use semi-technical language
        - Avoid overly complex terminology
        - Make it understandable for non-medical users
        ABNORMALITY RULES:
        - Must list 1–3 most likely diseases
        - Use numbered format
        - Each disease must include: medical name, simple explanation in layman terms
        - If normal: "Tidak ditemukan kelainan yang signifikan pada paru-paru"
        ------------------------
        BOUNDING BOX RULES
        ------------------------
        - Detect ALL suspicious regions
        - Maximum 5 boxes
        - Must be tight and minimal
        - Avoid healthy areas
        - Coordinates normalized (0–1)
        - If normal: return empty[]
        ------------------------
        RISK ESTIMATION
        ------------------------
        - Range: 0–100
        - Based on: affected area, number of regions, opacity intensity
        - Provide simple explainable reasoning
        ------------------------
        RECOMMENDATION RULES
        ------------------------
        - Write in natural, patient-friendly clinical explanation
        - Avoid overly formal or textbook language
        Structure:
        1. Approach
        2. Treatment
        Tone: Calm, informative, and helpful
        ------------------------
        OUTPUT FORMAT
        ------------------------
        Return ONLY valid JSON. No explanation, no markdown.
        {
        "findings": "...",
        "abnormality": "...",
        "risk": 0-100,
        "risk_factors": {
            "area": "...",
            "region_count": "...",
            "intensity": "...",
            "calculation": "..."
        },
        "bboxes":[
            {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
        ],
        "recommendation": {
            "approach": "...",
            "treatment": "..."
        }
        }
        """
        
        prompt_fundus = """
        Analyze this retinal fundus image.
        Focus on retinal abnormalities including:
        - microaneurysms (small red dots)
        - hemorrhages (dark red patches)
        - exudates (yellow-white deposits)
        - cotton wool spots (soft white lesions)
        - abnormal blood vessels (tortuosity, neovascularization)
        - macula abnormalities
        Rules:
        - Do NOT provide a definitive medical diagnosis
        - Detect ALL suspicious retinal lesions
        - If normal: return empty bboxes[]
        Findings rules:
        - Write in detailed clinical narrative style (ophthalmology)
        - Minimum 3–5 sentences
        - Include: location, lesion type, severity
        Normal case rule:
        - Clearly state retina appears normal
        Abnormality rules:
        - MUST include possible disease name
        Bounding boxes:
        - Tight around lesions
        - Max 5 boxes
        - Coordinates normalized (0–1)
        Output Format:
        Return ONLY valid JSON.
        {
        "findings": "...",
        "abnormality": "...",
        "risk": 0-100,
        "risk_factors": {
            "lesion_count": "...",
            "spread": "...",
            "severity": "...",
            "calculation": "..."
        },
        "bboxes":[
            {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
        ],
        "recommendation": {
            "approach": "...",
            "treatment": "..."
        }
        }
        """
        
        prompt_ct = """
        test
        """
        
        if "x-ray" in analysis_type or "xray" in analysis_type:
            prompt = prompt_xray
        elif "fundus" in analysis_type or "mata" in analysis_type:
            prompt = prompt_fundus
        elif "ct" in analysis_type:
            prompt = prompt_ct
        else:
            prompt = prompt_xray  # fallback
        
        # Eksekusi OpenAI dari temen lo
        response = client.responses.create(
            model="gpt-5.4-mini",
            input=[
                {
                    "role": "user",
                    "content":[
                        {"type": "input_text", "text": prompt},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{image_base64}"
                        }
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
                    "area": "-",
                    "region_count": "-",
                    "intensity": "-",
                    "calculation": "Tidak tersedia"
                }
            
            # --- TRANSLATE LOGIC TEMEN LO ---
            ai_result["findings"] = translate_text(ai_result.get("findings"))
            ai_result["abnormality"] = translate_text(ai_result.get("abnormality"))
            ai_result["recommendation"]["approach"] = translate_text(ai_result["recommendation"].get("approach"))
            ai_result["recommendation"]["treatment"] = translate_text(ai_result["recommendation"].get("treatment"))
            ai_result["risk_factors"]["calculation"] = translate_text(ai_result["risk_factors"].get("calculation"))
            ai_result["risk_factors"]["area"] = translate_text(ai_result["risk_factors"].get("area"))
            ai_result["risk_factors"]["region_count"] = translate_text(str(ai_result["risk_factors"].get("region_count") or ai_result["risk_factors"].get("lesion_count", "-")))
            ai_result["risk_factors"]["intensity"] = translate_text(ai_result["risk_factors"].get("intensity") or ai_result["risk_factors"].get("severity", "-"))

            required_keys =["findings", "abnormality", "risk", "bboxes", "recommendation"]
            for key in required_keys:
                if key not in ai_result:
                    raise HTTPException(status_code=500, detail=f"{key} tidak ada di response AI")

        except Exception as e:
            print("ERROR:", str(e))
            raise HTTPException(status_code=500, detail="Format AI tidak valid")
        
        # --- BBOX OPENCV DARI TEMEN LO ---
        bboxes = ai_result.get("bboxes",[])
        overlay = np.array(pil_image)

        if not bboxes:
            print("AI tidak mendeteksi area abnormal")
        else:
            refined_boxes = refine_bbox_with_opencv(overlay, bboxes)
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

        # Save Gambar Segmentasi
        import uuid
        file_name_hasil = f"hasil_{uuid.uuid4().hex}.jpg"
        file_path_hasil = os.path.join(IMG_DIR, file_name_hasil)
        cv2.imwrite(file_path_hasil, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
        
        # UPDATE DB
        analisis.teks_hasil_analisis = json.dumps(ai_result)
        analisis.gambar_hasil = file_path_hasil
        db.commit()
        db.refresh(analisis)
        print("Auto-Analyze Selesai dan disimpan ke Database!")

    # ========================================================
    # RETURN HASIL KE FRONTEND (KLAUSA ELSE YANG KEPOTONG)
    # ========================================================
    # ========================================================
    # JIKA SUDAH ADA HASIL (Ambil langsung dari Database)
    # ========================================================
    try:
        if analisis.teks_hasil_analisis:
            # Kita bersihkan string dari spasi atau karakter aneh di ujung
            clean_json_str = analisis.teks_hasil_analisis.strip()
            
            # Cek apakah datanya "double string" (kasus langka tapi sering bikin error)
            hasil_json = json.loads(clean_json_str)
            if isinstance(hasil_json, str):
                hasil_json = json.loads(hasil_json)
        else:
            hasil_json = None
    except Exception as e:
        print(f"Gagal parse JSON dari DB: {e}")
        # Jika gagal, kembalikan data kosong bukannya bikin server mati (500)
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
            "gambar_asli_url": get_clean_url(analisis.gambar_asli), # Pake fungsi pembersih
            "gambar_hasil_url": get_clean_url(analisis.gambar_hasil), 
            "ai_result": hasil_json,
            "doctor_notes": json.loads(analisis.doctor_notes) if analisis.doctor_notes else None,
            "ai_bboxes": json.loads(analisis.ai_bboxes) if analisis.ai_bboxes else [],
            "doctor_bboxes": json.loads(analisis.doctor_bboxes) if analisis.doctor_bboxes else [],
            "doctor_notes": json.loads(analisis.doctor_notes) if analisis.doctor_notes else None,        }
    }
    
@app.put("/api/records/{id_analisis}/doctor-update")
async def update_doctor_data(
    id_analisis: int,
    doctor_notes: Optional[str] = Form(None),
    doctor_bboxes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    # Langsung simpan aja karena dari React udah berwujud JSON String yang rapi.
    # Kita TIMPA (Overwrite) data lama biar fungsi "Hapus Kotak" di Frontend berfungsi.
    if doctor_bboxes is not None:
        analisis.doctor_bboxes = doctor_bboxes

    if doctor_notes is not None:
        analisis.doctor_notes = doctor_notes

    db.commit()
    db.refresh(analisis)
    return {"status": "success"}

@app.get("/api/debug/reset/{id_analisis}")
def reset_analysis(id_analisis: int, db: Session = Depends(get_db)):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if analisis:
        analisis.teks_hasil_analisis = None # Kosongkan biar ke-trigger analyze ulang
        analisis.gambar_hasil = None
        db.commit()
        return {"msg": "Data direset, silakan refresh halaman Detail di React"}

@app.put("/api/records/{id_analisis}/doctor-update")
async def update_doctor_data(
    id_analisis: int,
    doctor_notes: Optional[str] = Form(None),
    doctor_bboxes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    # Simpan langsung karena dari frontend sudah berupa JSON string
    if doctor_notes:
        analisis.doctor_notes = doctor_notes
    if doctor_bboxes:
        analisis.doctor_bboxes = doctor_bboxes

    db.commit()
    return {"status": "success"}
    
def get_clean_url(path):
    if not path: return None
    # Ubah backslash Windows (\) jadi forward slash (/) biar browser paham
    clean_path = path.replace("\\", "/")
    # Pastikan tidak double http
    return f"http://localhost:8000/{clean_path}"

# ================== SEEDING DATA DUMMY ==================

seed_everything()
