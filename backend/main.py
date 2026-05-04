from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import json
import numpy as np
import cv2
import base64
from dotenv import load_dotenv
from typing import Optional, List
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
from dicom_utils import (
    is_dicom_file,
    dicom_to_pil_slices,
    pil_to_base64_jpeg,
    DicomNotSupportedError,
)


models.Base.metadata.create_all(bind=engine)

def seed_everything():
    db = SessionLocal()
    if db.query(models.Pasien).count() == 0:
        data_pasien = [
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
        kategori = ["X-Ray", "CT Scan", "Retina Scan", "Endoscopy"]
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
    get_prompt_endoscopy,
    get_prompt_combine_results,   # ← prompt gabungan baru
)

# ================== FOLDER STRUCTURE HELPERS ==================

def sanitize_folder_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'[^\w\-]', '', name)
    return name

def sanitize_jenis_name(jenis: str) -> str:
    jenis = jenis.strip().lower()
    jenis = re.sub(r'\s+', '_', jenis)
    jenis = re.sub(r'[^\w\-]', '', jenis)
    return jenis

def get_next_sequence(folder_path: str, prefix: str) -> int:
    if not os.path.exists(folder_path):
        return 1
    original_files = [
        f for f in os.listdir(folder_path)
        if f.startswith(prefix) and "_original." in f
    ]
    return len(original_files) + 1

def build_patient_jenis_dir(no_rm: str, nama_pasien: str, jenis: str) -> str:
    patient_folder = f"{sanitize_folder_name(no_rm)}_{sanitize_folder_name(nama_pasien)}"
    jenis_folder = sanitize_jenis_name(jenis)
    dir_path = os.path.join(UPLOAD_DIR, "patients", patient_folder, jenis_folder)
    os.makedirs(dir_path, exist_ok=True)
    return dir_path

def build_filename(no_rm: str, nama_pasien: str, jenis: str, seq: int, suffix: str, ext: str) -> str:
    rm_clean = sanitize_folder_name(no_rm)
    nama_clean = sanitize_folder_name(nama_pasien)
    jenis_clean = sanitize_jenis_name(jenis)
    seq_str = str(seq).zfill(3)
    return f"{rm_clean}_{nama_clean}_{jenis_clean}_{seq_str}_{suffix}.{ext}"

def build_filename_multi(no_rm: str, nama_pasien: str, jenis: str, seq: int, urutan: int, suffix: str, ext: str) -> str:
    rm_clean = sanitize_folder_name(no_rm)
    nama_clean = sanitize_folder_name(nama_pasien)
    jenis_clean = sanitize_jenis_name(jenis)
    seq_str = str(seq).zfill(3)
    return f"{rm_clean}_{nama_clean}_{jenis_clean}_{seq_str}_img{urutan}_{suffix}.{ext}"

def get_patient_info_from_db(db, id_pasien: int):
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
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        kernel = np.ones((5, 5), np.uint8)
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


# ================== HELPER: PILIH PROMPT SINGLE ==================
def get_single_prompt(analysis_type: str, detail_level: str) -> str:
    tipe_lower = analysis_type.lower().strip()
    if "xray" in tipe_lower or "x-ray" in tipe_lower:
        return get_prompt_xrays(detail_level)
    elif "fundus" in tipe_lower or "retina" in tipe_lower:
        return get_prompt_fundus(detail_level)
    elif "ct" in tipe_lower:
        return get_prompt_ct(detail_level)
    elif "endoscopy" in tipe_lower:
        return get_prompt_endoscopy(detail_level)
    else:
        return get_prompt_xrays(detail_level)

def extract_json_robust(text: str) -> dict:
    """
    Parse JSON dari response AI dengan multiple fallback strategy.
    """
    # 1. Bersihkan markdown code block
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()
 
    # 2. Coba parse langsung
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  [JSON] Parse langsung gagal: {e}")
 
    # 3. Cari blok { ... } terluar
    # Gunakan pendekatan bracket counting bukan regex greedy
    start = text.find('{')
    if start == -1:
        print("  [JSON] Tidak ada { ditemukan")
        return _empty_result()
 
    # Counting bracket untuk cari penutup yang benar
    depth = 0
    end = -1
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
 
    if end == -1:
        # JSON tidak complete (terpotong) — coba tutup manual
        print(f"  [JSON] JSON terpotong, mencoba auto-close...")
        candidate = text[start:]
        candidate = _try_close_json(candidate)
    else:
        candidate = text[start:end]
 
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        print(f"  [JSON] Parse candidate gagal: {e}")
 
    # 4. Fix JSON rusak: trailing comma, dll
    try:
        fixed = re.sub(r',\s*([}\]])', r'\1', candidate)
        # Escape newline di dalam string values
        fixed = _fix_unescaped_newlines(fixed)
        return json.loads(fixed)
    except Exception as e:
        print(f"  [JSON] Fix attempt gagal: {e}")
 
    # 5. Field extraction manual
    print(f"  [JSON] Fallback ke field extraction")
    return _extract_fields_manual(text)
 
 
def _try_close_json(partial: str) -> str:
    """
    Coba tutup JSON yang terpotong dengan menambah bracket/brace yang kurang.
    """
    # Hitung bracket yang belum ditutup
    depth_brace = 0
    depth_bracket = 0
    in_string = False
    escape_next = False
 
    for ch in partial:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{': depth_brace += 1
        elif ch == '}': depth_brace -= 1
        elif ch == '[': depth_bracket += 1
        elif ch == ']': depth_bracket -= 1
 
    # Kalau masih ada string yang terbuka, tutup dulu
    if in_string:
        partial += '"'
 
    # Tutup array dan object yang terbuka
    partial = partial.rstrip().rstrip(',')
    partial += ']' * max(0, depth_bracket)
    partial += '}' * max(0, depth_brace)
 
    return partial
 
 
def _fix_unescaped_newlines(text: str) -> str:
    """
    Fix newline tidak ter-escape di dalam JSON string values.
    Ini penyebab utama 'Expecting , delimiter' error.
    """
    result = []
    in_string = False
    escape_next = False
 
    for ch in text:
        if escape_next:
            escape_next = False
            result.append(ch)
            continue
        if ch == '\\' and in_string:
            escape_next = True
            result.append(ch)
            continue
        if ch == '"':
            in_string = not in_string
            result.append(ch)
            continue
        # Kalau di dalam string dan ketemu newline/tab literal → escape
        if in_string and ch == '\n':
            result.append('\\n')
            continue
        if in_string and ch == '\r':
            result.append('\\r')
            continue
        if in_string and ch == '\t':
            result.append('\\t')
            continue
        result.append(ch)
 
    return ''.join(result)
 
 
def _extract_fields_manual(text: str) -> dict:
    """Last resort: extract field-field penting dengan regex."""
    result = _empty_result()
 
    patterns = {
        "findings": r'"findings"\s*:\s*"((?:[^"\\]|\\.)*)"',
        "abnormality": r'"abnormality"\s*:\s*"((?:[^"\\]|\\.)*)"',
    }
    for field, pattern in patterns.items():
        m = re.search(pattern, text, re.DOTALL)
        if m:
            result[field] = m.group(1)
 
    risk_m = re.search(r'"risk"\s*:\s*(\d+)', text)
    if risk_m:
        result["risk"] = int(risk_m.group(1))
 
    approach_m = re.search(r'"approach"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if approach_m:
        result["recommendation"]["approach"] = approach_m.group(1)
 
    treatment_m = re.search(r'"treatment"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if treatment_m:
        result["recommendation"]["treatment"] = treatment_m.group(1)
 
    return result
 
 
def _empty_result() -> dict:
    return {
        "findings": "Gagal memproses respons AI.",
        "abnormality": "-",
        "risk": 0,
        "risk_factors": {"area": "-", "region_count": "-", "intensity": "-", "calculation": "-"},
        "bboxes": [],
        "recommendation": {"approach": "-", "treatment": "-"}
    }

# ================== HELPER: PANGGIL AI UNTUK 1 GAMBAR ==================
def call_ai_single(prompt: str, image_base64: str, mime_type: str) -> dict:
    response = client.responses.create(
        model="gpt-4o-mini",
        max_output_tokens=4096,   # ← NAIK dari 1000 ke 4096
        input=[{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:{mime_type};base64,{image_base64}"}
            ]
        }],
        temperature=0.3
    )
    content_text = response.output[0].content[0].text
 
    # Print lebih panjang untuk debug
    print(f"  [AI RAW len={len(content_text)}] {content_text[:500]}")
 
    result = extract_json_robust(content_text)
 
    result.setdefault("risk_factors", {"area": "-", "region_count": "-", "intensity": "-", "calculation": "Tidak tersedia"})
    result.setdefault("findings", "-")
    result.setdefault("abnormality", "-")
    result.setdefault("risk", 0)
    result.setdefault("bboxes", [])
    result.setdefault("recommendation", {"approach": "-", "treatment": "-"})
    return result

# ================== HELPER: GABUNGKAN HASIL MULTI-GAMBAR ==================
def call_ai_combine(
    per_image_results: list,
    analysis_type: str,
    detail_level: str,
    symptoms_en: str = None
) -> dict:
    prompt = get_prompt_combine_results(detail_level, analysis_type, per_image_results)
    if symptoms_en:
        prompt += f"\nPatient symptoms (for context): {symptoms_en}\n"
 
    response = client.responses.create(
        model="gpt-4o-mini",
        input=[{
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}]
        }],
        temperature=0.3
    )
    content_text = response.output[0].content[0].text
    print(f"  [COMBINE AI RAW] {content_text[:300]}")
 
    combined = extract_json_robust(content_text)
 
    combined.setdefault("risk_factors", {"area": "-", "region_count": "-", "intensity": "-", "calculation": "Tidak tersedia"})
    combined.setdefault("findings", "-")
    combined.setdefault("abnormality", "-")
    combined.setdefault("risk", 0)
    combined.setdefault("bboxes", [])
    combined.setdefault("recommendation", {"approach": "-", "treatment": "-"})
    return combined


# ================== MAIN ENDPOINT ==================
@app.post("/analyze")
async def analyze_xray(
    images: List[UploadFile] = File(...),
    symptoms: Optional[str] = Form(None),
    analysis_type: Optional[str] = Form("xray"),
    id_pasien: int = Form(...),
    detail_level: str = Form("medium"),
    db: Session = Depends(get_db)
):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API key tidak ditemukan")

    if not images or len(images) == 0:
        raise HTTPException(status_code=400, detail="Minimal 1 gambar harus diupload")

    if len(images) > 10:
        raise HTTPException(status_code=400, detail="Maksimal 10 gambar per sesi")

    # ── Validasi tipe file ─────────────────────────────────
    # Untuk CT Scan: boleh upload .dcm / .dicom
    # Untuk modality lain: harus JPG atau PNG
    is_ct = "ct" in analysis_type.lower().strip()
    allowed_types = ["image/jpeg", "image/png"]

    for img in images:
        is_dcm = is_dicom_file(img.filename, img.content_type or "")
        if is_dcm and not is_ct:
            raise HTTPException(
                status_code=400,
                detail=f"File DICOM hanya diizinkan untuk CT Scan. File: {img.filename}"
            )
        if not is_dcm and img.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File {img.filename} harus JPG, PNG, atau DCM (khusus CT Scan)"
            )

    # ── Info pasien & folder ────────────────────────────────
    no_rm, nama_pasien = get_patient_info_from_db(db, id_pasien)
    jenis_bersih = analysis_type.strip()
    img_dir = build_patient_jenis_dir(no_rm, nama_pasien, jenis_bersih)
    prefix = f"{sanitize_folder_name(no_rm)}_{sanitize_folder_name(nama_pasien)}_{sanitize_jenis_name(jenis_bersih)}_"
    seq = get_next_sequence(img_dir, prefix)

    # ── Translate symptoms ──────────────────────────────────
    symptoms_en = None
    if symptoms:
        symptoms_en = translate_to_english(symptoms)

    # ── Baca semua gambar ke memori & simpan original ───────
    # Kalau DICOM → extract slice representatif dulu, tiap slice jadi 1 entry
    images_data = []
    urutan_counter = 1  # counter global urutan (naik terus meski DICOM expand jadi banyak slice)

    for image_file in images:
        contents = await image_file.read()
        if len(contents) > 200 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File {image_file.filename} melebihi 200MB")

        file_ext = image_file.filename.split(".")[-1].lower()
        is_dcm = is_dicom_file(image_file.filename, image_file.content_type or "")

        if is_dcm:
            # ── DICOM: ekstrak slice representatif ──────────
            print(f"🔍 Memproses DICOM: {image_file.filename}")
            try:
                pil_slices = dicom_to_pil_slices(
                    dicom_bytes=contents,
                    filename=image_file.filename,
                    n_slices=5  # ambil 5 slice representatif per file DICOM
                )
            except DicomNotSupportedError as e:
                raise HTTPException(status_code=500, detail=str(e))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            print(f"✅ DICOM '{image_file.filename}': {len(pil_slices)} slice diekstrak")

            # Simpan original DICOM sekali
            dcm_name = build_filename_multi(no_rm, nama_pasien, jenis_bersih, seq, urutan_counter, "original", "dcm")
            dcm_path = os.path.join(img_dir, dcm_name)
            with open(dcm_path, "wb") as f:
                f.write(contents)

            # Setiap slice jadi 1 entry images_data
            for slice_idx, pil_slice in enumerate(pil_slices, start=1):
                # Simpan slice sebagai JPG
                slice_name = build_filename_multi(
                    no_rm, nama_pasien, jenis_bersih, seq,
                    urutan_counter, f"slice{slice_idx}", "jpg"
                )
                slice_path = os.path.join(img_dir, slice_name)
                pil_slice.save(slice_path, format="JPEG", quality=90)
                print(f"  [DEBUG] Slice saved: {slice_path}")

                # Base64 untuk AI
                image_base64 = pil_to_base64_jpeg(pil_slice)

                images_data.append({
                    "urutan": urutan_counter,
                    "slice_idx": slice_idx,
                    "pil_image": pil_slice,
                    "image_base64": image_base64,
                    "mime_type": "image/jpeg",
                    "path_original": slice_path,   # tampilkan slice JPG di frontend
                    "path_dicom": dcm_path,         # path DICOM asli untuk arsip
                    "file_ext": "jpg",
                    "from_dicom": True,
                })
                urutan_counter += 1

        else:
            # ── JPG/PNG biasa ────────────────────────────────
            file_name_original = build_filename_multi(no_rm, nama_pasien, jenis_bersih, seq, urutan_counter, "original", file_ext)
            file_path_original = os.path.join(img_dir, file_name_original)
            with open(file_path_original, "wb") as f:
                f.write(contents)

            pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
            buffered = io.BytesIO()
            pil_image.save(buffered, format="JPEG")
            image_base64 = base64.b64encode(buffered.getvalue()).decode()

            images_data.append({
                "urutan": urutan_counter,
                "slice_idx": None,
                "pil_image": pil_image,
                "image_base64": image_base64,
                "mime_type": "image/jpeg",
                "path_original": file_path_original,
                "path_dicom": None,
                "file_ext": file_ext,
                "from_dicom": False,
            })
            urutan_counter += 1

    # Cek total setelah DICOM expand
    if len(images_data) > 15:
        # Terlalu banyak slice, batasi ke 10 slice paling representatif
        print(f"⚠️ Total {len(images_data)} slice setelah expand DICOM, dibatasi ke 10")
        step = len(images_data) // 10
        images_data = images_data[::step][:10]
        # Re-assign urutan
        for i, d in enumerate(images_data, start=1):
            d["urutan"] = i

    # ── Analisis AI: setiap gambar pakai prompt SINGLE ──────
    # Strategi: analisis per-gambar → hasilnya akurat per gambar
    # Lalu jika multi-gambar → combine dengan 1 call AI lagi
    
    single_prompt = get_single_prompt(jenis_bersih, "long")
    if symptoms_en:
        single_prompt += f"\nPatient symptoms: {symptoms_en}\n"

    per_image_results = []  # hasil AI per gambar

    for img_data in images_data:
        try:
            result_single = call_ai_single(
                prompt=single_prompt,
                image_base64=img_data["image_base64"],
                mime_type=img_data["mime_type"]
            )
            per_image_results.append(result_single)
            print(f"✅ Gambar {img_data['urutan']} selesai dianalisis. Risk: {result_single.get('risk', 0)}, BBoxes: {len(result_single.get('bboxes', []))}")
        except Exception as e:
            print(f"❌ ERROR analisis gambar {img_data['urutan']}: {e}")
            raise HTTPException(status_code=500, detail=f"Gagal analisis gambar {img_data['urutan']}: {str(e)}")

    # ── Gabungkan hasil ──────────────────────────────────────
    total_images = len(images_data)

    if total_images == 1:
        # Single image: langsung pakai hasil single
        ai_result = per_image_results[0]
        print(f"✅ Single image mode. Risk: {ai_result.get('risk')}")
    else:
        # Multi image: combine semua hasil dengan 1 call AI
        try:
            ai_result = call_ai_combine(
                per_image_results=per_image_results,
                analysis_type=jenis_bersih,
                detail_level=detail_level,
                symptoms_en=symptoms_en
            )
            print(f"✅ Multi image combined. Risk: {ai_result.get('risk')}")
        except Exception as e:
            print(f"❌ ERROR combine: {e}. Fallback ke hasil gambar pertama.")
            # Fallback: pakai hasil gambar pertama
            ai_result = per_image_results[0]

    # ── Pastikan bboxes top-level ada ────────────────────────
    if "bboxes" not in ai_result:
        ai_result["bboxes"] = []

    # ── Simpan ke database ──────────────────────────────────
    jenis_db = db.query(models.Jenis).filter(models.Jenis.nama_jenis.ilike(jenis_bersih)).first()
    if not jenis_db:
        kategori_baru = models.Jenis(nama_jenis=jenis_bersih)
        db.add(kategori_baru)
        db.commit()
        db.refresh(kategori_baru)
        id_j = kategori_baru.id_jenis
    else:
        id_j = jenis_db.id_jenis

    new_pem = models.Pemeriksaan(
        id_pasien=id_pasien,
        no_reg=f"REG-{uuid.uuid4().hex[:6].upper()}",
        id_dokter=1
    )
    db.add(new_pem)
    db.flush()

    first = images_data[0]

    # Analisis utama — simpan AI result gabungan
    new_anal = models.Analisis(
        id_pemeriksaan=new_pem.id_pemeriksaan,
        id_jenis=id_j,
        gambar_asli=first["path_original"],
        gambar_hasil=None,      # Tidak ada gambar hasil AI (bbox di frontend)
        gambar_dokter=None,
        teks_hasil_analisis=json.dumps(ai_result),
        ai_bboxes=json.dumps(ai_result.get("bboxes", [])),
        doctor_bboxes=json.dumps([]),
        status="Selesai"
    )
    db.add(new_anal)
    db.flush()

    # GambarAnalisis per gambar — simpan path + bboxes per gambar
    processed_images = []
    for i, img_data in enumerate(images_data):
        urutan = img_data["urutan"]
        # Ambil bboxes dari hasil per-gambar (bukan combined)
        bboxes_for_this = per_image_results[i].get("bboxes", []) if i < len(per_image_results) else []

        gambar_rec = models.GambarAnalisis(
            id_analisis=new_anal.id_analisis,
            urutan=urutan,
            gambar_asli=img_data["path_original"],
            gambar_hasil=None,      # Tidak ada gambar hasil AI (bbox di frontend)
            teks_hasil_analisis=None,
            ai_bboxes=json.dumps(bboxes_for_this),
            doctor_bboxes=json.dumps([]),
        )
        db.add(gambar_rec)

        processed_images.append({
            "urutan": urutan,
            "path_original": img_data["path_original"],
            "bboxes": bboxes_for_this,
        })

    db.commit()
    print(f"✅ Analisis ID {new_anal.id_analisis} dengan {total_images} gambar tersimpan.")

    # ── Normalisasi semua field: pastikan semua value adalah string ──────────
    def safe_str(val):
        """Flatten any value to plain string."""
        if val is None:
            return "-"
        if isinstance(val, list):
            # List of objects/strings → join jadi teks bernomor
            parts = []
            for i, item in enumerate(val, 1):
                if isinstance(item, dict):
                    # Coba ambil field name/disease/condition dulu
                    name = item.get("name") or item.get("disease") or item.get("condition") or item.get("title") or ""
                    desc = item.get("description") or item.get("explanation") or item.get("detail") or ""
                    if name:
                        parts.append(f"{i}. {name}\n→ {desc}" if desc else f"{i}. {name}")
                    else:
                        parts.append(f"{i}. " + ", ".join(f"{k}: {v}" for k, v in item.items()))
                else:
                    parts.append(str(item))
            return "\n\n".join(parts) if parts else "-"
        if isinstance(val, dict):
            # Dict dengan numeric keys atau nested
            parts = []
            for i, (k, v) in enumerate(val.items(), 1):
                if isinstance(v, dict):
                    name = v.get("name") or v.get("disease") or str(k)
                    desc = v.get("description") or v.get("explanation") or ""
                    parts.append(f"{i}. {name}\n→ {desc}" if desc else f"{i}. {name}")
                else:
                    parts.append(f"{i}. {k}: {v}")
            return "\n\n".join(parts) if parts else "-"
        return str(val)

    # Normalisasi abnormality (sering jadi array atau dict dari AI)
    raw_abnormality = ai_result.get("abnormality", "-")
    if not isinstance(raw_abnormality, str):
        ai_result["abnormality"] = safe_str(raw_abnormality)

    # Normalisasi findings
    raw_findings = ai_result.get("findings", "-")
    if not isinstance(raw_findings, str):
        ai_result["findings"] = safe_str(raw_findings)

    # Normalisasi risk_factors
    rf = ai_result.get("risk_factors", {})
    if not isinstance(rf, dict):
        rf = {}
    normalized_rf = {
        "area":         safe_str(rf.get("area") or rf.get("location") or rf.get("lesion_size") or rf.get("lesion_count") or "-"),
        "region_count": safe_str(rf.get("region_count") or rf.get("distribution") or "-"),
        "intensity":    safe_str(rf.get("intensity") or rf.get("severity") or rf.get("mass_effect") or "-"),
        "calculation":  safe_str(rf.get("calculation") or "-"),
    }
    ai_result["risk_factors"] = normalized_rf

    # ── Translate hasil untuk response ───────────────────────
    ai_result["findings"]    = translate_text(ai_result.get("findings") or "")
    ai_result["abnormality"] = translate_text(ai_result.get("abnormality") or "")
    if isinstance(ai_result.get("recommendation"), dict):
        ai_result["recommendation"]["approach"] = translate_text(ai_result["recommendation"].get("approach") or "")
        ai_result["recommendation"]["treatment"] = translate_text(ai_result["recommendation"].get("treatment") or "")
    else:
        ai_result["recommendation"] = {"approach": "-", "treatment": "-"}
    ai_result["risk_factors"]["calculation"]  = translate_text(ai_result["risk_factors"]["calculation"])
    ai_result["risk_factors"]["area"]         = translate_text(ai_result["risk_factors"]["area"])
    ai_result["risk_factors"]["region_count"] = translate_text(ai_result["risk_factors"]["region_count"])
    ai_result["risk_factors"]["intensity"]    = translate_text(ai_result["risk_factors"]["intensity"])

    return {
        "record_id": new_anal.id_analisis,
        "result": ai_result,
        "segmentation_image": None,    # Tidak ada lagi — bbox di frontend overlay
        "total_images": total_images,
        # Semua gambar untuk slider di frontend
        "images": [
            {
                "urutan": item["urutan"],
                "segmentation_image": None,
                "original_url": get_clean_url(item["path_original"]),
                "ai_url": None,
                "ai_bboxes": item["bboxes"],
            }
            for item in processed_images
        ]
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
    no_rm, nama_pasien = get_patient_info_from_db(db, id_pasien)

    jenis_db = db.query(models.Jenis).filter(models.Jenis.id_jenis == id_jenis).first()
    jenis_nama = jenis_db.nama_jenis if jenis_db else "umum"

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
    if not pasien:
        raise HTTPException(status_code=404)

    patient_data = {
        "id_pasien": pasien.id_pasien,
        "no_rm": pasien.no_rm,
        "nama_pasien": pasien.nama_pasien,
        "umur": pasien.umur,
        "gender": pasien.gender,
        "bloodType": pasien.blood_type
    }

    history = []
    records = db.query(models.Analisis).join(models.Pemeriksaan).filter(
        models.Pemeriksaan.id_pasien == id_pasien
    ).all()

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
            "total_images": len(r.gambar_list),
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

    # ── Gambar list dari GambarAnalisis ──
    gambar_list = []
    for g in analisis.gambar_list:
        gambar_list.append({
            "id_gambar": g.id_gambar,
            "urutan": g.urutan,
            "gambar_asli_url": get_clean_url(g.gambar_asli),
            "gambar_hasil_url": get_clean_url(g.gambar_hasil),   # None jika pakai overlay
            "gambar_dokter_url": get_clean_url(g.gambar_dokter),
            "ai_result": None,
            "ai_bboxes": json.loads(g.ai_bboxes) if g.ai_bboxes else [],
            "doctor_bboxes": json.loads(g.doctor_bboxes) if g.doctor_bboxes else [],
            "doctor_notes": json.loads(g.doctor_notes) if g.doctor_notes else None,
        })

    # Fallback kalau gambar_list kosong (data lama)
    if not gambar_list:
        gambar_list = [{
            "id_gambar": "main",
            "urutan": 1,
            "gambar_asli_url": get_clean_url(analisis.gambar_asli),
            "gambar_hasil_url": get_clean_url(analisis.gambar_hasil),
            "gambar_dokter_url": get_clean_url(analisis.gambar_dokter),
            "ai_result": None,
            "ai_bboxes": json.loads(analisis.ai_bboxes) if analisis.ai_bboxes else [],
            "doctor_bboxes": json.loads(analisis.doctor_bboxes) if analisis.doctor_bboxes else [],
            "doctor_notes": json.loads(analisis.doctor_notes) if analisis.doctor_notes else None,
        }]

    return {
        "status": "success",
        "data": {
            "id_analisis": analisis.id_analisis,
            "gambar_asli_url": get_clean_url(analisis.gambar_asli),
            "gambar_hasil_url": get_clean_url(analisis.gambar_hasil),
            "gambar_dokter_url": get_clean_url(analisis.gambar_dokter),
            "ai_result": hasil_json,
            "doctor_notes": json.loads(analisis.doctor_notes) if analisis.doctor_notes else None,
            "ai_bboxes": json.loads(analisis.ai_bboxes) if analisis.ai_bboxes else [],
            "doctor_bboxes": json.loads(analisis.doctor_bboxes) if analisis.doctor_bboxes else [],
            "gambar_list": gambar_list,
            "total_images": len(gambar_list),
            "patient_name": analisis.pemeriksaan.pasien.nama_pasien if analisis.pemeriksaan and analisis.pemeriksaan.pasien else "Pasien",
            "no_rm": analisis.pemeriksaan.pasien.no_rm if analisis.pemeriksaan and analisis.pemeriksaan.pasien else "-",
            "jenis": analisis.jenis.nama_jenis if analisis.jenis else "X-Ray",
        }
    }


# ================== DOCTOR UPDATE ==================
@app.put("/api/records/{id_analisis}/doctor-update")
async def update_doctor_data(
    id_analisis: int,
    doctor_notes: Optional[str] = Form(None),
    doctor_bboxes: Optional[str] = Form(None),
    doctor_image: Optional[UploadFile] = File(None),
    id_gambar: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if not analisis:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    target_gambar = None
    if id_gambar is not None:
        target_gambar = db.query(models.GambarAnalisis).filter(
            models.GambarAnalisis.id_gambar == id_gambar,
            models.GambarAnalisis.id_analisis == id_analisis
        ).first()

    target = target_gambar if target_gambar else analisis
    if doctor_bboxes is not None:
        target.doctor_bboxes = doctor_bboxes
    if doctor_notes is not None:
        target.doctor_notes = doctor_notes
        if target_gambar:
            analisis.doctor_notes = doctor_notes

    if doctor_image is not None:
        pemeriksaan = analisis.pemeriksaan
        pasien = pemeriksaan.pasien
        no_rm = pasien.no_rm
        nama_pasien = pasien.nama_pasien
        jenis_nama = analisis.jenis.nama_jenis if analisis.jenis else "umum"
        file_ext = "jpg"

        img_dir = build_patient_jenis_dir(no_rm, nama_pasien, jenis_nama)

        ref_path = target_gambar.gambar_asli if target_gambar else analisis.gambar_asli
        seq = 1
        urutan = 1
        if ref_path:
            base_name = os.path.basename(ref_path)
            m_seq = re.search(r'_(\d{3})_img(\d+)_', base_name)
            if m_seq:
                seq = int(m_seq.group(1))
                urutan = int(m_seq.group(2))
            else:
                m_old = re.search(r'_(\d{3})_original', base_name)
                if m_old:
                    seq = int(m_old.group(1))

        file_name_doctor = build_filename_multi(no_rm, nama_pasien, jenis_nama, seq, urutan, "doctor", file_ext)
        file_path_doctor = os.path.join(img_dir, file_name_doctor)

        img_contents = await doctor_image.read()
        with open(file_path_doctor, "wb") as f:
            f.write(img_contents)

        target.gambar_dokter = file_path_doctor

    db.commit()
    return {"status": "success"}


# ================== DEBUG RESET ==================
@app.get("/api/debug/reset/{id_analisis}")
def reset_analysis(id_analisis: int, db: Session = Depends(get_db)):
    analisis = db.query(models.Analisis).filter(models.Analisis.id_analisis == id_analisis).first()
    if analisis:
        analisis.teks_hasil_analisis = None
        analisis.gambar_hasil = None
        db.commit()
        return {"msg": "Data direset"}


@app.get("/api/records/{id_analisis}/export")
def export_record(id_analisis: int, detail_level: str = "long", db: Session = Depends(get_db)):
    record = db.query(models.Analisis).filter(
        models.Analisis.id_analisis == id_analisis
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    ai_result = json.loads(record.teks_hasil_analisis)

    # 🔥 summarize di sini
    summarized = summarize_ai_result(ai_result, detail_level)

    return {
        "data": {
            "id": record.id_analisis,
            "date": record.pemeriksaan.tgl_pemeriksaan.strftime("%d-%m-%Y"),
            "result": summarized,
            "doctorNotes": json.loads(record.doctor_notes) if record.doctor_notes else {},
            "gambar_asli_url": get_clean_url(record.gambar_asli),
        }
    }

def summarize_text(text: str, level: str) -> str:
    if not text or level == "long":
        return text or "-"

    if level == "short":
        target = "maksimal 2 kalimat"
    elif level == "medium":
        target = "sekitar 4–6 kalimat"
    else:
        target = "tanpa perubahan"

    prompt = f"""
    Ringkas teks medis berikut menjadi {target}.
    - Pertahankan istilah klinis penting
    - Jangan menambah informasi baru
    - Bahasa profesional

    Teks:
    {text}
    """

    resp = client.responses.create(
        model="gpt-4o-mini",
        input=prompt,
        temperature=0.2
    )

    return resp.output[0].content[0].text.strip()

def summarize_ai_result(ai_result: dict, level: str) -> dict:
    if level == "long":
        return ai_result

    return {
        **ai_result,
        "findings": summarize_text(ai_result.get("findings"), level),
        "abnormality": summarize_text(ai_result.get("abnormality"), level),
        "recommendation": {
            "approach": summarize_text(ai_result.get("recommendation", {}).get("approach"), level),
            "treatment": summarize_text(ai_result.get("recommendation", {}).get("treatment"), level),
        }
    }


# ================== SEEDING DATA DUMMY ==================
seed_everything()