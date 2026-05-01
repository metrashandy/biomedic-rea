export default function ResultCard({ icon, title, content }) {
  let safeContent = content || "-";
  if (typeof content === "object" && content !== null) {
    // Kalau AI ngirim {1: "Pneumonia", 2: "TBC"}, gabungin jadi satu paragraf
    safeContent = Object.entries(content)
      .map(([key, value]) => `${key}. ${value}`)
      .join("\n\n");
  } else if (Array.isArray(content)) {
    safeContent = content.join("\n\n");
  }
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      </div>

      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
        {content}
      </p>
    </div>
  );
}
