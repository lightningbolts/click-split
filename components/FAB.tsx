import Link from 'next/link';

interface FABProps {
  href: string;
}

export default function FAB({ href }: FABProps) {
  return (
    <div className="fab">
      <Link href={href} className="fab-btn" aria-label="Add expense">
        +
      </Link>
    </div>
  );
}
