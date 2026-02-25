
interface ConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
}

export default function ConfidenceBadge({
  confidence,
  showPercentage = true,
}: ConfidenceBadgeProps) {
  const percentage = Math.round(confidence * 100);

  let colorClass: string;
  let label: string;

  if (confidence >= 0.85) {
    colorClass = 'confidence-high';
    label = 'High';
  } else if (confidence >= 0.5) {
    colorClass = 'confidence-medium';
    label = 'Medium';
  } else {
    colorClass = 'confidence-low';
    label = 'Low';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {/* Confidence dot indicator */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          confidence >= 0.85
            ? 'bg-green-500'
            : confidence >= 0.5
              ? 'bg-yellow-500'
              : 'bg-red-500'
        }`}
      />

      {showPercentage ? (
        <span>{percentage}%</span>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
