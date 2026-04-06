import numpy as np
import cv2
import matplotlib.pyplot as plt


# ================= ADAPTIVE LUNG MASK =================
def get_lung_mask(image):
    h, w = image.shape

    blur = cv2.GaussianBlur(image, (7,7), 0)

    _, thresh = cv2.threshold(
        blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    # batasi area tengah
    mask_area = np.zeros_like(image)
    left = int(w * 0.1)
    right = int(w * 0.9)
    top = int(h * 0.1)
    bottom = int(h * 0.9)
    mask_area[top:bottom, left:right] = thresh[top:bottom, left:right]

    contours, _ = cv2.findContours(mask_area, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    mask_clean = np.zeros_like(image)
    mid = w // 2

    left_contours = []
    right_contours = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 2000:
            continue

        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect_ratio = ch / (cw + 1e-5)

        # filter tulang (garis tipis)
        if aspect_ratio > 4:
            continue

        if x < mid:
            left_contours.append(cnt)
        else:
            right_contours.append(cnt)

    if left_contours:
        left_contours = sorted(left_contours, key=cv2.contourArea, reverse=True)
        cv2.drawContours(mask_clean, [left_contours[0]], -1, 255, -1)

    if right_contours:
        right_contours = sorted(right_contours, key=cv2.contourArea, reverse=True)
        cv2.drawContours(mask_clean, [right_contours[0]], -1, 255, -1)

    # smoothing
    kernel = np.ones((15,15), np.uint8)
    mask_clean = cv2.morphologyEx(mask_clean, cv2.MORPH_CLOSE, kernel)

    return mask_clean


# ================= OPACITY =================
def detect_opacity(image):
    img_eq = cv2.equalizeHist(image)
    blur = cv2.GaussianBlur(img_eq, (5, 5), 0)

    _, thresh = cv2.threshold(blur, 145, 255, cv2.THRESH_BINARY)

    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    return thresh


# ================= MAIN =================
def segment(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    if img is None:
        print("Gambar tidak ditemukan!")
        return

    img = cv2.resize(img, (512, 512))

    lung_mask = get_lung_mask(img)
    opacity = detect_opacity(img)

        # ambil hanya bagian paru
    lung_region = cv2.bitwise_and(img, lung_mask)

    # threshold khusus di dalam paru
    _, lung_thresh = cv2.threshold(lung_region, 130, 255, cv2.THRESH_BINARY)

    pneumonia_mask = lung_thresh

    overlay = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    red_mask = np.zeros_like(overlay)
    red_mask[pneumonia_mask == 255] = [0, 0, 255]

    overlay = cv2.addWeighted(overlay, 0.7, red_mask, 0.3, 0)

    plt.figure(figsize=(12,6))

    plt.subplot(1,4,1)
    plt.title("Original")
    plt.imshow(img, cmap="gray")
    plt.axis("off")

    plt.subplot(1,4,2)
    plt.title("Lung Mask")
    plt.imshow(lung_mask, cmap="gray")
    plt.axis("off")

    plt.subplot(1,4,3)
    plt.title("Opacity")
    plt.imshow(opacity, cmap="gray")
    plt.axis("off")

    plt.subplot(1,4,4)
    plt.title("Overlay")
    plt.imshow(overlay)
    plt.axis("off")

    plt.tight_layout()
    plt.show()


# RUN
segment(r"C:\Users\DEVASYA ADITYA\Documents\biomedic-rea\backend\xray.jpg")