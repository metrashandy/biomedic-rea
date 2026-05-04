"""
dicom_utils.py
==============
Utility untuk membaca file DICOM dan mengekstrak slice-slice representatif
sebagai PIL Image (JPEG-ready), siap dikirim ke OpenAI.

Install dependency:
    pip install pydicom numpy Pillow pylibjpeg pylibjpeg-libjpeg

Cara kerja:
    1. Baca file DICOM (single slice atau multi-frame)
    2. Normalisasi pixel ke 0-255 dengan windowing yang proper
    3. Pilih N slice representatif (tengah ± offset)
    4. Return list PIL.Image siap dipakai
"""

import io
import numpy as np
from PIL import Image

try:
    import pydicom
    from pydicom.pixel_data_handlers.util import apply_voi_lut
    PYDICOM_AVAILABLE = True
except ImportError:
    PYDICOM_AVAILABLE = False


class DicomNotSupportedError(Exception):
    pass


def check_pydicom():
    if not PYDICOM_AVAILABLE:
        raise DicomNotSupportedError(
            "pydicom belum terinstall. Jalankan: pip install pydicom pylibjpeg pylibjpeg-libjpeg"
        )


def normalize_dicom_array(pixel_array: np.ndarray, ds=None) -> np.ndarray:
    img = pixel_array.copy().astype(float)

    slope = float(getattr(ds, 'RescaleSlope', 1)) if ds else 1.0
    intercept = float(getattr(ds, 'RescaleIntercept', 0)) if ds else 0.0
    if slope != 1.0 or intercept != 0.0:
        img = img * slope + intercept

    modality = str(getattr(ds, 'Modality', '')).upper() if ds else ''
    is_ct = modality == 'CT'

    if is_ct:
        # ── MULTI-WINDOW BLEND untuk CT ──────────────────────
        # Blend 3 window preset → AI bisa lihat semua jenis lesi
        windows = [
            (40, 400),   # soft tissue  — massa, organ
            (75, 175),   # tumor        — neoplasma
            (40,  80),   # brain        — edema, perdarahan
        ]

        channels = []
        for wc, ww in windows:
            wmin = wc - ww / 2
            wmax = wc + ww / 2
            ch = np.clip(img, wmin, wmax)
            ch = (ch - wmin) / (wmax - wmin) * 255.0
            channels.append(ch.astype(np.uint8))

        # Stack jadi RGB: R=soft tissue, G=tumor, B=brain
        multi = np.stack(channels, axis=-1)
        return multi  # shape: (H, W, 3)

    else:
        # Non-CT: tetap min-max biasa
        if ds is not None:
            try:
                from pydicom.pixel_data_handlers.util import apply_voi_lut
                img_lut = apply_voi_lut(pixel_array, ds)
                img = img_lut.astype(float)
            except Exception as e:
                print(f"  [DICOM] VOI LUT gagal ({e}), pakai min-max")

        img_min, img_max = img.min(), img.max()
        if img_max > img_min:
            img = (img - img_min) / (img_max - img_min) * 255.0
        else:
            img = np.zeros_like(img)
        return img.astype(np.uint8)

def normalize_dicom_array_ct(pixel_array: np.ndarray, ds=None,
                              window_center: int = None,
                              window_width: int = None) -> np.ndarray:
    """
    Normalisasi CT scan dengan windowing yang proper.
    Default: brain window (W=80, L=40) untuk deteksi lesi otak.
 
    Window presets CT:
    - Brain:   W=80,  L=40   → terbaik untuk stroke, edema
    - Tumor:   W=150, L=75   → terbaik untuk massa/neoplasma
    - Blood:   W=100, L=50   → terbaik untuk perdarahan
    - Bone:    W=2500,L=480  → tulang tengkorak
    """
    img = pixel_array.astype(float)
 
    # Terapkan rescale slope/intercept jika belum (untuk HU)
    slope = float(getattr(ds, 'RescaleSlope', 1)) if ds else 1
    intercept = float(getattr(ds, 'RescaleIntercept', 0)) if ds else 0
    if slope != 1 or intercept != 0:
        img = img * slope + intercept
 
    # Ambil window dari metadata DICOM kalau tidak dispec manual
    if window_center is None and ds is not None:
        wc = getattr(ds, 'WindowCenter', None)
        ww = getattr(ds, 'WindowWidth', None)
        if wc is not None:
            window_center = float(wc[0]) if hasattr(wc, '__iter__') else float(wc)
        if ww is not None:
            window_width = float(ww[0]) if hasattr(ww, '__iter__') else float(ww)
 
    # Default brain window kalau tidak ada info
    if window_center is None:
        window_center = 40   # brain default
    if window_width is None:
        window_width = 80    # brain default
 
    print(f"  [DICOM] Window: C={window_center}, W={window_width}")
 
    # Terapkan windowing
    wmin = window_center - window_width / 2
    wmax = window_center + window_width / 2
 
    img = np.clip(img, wmin, wmax)
    img = (img - wmin) / (wmax - wmin) * 255.0
 
    return img.astype(np.uint8)

def array_to_pil(arr: np.ndarray) -> Image.Image:
    """Convert numpy array (grayscale atau RGB) ke PIL Image RGB."""
    if arr.ndim == 2:
        pil = Image.fromarray(arr, mode='L').convert('RGB')
    elif arr.ndim == 3 and arr.shape[2] == 3:
        pil = Image.fromarray(arr, mode='RGB')
    elif arr.ndim == 3 and arr.shape[2] == 4:
        pil = Image.fromarray(arr, mode='RGBA').convert('RGB')
    elif arr.ndim == 3 and arr.shape[0] in (1, 3, 4):
        # Channel-first format (C, H, W) → transpose ke (H, W, C)
        arr_t = np.transpose(arr, (1, 2, 0))
        if arr_t.shape[2] == 1:
            pil = Image.fromarray(arr_t[:, :, 0], mode='L').convert('RGB')
        elif arr_t.shape[2] == 3:
            pil = Image.fromarray(arr_t, mode='RGB')
        else:
            pil = Image.fromarray(arr_t[:, :, :3], mode='RGB')
    else:
        raise ValueError(f"Unexpected pixel array shape: {arr.shape}")
    return pil


def select_representative_slices(slices: list, n_slices: int = 5) -> list:
    """
    Pilih N slice representatif dari stack.
    Ambil dari 20%-80% range tengah (hindari slice kosong di awal/akhir).
    """
    total = len(slices)
    if total == 0:
        return []
    if total <= n_slices:
        return slices

    start_idx = int(total * 0.20)
    end_idx   = int(total * 0.80)

    indices = np.linspace(start_idx, end_idx, n_slices, dtype=int)
    indices = sorted(set(indices.tolist()))

    return [slices[i] for i in indices]


def get_pixel_array_safe(ds) -> np.ndarray:
    """
    Ambil pixel_array dari dataset DICOM dengan fallback untuk compressed transfer syntax.
    
    DICOM compressed (JPEG, JPEG2000, RLE, dll) butuh handler khusus.
    Kalau gagal → coba force decompress atau raise error yang jelas.
    """
    try:
        return ds.pixel_array
    except Exception as e:
        error_msg = str(e).lower()
        print(f"  [DICOM] pixel_array gagal: {e}")

        # ── Coba install handler otomatis ─────────────────────
        # JPEG Lossless / JPEG Baseline butuh pylibjpeg
        if "jpeg" in error_msg or "transfer syntax" in error_msg or "handler" in error_msg:
            try:
                import pydicom.config
                # Coba dengan pillow handler
                pydicom.config.pixel_data_handlers = None
                ds.convert_pixel_data()
                return ds.pixel_array
            except Exception:
                pass

            try:
                # Coba decompress manual dengan gdcm
                import gdcm  # noqa
                ds.decompress()
                return ds.pixel_array
            except ImportError:
                pass
            except Exception:
                pass

        # ── Fallback: coba baca pixel raw ─────────────────────
        try:
            if hasattr(ds, 'PixelData'):
                rows = int(getattr(ds, 'Rows', 512))
                cols = int(getattr(ds, 'Columns', 512))
                bits = int(getattr(ds, 'BitsAllocated', 16))
                dtype = np.uint16 if bits == 16 else np.uint8
                
                raw = np.frombuffer(ds.PixelData, dtype=dtype)
                
                # Hitung total pixels yang diharapkan
                total_pixels = rows * cols
                n_frames = len(raw) // total_pixels
                
                if n_frames >= 1 and len(raw) >= total_pixels:
                    if n_frames == 1:
                        return raw[:total_pixels].reshape(rows, cols)
                    else:
                        return raw[:n_frames * total_pixels].reshape(n_frames, rows, cols)
                        
        except Exception as fallback_err:
            print(f"  [DICOM] Fallback raw pixel juga gagal: {fallback_err}")

        # Kalau semua gagal, raise error yang informatif
        raise DicomNotSupportedError(
            f"Gagal membaca pixel DICOM. "
            f"Transfer syntax mungkin membutuhkan: pip install pylibjpeg pylibjpeg-libjpeg\n"
            f"Error asli: {e}"
        )


def dicom_to_pil_slices(
    dicom_bytes: bytes,
    filename: str = "file.dcm",
    n_slices: int = 5
) -> list:
    """
    Baca file DICOM dari bytes, return list PIL.Image (RGB).
    
    Args:
        dicom_bytes: raw bytes dari file DICOM
        filename: nama file (untuk logging)
        n_slices: jumlah slice representatif yang diambil
    
    Returns:
        list of PIL.Image objects (sudah RGB, siap disave sebagai JPEG)
    
    Raises:
        DicomNotSupportedError: jika pydicom tidak terinstall atau format tidak didukung
        ValueError: jika file bukan DICOM valid
    """
    check_pydicom()

    # ── Parse DICOM ──────────────────────────────────────────
    try:
        ds = pydicom.dcmread(io.BytesIO(dicom_bytes), force=True)
    except Exception as e:
        raise ValueError(f"File '{filename}' bukan DICOM valid atau corrupt: {e}")

    # ── Cek apakah ada pixel data ────────────────────────────
    if not hasattr(ds, 'PixelData'):
        raise ValueError(
            f"File '{filename}' adalah DICOM struktural (tanpa gambar/pixel data). "
            "Pastikan file adalah CT/MRI image, bukan DICOM SR/RT/KO."
        )

    # ── Ambil transfer syntax untuk logging ─────────────────
    ts = getattr(ds, 'file_meta', None)
    if ts:
        ts_uid = str(getattr(ts, 'TransferSyntaxUID', 'unknown'))
        print(f"  [DICOM] Transfer Syntax: {ts_uid}")
    
    modality = str(getattr(ds, 'Modality', 'unknown'))
    print(f"  [DICOM] Modality: {modality}")

    # ── Ambil pixel array dengan safe fallback ───────────────
    pixel_array = get_pixel_array_safe(ds)
    print(f"📋 DICOM '{filename}': shape={pixel_array.shape}, dtype={pixel_array.dtype}")

    # ── Rescale slope/intercept (Hounsfield Units untuk CT) ──
    rescale_slope = float(getattr(ds, 'RescaleSlope', 1))
    rescale_intercept = float(getattr(ds, 'RescaleIntercept', 0))
    if rescale_slope != 1 or rescale_intercept != 0:
        pixel_array = pixel_array.astype(float) * rescale_slope + rescale_intercept
        pixel_array = pixel_array.astype(np.int32)
        print(f"  [DICOM] Rescale applied: slope={rescale_slope}, intercept={rescale_intercept}")

    # ── Single frame ──────────────────────────────────────────
    if pixel_array.ndim == 2:
        normalized = normalize_dicom_array(pixel_array, ds)
        return [array_to_pil(normalized)]

    # ── Multi-frame ───────────────────────────────────────────
    if pixel_array.ndim == 3:
        n_frames = pixel_array.shape[0]
        print(f"📋 Multi-frame DICOM: {n_frames} frames → ambil {n_slices} slice representatif")

        all_slices = []
        for i in range(n_frames):
            frame = pixel_array[i]
            try:
                normalized = normalize_dicom_array(frame, ds if i == 0 else None)
                all_slices.append(normalized)
            except Exception as e:
                print(f"  [DICOM] Skip frame {i}: {e}")
                continue

        if not all_slices:
            raise DicomNotSupportedError("Semua frame DICOM gagal diproses")

        selected = select_representative_slices(all_slices, n_slices=n_slices)
        return [array_to_pil(s) for s in selected]

    # ── 4D array (jarang, tapi ada) ───────────────────────────
    if pixel_array.ndim == 4:
        # Biasanya (frames, height, width, channels) atau (frames, channels, h, w)
        print(f"📋 4D DICOM: shape={pixel_array.shape}, ambil frame pertama saja")
        # Ambil dimensi pertama sebagai frames
        frames = []
        for i in range(min(pixel_array.shape[0], 20)):  # max 20 frames dari 4D
            try:
                frame = pixel_array[i]
                if frame.ndim == 3:
                    # (C, H, W) atau (H, W, C)
                    if frame.shape[0] in (1, 3, 4):
                        frame = np.transpose(frame, (1, 2, 0))
                    if frame.shape[2] == 1:
                        frame = frame[:, :, 0]
                normalized = normalize_dicom_array(frame, ds if i == 0 else None)
                frames.append(normalized)
            except Exception as e:
                print(f"  [DICOM] Skip 4D frame {i}: {e}")
                continue
        
        if not frames:
            raise DicomNotSupportedError("Gagal memproses DICOM 4D")
        
        selected = select_representative_slices(frames, n_slices=n_slices)
        return [array_to_pil(s) for s in selected]

    raise ValueError(f"Format pixel array tidak dikenal: shape={pixel_array.shape}, ndim={pixel_array.ndim}")


def is_dicom_file(filename: str, content_type: str) -> bool:
    """
    Deteksi apakah file adalah DICOM berdasarkan ekstensi atau content-type.
    """
    filename_lower = filename.lower()
    if filename_lower.endswith('.dcm') or filename_lower.endswith('.dicom'):
        return True
    if content_type in ('application/dicom', 'application/octet-stream'):
        return filename_lower.endswith('.dcm') or filename_lower.endswith('.dicom')
    return False


def pil_to_base64_jpeg(pil_image: Image.Image, quality: int = 90) -> str:
    """Convert PIL Image ke base64 JPEG string."""
    import base64
    buffered = io.BytesIO()
    # Pastikan RGB sebelum save JPEG (JPEG tidak support RGBA)
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')
    pil_image.save(buffered, format="JPEG", quality=quality)
    return base64.b64encode(buffered.getvalue()).decode()