import jsPDF from "jspdf";

// =====================================================
// HELPER: Ambil base64 dari URL atau File/Blob object
// =====================================================
const getImageData = async (source) => {
  if (!source) return null;

  // Kalau source adalah File/Blob object (dari input upload)
  if (typeof source !== "string") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(source);
    });
  }

  // Kalau sudah base64 langsung return
  if (source.startsWith("data:")) return source;

  // Kalau URL → fetch dulu
  try {
    const resp = await fetch(source);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Gagal fetch gambar:", source, e);
    return null;
  }
};

// =====================================================
// HELPER: Generate gambar dokter dari base image + bbox
// Dipakai sebagai FALLBACK kalau gambar_dokter_url tidak ada
// bbox format: { x, y, width, height } semua normalized (0.0 - 1.0)
// =====================================================
const generateDoctorImageFromBoxes = (imageSrc, boxes) => {
  return new Promise((resolve) => {
    if (!imageSrc || !boxes || boxes.length === 0) {
      resolve(null);
      return;
    }

    const img = new Image();
    if (!imageSrc.startsWith("data:")) {
      img.crossOrigin = "Anonymous";
    }

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");

      // Gambar base image
      ctx.drawImage(img, 0, 0);

      // Gambar kotak hijau dokter
      ctx.strokeStyle = "#10B981"; // green
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.lineWidth = Math.max(3, img.naturalWidth * 0.004);

      boxes.forEach((box) => {
        // ✅ Konversi normalized (0.0-1.0) ke pixel
        const x = box.x * img.naturalWidth;
        const y = box.y * img.naturalHeight;
        const w = box.width * img.naturalWidth;
        const h = box.height * img.naturalHeight;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      });

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    img.onerror = () => {
      console.warn("Gagal load gambar untuk generate doctor boxes");
      resolve(null);
    };

    img.src = imageSrc;
  });
};

// =====================================================
// HELPER: Render gambar ke PDF dengan proporsi terjaga
// =====================================================
const renderImageToPDF = (doc, base64Img, margin, pageWidth, pageHeight, yPos) => {
  if (!base64Img) return yPos;
  try {
    const imgProps = doc.getImageProperties(base64Img);
    const maxWidth = pageWidth - 2 * margin;
    const maxHeight = 100;
    let imgW = maxWidth;
    let imgH = (imgProps.height * imgW) / imgProps.width;
    if (imgH > maxHeight) {
      imgH = maxHeight;
      imgW = (imgProps.width * imgH) / imgProps.height;
    }
    if (yPos + imgH > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
    doc.addImage(base64Img, "JPEG", (pageWidth - imgW) / 2, yPos, imgW, imgH);
    yPos += imgH + 8;
  } catch (e) {
    console.warn("Gagal render gambar ke PDF:", e);
  }
  return yPos;
};

// =====================================================
// MAIN EXPORT FUNCTION
//
// includeAI = true  → Laporan Lengkap: Gambar Asli + Gambar AI + Gambar Dokter + Analisis AI + Catatan Dokter
// includeAI = false → Laporan Dokter:  Gambar Asli + Gambar Dokter ONLY + Catatan Dokter (no AI stuff)
// =====================================================
export const exportToPDF = async (records, patientData = null, includeAI = true) => {
  const dataToPrint = Array.isArray(records) ? records : [records];
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * margin;

  // Bersihkan teks dari karakter aneh
  const cleanText = (text) =>
    text?.toString()
      .replace(/\n/g, " ").replace(/\r/g, " ").replace(/\t/g, " ")
      .replace(/[^ -~\u00C0-\u024F]+/g, "")
      .replace(/\s+/g, " ").trim() || "-";

  let yPos = 20;

  const checkPage = () => {
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  const addText = (text, { isBold = false, fontSize = 11, color = [30, 30, 30], spacing = 4 } = {}) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(cleanText(text), usableWidth);
    lines.forEach((line) => {
      checkPage();
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += spacing;
  };

  const addSectionTitle = (text) => {
    checkPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 120);
    doc.text(text, margin, yPos);
    yPos += 8;
  };

  const addDivider = () => {
    checkPage();
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  // ===================== LOOP TIAP RECORD =====================
  for (let i = 0; i < dataToPrint.length; i++) {
    const item = dataToPrint[i];
    if (i > 0) { doc.addPage(); yPos = 20; }

    // ── HEADER ──────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 80);
    doc.text("LAPORAN RADIOLOGI MEDIS", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (patientData) {
      doc.text(
        `Pasien: ${patientData.nama_pasien || "-"}   |   No. RM: ${patientData.no_rm || "-"}`,
        pageWidth / 2, yPos, { align: "center" }
      );
      yPos += 5;
    }
    doc.text(
      `Tanggal: ${item.date || new Date().toLocaleDateString("id-ID")}`,
      pageWidth / 2, yPos, { align: "center" }
    );
    yPos += 12;
    addDivider();

    // ── SECTION GAMBAR ───────────────────────────────────────
    addSectionTitle(includeAI ? "A. Dokumentasi Citra Medis" : "A. Dokumentasi Citra");

    // Resolve sumber gambar original
    const originalSrc =
      item.selectedFile ||
      item.imagePreview ||
      item.gambar_asli_url ||
      item.original_image ||
      null;

    // 1. GAMBAR ASLI — selalu ditampilkan
    const originalBase64 = await getImageData(originalSrc);
    if (originalBase64) {
      addText("1. Gambar Asli", { isBold: true, fontSize: 10, spacing: 2 });
      yPos = renderImageToPDF(doc, originalBase64, margin, pageWidth, pageHeight, yPos);
    }

    // 2. GAMBAR AI — hanya jika includeAI = true
    if (includeAI) {
      // Coba gambar hasil AI dari URL server dulu, fallback ke base64
      const aiSrc = item.gambar_hasil_url || 
        (item.segmentation_image
          ? (item.segmentation_image.startsWith("data:") || item.segmentation_image.startsWith("http")
              ? item.segmentation_image
              : `data:image/jpeg;base64,${item.segmentation_image}`)
          : null);

      const aiBase64 = await getImageData(aiSrc);
      if (aiBase64) {
        addText("2. Segmentasi AI (Area Abnormal)", { isBold: true, fontSize: 10, spacing: 2 });
        yPos = renderImageToPDF(doc, aiBase64, margin, pageWidth, pageHeight, yPos);
      }
    }

    // 3. GAMBAR DOKTER — selalu ditampilkan kalau ada
    // Prioritas: gambar_dokter_url (sudah di-render di server) → generate dari bbox
    let doctorBase64 = null;

    if (item.gambar_dokter_url) {
      // ✅ Pakai gambar dokter yang sudah tersimpan di server
      doctorBase64 = await getImageData(item.gambar_dokter_url);
    }

    if (!doctorBase64) {
      // Fallback: generate dari kotak bbox dokter + gambar original
      const rawBoxes = typeof item.doctorBoxes === "string"
        ? JSON.parse(item.doctorBoxes || "[]")
        : (item.doctorBoxes || item.doctor_bboxes || []);

      if (rawBoxes && rawBoxes.length > 0 && originalBase64) {
        doctorBase64 = await generateDoctorImageFromBoxes(originalBase64, rawBoxes);
      }
    }

    if (doctorBase64) {
      const docLabel = includeAI ? "3. Segmentasi Dokter (Area Anotasi)" : "2. Segmentasi Dokter (Area Anotasi)";
      addText(docLabel, { isBold: true, fontSize: 10, spacing: 2 });
      yPos = renderImageToPDF(doc, doctorBase64, margin, pageWidth, pageHeight, yPos);
    }

    addDivider();

    // ── SECTION CATATAN DOKTER ───────────────────────────────
    addSectionTitle("B. Catatan & Diagnosis Resmi Dokter");

    const notes = item.doctorNotes || item.doctor_notes || {};
    addText("Temuan Klinis:", { isBold: true, fontSize: 10, spacing: 1 });
    addText(notes.temuan || "-", { fontSize: 10, spacing: 5 });

    addText("Diagnosis Penyakit:", { isBold: true, fontSize: 10, spacing: 1 });
    addText(notes.penyakit || "-", { fontSize: 10, spacing: 5 });

    addText("Evaluasi Risiko:", { isBold: true, fontSize: 10, spacing: 1 });
    addText(notes.risiko || "-", { fontSize: 10, spacing: 5 });

    addText("Rekomendasi / Tindakan:", { isBold: true, fontSize: 10, spacing: 1 });
    addText(notes.rekomendasi || "-", { fontSize: 10, spacing: 5 });

    addDivider();

    // ── SECTION ANALISIS AI (hanya jika includeAI) ───────────
    if (includeAI) {
      addSectionTitle("C. Analisis Klinis Sistem AI (Penunjang)");

      const aiResult = item.result || item.ai_result || {};
      const rec = aiResult.recommendation || {};

      addText("Temuan AI:", { isBold: true, fontSize: 10, spacing: 1 });
      addText(aiResult.findings || "-", { fontSize: 10, spacing: 5 });

      addText("Potensi Kelainan:", { isBold: true, fontSize: 10, spacing: 1 });
      addText(aiResult.abnormality || "-", { fontSize: 10, spacing: 5 });

      addText(`Tingkat Risiko AI: ${aiResult.risk ?? "-"}%`, { isBold: true, fontSize: 10, spacing: 5 });

      addText("Rekomendasi AI:", { isBold: true, fontSize: 10, spacing: 1 });
      addText(`Pendekatan: ${rec.approach || "-"}`, { fontSize: 10, spacing: 2 });
      addText(`Penanganan: ${rec.treatment || "-"}`, { fontSize: 10, spacing: 5 });

      addDivider();
    }

    // ── DISCLAIMER ───────────────────────────────────────────
    addText(
      includeAI
        ? "Dokumen ini merupakan bagian dari rekam medis pasien. Hasil analisis AI bersifat penunjang dan tidak menggantikan diagnosis medis profesional."
        : "Dokumen ini merupakan laporan resmi dari dokter pemeriksa dan merupakan bagian dari rekam medis pasien.",
      { fontSize: 8, color: [120, 120, 120], spacing: 0 }
    );
  }

  const fileName = patientData
    ? `Laporan_${(patientData.nama_pasien || "Pasien").replace(/\s+/g, "_")}_${Date.now()}.pdf`
    : `Laporan_Medis_${Date.now()}.pdf`;

  doc.save(fileName);
};