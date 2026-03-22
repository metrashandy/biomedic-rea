from fastapi import FastAPI, File, UploadFile, Form
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
    # ✅ VALIDASI TYPE
    allowed_types = ["image/jpeg", "image/png"]
    if image.content_type not in allowed_types:
        return {"error": "File harus JPG atau PNG"}

    contents = await image.read()

    # ✅ VALIDASI SIZE (contoh: max 5MB)
    MAX_SIZE = 5 * 1024 * 1024  # 5MB
    if len(contents) > MAX_SIZE:
        return {"error": "Ukuran file maksimal 5MB"}

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

    response = requests.post(url, headers=headers, files=files, params=params)

    if response.status_code != 200:
        return {
            "error": "API request failed",
            "status_code": response.status_code,
            "detail": response.text
        }

    return response.json()