from fastapi import FastAPI, File, UploadFile, Form, HTTPException
import requests
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from typing import Optional
from deep_translator import GoogleTranslator
import torch
import torchxrayvision as xrv
import numpy as np
import cv2

# ================== LOAD ENV ==================
load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "ai-radiology-reporting-x-ray-interpretation-api.p.rapidapi.com"

# ================== INIT APP ==================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

lung_model = xrv.baseline_models.chestx_det.PSPNet()
lung_model.eval()

# ================== TRANSLATE FUNCTION ==================
def translate_text(text):
    if not text:
        return text
    try:
        return GoogleTranslator(source="en", target="id").translate(text)
    except Exception:
        return text  # fallback jika gagal
    
def translate_to_english(text):
    if not text:
        return text
    try:
        return GoogleTranslator(source='auto', target='en').translate(text)
    except:
        return text
    
def get_lung_mask(image):
    # resize ke 224 (standar model)
    img = cv2.resize(image, (224, 224))

    # normalize
    img = xrv.datasets.normalize(img, 255)

    # ubah ke tensor
    img = torch.from_numpy(img).unsqueeze(0).unsqueeze(0).float()

    with torch.no_grad():
        pred = lung_model(img)

    # ambil channel lung (biasanya index 0)
    mask = pred[0][0].numpy()

    # normalisasi ke 0-255
    mask = (mask > 0.5).astype(np.uint8) * 255

    # resize balik ke ukuran asli
    mask = cv2.resize(mask, (image.shape[1], image.shape[0]))

    return mask

def detect_opacity(image):
    img_eq = cv2.equalizeHist(image)
    blur = cv2.GaussianBlur(img_eq, (5, 5), 0)

    _, thresh = cv2.threshold(blur, 180, 255, cv2.THRESH_BINARY)

    return thresh

def segment_pneumonia_smart(image_bytes):
    # decode image
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)

    # lung mask
    lung_mask = get_lung_mask(img)

    # opacity detection
    opacity = detect_opacity(img)

    # 🔥 INTERSECTION (ini kunci)
    pneumonia_mask = cv2.bitwise_and(opacity, lung_mask)

    # overlay
    overlay = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    overlay[pneumonia_mask == 255] = [0, 0, 255]

    return overlay
    

# ================== MAIN ENDPOINT ==================
@app.post("/analyze")
async def analyze_xray(
    image: UploadFile = File(...),
    symptoms: Optional[str] = Form(None)
):
    # ❗ API KEY CHECK
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="API key tidak ditemukan")

    # ================== VALIDASI FILE ==================
    allowed_types = ["image/jpeg", "image/png"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File harus JPG atau PNG")

    contents = await image.read()

    MAX_SIZE = 100 * 1024 * 1024  # 100MB
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 100MB")

    # ================== API CONFIG ==================
    url = "https://ai-radiology-reporting-x-ray-interpretation-api.p.rapidapi.com/check"

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }
    
    translated_symptoms = translate_to_english(symptoms) if symptoms else None

    params = {
        "language": "en",
        "message": f"Analyze this X-ray. Symptoms: {translated_symptoms or 'No symptoms provided'}",
        "noqueue": "1"
    }

    files = {
        "image": (image.filename, contents, image.content_type)
    }

    # ================== REQUEST KE API ==================
    try:
        response = requests.post(
            url,
            headers=headers,
            files=files,
            params=params,
            timeout=20  # sedikit diperbesar
        )
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Gagal terhubung ke API eksternal")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="API radiologi gagal memproses data"
        )

    # ================== AMBIL DATA ==================
    data = response.json()

# ================== SEGMENTASI (🔥 TAMBAHKAN INI) ==================
    segmented_img = segment_pneumonia_smart(contents)

    # convert ke base64
    _, buffer = cv2.imencode(".png", segmented_img)
    import base64
    segmented_base64 = base64.b64encode(buffer).decode("utf-8")

    data["segmentation_image"] = segmented_base64
    
    # ================== TRANSLATE ==================
    try:
        if "result" in data:

            # ===== ANALYSIS =====
            analysis = data["result"].get("analysis", {})
            analysis["findings"] = translate_text(analysis.get("findings"))
            analysis["potential_abnormalities"] = translate_text(analysis.get("potential_abnormalities"))
            analysis["observations"] = translate_text(analysis.get("observations"))

            # ===== RISK =====
            risk = data["result"].get("risk_assessment", {})
            risk["assessment_explanation"] = translate_text(risk.get("assessment_explanation"))

            # ===== TECHNICAL =====
            technical = data["result"].get("technical_assessment", {})
            technical["positioning"] = translate_text(technical.get("positioning"))
            technical["exposure"] = translate_text(technical.get("exposure"))
            technical["artifacts"] = translate_text(technical.get("artifacts"))

            # ===== INTERPRETATION =====
            data["result"]["specific_response"] = translate_text(
                data["result"].get("specific_response")
            )

            # ===== TREATMENT =====
            treatment = data["result"].get("treatment_recommendations", {})
            treatment["general_approach"] = translate_text(treatment.get("general_approach"))
            treatment["possible_treatments"] = translate_text(treatment.get("possible_treatments"))
            treatment["follow_up"] = translate_text(treatment.get("follow_up"))

            # ===== FINAL =====
            data["result"]["recommendations"] = translate_text(
                data["result"].get("recommendations")
            )

            data["result"]["disclaimer"] = translate_text(
                data["result"].get("disclaimer")
            )

    except Exception as e:
        # tidak crash kalau translate gagal
        print("Translate error:", e)

    # ================== RETURN ==================
    return data