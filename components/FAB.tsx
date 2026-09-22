interface FABProps {
  onClick: () => void;
  ariaLabel?: string;
}

export default function FAB({ onClick, ariaLabel = 'Add expense' }: FABProps) {
  return (
    <div className="fab">
      <button
        type="button"
        className="fab-btn"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
