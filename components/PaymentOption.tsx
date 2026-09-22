interface PaymentOptionProps {
  icon: string;
  label: string;
  onClick: () => void;
}

export default function PaymentOption({ icon, label, onClick }: PaymentOptionProps) {
  return (
    <button className="pay-opt" onClick={onClick} type="button">
      <div className="p-name">
        <span className="p-icon">{icon}</span>
        {label}
      </div>
      <span className="arrow">→</span>
    </button>
  );
}
