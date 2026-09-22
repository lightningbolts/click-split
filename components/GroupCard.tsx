import Link from 'next/link';
import { formatMoney, formatSignedMoney, balanceClass, balanceLabel } from '@/lib/balance';
import { formatRelativeTime } from '@/lib/dates';

interface LatestExpense {
  description: string;
  amount: number;
  payer: string;
  createdAt: string;
}

interface GroupCardProps {
  id: string;
  name: string;
  icon: string;
  members?: string[];
  memberCount?: number;
  expenseCount?: number;
  totalSpend?: number;
  latestExpense?: LatestExpense | null;
  balance: number;
  /** Legacy fallback */
  memberSummary?: string;
}

export default function GroupCard({
  id,
  name,
  icon,
  members = [],
  memberCount,
  expenseCount = 0,
  totalSpend = 0,
  latestExpense,
  balance,
  memberSummary,
}: GroupCardProps) {
  const displayMemberCount = memberCount ?? (members.length || 1);
  const memberListText = members.length > 0
    ? members.slice(0, 3).join(', ') + (members.length > 3 ? ` +${members.length - 3}` : '')
    : memberSummary ?? `${displayMemberCount} member${displayMemberCount !== 1 ? 's' : ''}`;

  return (
    <div className="group-card">
      {/* Clickable Card Header */}
      <Link href={`/group/${id}`} className="group-card-header-link">
        <div className="g-icon">{icon}</div>
        <div className="g-body">
          <h3 className="g-title">{name}</h3>
          <p className="g-members-sub" title={members.join(', ')}>
            {memberListText}
          </p>
        </div>
        <div className={`g-amt ${balanceClass(balance)} tabular`}>
          {formatSignedMoney(balance)}
          <span className="g-sub">{balanceLabel(balance)}</span>
        </div>
      </Link>

      {/* Metrics Row: Total Spent, Expenses, Members */}
      <div className="group-card-metrics">
        <div className="g-metric-col">
          <span className="g-metric-lbl">TOTAL SPENT</span>
          <span className="g-metric-val tabular">{formatMoney(totalSpend)}</span>
        </div>
        <div className="g-metric-divider" />
        <div className="g-metric-col">
          <span className="g-metric-lbl">EXPENSES</span>
          <span className="g-metric-val tabular">{expenseCount}</span>
        </div>
        <div className="g-metric-divider" />
        <div className="g-metric-col">
          <span className="g-metric-lbl">MEMBERS</span>
          <span className="g-metric-val tabular">{displayMemberCount}</span>
        </div>
      </div>

      {/* Latest Activity Preview */}
      <div className="group-card-activity">
        {latestExpense ? (
          <div className="g-act-row">
            <span className="g-act-badge">LATEST</span>
            <span className="g-act-desc" title={latestExpense.description}>
              {latestExpense.description}
            </span>
            <span className="g-act-cost tabular">{formatMoney(latestExpense.amount)}</span>
            <span className="g-act-meta">
              ({latestExpense.payer}) · {formatRelativeTime(latestExpense.createdAt)}
            </span>
          </div>
        ) : (
          <div className="g-act-row empty">
            <span className="g-act-empty">No expenses yet · Ready to split</span>
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="group-card-footer">
        <Link href={`/group/${id}/add`} className="g-btn-add">
          + Add expense
        </Link>
        <Link href={`/group/${id}`} className="g-btn-view">
          Open group →
        </Link>
      </div>
    </div>
  );
}

