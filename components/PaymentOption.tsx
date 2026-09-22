interface PaymentOptionProps {
  icon: string;
  label: string;
  subtitle?: string;
  badgeColor?: string;
  onClick: () => void;
}

export default function PaymentOption({
  icon,
  label,
  subtitle,
  badgeColor,
  onClick,
}: PaymentOptionProps) {
  return (
    <button className="pay-opt" onClick={onClick} type="button">
      <div className="p-name">
        <span
          className="p-icon"
          style={badgeColor ? { borderColor: 'var(--ink)' } : undefined}
        >
          {icon}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
          <span style={{ fontWeight: 800 }}>{label}</span>
          {subtitle && (
            <span style={{ fontSize: '11px', color: 'var(--grey)', fontWeight: 600 }}>{subtitle}</span>
          )}
        </div>
      </div>
      <span className="arrow">→</span>
    </button>
  );
}
