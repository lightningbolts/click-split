'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import ScannedItems, { type ScannedItem } from '@/components/ScannedItems';
import SplitMethodSelector, { type SplitMethod } from '@/components/SplitMethodSelector';
import { formatMoney } from '@/lib/balance';

interface Member {
  userId: string;
  name: string;
}

export default function AddExpensePage() {
  const params = useParams();
  const groupId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('even');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch group members
  useEffect(() => {
    if (authLoading || !user) return;
    setPaidBy(user.id);

    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/split/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(
            (data.members ?? []).map((m: { userId: string; name: string }) => ({
              userId: m.userId,
              name: m.userId === user.id ? 'You' : m.name,
            })),
          );
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    void fetchMembers();
  }, [groupId, user, authLoading]);

  const handleScan = useCallback(async (file: File) => {
    setScanning(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/split/receipt-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Scan failed');
      }

      const data = await res.json();
      const items: ScannedItem[] = (data.items ?? []).map(
        (item: { label: string; price: number }, i: number) => ({
          id: `item-${i}`,
          label: item.label,
          price: item.price,
          assignedTo: 'split',
        }),
      );

      setScannedItems(items);
      setTotalAmount(String(data.detected_total ?? items.reduce((s: number, i: ScannedItem) => s + i.price, 0)));

      if (!description && items.length > 0) {
        setDescription('Scanned receipt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [description]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleScan(file);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !totalAmount || !paidBy) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        groupId,
        description: description.trim(),
        totalAmount: parseFloat(totalAmount),
        paidBy,
        splitMethod,
        source: scannedItems.length > 0 ? 'receipt_scan' : 'manual',
        items: scannedItems.length > 0
          ? scannedItems.map((item) => ({
              label: item.label,
              price: item.price,
              assignedTo: item.assignedTo === 'split' ? null : item.assignedTo,
            }))
          : undefined,
      };

      const res = await fetch('/api/split/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create expense');
      }

      router.push(`/group/${groupId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  const total = parseFloat(totalAmount) || 0;
  const hasItems = scannedItems.length > 0;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="form-container" style={{ maxWidth: '720px', flex: 1 }}>
        <div className="form-card">
          <div className="sheet">
            <div className="sheet-head">
              <h2>Add expense</h2>
              <Link href={`/group/${groupId}`} className="x" aria-label="Close">×</Link>
            </div>

        {/* Scan box */}
        <div className="scan-box">
          <div className="cam">📷</div>
          <h3>Scan a receipt</h3>
          <p>Photograph it and Click Split pulls out every item and price for you.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
          >
            {scanning ? 'Scanning…' : 'Take photo'}
          </button>
        </div>

        <div className="or-divider">OR ENTER MANUALLY</div>

        {/* Manual fields */}
        <div className="field">
          <label htmlFor="expense-description">What was it for?</label>
          <input
            id="expense-description"
            type="text"
            placeholder="e.g. Trader Joe's run"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="expense-amount">Total amount</label>
          <input
            id="expense-amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="$0.00"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </div>

        {/* Scanned items */}
        {hasItems && (
          <ScannedItems
            items={scannedItems}
            members={members.map((m) => ({ id: m.userId, name: m.name }))}
            onChange={setScannedItems}
          />
        )}

        {/* Paid by */}
        <div className="field">
          <label htmlFor="paid-by">Paid by</label>
          <select
            id="paid-by"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Split method */}
        <div className="field">
          <label>Split</label>
        </div>
        <SplitMethodSelector
          value={splitMethod}
          onChange={setSplitMethod}
          hasItems={hasItems}
        />

        {error && (
          <div style={{ margin: '0 20px 14px', color: 'var(--red)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="sheet-cta">
          <button
            className="btn btn-primary btn-block"
            onClick={handleSubmit}
            disabled={submitting || !description.trim() || total <= 0}
          >
            {submitting ? 'Adding…' : `Add expense · ${formatMoney(total)}`}
          </button>
        </div>
      </div>
    </div>
  </main>
</div>
  );
}
