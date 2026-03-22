from fastapi import FastAPI, File, UploadFile, Form, HTTPException
import requests
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "ai-radiology-reporting-x-ray-interpretation-api.p.rapidapi.com"

@app.post("/analyze")
async def analyze_xray(
    image: UploadFile = File(...),
    symptoms: str = Form(...)
):
    # ❗ cek API key
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="API key tidak ditemukan")

    # ✅ VALIDASI TYPE
    allowed_types = ["image/jpeg", "image/png"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File harus JPG atau PNG")

    contents = await image.read()

    # ✅ VALIDASI SIZE
    MAX_SIZE = 5 * 1024 * 1024
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 5MB")

    url = "https://ai-radiology-reporting-x-ray-interpretation-api.p.rapidapi.com/check"

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }

    params = {
        "language": "en",
        "message": f"Analyze this X-ray. Symptoms: {symptoms}",
        "noqueue": "1"
    }

    files = {
        "image": (image.filename, contents, image.content_type)
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            files=files,
            params=params,
            timeout=15
        )
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Gagal terhubung ke API eksternal")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="API radiologi gagal memproses data"
        )

    return response.json()