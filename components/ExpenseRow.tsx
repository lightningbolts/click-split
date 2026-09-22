import { formatMoney, formatSignedMoney, balanceClass } from '@/lib/balance';

interface ExpenseRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  totalAmount: number;
  userShare: number;
  onClick?: () => void;
}

export default function ExpenseRow({
  icon,
  title,
  subtitle,
  totalAmount,
  userShare,
  onClick,
}: ExpenseRowProps) {
  return (
    <div
      className="expense-row"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="e-icon">
        {icon ?? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="8" y1="16" x2="12" y2="16" />
          </svg>
        )}
      </div>
      <div className="e-body">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
      <div className="e-amt">
        <div className="total tabular">{formatMoney(totalAmount)}</div>
        <div className={`share ${balanceClass(userShare)} tabular`}>
          {formatSignedMoney(userShare)}
        </div>
      </div>
    </div>
  );
}
