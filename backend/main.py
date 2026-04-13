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
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    # ================== LOAD IMAGE ==================
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # ================== SEGMENTASI (UNET KAGGLE) ==================
    #base64_img = to_base64(overlay)
    
    # ================== OPENAI ==================
    image_base64 = base64.b64encode(contents).decode("utf-8")

    prompt = """
    Analyze this chest X-ray image. Focus only on visible patterns (opacity, asymmetry, density differences). Do NOT provide a medical diagnosis. Identify ALL suspicious regions if visible. Return multiple bounding boxes if needed. If no clear abnormality is visible, return empty list.
    Identify ALL suspicious regions if visible.

    Each bounding box MUST:
    - tightly fit the abnormal region
    - avoid including healthy areas
    - be as small as possible while covering the abnormality

    Do NOT create large boxes covering the center unless absolutely necessary.

Coordinates must be normalized between 0 and 1.
    Return STRICT JSON:
    {
    "findings": "...",
    "abnormality": "...",
    "risk": 0-100,
    "bboxes": [
        {
        "x": 0-1,
        "y": 0-1,
        "width": 0-1,
        "height": 0-1
        }
    ],
    "recommendation": {
        "approach": "...",
        "treatment": "..."
    }
    }
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

    # ================== FINAL ==================
    base64_img = to_base64(overlay)

    # ================== RETURN ==================
    return {
        "result": ai_result,
        "segmentation_image": base64_img
    }