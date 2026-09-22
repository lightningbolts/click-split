interface SettleConfirmProps {
  counterpartyName: string;
  groupName: string;
}

export default function SettleConfirm({ counterpartyName, groupName }: SettleConfirmProps) {
  return (
    <div className="settle-confirm">
      <div className="check">✓</div>
      <h3>Settled up</h3>
      <p>{counterpartyName}&apos;s balance in {groupName} is now $0.00</p>
    </div>
  );
}
