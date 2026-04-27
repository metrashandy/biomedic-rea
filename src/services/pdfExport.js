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

  // ================= GENERATE DOCTOR IMAGE =================
  const generateDoctorImage = (imageSrc, boxes) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!imageSrc.startsWith("data:")) {
        img.crossOrigin = "Anonymous";
      }

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // 🔥 FIX: TAMBAHIN FILLSTYLE & STROKESTYLE
        ctx.strokeStyle = "#10B981"; // Emerald-500
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)"; // Emerald-500 dengan 25% transparansi
        ctx.lineWidth = Math.max(4, img.naturalWidth * 0.005);

        boxes.forEach((box) => {
          // Asumsi box sudah dalam format { x, y, width, height }
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.fillRect(box.x, box.y, box.width, box.height); // <--- INI YG BIKIN ADA ISI HIJAUNYA
        });

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      
      img.onerror = () => {
        console.error("Gagal memuat gambar untuk canvas dokter");
        reject("Gagal load gambar canvas");
      };

      img.src = imageSrc;
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

    // --- 4. CATATAN & DIAGNOSIS RESMI DOKTER (DIUTAMAKAN) ---
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Catatan & Diagnosis Resmi Dokter", margin, yPos); yPos += 8;

    const section = (title) => { doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(title, margin, yPos); yPos += 6; };

    addWrappedText(`Temuan Dokter:`, { isBold: true, fontSize: 10 }); addWrappedText(item.doctor_notes?.temuan || "-");
    addWrappedText(`Diagnosis Penyakit:`, { isBold: true, fontSize: 10 }); addWrappedText(item.doctor_notes?.penyakit || "-");
    addWrappedText(`Evaluasi Risiko:`, { isBold: true, fontSize: 10 }); addWrappedText(item.doctor_notes?.risiko || "-");
    addWrappedText(`Rekomendasi / Tindakan:`, { isBold: true, fontSize: 10 }); addWrappedText(item.doctor_notes?.rekomendasi || "-");
    
    doc.setDrawColor(200); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 8;

    // --- 5. ANALISIS KLINIS AI (SEBAGAI PENUNJANG) ---
    if (includeAI) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text("Analisis Klinis (Sistem AI)", margin, yPos); yPos += 8;
      
      section("1. Temuan AI");
      addWrappedText(item.result?.findings || item.ai_result?.findings || "-");

      section("2. Potensi Kelainan AI");
      addWrappedText(item.result?.abnormality || item.ai_result?.abnormality || "-");

      section("3. Tingkat Risiko AI");
      addWrappedText(`Overall Risk: ${item.result?.risk || item.ai_result?.risk || 0}%`);

      section("4. Rekomendasi AI");
      const rec = item.result?.recommendation || item.ai_result?.recommendation;
      addWrappedText(`Pendekatan: ${rec?.approach || "-"}`);
      addWrappedText(`Penanganan: ${rec?.treatment || "-"}`);
      yPos += 4;
    }

    // --- 6. DISCLAIMER ---
    doc.setDrawColor(200); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 6;
    addWrappedText("Dokumen ini sah dan merupakan bagian dari rekam medis pasien. Hasil AI hanya sebagai penunjang dan tidak menggantikan diagnosis medis profesional.", { fontSize: 8, color: [100, 100, 100] });
  }

  const fileName = patientData ? `Laporan_${patientData.nama_pasien}.pdf` : `Laporan_Medis_${new Date().getTime()}.pdf`;
  doc.save(fileName);
};