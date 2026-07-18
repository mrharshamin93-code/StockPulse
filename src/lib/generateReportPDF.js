import { jsPDF } from "jspdf";

const DARK = [15, 15, 20];
const ACCENT = [99, 102, 241]; // indigo
const GREEN = [34, 197, 94];
const RED = [239, 68, 68];
const LIGHT_BG = [248, 248, 252];
const CARD_BG = [255, 255, 255];
const BORDER = [230, 230, 240];
const MUTED = [120, 120, 140];

function fmt(n, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

function fmtPct(n) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function drawRoundedRect(doc, x, y, w, h, r, fillColor, strokeColor) {
  if (fillColor) { doc.setFillColor(...fillColor); }
  if (strokeColor) { doc.setDrawColor(...strokeColor); } else { doc.setDrawColor(0, 0, 0, 0); }
  doc.roundedRect(x, y, w, h, r, r, fillColor ? (strokeColor ? "FD" : "F") : "D");
}

export async function generateReportPDF({ user, stocks, transactions, currency = "USD" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 110, "F");

  // Accent stripe
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 6, 110, "F");

  // Logo circle
  doc.setFillColor(...ACCENT);
  doc.circle(52, 55, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SP", 52, 61, { align: "center" });

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("StockPulse", 86, 48);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 210);
  doc.text("Portfolio Performance Report", 86, 66);
  doc.text(month, 86, 82);

  // Right side: user info
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 210);
  doc.text(user.full_name || "Investor", W - 32, 48, { align: "right" });
  doc.setFontSize(9);
  doc.text(user.email || "", W - 32, 63, { align: "right" });
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, W - 32, 78, { align: "right" });

  // ── PORTFOLIO SUMMARY CARDS ───────────────────────────────────────────────
  const totalValue = stocks.reduce((s, st) => s + (st.current_price || 0) * st.quantity, 0);
  const totalCost = stocks.reduce((s, st) => s + st.purchase_price * st.quantity, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const isPositive = totalGain >= 0;

  let y = 128;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("PORTFOLIO OVERVIEW", 32, y);

  y += 14;
  const cardW = (W - 64 - 24) / 3;
  const cards = [
    { label: "Total Value", value: fmt(totalValue, currency), color: ACCENT },
    { label: "Cost Basis", value: fmt(totalCost, currency), color: MUTED },
    { label: "Total P&L", value: `${isPositive ? "+" : ""}${fmt(totalGain, currency)}`, sub: fmtPct(totalGainPct), color: isPositive ? GREEN : RED },
  ];

  cards.forEach((card, i) => {
    const cx = 32 + i * (cardW + 12);
    drawRoundedRect(doc, cx, y, cardW, 72, 8, CARD_BG, BORDER);

    // Color bar top
    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, 4, 2, 2, "F");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), cx + 14, y + 22);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(card.value, cx + 14, y + 44);

    if (card.sub) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...card.color);
      doc.text(card.sub, cx + 14, y + 58);
    }
  });

  // ── HOLDINGS TABLE ────────────────────────────────────────────────────────
  y += 90;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("HOLDINGS", 32, y);

  y += 12;
  // Table header
  doc.setFillColor(...DARK);
  doc.roundedRect(32, y, W - 64, 24, 4, 4, "F");

  const cols = [
    { label: "Ticker", x: 46, w: 60 },
    { label: "Company", x: 110, w: 140 },
    { label: "Shares", x: 255, w: 55 },
    { label: "Avg Cost", x: 312, w: 70 },
    { label: "Curr. Price", x: 385, w: 70 },
    { label: "Value", x: 458, w: 70 },
    { label: "P&L", x: 530, w: 65 },
  ];

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  cols.forEach(c => doc.text(c.label, c.x, y + 15.5));

  y += 24;
  stocks.forEach((s, i) => {
    const rowH = 30;
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(32, y, W - 64, rowH, "F");
    }

    const val = (s.current_price || 0) * s.quantity;
    const cost = s.purchase_price * s.quantity;
    const gain = val - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const gainColor = gain >= 0 ? GREEN : RED;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(s.ticker, cols[0].x, y + 12);

    // Ticker badge
    doc.setFillColor(...ACCENT);
    doc.setFillColor(235, 235, 255);
    doc.roundedRect(cols[0].x - 2, y + 3, 38, 14, 3, 3, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ACCENT);
    doc.text(s.ticker, cols[0].x + 19 - 2, y + 12.5, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const companyName = s.company_name.length > 22 ? s.company_name.slice(0, 20) + "…" : s.company_name;
    doc.text(companyName, cols[1].x, y + 12);
    doc.text(String(s.quantity), cols[2].x, y + 12);
    doc.text(fmt(s.purchase_price, currency), cols[3].x, y + 12);
    doc.text(s.current_price ? fmt(s.current_price, currency) : "—", cols[4].x, y + 12);
    doc.text(fmt(val, currency), cols[5].x, y + 12);

    // P&L cell with color
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gainColor);
    doc.text(`${gain >= 0 ? "+" : ""}${fmt(gain, currency)}`, cols[6].x, y + 10);
    doc.setFontSize(7.5);
    doc.text(fmtPct(gainPct), cols[6].x, y + 21);

    // bottom border
    doc.setDrawColor(...BORDER);
    doc.line(32, y + rowH, W - 32, y + rowH);

    y += rowH;
  });

  // ── TRANSACTION TIMELINE ──────────────────────────────────────────────────
  y += 24;
  if (y > H - 160) {
    doc.addPage();
    y = 48;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("TRANSACTION TIMELINE", 32, y);

  y += 16;

  if (transactions.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...MUTED);
    doc.text("No transactions recorded yet.", 32, y);
    y += 20;
  } else {
    const timelineX = 56; // center of dots
    const lineX = timelineX;

    // Draw vertical line
    const lineTop = y;
    const lineBottom = y + transactions.length * 44;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(1.5);
    doc.line(lineX, lineTop, lineX, Math.min(lineBottom, H - 60));
    doc.setLineWidth(1);

    transactions.forEach((t, i) => {
      if (y > H - 60) {
        doc.addPage();
        y = 48;
        // Re-draw vertical line on new page
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(1.5);
        doc.line(lineX, y, lineX, y + (transactions.length - i) * 44);
        doc.setLineWidth(1);
      }

      const isBuy = t.type === "buy";
      const dotColor = isBuy ? GREEN : RED;
      const date = new Date(t.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      // Dot
      doc.setFillColor(...dotColor);
      doc.circle(lineX, y + 8, 5, "F");

      // Card
      const cardX = timelineX + 18;
      const cardW2 = W - cardX - 32;
      drawRoundedRect(doc, cardX, y, cardW2, 36, 6, CARD_BG, BORDER);

      // Left accent
      doc.setFillColor(...dotColor);
      doc.roundedRect(cardX, y, 4, 36, 2, 2, "F");

      // Badge
      doc.setFillColor(isBuy ? [220, 252, 231] : [254, 226, 226]);
      doc.roundedRect(cardX + 12, y + 8, 28, 14, 3, 3, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dotColor);
      doc.text(isBuy ? "BUY" : "SELL", cardX + 26, y + 17.5, { align: "center" });

      // Ticker
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(t.ticker, cardX + 48, y + 17);

      // Details
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(`${t.quantity} shares @ ${fmt(t.price, currency)}`, cardX + 48, y + 29);

      // Total & date on right
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(fmt(t.total || t.price * t.quantity, currency), W - 36, y + 17, { align: "right" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(date, W - 36, y + 29, { align: "right" });

      y += 44;
    });
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, H - 36, W, 36, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("StockPulse · Portfolio Performance Report · Market data may be delayed. Not financial advice.", 32, H - 18);
    doc.text(`Page ${p} of ${pageCount}`, W - 32, H - 18, { align: "right" });
  }

  return doc.output("arraybuffer");
}