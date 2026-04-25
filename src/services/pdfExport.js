import jsPDF from "jspdf";

const getImageData = async (source) => {
  if (!source) return null;
  if (typeof source !== "string") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(source);
    });
  }
  const resp = await fetch(source);
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

export const exportToPDF = async (
  records,
  patientData = null,
  includeAI = true, // <--- PARAMETER BARU (Default True)
) => {
  const dataToPrint = Array.isArray(records) ? records : [records];
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * margin;

  const cleanText = (text) =>
    text
      ?.toString()
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\t/g, " ")
      .replace(/[^ -~]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

  let yPos = 20;
  const addWrappedText = (text, options = {}) => {
    const {
      isBold = false,
      fontSize = 11,
      color = [0, 0, 0],
      spacing = 5,
    } = options;
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(cleanText(text || "-"), usableWidth);
    lines.forEach((line) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += spacing;
  };

  const renderImage = (base64Img, format = "JPEG") => {
    if (!base64Img) return;
    const imgProps = doc.getImageProperties(base64Img);
    const maxWidth = 110;
    const maxHeight = 80;
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
    doc.addImage(base64Img, format, (pageWidth - imgW) / 2, yPos, imgW, imgH);
    yPos += imgH + 10;
  };

  const generateDoctorImage = (imageSrc, boxes) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = "green";
        ctx.lineWidth = 5;
        boxes.forEach((box) =>
          ctx.strokeRect(box.x, box.y, box.width, box.height),
        );
        resolve(canvas.toDataURL("image/jpeg"));
      };
    });
  };

  for (let i = 0; i < dataToPrint.length; i++) {
    const item = dataToPrint[i];
    if (i > 0) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LAPORAN RADIOLOGI MEDIS", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (patientData) {
      doc.text(
        `Pasien: ${patientData.nama_pasien} (${patientData.no_rm})`,
        pageWidth / 2,
        yPos,
        { align: "center" },
      );
      yPos += 5;
    }
    doc.text(
      `Tanggal Pemeriksaan: ${item.date || new Date().toLocaleDateString()}`,
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    yPos += 15;

    // 1. Gambar Asli
    let originalSource =
      item.selectedFile ||
      item.imagePreview ||
      item.gambar_asli_url ||
      item.original_image;
    if (!originalSource && item.segmentation_image)
      originalSource = `data:image/jpeg;base64,${item.segmentation_image}`;

    const originalImgBase64 = await getImageData(originalSource);
    if (originalImgBase64) {
      doc.setFont("helvetica", "bold");
      doc.text("1. Gambar Asli", margin, yPos);
      yPos += 5;
      renderImage(originalImgBase64);
    }

    // 2. AI Segmentation (HANYA MUNCUL JIKA includeAI = TRUE)
    if (includeAI && (item.segmentation_image || item.gambar_hasil_url)) {
      const aiImg = item.segmentation_image
        ? `data:image/jpeg;base64,${item.segmentation_image}`
        : item.gambar_hasil_url;
      const aiImgBase64 = await getImageData(aiImg);
      doc.setFont("helvetica", "bold");
      doc.text("2. Segmentasi AI", margin, yPos);
      yPos += 5;
      renderImage(aiImgBase64);
    }

    // 3. Dokter Mark
    let doctorBoxes =
      typeof item.doctorBoxes === "string"
        ? JSON.parse(item.doctorBoxes || "[]")
        : item.doctorBoxes;
    if (doctorBoxes && doctorBoxes.length > 0 && originalImgBase64) {
      const docImgBase64 = await generateDoctorImage(
        originalImgBase64,
        doctorBoxes,
      );
      doc.setFont("helvetica", "bold");
      doc.text(
        includeAI ? "3. Segmentasi Dokter" : "2. Segmentasi Dokter",
        margin,
        yPos,
      );
      yPos += 5;
      renderImage(docImgBase64);
    }

    // 4. Analisis Teks (Pemisahan Berdasarkan includeAI)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);

    if (includeAI) {
      doc.text("Analisis Klinis (Sistem AI)", margin, yPos);
      yPos += 8;
      addWrappedText("Temuan Klinis AI:", { isBold: true, fontSize: 11 });
      addWrappedText(item.result?.findings || item.ai_result?.findings || "-");
      addWrappedText(
        `Tingkat Risiko: ${item.result?.risk || item.ai_result?.risk || 0}%`,
        { isBold: true },
      );
      yPos += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Catatan & Diagnosis Resmi Dokter", margin, yPos);
    yPos += 8;
    addWrappedText(`Temuan Dokter:`, { isBold: true, fontSize: 11 });
    addWrappedText(item.doctorNotes?.temuan || "-");
    addWrappedText(`Diagnosis Penyakit:`, { isBold: true, fontSize: 11 });
    addWrappedText(item.doctorNotes?.penyakit || "-");
    addWrappedText(`Evaluasi Risiko:`, { isBold: true, fontSize: 11 });
    addWrappedText(item.doctorNotes?.risiko || "-");
    addWrappedText(`Rekomendasi / Tindakan:`, { isBold: true, fontSize: 11 });
    addWrappedText(item.doctorNotes?.rekomendasi || "-");

    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    addWrappedText(
      "Dokumen ini sah dan merupakan bagian dari rekam medis pasien.",
      { fontSize: 9, color: [100, 100, 100] },
    );
  }

  doc.save(`Laporan_Medis_${new Date().getTime()}.pdf`);
};
