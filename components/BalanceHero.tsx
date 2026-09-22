import { formatMoney } from '@/lib/balance';

interface BalanceHeroProps {
  netBalance: number;
  owedToUser: number;
  userOwes: number;
}

export default function BalanceHero({ netBalance, owedToUser, userOwes }: BalanceHeroProps) {
  const label = netBalance >= 0 ? 'Overall, you\'re owed' : 'Overall, you owe';
  const amountClass = netBalance >= 0 ? 'owed' : 'owes';

  return (
    <div className="balance-hero">
      <div className="label">{label}</div>
      <div className={`amount ${amountClass} tabular`}>{formatMoney(Math.abs(netBalance))}</div>
      <div className="balance-split">
        <div className="cell pos">
          <div className="k">Owed to you</div>
          <div className="v tabular">{formatMoney(owedToUser)}</div>
        </div>
        <div className="cell neg">
          <div className="k">You owe</div>
          <div className="v tabular">{formatMoney(userOwes)}</div>
        </div>
      </div>
    </div>
  );
}
