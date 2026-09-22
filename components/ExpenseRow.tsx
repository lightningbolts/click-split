import { formatMoney, formatSignedMoney, balanceClass } from '@/lib/balance';

interface ExpenseRowProps {
  icon: string;
  title: string;
  subtitle: string;
  totalAmount: number;
  userShare: number;
}

export default function ExpenseRow({ icon, title, subtitle, totalAmount, userShare }: ExpenseRowProps) {
  return (
    <div className="expense-row">
      <div className="e-icon">{icon}</div>
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
