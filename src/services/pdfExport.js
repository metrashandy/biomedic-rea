import jsPDF from "jspdf";

// Fungsi Helper: Ambil Base64 dari File atau URL (Biar anti-crash)
const getImageData = async (source) => {
  if (!source) return null;
  if (typeof source !== "string") {
    // Jika source adalah File Object (Upload)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(source);
    });
  }
  // Jika source adalah URL (Database)
  const resp = await fetch(source);
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

export const exportToPDF = async (
  records, // Sekarang nerima ARRAY of records
  patientData = null, // Opsional: buat nambahin nama pasien di atas
) => {
  // Jika yang dikirim cuma satu objek (bukan array), jadiin array
  const dataToPrint = Array.isArray(records) ? records : [records];

  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * margin;

  // ================= CLEAN TEXT (Punya Lu) =================
  const cleanText = (text) => {
    return text
      ?.toString()
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\t/g, " ")
      .replace(/[^ -~]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // ================= TEXT WRAPPER (Punya Lu) =================
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

  // ================= RENDER IMAGE (Punya Lu) =================
  const renderImage = (base64Img, format = "JPEG") => {
    if (!base64Img) return;
    const imgProps = doc.getImageProperties(base64Img);
    const maxWidth = 110;
    const maxHeight = 80;
    let imgWidth = maxWidth;
    let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = (imgProps.width * imgHeight) / imgProps.height;
    }
    if (yPos + imgHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
    const xPos = (pageWidth - imgWidth) / 2;
    doc.addImage(base64Img, format, xPos, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 10;
  };

  // ================= GENERATE DOCTOR IMAGE (Punya Lu) =================
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
        boxes.forEach((box) => {
          ctx.strokeRect(box.x, box.y, box.width, box.height);
        });
        resolve(canvas.toDataURL("image/jpeg"));
      };
    });
  };

  // ================= LOOPING MULAI DI SINI =================
  for (let i = 0; i < dataToPrint.length; i++) {
    const item = dataToPrint[i];
    if (i > 0) {
      doc.addPage();
      yPos = 20;
    }

    // Header Laporan
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
    const originalImgBase64 = await getImageData(
      item.selectedFile || item.gambar_asli_url,
    );
    doc.setFont("helvetica", "bold");
    doc.text("1. Gambar Asli", margin, yPos);
    yPos += 5;
    renderImage(originalImgBase64);

    // 2. AI Segmentation
    if (item.result?.segmentation_image || item.gambar_hasil_url) {
      const aiImg = item.result?.segmentation_image
        ? `data:image/jpeg;base64,${item.result.segmentation_image}`
        : item.gambar_hasil_url;
      const aiImgBase64 = await getImageData(aiImg);
      doc.setFont("helvetica", "bold");
      doc.text("2. Segmentasi AI", margin, yPos);
      yPos += 5;
      renderImage(aiImgBase64);
    }

    // 3. Dokter Mark
    if (item.doctorBoxes && item.doctorBoxes.length > 0) {
      const docImgBase64 = await generateDoctorImage(
        originalImgBase64,
        item.doctorBoxes,
      );
      doc.setFont("helvetica", "bold");
      doc.text("3. Segmentasi Dokter", margin, yPos);
      yPos += 5;
      renderImage(docImgBase64);
    }

    // 4. Medical Analysis (Persis Format Lu)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Medical Analysis", margin, yPos);
    yPos += 8;

    const section = (title) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, margin, yPos);
      yPos += 6;
    };

    section("1. Temuan");
    addWrappedText(
      item.result?.result?.findings || item.ai_result?.findings || "-",
    );

    section("2. Potensi Kelainan");
    addWrappedText(
      item.result?.result?.abnormality || item.ai_result?.abnormality || "-",
    );

    section("3. Tingkat Risiko");
    addWrappedText(
      `Overall Risk: ${item.result?.result?.risk || item.ai_result?.risk || 0}%`,
    );

    section("4. Rekomendasi");
    const rec =
      item.result?.result?.recommendation || item.ai_result?.recommendation;
    addWrappedText(`Pendekatan: ${rec?.approach || "-"}`);
    addWrappedText(`Penanganan: ${rec?.treatment || "-"}`);

    section("5. Disclaimer");
    addWrappedText(
      "Hasil ini tidak menggantikan diagnosis medis profesional.",
      { fontSize: 9, color: [120, 120, 120] },
    );

    section("6. Catatan Dokter");
    addWrappedText(`Temuan: ${item.doctorNotes?.temuan || "-"}`);
    addWrappedText(`Penyakit: ${item.doctorNotes?.penyakit || "-"}`);
    addWrappedText(`Risiko: ${item.doctorNotes?.risiko || "-"}`);
    addWrappedText(`Rekomendasi: ${item.doctorNotes?.rekomendasi || "-"}`);
  }

  doc.save(`Laporan_Medis_${new Date().getTime()}.pdf`);
};
