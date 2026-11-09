import React, { useEffect, useState } from 'react';
import { ordersService } from '../services/api';

// This is a demo order summary, not a payment or tax certificate.
export default function ReceiptInvoiceModal({ order, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    ordersService.getReceipt(order._id).then((result) => {
      if (!active) return;
      if (result?.success && result.receipt) setReceipt(result.receipt);
      else setError(result?.message || 'Receipt unavailable.');
    }).catch(() => { if (active) setError('Receipt unavailable. Check the connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [order._id]);

  const download = () => {
    const lines = [
      'CROPGUARD DEMO ORDER RECEIPT',
      'Demo only: payment states are simulated; no payment is transferred.',
      `Receipt: ${receipt.receiptNumber}`, `Order: ${receipt.orderNumber}`,
      `Order status: ${receipt.orderStatus}`, `Payment status: ${receipt.paymentStatus} (simulated)`,
      `Farmer: ${receipt.seller?.name || 'Unknown'}`, `Buyer: ${receipt.buyer?.name || 'Unknown'}`,
      ...(receipt.items || []).map((item) => `${item.description}: ${item.quantity} ${item.unit} at ₹${item.unitRate} = ₹${item.total}`),
      `Order total: ₹${receipt.financialBreakdown?.grandTotal ?? 0}`
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${receipt.receiptNumber}.txt`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Demo receipt">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-6 text-slate-100 shadow-xl">
        <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">Demo order receipt</h2><button onClick={onClose} aria-label="Close receipt">✕</button></div>
        <p className="my-4 rounded bg-amber-950 p-3 text-amber-200">Demo only: payment and settlement statuses are simulated. No money is transferred.</p>
        {loading && <p>Loading receipt…</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {receipt && <div className="space-y-2">
          <p>Receipt: {receipt.receiptNumber}</p><p>Order: {receipt.orderNumber}</p>
          <p>Order status: {receipt.orderStatus}</p><p>Payment status: {receipt.paymentStatus} (simulated)</p>
          <p>Farmer: {receipt.seller?.name || 'Unknown'}</p><p>Buyer: {receipt.buyer?.name || 'Unknown'}</p>
          {(receipt.items || []).map((item, index) => <p key={index}>{item.description}: {item.quantity} {item.unit} × ₹{item.unitRate} = ₹{item.total}</p>)}
          <p className="font-bold">Order total: ₹{receipt.financialBreakdown?.grandTotal ?? 0}</p>
          <div className="flex gap-3 pt-4"><button className="rounded bg-emerald-500 px-4 py-2 text-slate-950" onClick={() => window.print()}>Print</button><button className="rounded bg-slate-700 px-4 py-2" onClick={download}>Download summary</button></div>
        </div>}
      </div>
    </div>
  );
}
