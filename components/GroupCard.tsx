import Link from 'next/link';
import { formatSignedMoney, balanceClass, balanceLabel } from '@/lib/balance';

interface GroupCardProps {
  id: string;
  name: string;
  icon: string;
  memberSummary: string;
  balance: number;
}

export default function GroupCard({ id, name, icon, memberSummary, balance }: GroupCardProps) {
  return (
    <Link href={`/group/${id}`} className="group-card">
      <div className="g-icon">{icon}</div>
      <div className="g-body">
        <h3>{name}</h3>
        <p>{memberSummary}</p>
      </div>
      <div className={`g-amt ${balanceClass(balance)} tabular`}>
        {formatSignedMoney(balance)}
        <span className="g-sub">{balanceLabel(balance)}</span>
      </div>
    </Link>
  );
}
