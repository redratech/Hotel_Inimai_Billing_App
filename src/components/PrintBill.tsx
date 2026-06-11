import { HOTEL_INFO, formatINR, formatDateTime, type CartLine } from "@/lib/db";

export function printBill() {
  window.print();
}

export function PrintBill({
  billNumber,
  createdAt,
  lines,
  total,
}: {
  billNumber: string;
  createdAt: string;
  lines: { item_name: string; quantity: number; price: number }[] | CartLine[];
  total: number;
}) {
  return (
    <div className="print-area hidden print:block" style={{ fontFamily: "monospace", color: "#000", padding: 12, width: "80mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{HOTEL_INFO.name}</div>
        <div style={{ fontSize: 11 }}>{HOTEL_INFO.address}</div>
        <div style={{ fontSize: 11 }}>Ph: {HOTEL_INFO.phone}</div>
      </div>
      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", fontSize: 12 }}>
        <div>Bill: <b>{billNumber}</b></div>
        <div>Date: {formatDateTime(createdAt)}</div>
      </div>
      <table style={{ width: "100%", fontSize: 12, marginTop: 6 }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000" }}>
            <th style={{ textAlign: "left" }}>Item</th>
            <th style={{ textAlign: "center" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Price</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{l.item_name}</td>
              <td style={{ textAlign: "center" }}>{l.quantity}</td>
              <td style={{ textAlign: "right" }}>{Number(l.price).toFixed(2)}</td>
              <td style={{ textAlign: "right" }}>{(l.quantity * Number(l.price)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px dashed #000", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
        <span>GRAND TOTAL</span>
        <span>{formatINR(total)}</span>
      </div>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12 }}>
        — Thank You. Visit Again —
      </div>
    </div>
  );
}