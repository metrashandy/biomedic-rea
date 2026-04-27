import { Activity } from "lucide-react";

export default function RiskCard({ percentage, factors }) {
  const getRiskCategory = (risk) => {
    if (risk > 70) return "Berat";
    if (risk > 30) return "Sedang";
    return "Ringan";
  };

  const getRiskColor = (risk) => {
    if (risk > 70) return "text-red-600";
    if (risk > 30) return "text-yellow-500";
    return "text-green-600";
  };

  const safePercentage = Number(percentage) || 0;
  const category = getRiskCategory(safePercentage);
  const color = getRiskColor(safePercentage);

  const riskColor =
    safePercentage > 70
      ? "bg-red-500"
      : safePercentage > 30
        ? "bg-yellow-500"
        : "bg-green-500";

  const riskTextColor =
    safePercentage > 70
      ? "text-red-600"
      : safePercentage > 30
        ? "text-yellow-600"
        : "text-green-600";

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border h-full">
      <div className="flex items-center gap-3 mb-3">
        <Activity />
        <h3 className="text-xl font-bold text-slate-800">Tingkat Risiko</h3>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-5 my-2">
        <div
          className={`${riskColor} h-5 rounded-full`}
          style={{ width: `${safePercentage}%` }}
        ></div>
      </div>

      <div className="flex flex-col items-start">
        <p className={`text-2xl font-bold ${color}`}>{percentage}%</p>
        <p className="mt-1 text-lg font-semibold text-slate-700">
          Kategori:{" "}
          <span className={`ml-2 text-xl font-bold ${color}`}>{category}</span>
        </p>
      </div>

      {factors && (
        <div className="mt-4 text-sm text-slate-600 space-y-1">
          <p>
            <b>Perhitungan:</b>
          </p>
          <p>• Area: {factors?.area || "-"}</p>
          <p>• Jumlah area: {factors?.region_count || "-"}</p>
          <p>• Intensitas: {factors?.intensity || "-"}</p>
          <p className="italic text-slate-500">
            → {factors?.calculation || "-"}
          </p>
        </div>
      )}
    </div>
  );
}
