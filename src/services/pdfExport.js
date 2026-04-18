import jsPDF from "jspdf";

export const exportToPDF = async (
  result,
  selectedFile,
  doctorBoxes,
  imagePreview,
  doctorNotes,
) => {
  if (!result || !selectedFile) return;

  const doc = new jsPDF("p", "mm", "a4");

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - 2 * margin;

  let yPos = 20;

  // ================= CLEAN TEXT =================
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

  // ================= TEXT =================
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

    const lines = doc.splitTextToSize(cleanText(text), usableWidth);

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

  // ================= IMAGE =================
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

    // pindah halaman kalau kepotong
    if (yPos + imgHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    const xPos = (pageWidth - imgWidth) / 2;

    doc.addImage(base64Img, format, xPos, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 10;
  };

  // ================= GENERATE DOCTOR IMAGE =================
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
        ctx.lineWidth = 3;

        boxes.forEach((box) => {
          ctx.strokeRect(box.x, box.y, box.width, box.height);
        });

        resolve(canvas.toDataURL("image/jpeg"));
      };
    });
  };

  // ================= HEADER =================
  const now = new Date();

  const reportId = `BR-${now.getFullYear()}${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
    now.getHours(),
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LAPORAN RADIOLOGI MEDIS", pageWidth / 2, yPos, {
    align: "center",
  });

  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Report ID: ${reportId}`, pageWidth / 2, yPos, {
    align: "center",
  });

  yPos += 15;

  // ================= RENDER SEMUA GAMBAR =================
  const renderAllImages = async () => {
    // ORIGINAL
    const reader = new FileReader();

    const originalImage = await new Promise((resolve) => {
      reader.readAsDataURL(selectedFile);
      reader.onloadend = () => resolve(reader.result);
    });

    doc.setFont("helvetica", "bold");

    doc.text("1. Gambar Asli", margin, yPos);
    yPos += 5;
    renderImage(originalImage);

    // AI
    if (result.segmentation_image) {
      doc.text("2. Segmentasi AI", margin, yPos);
      yPos += 5;

      renderImage(`data:image/jpeg;base64,${result.segmentation_image}`);
    }

    // DOKTER
    if (doctorBoxes && doctorBoxes.length > 0) {
      const doctorImg = await generateDoctorImage(imagePreview, doctorBoxes);

      doc.text("3. Segmentasi Dokter", margin, yPos);
      yPos += 5;

      renderImage(doctorImg);
    }

    // ================= ANALYSIS =================
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
    addWrappedText(result?.result?.findings || "-");

    section("2. Potensi Kelainan");
    addWrappedText(result?.result?.abnormality || "-");

    section("3. Tingkat Risiko");
    addWrappedText(`Overall Risk: ${result?.result?.risk ?? "-"}%`);

    section("4. Rekomendasi");
    addWrappedText(
      `Pendekatan: ${result?.result?.recommendation?.approach || "-"}`,
    );
    addWrappedText(
      `Penanganan: ${result?.result?.recommendation?.treatment || "-"}`,
    );

    section("5. Disclaimer");
    addWrappedText(
      result?.result?.disclaimer ||
        "Hasil ini tidak menggantikan diagnosis medis profesional.",
      { fontSize: 9, color: [120, 120, 120] },
    );
    section("6. Catatan Dokter");

    addWrappedText(`Temuan: ${doctorNotes?.temuan || "-"}`);

    addWrappedText(`Penyakit: ${doctorNotes?.penyakit || "-"}`);

    addWrappedText(`Risiko: ${doctorNotes?.risiko || "-"}`);

    addWrappedText(`Rekomendasi: ${doctorNotes?.rekomendasi || "-"}`);

    doc.save(`Medical_Report_${reportId}.pdf`);
  };

  await renderAllImages();
};
