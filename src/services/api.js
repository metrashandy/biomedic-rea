// src/services/api.js

export const analyzeImage = async (file, symptoms) => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("symptoms", symptoms);

  const response = await fetch("http://127.0.0.1:8000/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.result || !data.result.findings) {
    throw new Error("Gambar tidak dapat dianalisis (bukan X-ray)");
  }

  return data;
};