export default function DisclaimerCard({ content }) {
  return (
    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
      <p className="text-sm text-yellow-800">
        <span className="font-bold">Disclaimer:</span> {content}
      </p>
    </div>
  );
}
