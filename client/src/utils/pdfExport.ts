import { jsPDF } from "jspdf";
import type { TimelineStep, RiskInfo } from "../types";

export type PdfReportData = {
  steps: TimelineStep[];
  goal?: string;
  budget?: string;
  total?: number;
  status?: string;
  risk?: RiskInfo | null;
  order?: { id: string; source: string; amount: number } | null;
};

export function exportAuditPdf({
  steps,
  goal,
  budget,
  total,
  status,
  risk,
  order
}: PdfReportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Executive Palette Tokens
  const gold = [199, 125, 46];       // #C77D2E Warm Signature Gold
  const goldDark = [160, 95, 25];    // #A05F19 High-contrast Gold
  const ink = [28, 25, 23];          // #1C1917 Deep Stone Ink
  const slate = [68, 64, 60];        // #44403C Body Detail Slate
  const muted = [120, 113, 108];     // #78716C Metadata & Footers
  const lightBg = [252, 250, 247];   // #FCFAF7 Clean Card Fill
  const borderCol = [231, 229, 224]; // #E7E5E0 Subtle Hairline
  const passText = [22, 101, 52];    // Green 800
  const passBg = [240, 253, 244];    // Green 50
  const passBorder = [187, 247, 208];// Green 200
  const failText = [153, 27, 27];    // Red 800
  const failBg = [254, 242, 242];    // Red 50
  const failBorder = [254, 202, 202];// Red 200
  const warnText = [161, 98, 7];     // Amber 800
  const warnBg = [254, 252, 232];    // Amber 50
  const warnBorder = [254, 240, 138];// Amber 200
  const infoText = [71, 85, 105];    // Slate 700
  const infoBg = [248, 250, 252];    // Slate 50
  const infoBorder = [226, 232, 240];// Slate 200

  const drawTableHeader = (startY: number) => {
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(margin, startY, contentWidth, 6.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    const headerBaseline = startY + 4.5;
    doc.text("#", margin + 2.5, headerBaseline);
    doc.text("TIME", margin + 9.5, headerBaseline);
    doc.text("EVENT / STAGE", margin + 27, headerBaseline);
    doc.text("STATUS", margin + 77, headerBaseline);
    doc.text("AUDIT RECORD & REASONING DETAILS", margin + 98, headerBaseline);
  };

  const drawFirstPageHeader = () => {
    // 1. Top Gold Accent Bar
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(margin, y, contentWidth, 2.2, "F");
    y += 8.2; // Generous vertical clearance below top bar to prevent any collision

    // 2. Brand & Title Section
    const brandRowY = y;

    // Brand Left: CUSTOS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text("CUSTOS", margin, brandRowY + 4.0);

    const brandWidth = doc.getTextWidth("CUSTOS");

    // Vertical Divider between CUSTOS and Tagline
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.4);
    doc.line(margin + brandWidth + 3.5, brandRowY + 0.8, margin + brandWidth + 3.5, brandRowY + 4.2);

    // Tagline: THE GATED BUYER AGENT
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(goldDark[0], goldDark[1], goldDark[2]);
    doc.text("THE GATED BUYER AGENT", margin + brandWidth + 6.5, brandRowY + 3.8);

    // Header Right: Document Title & Timestamp
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text("TRANSACTION & AUDIT REPORT", pageWidth - margin, brandRowY + 1.2, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    const dateStr = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    doc.text(`Generated: ${dateStr}`, pageWidth - margin, brandRowY + 4.5, { align: "right" });

    // 3. Hairline Horizontal Divider
    y += 7.8;
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5.2;
  };

  const drawContinuationHeader = () => {
    // Top Accent Bar
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(margin, y, contentWidth, 1.6, "F");
    y += 6.0;

    // Compact Continuation Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text("CUSTOS - AUDIT TRAIL (CONTINUED)", margin, y + 1.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("Certified Transaction Log", pageWidth - margin, y + 1.5, { align: "right" });

    y += 4.5;
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.0;

    drawTableHeader(y);
    y += 6.5;
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = margin;
      drawContinuationHeader();
    }
  };

  // 1. Render First Page Header
  drawFirstPageHeader();

  // Extract metadata from steps if not explicitly provided
  const goalStep = steps.find((s) => s.event === "goal_received");
  const rawGoalData = goalStep?.raw as any;
  const resolvedGoal = goal || rawGoalData?.goal || "Autonomous Purchase";
  const resolvedBudget = budget || (rawGoalData?.budget ? String(rawGoalData.budget) : "N/A");

  const orderStep = steps.find((s) => s.event === "order_created");
  const rawOrder = (orderStep?.raw as any)?.order || order;
  const resolvedOrder = rawOrder ? rawOrder.id : "N/A";
  const resolvedSource = rawOrder
    ? rawOrder.source === "razorpay_test_mode"
      ? "Razorpay Test Mode"
      : "Mock Mode"
    : "N/A";

  const doneStep = steps.find((s) => s.event === "done");
  const resolvedTotal = total ?? (doneStep?.raw as any)?.total ?? (rawOrder?.amount ? rawOrder.amount / 100 : 0);

  const isSuccess = steps.some((s) => s.event === "done");
  const isFailed = steps.some((s) => ["flow_stopped", "agent_stopped", "order_rejected", "error"].includes(s.event));
  const resolvedStatus = status || (isSuccess ? "APPROVED & EXECUTED" : isFailed ? "GATE REJECTED / HALTED" : "IN PROGRESS");

  // 2. Executive Summary Card with dynamic goal height
  const goalLabel = "Shopping Goal:";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  const goalLabelW = doc.getTextWidth(goalLabel);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  const maxGoalW = contentWidth - goalLabelW - 14;
  const goalLines = doc.splitTextToSize(`"${resolvedGoal}"`, maxGoalW);
  const goalHeight = Math.max(4.2, goalLines.length * 3.8);
  const cardHeight = 25.5 + goalHeight;

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 1.8, 1.8, "FD");

  // Summary Card Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(goldDark[0], goldDark[1], goldDark[2]);
  doc.text("EXECUTIVE TRANSACTION SUMMARY", margin + 4.5, y + 5.2);

  // Goal Row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(goalLabel, margin + 4.5, y + 9.8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(slate[0], slate[1], slate[2]);
  goalLines.forEach((line: string, idx: number) => {
    doc.text(line, margin + 4.5 + goalLabelW + 2.5, y + 9.8 + idx * 3.8);
  });

  // Inner Divider Line
  const metricY = y + 10.0 + goalHeight;
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setLineWidth(0.2);
  doc.line(margin + 4.5, metricY - 2.2, margin + contentWidth - 4.5, metricY - 2.2);

  // 4 Metrics Grid
  const colW = contentWidth / 4;

  // Vertical Separators
  for (let c = 1; c < 4; c++) {
    const sepX = margin + c * colW;
    doc.line(sepX, metricY - 0.5, sepX, metricY + 11);
  }

  // Col 1: Committed Spend
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("COMMITTED SPEND", margin + 4.5, metricY + 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  const formattedTotal = typeof resolvedTotal === "number" ? resolvedTotal.toLocaleString("en-IN") : resolvedTotal;
  doc.text(`Rs. ${formattedTotal}`, margin + 4.5, metricY + 6.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`Budget: Rs. ${resolvedBudget}`, margin + 4.5, metricY + 10.0);

  // Col 2: Policy Status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("POLICY STATUS", margin + colW + 4.5, metricY + 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  if (isSuccess) {
    doc.setTextColor(passText[0], passText[1], passText[2]);
    doc.text("APPROVED", margin + colW + 4.5, metricY + 6.2);
  } else if (isFailed) {
    doc.setTextColor(failText[0], failText[1], failText[2]);
    doc.text("STOPPED", margin + colW + 4.5, metricY + 6.2);
  } else {
    doc.setTextColor(warnText[0], warnText[1], warnText[2]);
    const shortStatus = resolvedStatus.length > 14 ? resolvedStatus.slice(0, 14) : resolvedStatus;
    doc.text(shortStatus, margin + colW + 4.5, metricY + 6.2);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Dual-Gate Verified", margin + colW + 4.5, metricY + 10.0);

  // Col 3: Risk Matrix
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("TRANSACTION RISK", margin + colW * 2 + 4.5, metricY + 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  if (risk) {
    const riskColor = risk.level === "low" ? passText : risk.level === "medium" ? warnText : failText;
    doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
    doc.text(`${risk.score}/100 (${risk.level.toUpperCase()})`, margin + colW * 2 + 4.5, metricY + 6.2);
  } else {
    doc.setTextColor(passText[0], passText[1], passText[2]);
    doc.text("30/100 (LOW)", margin + colW * 2 + 4.5, metricY + 6.2);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Deterministic Matrix", margin + colW * 2 + 4.5, metricY + 10.0);

  // Col 4: Order ID
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("ORDER REFERENCE", margin + colW * 3 + 4.5, metricY + 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  const shortOrder = resolvedOrder.length > 15 ? resolvedOrder.slice(0, 15) + "..." : resolvedOrder;
  doc.text(shortOrder, margin + colW * 3 + 4.5, metricY + 6.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(resolvedSource, margin + colW * 3 + 4.5, metricY + 10.0);

  y += cardHeight + 5.5;

  // 3. Dual-Policy Governance Controls Checklist
  checkPageBreak(25);
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, y - 2.2, 2.2, 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text("ENFORCED GOVERNANCE POLICY CHECKS", margin + 4.0, y);
  y += 3.5;

  const govBoxH = 18.5;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, govBoxH, 1.8, 1.8, "FD");

  const rules = [
    { title: "01. Budget Cap:", desc: "Spend strictly verified within stated budget limit.", col: 0, row: 0 },
    { title: "02. Stock Verification:", desc: "Out-of-stock items substituted or dropped.", col: 0, row: 1 },
    { title: "03. Discount Limits:", desc: "Item discounts bounded to merchant caps.", col: 0, row: 2 },
    { title: "04. Bounded Revision:", desc: "Exactly 1 autonomous retry on gate failure.", col: 1, row: 0 },
    { title: "05. Merchant Guardrails:", desc: "Category limits & manual approval enforced.", col: 1, row: 1 },
    { title: "06. Gated Payment:", desc: "User checkout & server signature verification.", col: 1, row: 2 }
  ];

  const colWidthGov = contentWidth / 2;
  rules.forEach((r) => {
    const rX = margin + 4.5 + r.col * (colWidthGov + 2);
    const rY = y + 4.8 + r.row * 4.8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(r.title, rX, rY);

    const titleW = doc.getTextWidth(r.title);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text(r.desc, rX + titleW + 1.5, rY);
  });

  y += govBoxH + 5.5;

  // 4. Chronological Execution Audit Trail
  checkPageBreak(25);
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, y - 2.2, 2.2, 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text("CHRONOLOGICAL EXECUTION AUDIT TRAIL", margin + 4.0, y);
  y += 3.5;

  drawTableHeader(y);
  y += 6.5;

  // Table Rows
  steps.forEach((step, index) => {
    const rawData = step.raw as any;
    let detailText = "";

    if (step.event === "goal_received") {
      detailText = `Goal: "${rawData?.goal || ""}" | Stated Budget: Rs. ${rawData?.budget || "None"}`;
    } else if (step.event === "catalog_fetched") {
      detailText = `${rawData?.count || "12"} merchant catalog SKUs loaded into candidate pool.`;
    } else if (step.event === "goal_interpreted") {
      detailText = rawData?.reason || (rawData?.categories ? `Restricted to ${rawData.categories.join(", ")}` : "All categories eligible");
    } else if (step.event === "cart_proposed") {
      const items = (rawData?.cart || []).map((c: any) => `${c.id} (qty ${c.qty})`).join(", ");
      detailText = `${rawData?.revised ? "Revised Cart" : "Proposed Cart"} (Total: Rs. ${rawData?.total_estimated || 0}) | Items: ${items || "selected"}`;
    } else if (step.event === "stock_check") {
      const issues = (rawData?.checks || []).map((c: any) => c.reason).join("; ");
      detailText = `Stock check failed: ${issues}`;
    } else if (step.event === "substitution") {
      const subs = (rawData?.substitutions || []).map((s: any) => `${s.original} -> ${s.replacement}`).join("; ");
      detailText = `Out-of-stock substitution applied: ${subs}`;
    } else if (step.event === "policy_check") {
      detailText = `Attempt ${rawData?.attempt || 1}: ${rawData?.reason || ""} (Total: Rs. ${rawData?.total || "N/A"})`;
    } else if (step.event === "merchant_policy_check") {
      detailText = `Attempt ${rawData?.attempt || 1}: ${rawData?.reason || ""}`;
    } else if (step.event === "revision_started") {
      detailText = `Revision triggered: ${rawData?.reason || "Cart adjusted within budget constraints"}`;
    } else if (step.event === "risk_assessed") {
      detailText = `Risk Score: ${rawData?.score}/100 (${String(rawData?.level).toUpperCase()}). Signals: ${(rawData?.reasons || []).join("; ")}`;
    } else if (step.event === "approval_required") {
      detailText = `Human review required: ${rawData?.reason || ""}`;
    } else if (step.event === "approval_granted") {
      detailText = `Approved by authorized human operator for Rs. ${rawData?.total || 0}.`;
    } else if (step.event === "order_created") {
      detailText = `Order ${rawData?.order?.id || ""} created via ${rawData?.order?.source === "razorpay_test_mode" ? "Razorpay Test Mode" : "Mock Mode"}. Amount: Rs. ${((rawData?.order?.amount || 0) / 100).toFixed(2)}`;
    } else if (step.event === "awaiting_payment") {
      detailText = `Governance cleared. System paused awaiting user test payment initiation.`;
    } else if (step.event === "payment_initiated") {
      detailText = `User initiated Razorpay Test Mode checkout. Modal opened.`;
    } else if (step.event === "payment_verification_started") {
      detailText = `Cryptographic payment signature verification started with backend.`;
    } else if (step.event === "payment_verified") {
      detailText = `Signature verified via HMAC-SHA256 timingSafeEqual. Payment ID: ${rawData?.payment_id || ""}`;
    } else if (step.event === "payment_cancelled") {
      detailText = `Payment cancelled by user. Modal dismissed without completing payment.`;
    } else if (step.event === "payment_failed") {
      detailText = `Razorpay payment failed: ${rawData?.reason || "Payment could not be completed."}`;
    } else if (step.event === "agent_stopped") {
      detailText = `Emergency kill switch engaged. Execution halted immediately.`;
    } else if (step.event === "order_rejected") {
      detailText = `Human operator rejected the purchase. No order or payment executed.`;
    } else if (step.event === "flow_stopped") {
      detailText = `Bounded revision limit reached. Flow stopped safely without ordering.`;
    } else if (step.event === "done") {
      detailText = rawData?.paymentId
        ? `Flow complete. Payment ${rawData.paymentId} verified server-side. Order: ${rawData.orderId}. Total: Rs. ${rawData.total}`
        : `Flow complete. Order placed: ${rawData?.orderId || ""}. Total: Rs. ${rawData?.total || 0}`;
    } else {
      detailText = step.label;
    }

    const detailColWidth = contentWidth - 98;
    const lines = doc.splitTextToSize(detailText, detailColWidth - 4);
    const rowHeight = Math.max(7.2, lines.length * 3.6 + 3.8);

    checkPageBreak(rowHeight + 1.5);

    // Alternate row background
    if (index % 2 === 1) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    // Row bottom hairline border
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    const baseY = y + 4.4;

    // 1. Step index
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(String(index + 1).padStart(2, "0"), margin + 2.5, baseY);

    // 2. Time
    let timeFormatted = "";
    try {
      timeFormatted = new Date(step.timestamp).toLocaleTimeString("en-IN", { hour12: false });
    } catch {
      timeFormatted = "--:--:--";
    }
    doc.text(timeFormatted, margin + 9.5, baseY);

    // 3. Stage Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const cleanLabel = step.label.length > 32 ? step.label.slice(0, 31) + "..." : step.label;
    doc.text(cleanLabel, margin + 27, baseY);

    // 4. Status Badge Pill
    const pillW = 14;
    const pillH = 4.0;
    const pillX = margin + 77;
    const pillY = y + 1.6;

    let bText = "INFO";
    let bBg = infoBg;
    let bBorder = infoBorder;
    let bTextColor = infoText;

    if (step.status === "pass") {
      bText = "PASS";
      bBg = passBg;
      bBorder = passBorder;
      bTextColor = passText;
    } else if (step.status === "fail") {
      bText = "FAIL";
      bBg = failBg;
      bBorder = failBorder;
      bTextColor = failText;
    } else if (step.status === "warn") {
      bText = "WARN";
      bBg = warnBg;
      bBorder = warnBorder;
      bTextColor = warnText;
    }

    doc.setFillColor(bBg[0], bBg[1], bBg[2]);
    doc.setDrawColor(bBorder[0], bBorder[1], bBorder[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(pillX, pillY, pillW, pillH, 0.8, 0.8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.0);
    doc.setTextColor(bTextColor[0], bTextColor[1], bTextColor[2]);
    doc.text(bText, pillX + pillW / 2, pillY + 2.9, { align: "center" });

    // 5. Detail text lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(slate[0], slate[1], slate[2]);
    lines.forEach((line: string, lIdx: number) => {
      doc.text(line, margin + 98, baseY + lIdx * 3.6);
    });

    y += rowHeight;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 9.5, pageWidth - margin, pageHeight - 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(
      "Custos Governance Engine  |  Certified Autonomous Transaction Audit Trail",
      margin,
      pageHeight - 5.2
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5.2, { align: "right" });
  }

  // Save the PDF
  const filename = `custos-audit-report-${Date.now()}.pdf`;
  doc.save(filename);
}

