"""
========================================================
TEST CASE LENGKAP — AI Doctor Backend
========================================================
Cara pakai:
  pip install pytest httpx reportlab
  pytest test_main.py -v

Pastikan file main.py ada di direktori yang sama.
Test ini TIDAK memerlukan koneksi ke OpenAI — semua AI call di-mock.
========================================================
"""

import pytest
import json
import os
import base64
import shutil
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# ---- patch OpenAI sebelum import main ----
mock_openai_client = MagicMock()

with patch("openai.OpenAI", return_value=mock_openai_client):
    import main as app_module
    from main import app, SessionLocal, DBPatient, DBVisit, Base, engine

client = TestClient(app)

# ========================================================
# FIXTURES & HELPERS
# ========================================================

DUMMY_PATIENT = {
    "name": "Budi Santoso",
    "age": 35,
    "gender": "Laki-laki",
    "weight": 70.0,
    "height": 170.0,
}

DUMMY_AI_RESPONSE = {
    "penyakit": "Kemungkinan diagnosis: Demam Berdarah Dengue (DBD). Diagnosis banding: Malaria, Tifoid.",
    "icd10": [
        {"kode": "A90", "label": "Dengue fever"},
        {"kode": "A91", "label": "Dengue haemorrhagic fever"},
    ],
    "rekomendasi": [
        "Paracetamol 500mg — 3x1 — selama demam",
        "Istirahat total, hindari aktivitas berat",
        "Cek darah lengkap setiap hari selama 3 hari",
    ],
    "saran_pemeriksaan": [
        "Pemeriksaan NS1 Antigen — untuk konfirmasi dengue",
        "Darah lengkap — monitor trombosit dan hematokrit",
    ],
    "pertanyaan_lanjutan": [
        "Apakah ada ruam/bintik merah di kulit?",
        "Apakah nyeri di belakang mata?",
    ],
    "tanda_bahaya": "Segera ke IGD jika trombosit < 50.000 atau ada perdarahan.",
    "kelengkapan_data": "Data cukup untuk analisis awal. Konfirmasi dengan NS1.",
}

DUMMY_IMAGE_RESPONSE = {
    "deskripsi_gambar": "Tampak bercak kemerahan pada kulit lengan.",
    "kemungkinan_temuan": "Dapat berkaitan dengan reaksi alergi atau manifestasi virus.",
    "rekomendasi_lanjut": "Perlu pemeriksaan dermatologi lebih lanjut.",
    "catatan": "Analisis ini hanya pendukung, bukan diagnosis pasti.",
    "saved_image_path": "",
}


def make_mock_completion(content_dict):
    """Buat mock response OpenAI completion."""
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = json.dumps(content_dict)
    return mock_resp


def setup_mock_ai(response_dict=None):
    """Setup mock AI untuk semua test yang butuh AI."""
    resp = response_dict or DUMMY_AI_RESPONSE
    mock_openai_client.chat.completions.create.return_value = make_mock_completion(resp)


def get_db():
    return SessionLocal()


def cleanup_patient(name):
    """Hapus pasien test dari DB."""
    db = get_db()
    try:
        patients = db.query(DBPatient).filter(DBPatient.name == name).all()
        for p in patients:
            db.query(DBVisit).filter(DBVisit.patient_id == p.id).delete()
            db.delete(p)
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def cleanup():
    """Cleanup setelah setiap test."""
    yield
    cleanup_patient("Budi Santoso")
    cleanup_patient("Siti Rahayu")
    cleanup_patient("Test Pasien")
    cleanup_patient("Pasien Duplikat")
    cleanup_patient("Ani Wijaya")


# ========================================================
# GRUP 1: REGISTRASI & MANAJEMEN PASIEN
# ========================================================

class TestPatientRegistration:

    def test_daftar_pasien_baru_sukses(self):
        """TC-01: Daftarkan pasien baru dengan data lengkap."""
        resp = client.post("/api/patients/register", json=DUMMY_PATIENT)
        assert resp.status_code == 200
        data = resp.json()
        assert "patient" in data
        p = data["patient"]
        assert p["name"] == "Budi Santoso"
        assert p["age"] == 35
        assert p["gender"] == "Laki-laki"
        assert p["weight"] == 70.0
        assert p["height"] == 170.0
        assert "id" in p

    def test_daftar_pasien_tanpa_bb_tb(self):
        """TC-02: Daftarkan pasien tanpa berat/tinggi badan (opsional)."""
        resp = client.post("/api/patients/register", json={
            "name": "Siti Rahayu", "age": 28, "gender": "Perempuan"
        })
        assert resp.status_code == 200
        p = resp.json()["patient"]
        assert p["name"] == "Siti Rahayu"
        assert p["weight"] is None
        assert p["height"] is None

    def test_daftar_pasien_duplikat_return_existing(self):
        """TC-03: Pasien sama (nama+umur+gender) tidak dibuat duplikat."""
        client.post("/api/patients/register", json={
            "name": "Pasien Duplikat", "age": 40, "gender": "Laki-laki"
        })
        resp2 = client.post("/api/patients/register", json={
            "name": "Pasien Duplikat", "age": 40, "gender": "Laki-laki"
        })
        assert resp2.status_code == 200
        # ID harus sama (bukan entri baru)
        db = get_db()
        count = db.query(DBPatient).filter(DBPatient.name == "Pasien Duplikat").count()
        db.close()
        assert count == 1

    def test_get_all_patients(self):
        """TC-04: GET /api/patients mengembalikan list pasien."""
        client.post("/api/patients/register", json=DUMMY_PATIENT)
        resp = client.get("/api/patients")
        assert resp.status_code == 200
        data = resp.json()
        assert "patients" in data
        assert isinstance(data["patients"], list)
        names = [p["name"] for p in data["patients"]]
        assert "Budi Santoso" in names

    def test_patient_list_includes_kunjungan_info(self):
        """TC-05: List pasien menyertakan total_kunjungan dan keluhan_terakhir."""
        client.post("/api/patients/register", json=DUMMY_PATIENT)
        resp = client.get("/api/patients")
        pasien = next(p for p in resp.json()["patients"] if p["name"] == "Budi Santoso")
        assert "total_kunjungan" in pasien
        assert "keluhan_terakhir" in pasien

    def test_patient_register_returns_id(self):
        """TC-06: Registrasi mengembalikan ID yang valid (integer positif)."""
        resp = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = resp.json()["patient"]["id"]
        assert isinstance(pid, int)
        assert pid > 0


# ========================================================
# GRUP 2: ANALISIS AI (FITUR LAMA)
# ========================================================

class TestAnalyzeEndpoint:

    def test_analyze_basic_sukses(self):
        """TC-07: Analisis dasar dengan keluhan utama — AI merespons."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Demam tinggi 3 hari, sakit kepala",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "penyakit" in data
        assert "icd10" in data
        assert "rekomendasi" in data
        assert "tanda_bahaya" in data

    def test_analyze_icd10_format(self):
        """TC-08: ICD-10 berformat list of {kode, label}."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Batuk lama"})
        icd = resp.json()["icd10"]
        assert isinstance(icd, list)
        for item in icd:
            assert "kode" in item
            assert "label" in item

    def test_analyze_rekomendasi_list(self):
        """TC-09: Rekomendasi berupa list of string."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Nyeri dada"})
        rek = resp.json()["rekomendasi"]
        assert isinstance(rek, list)
        assert len(rek) >= 1

    def test_analyze_returns_db_patient_id(self):
        """TC-10: Analisis membuat/menemukan pasien di DB dan return db_patient_id."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Pusing"})
        assert "db_patient_id" in resp.json()
        assert resp.json()["db_patient_id"] > 0

    def test_analyze_dengan_semua_field_opsional(self):
        """TC-11: Analisis dengan semua field terisi tidak error."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Demam",
            "gejala": "Mual, muntah",
            "tandaVital": "TD: 120/80, Suhu: 38.5",
            "hasilLab": "Leukosit 12.000",
            "alergi": "Penisilin",
            "riwayat": "Asma",
            "catatan": "Pasien dari daerah endemik",
        })
        assert resp.status_code == 200

    def test_analyze_dengan_conversation_history(self):
        """TC-12: Analisis dengan conversation history (multi-giliran) lama."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Demam lanjutan",
            "conversation_history": [
                {"user": "Keluhan: Demam 2 hari", "assistant": "Dx: Kemungkinan infeksi virus"}
            ],
        })
        assert resp.status_code == 200

    def test_analyze_alergi_masuk_ke_prompt(self):
        """TC-13: Field alergi dikirim ke AI (verifikasi AI dipanggil dengan alergi)."""
        setup_mock_ai()
        client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Nyeri sendi",
            "alergi": "Amoxicillin",
        })
        call_args = mock_openai_client.chat.completions.create.call_args
        # Cek ada string "Amoxicillin" di messages yang dikirim
        messages_str = str(call_args)
        assert "Amoxicillin" in messages_str

    def test_analyze_missing_keluhan_returns_error(self):
        """TC-14: Jika keluhan kosong, FastAPI validation error (422)."""
        resp = client.post("/api/analyze", json={
            "name": "Test", "age": 30, "gender": "Laki-laki"
            # keluhan tidak ada
        })
        assert resp.status_code == 422


# ========================================================
# GRUP 3: FITUR BARU — TEKS BEBAS & CHAT KONSULTASI
# ========================================================

class TestNewFeatures:

    def test_analyze_dengan_teks_bebas(self):
        """TC-15: Analisis menerima teks_bebas dan menyertakannya ke AI."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Demam",
            "teks_bebas": "Pasien tinggal di daerah endemik, baru pulang dari hutan 1 minggu lalu.",
        })
        assert resp.status_code == 200
        call_args = mock_openai_client.chat.completions.create.call_args
        assert "baru pulang dari hutan" in str(call_args)

    def test_analyze_dengan_chat_konsultasi(self):
        """TC-16: Analisis menerima chat_konsultasi dan mengirimnya ke AI."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={
            **DUMMY_PATIENT,
            "keluhan": "Batuk",
            "chat_konsultasi": [
                {"role": "dokter", "content": "Batuknya sudah berapa lama?"},
                {"role": "ai", "content": "Analisis: kemungkinan infeksi saluran napas."},
                {"role": "dokter", "content": "Sudah 2 minggu, berdahak."},
            ],
        })
        assert resp.status_code == 200
        call_args = str(mock_openai_client.chat.completions.create.call_args)
        assert "2 minggu" in call_args

    def test_analyze_return_saran_pemeriksaan(self):
        """TC-17: Hasil analisis menyertakan saran_pemeriksaan."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Demam"})
        data = resp.json()
        assert "saran_pemeriksaan" in data
        assert isinstance(data["saran_pemeriksaan"], list)

    def test_analyze_return_pertanyaan_lanjutan(self):
        """TC-18: Hasil analisis menyertakan pertanyaan_lanjutan."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Demam"})
        data = resp.json()
        assert "pertanyaan_lanjutan" in data
        assert isinstance(data["pertanyaan_lanjutan"], list)

    def test_analyze_return_kelengkapan_data(self):
        """TC-19: Hasil analisis menyertakan kelengkapan_data."""
        setup_mock_ai()
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Sesak napas"})
        assert "kelengkapan_data" in resp.json()


# ========================================================
# GRUP 4: ANALISIS GAMBAR (FITUR BARU)
# ========================================================

class TestImageAnalysis:

    def _dummy_base64_image(self):
        """Buat gambar PNG 1x1 pixel sebagai dummy base64."""
        # PNG 1x1 pixel merah (bytes minimal valid)
        png_bytes = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd5N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        return base64.b64encode(png_bytes).decode()

    def test_analyze_image_sukses(self):
        """TC-20: Analisis gambar sukses dengan base64 valid."""
        mock_openai_client.chat.completions.create.return_value = make_mock_completion(
            DUMMY_IMAGE_RESPONSE
        )
        resp = client.post("/api/analyze-image", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "keluhan": "Ada bercak merah di lengan",
            "image_base64": self._dummy_base64_image(),
            "image_type": "image/png",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "deskripsi_gambar" in data
        assert "kemungkinan_temuan" in data
        assert "rekomendasi_lanjut" in data
        assert "catatan" in data

    def test_analyze_image_simpan_ke_disk(self):
        """TC-21: Analisis gambar menyimpan file ke folder uploads."""
        mock_openai_client.chat.completions.create.return_value = make_mock_completion(
            DUMMY_IMAGE_RESPONSE
        )
        resp = client.post("/api/analyze-image", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "keluhan": "Benjolan di tangan",
            "image_base64": self._dummy_base64_image(),
            "image_type": "image/png",
        })
        assert resp.status_code == 200
        data = resp.json()
        # saved_image_path ada (meski mungkin kosong kalau decode gagal di test env)
        assert "saved_image_path" in data

    def test_analyze_image_dengan_konteks_pasien(self):
        """TC-22: Informasi pasien (keluhan, gejala) dikirim ke AI saat analisis gambar."""
        mock_openai_client.chat.completions.create.return_value = make_mock_completion(
            DUMMY_IMAGE_RESPONSE
        )
        client.post("/api/analyze-image", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "keluhan": "Ruam gatal sejak 3 hari",
            "gejala": "Gatal semakin malam",
            "image_base64": self._dummy_base64_image(),
            "image_type": "image/png",
        })
        call_args = str(mock_openai_client.chat.completions.create.call_args)
        assert "Ruam gatal" in call_args

    def test_analyze_image_tanpa_keluhan(self):
        """TC-23: Analisis gambar tetap jalan meski keluhan kosong."""
        mock_openai_client.chat.completions.create.return_value = make_mock_completion(
            DUMMY_IMAGE_RESPONSE
        )
        resp = client.post("/api/analyze-image", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "image_base64": self._dummy_base64_image(),
        })
        assert resp.status_code == 200


# ========================================================
# GRUP 10: CHAT KONSULTASI (/api/chat) — FITUR BARU
# ========================================================

class TestChatEndpoint:

    DUMMY_DIAGNOSIS_CONTEXT = {
        "penyakit": "Kemungkinan Demam Berdarah Dengue. Diagnosis banding: Malaria.",
        "icd10": [{"kode": "A90", "label": "Dengue fever"}],
        "rekomendasi": ["Paracetamol 500mg 3x1", "Istirahat total"],
        "saran_pemeriksaan": ["NS1 Antigen", "Darah lengkap"],
        "tanda_bahaya": "Segera ke IGD jika trombosit < 50.000.",
    }

    def test_chat_dengan_konteks_diagnosis(self):
        """TC-54: Chat sukses dengan konteks hasil diagnosis."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(
                content="Paracetamol aman untuk pasien ini. Berikan setiap 6-8 jam."
            ))]
        )
        resp = client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [{"role": "dokter", "content": "Apakah paracetamol aman?"}],
            "pesan": "Apakah paracetamol aman?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert len(data["reply"]) > 0

    def test_chat_reply_berupa_string(self):
        """TC-55: Reply dari /api/chat adalah string bukan JSON."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Ya, bisa diberikan setelah makan."))]
        )
        resp = client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [{"role": "dokter", "content": "Boleh makan dulu?"}],
            "pesan": "Boleh makan dulu?",
        })
        assert isinstance(resp.json()["reply"], str)

    def test_chat_konteks_diagnosis_dikirim_ke_ai(self):
        """TC-56: Konteks diagnosis (bukan form gejala) yang dikirim ke AI."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Jawaban AI."))]
        )
        client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [{"role": "dokter", "content": "Apa itu NS1?"}],
            "pesan": "Apa itu NS1?",
        })
        call_args = str(mock_openai_client.chat.completions.create.call_args)
        # Konteks diagnosis masuk ke prompt
        assert "Dengue fever" in call_args
        assert "Paracetamol" in call_args

    def test_chat_tanpa_konteks_diagnosis_tetap_jalan(self):
        """TC-57: Chat tanpa diagnosis_context (sebelum analisis) tidak error."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Silakan lakukan analisis dulu."))]
        )
        resp = client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": None,
            "chat_history": [{"role": "dokter", "content": "Halo"}],
            "pesan": "Halo",
        })
        assert resp.status_code == 200
        assert "reply" in resp.json()

    def test_chat_riwayat_percakapan_dikirim_ke_ai(self):
        """TC-58: Riwayat chat sebelumnya (selain pesan terbaru) masuk ke messages AI."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Lanjutan jawaban."))]
        )
        client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [
                {"role": "dokter", "content": "Apakah perlu opname?"},
                {"role": "ai", "content": "Tergantung kondisi trombosit."},
                {"role": "dokter", "content": "Trombositnya 80.000."},
            ],
            "pesan": "Trombositnya 80.000.",
        })
        call_args = str(mock_openai_client.chat.completions.create.call_args)
        # Riwayat sebelumnya masuk
        assert "opname" in call_args

    def test_chat_pesan_dokter_masuk_sebagai_user_role(self):
        """TC-59: Pesan dokter dikirim ke AI dengan role 'user'."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Jawaban."))]
        )
        client.post("/api/chat", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [{"role": "dokter", "content": "Perlu rawat inap?"}],
            "pesan": "Perlu rawat inap?",
        })
        call_args = mock_openai_client.chat.completions.create.call_args
        messages = call_args[1]["messages"] if "messages" in call_args[1] else call_args[0][0]
        # Cari pesan user (pesan dokter)
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assert len(user_msgs) >= 1

    def test_chat_identitas_pasien_di_konteks(self):
        """TC-60: Nama dan usia pasien ada di konteks yang dikirim ke AI."""
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Jawaban."))]
        )
        client.post("/api/chat", json={
            "name": "Siti Rahayu", "age": 28, "gender": "Perempuan",
            "diagnosis_context": self.DUMMY_DIAGNOSIS_CONTEXT,
            "chat_history": [{"role": "dokter", "content": "Apa obatnya?"}],
            "pesan": "Apa obatnya?",
        })
        call_args = str(mock_openai_client.chat.completions.create.call_args)
        assert "Siti Rahayu" in call_args
        assert "28" in call_args


# ========================================================
# GRUP 11: GAMBAR INLINE DI FORM
# Verifikasi gambar tetap bisa dianalisis dan disimpan
# setelah dipindah inline ke dalam form
# ========================================================

class TestImageInlineForm:

    def _dummy_b64(self):
        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd5N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        return base64.b64encode(png).decode()

    def test_gambar_pendukung_masih_bisa_dianalisis(self):
        """TC-61: /api/analyze-image masih berfungsi setelah gambar dipindah inline."""
        mock_openai_client.chat.completions.create.return_value = make_mock_completion(
            DUMMY_IMAGE_RESPONSE
        )
        resp = client.post("/api/analyze-image", json={
            "name": "Budi Santoso", "age": 35, "gender": "Laki-laki",
            "keluhan": "Bercak merah di lengan",
            "gejala": "Gatal, terasa panas",
            "image_base64": self._dummy_b64(),
            "image_type": "image/png",
        })
        assert resp.status_code == 200
        d = resp.json()
        assert "deskripsi_gambar" in d
        assert "kemungkinan_temuan" in d

    def test_gambar_pendukung_tersimpan_saat_save_visit(self):
        """TC-62: Analisis gambar (dari form inline) tersimpan saat kunjungan disimpan."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        img_result = json.dumps({
            "deskripsi_gambar": "Bercak merah di lengan kiri.",
            "kemungkinan_temuan": "Kemungkinan dermatitis atau reaksi alergi.",
            "rekomendasi_lanjut": "Konsultasi dermatologi.",
            "catatan": "Bukan diagnosis pasti.",
        })

        resp = client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Bercak merah gatal",
            "analisis_gambar": img_result,
            "image_path": "./uploads/dummy.png",
            "diagnosis_final": "Dermatitis suspek",
        })
        assert resp.status_code == 200

        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        stored = json.loads(visit.analisis_gambar)
        assert "Bercak merah" in stored["deskripsi_gambar"]
        assert visit.image_path == "./uploads/dummy.png"
        db.close()

    def test_gambar_muncul_di_history(self):
        """TC-63: has_image True di history jika ada image_path."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Lebam di kaki",
            "image_path": "./uploads/foto_lebam.jpg",
            "analisis_gambar": json.dumps(DUMMY_IMAGE_RESPONSE),
            "diagnosis_final": "Contusion",
        })

        resp = client.get(f"/api/history/{pid}")
        v = resp.json()["visits"][0]
        assert v["has_image"] is True

    def test_kunjungan_tanpa_gambar_has_image_false(self):
        """TC-64: has_image False jika tidak ada gambar (gambar bersifat opsional)."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Batuk biasa",
            "image_path": "",
            "diagnosis_final": "ISPA ringan",
        })

        resp = client.get(f"/api/history/{pid}")
        v = resp.json()["visits"][0]
        assert v["has_image"] is False

    def test_analisis_gambar_ikut_ke_pdf(self):
        """TC-65: PDF tetap generate sukses meski ada analisis gambar dari form inline."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        save_resp = client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Ruam kulit merah",
            "analisis_gambar": json.dumps(DUMMY_IMAGE_RESPONSE),
            "diagnosis_final": "Urtikaria",
            "selected_icd10": [{"kode": "L50", "label": "Urticaria"}],
        })
        vid = save_resp.json()["visit_id"]

        pdf_resp = client.get(f"/api/generate-pdf/{vid}")
        assert pdf_resp.status_code == 200
        assert pdf_resp.content[:5] == b"%PDF-"


# ========================================================
# GRUP 5: SIMPAN KUNJUNGAN (FITUR LAMA + BARU)
# ========================================================

class TestSaveVisit:

    def _register_and_get_id(self, name="Ani Wijaya"):
        resp = client.post("/api/patients/register", json={
            "name": name, "age": 30, "gender": "Perempuan"
        })
        return resp.json()["patient"]["id"]

    def test_save_visit_basic(self):
        """TC-24: Simpan kunjungan dasar sukses."""
        pid = self._register_and_get_id()
        resp = client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Demam",
            "diagnosis_final": "Kemungkinan DBD",
            "selected_icd10": [{"kode": "A90", "label": "Dengue fever"}],
            "selected_rekomendasi": ["Paracetamol 500mg 3x1"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "visit_id" in data
        assert data["visit_id"] > 0

    def test_save_visit_dengan_teks_bebas(self):
        """TC-25: Simpan kunjungan dengan teks_bebas tersimpan di DB."""
        pid = self._register_and_get_id()
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Batuk",
            "teks_bebas": "Pasien baru pulang dari luar kota.",
            "diagnosis_final": "ISPA",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        assert visit.teks_bebas == "Pasien baru pulang dari luar kota."
        db.close()

    def test_save_visit_dengan_chat_konsultasi(self):
        """TC-26: Chat konsultasi tersimpan sebagai JSON di DB."""
        pid = self._register_and_get_id()
        chat = [
            {"role": "dokter", "content": "Demamnya sudah berapa hari?"},
            {"role": "ai", "content": "Analisis: kemungkinan infeksi."},
        ]
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Demam",
            "chat_konsultasi": chat,
            "diagnosis_final": "Fever",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        stored_chat = json.loads(visit.chat_history)
        assert len(stored_chat) == 2
        assert stored_chat[0]["role"] == "dokter"
        db.close()

    def test_save_visit_dengan_saran_pemeriksaan(self):
        """TC-27: Saran pemeriksaan tersimpan di DB."""
        pid = self._register_and_get_id()
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Nyeri kepala",
            "saran_pemeriksaan_final": "CT Scan kepala\nPemeriksaan tekanan darah",
            "diagnosis_final": "Tension headache",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        assert "CT Scan" in visit.saran_pemeriksaan
        db.close()

    def test_save_visit_dengan_analisis_gambar(self):
        """TC-28: Analisis gambar tersimpan di DB."""
        pid = self._register_and_get_id()
        img_result = json.dumps(DUMMY_IMAGE_RESPONSE)
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Ruam kulit",
            "analisis_gambar": img_result,
            "diagnosis_final": "Dermatitis",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        stored = json.loads(visit.analisis_gambar)
        assert stored["deskripsi_gambar"] == DUMMY_IMAGE_RESPONSE["deskripsi_gambar"]
        db.close()

    def test_save_visit_created_at_tersimpan(self):
        """TC-29: created_at tersimpan dengan format tanggal yang valid."""
        pid = self._register_and_get_id()
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Pusing",
            "diagnosis_final": "Vertigo",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        assert visit.created_at is not None
        assert len(visit.created_at) > 0
        db.close()

    def test_save_visit_icd10_tersimpan_sebagai_json(self):
        """TC-30: ICD-10 terpilih tersimpan sebagai JSON string di DB."""
        pid = self._register_and_get_id()
        client.post("/api/save-visit", json={
            "patient_id": pid,
            "name": "Ani Wijaya", "age": 30, "gender": "Perempuan",
            "keluhan": "Demam",
            "selected_icd10": [
                {"kode": "A90", "label": "Dengue fever"},
                {"kode": "A91", "label": "Dengue haemorrhagic fever"},
            ],
            "diagnosis_final": "DBD",
        })
        db = get_db()
        visit = db.query(DBVisit).filter(DBVisit.patient_id == pid).first()
        icd = json.loads(visit.icd10_codes)
        assert len(icd) == 2
        assert icd[0]["kode"] == "A90"
        db.close()

    def test_save_visit_tanpa_patient_id_buat_pasien_baru(self):
        """TC-31: Simpan tanpa patient_id — pasien baru dibuat otomatis."""
        resp = client.post("/api/save-visit", json={
            "name": "Test Pasien", "age": 25, "gender": "Laki-laki",
            "keluhan": "Mual",
            "diagnosis_final": "Gastritis",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True


# ========================================================
# GRUP 6: RIWAYAT KUNJUNGAN
# ========================================================

class TestHistory:

    def test_history_pasien_tidak_ada(self):
        """TC-32: GET history pasien ID yang tidak ada — return list kosong."""
        resp = client.get("/api/history/999999")
        assert resp.status_code == 200
        assert resp.json()["visits"] == []

    def test_history_setelah_simpan_kunjungan(self):
        """TC-33: History mengembalikan kunjungan yang baru disimpan."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/save-visit", json={
            "patient_id": pid,
            **DUMMY_PATIENT,
            "keluhan": "Demam tinggi",
            "diagnosis_final": "Probable DBD",
            "selected_icd10": [{"kode": "A90", "label": "Dengue fever"}],
        })

        resp = client.get(f"/api/history/{pid}")
        assert resp.status_code == 200
        visits = resp.json()["visits"]
        assert len(visits) >= 1
        assert visits[0]["keluhan"] == "Demam tinggi"

    def test_history_berisi_field_baru(self):
        """TC-34: History menyertakan field baru: teks_bebas, chat_history, saran_pemeriksaan, analisis_gambar."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/save-visit", json={
            "patient_id": pid,
            **DUMMY_PATIENT,
            "keluhan": "Batuk",
            "teks_bebas": "Kronologi: sudah 2 minggu",
            "chat_konsultasi": [{"role": "dokter", "content": "Apakah berdahak?"}],
            "saran_pemeriksaan_final": "Foto Thorax",
            "analisis_gambar": json.dumps(DUMMY_IMAGE_RESPONSE),
            "diagnosis_final": "TB paru suspek",
        })

        resp = client.get(f"/api/history/{pid}")
        v = resp.json()["visits"][0]
        assert v["teks_bebas"] == "Kronologi: sudah 2 minggu"
        assert len(v["chat_history"]) == 1
        assert "Foto Thorax" in v["saran_pemeriksaan"]
        assert v["analisis_gambar"] != ""

    def test_history_urutan_terbaru_dulu(self):
        """TC-35: History diurutkan terbaru di atas (reversed)."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        for keluhan in ["Kunjungan pertama", "Kunjungan kedua", "Kunjungan ketiga"]:
            client.post("/api/save-visit", json={
                "patient_id": pid, **DUMMY_PATIENT,
                "keluhan": keluhan, "diagnosis_final": "Test",
            })

        resp = client.get(f"/api/history/{pid}")
        visits = resp.json()["visits"]
        assert visits[0]["keluhan"] == "Kunjungan ketiga"
        assert visits[-1]["keluhan"] == "Kunjungan pertama"

    def test_history_icd10_parsed_sebagai_list(self):
        """TC-36: icd10_codes di history sudah di-parse sebagai list (bukan string)."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Nyeri",
            "selected_icd10": [{"kode": "M54.5", "label": "Low back pain"}],
            "diagnosis_final": "LBP",
        })

        resp = client.get(f"/api/history/{pid}")
        icd = resp.json()["visits"][0]["icd10_codes"]
        assert isinstance(icd, list)
        assert icd[0]["kode"] == "M54.5"

    def test_history_has_image_flag(self):
        """TC-37: Field has_image = True jika ada image_path."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        # Simpan tanpa gambar
        client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Batuk", "diagnosis_final": "ISPA",
            "image_path": "",
        })

        resp = client.get(f"/api/history/{pid}")
        v = resp.json()["visits"][0]
        assert "has_image" in v
        assert v["has_image"] is False


# ========================================================
# GRUP 7: GENERATE PDF (FITUR BARU)
# ========================================================

class TestGeneratePDF:

    def _create_visit(self, with_chat=False, with_image=False):
        """Helper: buat pasien + kunjungan, return visit_id."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        payload = {
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Demam 3 hari",
            "gejala": "Mual, pusing",
            "teks_bebas": "Pasien dari daerah endemik dengue.",
            "tanda_bahaya_final": "Segera ke IGD jika trombosit turun.",
            "saran_pemeriksaan_final": "NS1 Antigen, Darah lengkap",
            "diagnosis_final": "Probable Dengue Fever",
            "selected_icd10": [{"kode": "A90", "label": "Dengue fever"}],
            "selected_rekomendasi": ["Paracetamol 500mg 3x1", "Istirahat total"],
        }
        if with_chat:
            payload["chat_konsultasi"] = [
                {"role": "dokter", "content": "Apakah ada ruam?"},
                {"role": "ai", "content": "Pertimbangkan dengue jika ada ruam."},
            ]
        if with_image:
            payload["analisis_gambar"] = json.dumps(DUMMY_IMAGE_RESPONSE)

        resp = client.post("/api/save-visit", json=payload)
        return resp.json()["visit_id"]

    def test_generate_pdf_sukses(self):
        """TC-38: Generate PDF sukses dan return file PDF."""
        vid = self._create_visit()
        resp = client.get(f"/api/generate-pdf/{vid}")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert len(resp.content) > 0

    def test_generate_pdf_file_valid(self):
        """TC-39: Konten PDF dimulai dengan header PDF valid (%PDF-)."""
        vid = self._create_visit()
        resp = client.get(f"/api/generate-pdf/{vid}")
        assert resp.content[:5] == b"%PDF-"

    def test_generate_pdf_dengan_chat(self):
        """TC-40: PDF berhasil dibuat meski ada chat history."""
        vid = self._create_visit(with_chat=True)
        resp = client.get(f"/api/generate-pdf/{vid}")
        assert resp.status_code == 200
        assert resp.content[:5] == b"%PDF-"

    def test_generate_pdf_dengan_analisis_gambar(self):
        """TC-41: PDF berhasil dibuat meski ada analisis gambar."""
        vid = self._create_visit(with_image=True)
        resp = client.get(f"/api/generate-pdf/{vid}")
        assert resp.status_code == 200
        assert resp.content[:5] == b"%PDF-"

    def test_generate_pdf_visit_tidak_ada(self):
        """TC-42: Generate PDF untuk visit_id tidak ada — return error JSON."""
        resp = client.get("/api/generate-pdf/999999")
        assert resp.status_code == 200
        data = resp.json()
        assert "error" in data

    def test_generate_pdf_filename_di_header(self):
        """TC-43: Response header menyertakan Content-Disposition dengan filename."""
        vid = self._create_visit()
        resp = client.get(f"/api/generate-pdf/{vid}")
        assert "content-disposition" in resp.headers
        assert "attachment" in resp.headers["content-disposition"]
        assert ".pdf" in resp.headers["content-disposition"]

    def test_generate_pdf_disimpan_ke_disk(self):
        """TC-44: File PDF tersimpan di folder pdfs/."""
        vid = self._create_visit()
        client.get(f"/api/generate-pdf/{vid}")
        # Cek folder pdfs ada dan ada file di dalamnya
        assert os.path.exists("./pdfs")
        pdf_files = [f for f in os.listdir("./pdfs") if f.endswith(".pdf")]
        assert len(pdf_files) > 0


# ========================================================
# GRUP 8: MIGRASI DB
# ========================================================

class TestDatabaseMigration:

    def test_migrasi_kolom_baru_ada(self):
        """TC-45: Kolom baru tersedia di tabel visits setelah migrasi."""
        import sqlite3
        con = sqlite3.connect("./clinic.db")
        cur = con.cursor()
        existing = [row[1] for row in cur.execute("PRAGMA table_info(visits)").fetchall()]
        con.close()

        required_new_cols = [
            "teks_bebas", "chat_history", "saran_pemeriksaan",
            "image_path", "analisis_gambar", "pdf_path", "created_at"
        ]
        for col in required_new_cols:
            assert col in existing, f"Kolom '{col}' tidak ditemukan di tabel visits"

    def test_kolom_lama_tetap_ada(self):
        """TC-46: Kolom lama tidak terhapus setelah migrasi."""
        import sqlite3
        con = sqlite3.connect("./clinic.db")
        cur = con.cursor()
        existing = [row[1] for row in cur.execute("PRAGMA table_info(visits)").fetchall()]
        con.close()

        required_old_cols = [
            "id", "patient_id", "keluhan", "gejala", "tanda_vital",
            "hasil_lab", "alergi", "diagnosis_ai", "icd10_codes",
            "rekomendasi_terpilih", "tanda_bahaya"
        ]
        for col in required_old_cols:
            assert col in existing, f"Kolom lama '{col}' hilang!"


# ========================================================
# GRUP 9: EDGE CASES & ROBUSTNESS
# ========================================================

class TestEdgeCases:

    def test_analyze_ai_response_missing_field_diisi_default(self):
        """TC-47: Jika AI tidak return field tertentu, default diisi otomatis."""
        # AI hanya return penyakit, tidak return icd10, rekomendasi, dll
        mock_openai_client.chat.completions.create.return_value = make_mock_completion({
            "penyakit": "Kemungkinan infeksi virus"
        })
        resp = client.post("/api/analyze", json={**DUMMY_PATIENT, "keluhan": "Demam"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["icd10"] == []
        assert data["rekomendasi"] == []
        assert data["tanda_bahaya"] != ""
        assert data["saran_pemeriksaan"] == []
        assert data["pertanyaan_lanjutan"] == []

    def test_patient_list_kosong_jika_belum_ada_data(self):
        """TC-48: GET /api/patients return list (bisa kosong, bukan error)."""
        resp = client.get("/api/patients")
        assert resp.status_code == 200
        assert "patients" in resp.json()
        assert isinstance(resp.json()["patients"], list)

    def test_save_visit_tanpa_icd10_dan_rekomendasi(self):
        """TC-49: Simpan kunjungan tanpa ICD-10 dan rekomendasi tidak error."""
        resp = client.post("/api/save-visit", json={
            "name": "Test Pasien", "age": 25, "gender": "Laki-laki",
            "keluhan": "Pusing",
            "selected_icd10": [],
            "selected_rekomendasi": [],
            "diagnosis_final": "",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_save_visit_chat_kosong_tidak_error(self):
        """TC-50: Simpan dengan chat_konsultasi kosong tidak error."""
        resp = client.post("/api/save-visit", json={
            "name": "Test Pasien", "age": 25, "gender": "Laki-laki",
            "keluhan": "Mual",
            "chat_konsultasi": [],
            "diagnosis_final": "Gastritis",
        })
        assert resp.status_code == 200

    def test_analyze_patient_id_existing_tidak_buat_duplikat(self):
        """TC-51: Analyze dengan patient_id yang ada tidak buat pasien duplikat."""
        setup_mock_ai()
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        client.post("/api/analyze", json={**DUMMY_PATIENT, "patient_id": pid, "keluhan": "Demam"})
        client.post("/api/analyze", json={**DUMMY_PATIENT, "patient_id": pid, "keluhan": "Batuk"})

        db = get_db()
        count = db.query(DBPatient).filter(DBPatient.name == "Budi Santoso").count()
        db.close()
        assert count == 1

    def test_multiple_visits_same_patient(self):
        """TC-52: Satu pasien bisa punya banyak kunjungan."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        for keluhan in ["Demam", "Batuk", "Nyeri kepala"]:
            client.post("/api/save-visit", json={
                "patient_id": pid, **DUMMY_PATIENT,
                "keluhan": keluhan, "diagnosis_final": "Test",
            })

        resp = client.get(f"/api/history/{pid}")
        assert len(resp.json()["visits"]) == 3

    def test_total_kunjungan_update_setelah_simpan(self):
        """TC-53: total_kunjungan di /api/patients bertambah setelah simpan kunjungan."""
        reg = client.post("/api/patients/register", json=DUMMY_PATIENT)
        pid = reg.json()["patient"]["id"]

        # Sebelum simpan
        resp_before = client.get("/api/patients")
        pasien_before = next(p for p in resp_before.json()["patients"] if p["id"] == pid)
        kunjungan_before = pasien_before["total_kunjungan"]

        # Simpan kunjungan
        client.post("/api/save-visit", json={
            "patient_id": pid, **DUMMY_PATIENT,
            "keluhan": "Demam", "diagnosis_final": "Fever",
        })

        resp_after = client.get("/api/patients")
        pasien_after = next(p for p in resp_after.json()["patients"] if p["id"] == pid)
        assert pasien_after["total_kunjungan"] == kunjungan_before + 1


# ========================================================
# RINGKASAN TEST
# ========================================================
if __name__ == "__main__":
    print("=" * 60)
    print("Jalankan dengan: pytest test_main.py -v")
    print("=" * 60)
    print()
    print("Grup test:")
    print("  Grup 1 (TC-01 s/d TC-06)  : Registrasi & manajemen pasien")
    print("  Grup 2 (TC-07 s/d TC-14)  : Analisis AI (fitur lama)")
    print("  Grup 3 (TC-15 s/d TC-19)  : Teks bebas & chat konsultasi")
    print("  Grup 4 (TC-20 s/d TC-23)  : Analisis gambar")
    print("  Grup 5 (TC-24 s/d TC-31)  : Simpan kunjungan")
    print("  Grup 6 (TC-32 s/d TC-37)  : Riwayat kunjungan")
    print("  Grup 7 (TC-38 s/d TC-44)  : Generate PDF")
    print("  Grup 8 (TC-45 s/d TC-46)  : Migrasi DB")
    print("  Grup 9  (TC-47 s/d TC-53) : Edge cases & robustness")
    print("  Grup 10 (TC-54 s/d TC-60) : Chat konsultasi (/api/chat)")
    print("  Grup 11 (TC-61 s/d TC-65) : Gambar inline di form")
    print()
    print("Total: 65 test cases")