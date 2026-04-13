from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import json
import torch
import numpy as np
import cv2
import base64
from dotenv import load_dotenv
from typing import Optional
from deep_translator import GoogleTranslator
from openai import OpenAI

# ================== IMPORT HUGGING FACE ==================
from transformers import AutoModel

# ================== LOAD ENV ==================
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
print("API KEY:", os.getenv("OPENAI_API_KEY"))

# ================== INIT APP ==================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== LOAD HUGGING FACE MODEL ==================
# Ini akan otomatis mendownload model saat server pertama kali jalan
print("Loading Hugging Face Model...")
device = "cuda" if torch.cuda.is_available() else "cpu"
hf_model = AutoModel.from_pretrained("ianpan/chest-x-ray-basic", trust_remote_code=True)
hf_model = hf_model.eval().to(device)
hf_model = AutoModel.from_pretrained(
    "ianpan/chest-x-ray-basic",
    trust_remote_code=True,
    ignore_mismatched_sizes=True
)
print("Model loaded successfully!")

# ================== FUNGSI BANTUAN ==================
def translate_text(text):
    if not text: return text
    try: return GoogleTranslator(source="en", target="id").translate(text)
    except Exception: return text 
    
def translate_to_english(text):
    if not text: return text
    try: return GoogleTranslator(source='auto', target='en').translate(text)
    except: return text

# Fungsi kalkulasi CTR bawaan dari Hugging Face
def calculate_ctr(mask): 
    lungs = np.zeros_like(mask)
    lungs[mask == 1] = 1
    lungs[mask == 2] = 1
    heart = (mask == 3).astype("int")
    
    try:
        y, x = np.stack(np.where(lungs == 1))
        lung_min, lung_max = x.min(), x.max()
        y, x = np.stack(np.where(heart == 1))    
        heart_min, heart_max = x.min(), x.max()
        lung_range = lung_max - lung_min
        heart_range = heart_max - heart_min
        return float(heart_range / lung_range)
    except ValueError:
        return 0.0 # Return 0 jika gagal menemukan paru/jantung

# ================== FUNGSI PROSES HUGGING FACE ==================
def process_huggingface_image(image_bytes):
    # 1. Decode gambar dari FastApi ke format OpenCV (Grayscale)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
    
    # Simpan gambar asli (berwarna) untuk background overlay nanti
    img_color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    # 2. Preprocess untuk model HF
    x = hf_model.preprocess(img) 
    x = torch.from_numpy(x).unsqueeze(0).unsqueeze(0).float()

    # 3. Jalankan Model AI
    with torch.inference_mode():
        out = hf_model(x.to(device))

    # 4. Ambil data teks (Umur, Gender, View)
    age = float(out["age"].item())
    is_female = bool(out["female"].item() >= 0.5)
    view_idx = out["view"].argmax(1).item()
    view_map = {0: "AP", 1: "PA", 2: "Lateral"}
    view_str = view_map.get(view_idx, "Unknown")

    # 5. Ambil gambar MASK (Segmentasi)
    mask = out["mask"].argmax(1).squeeze().cpu().numpy()
    
    # 6. Hitung CTR
    ctr_value = calculate_ctr(mask)

    # 7. Mewarnai Mask (Biar keren di Frontend!)
    # Resize mask agar ukurannya sama persis dengan gambar asli
    mask_resized = cv2.resize(mask.astype(np.uint8), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    
    colored_mask = np.zeros_like(img_color)
    # Paru Kanan = Biru muda
    colored_mask[mask_resized == 1] = [255, 191, 0] # BGR
    # Paru Kiri = Hijau
    colored_mask[mask_resized == 2] =[0, 255, 0]
    # Jantung = Merah
    colored_mask[mask_resized == 3] = [0, 0, 255]

    # Gabungkan gambar asli dengan warna (Alpha blending/Transparan)
    overlay = cv2.addWeighted(img_color, 0.7, colored_mask, 0.4, 0)

    # 8. Convert overlay ke Base64 untuk dikirim ke frontend
    _, buffer = cv2.imencode(".png", overlay)
    segmented_base64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "image_base64": segmented_base64,
        "age": round(age, 1),
        "gender": "Perempuan" if is_female else "Laki-laki",
        "view": view_str,
        "ctr": round(ctr_value, 2)
    }

# ================== MAIN ENDPOINT ==================
@app.post("/analyze")
async def analyze_xray(
    image: UploadFile = File(...),
    symptoms: Optional[str] = Form(None)
    
):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API key tidak ditemukan")

    allowed_types = ["image/jpeg", "image/png"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File harus JPG atau PNG")

    contents = await image.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 100MB")

    # ================== 1. PROSES LOKAL (HUGGING FACE) ==================
    hf_data = process_huggingface_image(contents)

    # ================== 2. REQUEST KE OPENAI ==================


    # encode image ke base64
    image_base64 = base64.b64encode(contents).decode("utf-8")

    translated_symptoms = translate_to_english(symptoms) if symptoms else "None"

    prompt = f"""
    Analyze this chest X-ray image and describe visible findings.

    Focus only on visual patterns. Do not provide a medical diagnosis.

    Return STRICT JSON:

    {{
    "findings": "...",
    "abnormality": "...",
    "risk": 0-100,
    "recommendation": {{
        "approach": "...",
        "treatment": "..."
    }}
    }}
    """

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

        if "findings" not in ai_result:
            raise HTTPException(status_code=500, detail="Format AI tidak sesuai")

    except json.JSONDecodeError:
        print("RAW AI RESPONSE:", content)
        raise HTTPException(status_code=500, detail="Format JSON dari AI tidak valid")

    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses AI")

    # ================== 3. GABUNGKAN HASIL & TRANSLATE ==================
    
    # Masukkan hasil segmentasi HF ke JSON response
    data = {
    "result": ai_result
    }
    data["segmentation_image"] = hf_data["image_base64"]
    data["ai_metadata"] = {
        "age": hf_data["age"],
        "gender": hf_data["gender"],
        "view": hf_data["view"],
        "ctr_ratio": hf_data["ctr"]
    }
    
    try:
        if "result" in data:
            analysis = data["result"].get("analysis", {})
            analysis["findings"] = translate_text(analysis.get("findings"))
            analysis["potential_abnormalities"] = translate_text(analysis.get("potential_abnormalities"))
            analysis["observations"] = translate_text(analysis.get("observations"))

            risk = data["result"].get("risk_assessment", {})
            risk["assessment_explanation"] = translate_text(risk.get("assessment_explanation"))

            technical = data["result"].get("technical_assessment", {})
            technical["positioning"] = translate_text(technical.get("positioning"))
            technical["exposure"] = translate_text(technical.get("exposure"))
            technical["artifacts"] = translate_text(technical.get("artifacts"))

            data["result"]["specific_response"] = translate_text(data["result"].get("specific_response"))

            treatment = data["result"].get("treatment_recommendations", {})
            treatment["general_approach"] = translate_text(treatment.get("general_approach"))
            treatment["possible_treatments"] = translate_text(treatment.get("possible_treatments"))
            treatment["follow_up"] = translate_text(treatment.get("follow_up"))

            data["result"]["recommendations"] = translate_text(data["result"].get("recommendations"))
            data["result"]["disclaimer"] = translate_text(data["result"].get("disclaimer"))
    except Exception as e:
        print("Translate error:", e)

    return data