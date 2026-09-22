'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import ScannedItems, { ScannedItem } from '@/components/ScannedItems';
import SplitMethodSelector from '@/components/SplitMethodSelector';
import { formatMoney } from '@/lib/balance';

interface Member {
  userId: string;
  name: string;
  image: string | null;
}

export default function AddExpensePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitMethod, setSplitMethod] = useState<'even' | 'by_item' | 'custom_percent'>('even');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  // Tax & Tip
  const [taxInput, setTaxInput] = useState<string>('0');
  const [tipPreset, setTipPreset] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});

  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/split/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          const mems = (data.members ?? []).map((m: { userId: string; name: string; image: string | null }) => ({
            userId: m.userId,
            name: m.name,
            image: m.image,
          }));
          setMembers(mems);
          setCustomPercentages((current) => {
            if (mems.length === 0 || Object.keys(current).length > 0) return current;
            const base = Math.floor((10000 / mems.length)) / 100;
            let assigned = 0;
            const next: Record<string, string> = {};
            mems.forEach((member: Member, index: number) => {
              const pct = index === mems.length - 1 ? Math.round((100 - assigned) * 100) / 100 : base;
              next[member.userId] = pct.toFixed(2);
              assigned += pct;
            });
            return next;
          });
          if (mems.length > 0 && !paidBy) {
            const current = mems.find((m: Member) => m.userId === user.id);
            setPaidBy(current ? current.userId : mems[0].userId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    void fetchMembers();
  }, [groupId, user, authLoading, paidBy]);

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

      // 1. Upload receipt to permanent Supabase Storage
      try {
        const uploadRes = await fetch('/api/split/receipt-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            setReceiptImageUrl(uploadData.url);
          }
        }
      } catch (uploadErr) {
        console.warn('Storage upload fallback warning:', uploadErr);
      }

      // 2. Scan OCR items
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
      setSplitMethod('by_item');
      const detected = Number(data.detected_total ?? items.reduce((s: number, i: ScannedItem) => s + i.price, 0));
      setTotalAmount(detected.toFixed(2));

      if (data.tax && (!taxInput || taxInput === '0')) {
        setTaxInput(Number(data.tax).toFixed(2));
      }

      if (data.merchant) {
        setDescription(data.merchant);
      } else if (!description && items.length > 0) {
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

  // Recalculate total if items + tax + tip are modified
  const itemsSubtotal = scannedItems.reduce((sum, item) => sum + Number(item.price), 0);
  const taxVal = parseFloat(taxInput) || 0;
  const tipVal = customTip ? parseFloat(customTip) || 0 : (itemsSubtotal * tipPreset) / 100;

  useEffect(() => {
    if (scannedItems.length > 0) {
      const computedTotal = itemsSubtotal + taxVal + tipVal;
      setTotalAmount(computedTotal.toFixed(2));
    }
  }, [itemsSubtotal, taxVal, tipVal, scannedItems.length]);

  const handleSubmit = async () => {
    if (!description.trim() || !totalAmount || !paidBy) {
      setError('Please fill in all required fields.');
      return;
    }

    if (splitMethod === 'custom_percent') {
      const totalPercent = members.reduce(
        (sum, member) => sum + (parseFloat(customPercentages[member.userId] ?? '0') || 0),
        0,
      );
      if (Math.abs(totalPercent - 100) > 0.01) {
        setError(`Custom percentages must add up to 100% (currently ${totalPercent.toFixed(2)}%).`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build final items array (including tax and tip if items exist)
      let finalItems = scannedItems.map((item) => ({
        label: item.label,
        price: item.price,
        assignedTo: item.assignedTo === 'split' ? null : item.assignedTo,
      }));

      if (scannedItems.length > 0) {
        if (taxVal > 0) {
          finalItems.push({
            label: 'Tax',
            price: Math.round(taxVal * 100) / 100,
            assignedTo: null,
          });
        }
        if (tipVal > 0) {
          finalItems.push({
            label: `Tip (${customTip ? '$' + customTip : tipPreset + '%'})`,
            price: Math.round(tipVal * 100) / 100,
            assignedTo: null,
          });
        }
      }

      const body = {
        groupId,
        description: description.trim(),
        totalAmount: parseFloat(totalAmount),
        paidBy,
        splitMethod,
        source: scannedItems.length > 0 ? 'receipt_scan' : 'manual',
        receiptImageUrl: receiptImageUrl ?? undefined,
        items: finalItems.length > 0 ? finalItems : undefined,
        customPercentages: splitMethod === 'custom_percent'
          ? Object.fromEntries(
              members.map((member) => [
                member.userId,
                parseFloat(customPercentages[member.userId] ?? '0') || 0,
              ]),
            )
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
              <div className="cam" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
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
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? 'Scanning & saving photo…' : 'Take photo'}
              </button>

              {receiptImageUrl && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--green)', fontWeight: 800 }}>
                  ✓ Receipt photo archived to cloud
                </div>
              )}
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
              <>
                <ScannedItems
                  items={scannedItems}
                  members={members.map((m) => ({ id: m.userId, name: m.name }))}
                  onChange={setScannedItems}
                />

                {/* Tax and Tip Section */}
                <div
                  style={{
                    margin: '16px 0',
                    padding: '16px',
                    border: '2px solid var(--ink)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--paper-dim)',
                  }}
                >
                  <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>
                    Tax & Tip Distribution
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        Tax ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxInput}
                        onChange={(e) => setTaxInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1.5px solid var(--ink)',
                          fontSize: '13px',
                          background: 'var(--white)',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        Tip (% or $)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Custom $"
                        value={customTip}
                        onChange={(e) => {
                          setCustomTip(e.target.value);
                          setTipPreset(0);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1.5px solid var(--ink)',
                          fontSize: '13px',
                          background: 'var(--white)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Preset Tip Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[0, 15, 18, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipPreset(pct);
                          setCustomTip('');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: '1.5px solid var(--ink)',
                          background: tipPreset === pct && !customTip ? 'var(--ink)' : 'var(--white)',
                          color: tipPreset === pct && !customTip ? 'var(--white)' : 'var(--ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {pct === 0 ? 'No Tip' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
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

            {splitMethod === 'custom_percent' && (
              <div style={{ margin: '0 24px 20px', border: '2px solid var(--ink)', background: 'var(--paper-dim)' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1.5px solid var(--ink)', fontSize: '12px', fontWeight: 800 }}>
                  Custom percentages
                </div>
                {members.map((member) => (
                  <label
                    key={member.userId}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderBottom: '1px solid var(--paper)' }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{member.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={customPercentages[member.userId] ?? ''}
                        onChange={(e) => setCustomPercentages((current) => ({ ...current, [member.userId]: e.target.value }))}
                        style={{ width: '88px', padding: '8px', border: '1.5px solid var(--ink)', textAlign: 'right', fontWeight: 700 }}
                        aria-label={`${member.name} percentage`}
                      />
                      <span style={{ fontWeight: 800 }}>%</span>
                    </span>
                  </label>
                ))}
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800 }}>
                  <span>Total</span>
                  <span>
                    {members.reduce((sum, member) => sum + (parseFloat(customPercentages[member.userId] ?? '0') || 0), 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div style={{ margin: '0 20px 14px', color: 'var(--red)', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div className="sheet-cta">
              <button
                type="button"
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
