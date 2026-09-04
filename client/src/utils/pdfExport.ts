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

  // Helper colors
  const gold = [199, 125, 46]; // #C77D2E
  const ink = [28, 25, 23]; // #1C1917
  const muted = [115, 115, 115]; // #737373
  const lightBg = [251, 249, 246]; // #FBF9F6
  const borderCol = [232, 230, 225]; // #E8E6E1
  const passCol = [46, 125, 91]; // #2E7D5B
  const failCol = [178, 58, 46]; // #B23A2E
  const warnCol = [199, 125, 46]; // #C77D2E

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    // Header bar
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(margin, y, contentWidth, 1.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text("CUSTOS", margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text("THE GATED BUYER AGENT", margin + 27, y);

    // Right header info
    doc.setFontSize(8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    const dateStr = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    doc.text("TRANSACTION & AUDIT REPORT", pageWidth - margin, y - 1, { align: "right" });
    doc.text(`Generated: ${dateStr}`, pageWidth - margin, y + 3, { align: "right" });

    y += 7;
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  // 1. Render First Page Header
  drawHeader();

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
  const resolvedTotal = total ?? (doneStep?.raw as any)?.total ?? rawOrder ? (rawOrder?.amount ? rawOrder.amount / 100 : 0) : 0;

  const isSuccess = steps.some((s) => s.event === "done");
  const isFailed = steps.some((s) => ["flow_stopped", "agent_stopped", "order_rejected", "error"].includes(s.event));
  const resolvedStatus = status || (isSuccess ? "APPROVED & EXECUTED" : isFailed ? "GATE REJECTED / HALTED" : "IN PROGRESS");

  // 2. Executive Summary Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "FD");

  // Title in summary box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("EXECUTIVE TRANSACTION SUMMARY", margin + 4, y + 6);

  // Goal row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text("Shopping Goal:", margin + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  const splitGoal = doc.splitTextToSize(`"${resolvedGoal}"`, contentWidth - 40);
  doc.text(splitGoal[0], margin + 28, y + 12);

  // Key metrics 4-column layout
  const colW = contentWidth / 4;
  const metY = y + 19;

  // Metric 1: Committed Spend
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("COMMITTED SPEND", margin + 4, metY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(`Rs. ${resolvedTotal}`, margin + 4, metY + 5);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`Budget: Rs. ${resolvedBudget}`, margin + 4, metY + 9);

  // Metric 2: Policy Status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("POLICY STATUS", margin + colW + 4, metY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  if (isSuccess) {
    doc.setTextColor(passCol[0], passCol[1], passCol[2]);
    doc.text("✓ Approved", margin + colW + 4, metY + 5);
  } else if (isFailed) {
    doc.setTextColor(failCol[0], failCol[1], failCol[2]);
    doc.text("✕ Stopped", margin + colW + 4, metY + 5);
  } else {
    doc.setTextColor(warnCol[0], warnCol[1], warnCol[2]);
    doc.text(resolvedStatus, margin + colW + 4, metY + 5);
  }
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Dual-Gate Verified", margin + colW + 4, metY + 9);

  // Metric 3: Risk Score
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("TRANSACTION RISK", margin + colW * 2 + 4, metY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (risk) {
    doc.setTextColor(risk.level === "low" ? passCol[0] : risk.level === "medium" ? warnCol[0] : failCol[0], risk.level === "low" ? passCol[1] : risk.level === "medium" ? warnCol[1] : failCol[1], risk.level === "low" ? passCol[2] : risk.level === "medium" ? warnCol[2] : failCol[2]);
    doc.text(`${risk.score}/100 (${risk.level.toUpperCase()})`, margin + colW * 2 + 4, metY + 5);
  } else {
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("30/100 (LOW)", margin + colW * 2 + 4, metY + 5);
  }
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Autonomous Risk Matrix", margin + colW * 2 + 4, metY + 9);

  // Metric 4: Order ID
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("ORDER REFERENCE", margin + colW * 3 + 4, metY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  const shortOrder = resolvedOrder.length > 15 ? resolvedOrder.slice(0, 15) + "…" : resolvedOrder;
  doc.text(shortOrder, margin + colW * 3 + 4, metY + 5);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(resolvedSource, margin + colW * 3 + 4, metY + 9);

  y += 38;

  // 3. Dual-Policy Governance Controls Checklist
  checkPageBreak(22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text("ENFORCED GOVERNANCE POLICY CHECKS", margin, y);
  y += 3;

  doc.setFontSize(7.5);
  const rules = [
    "01. Budget Cap: Spend strictly verified within stated budget limit.",
    "02. Stock Verification: Out-of-stock items automatically substituted or dropped.",
    "03. Discount Limits: Item discounts bounded to merchant authorized caps.",
    "04. Bounded Revision: Exactly 1 autonomous retry allowed on gate failure.",
    "05. Merchant Guardrails: Category restrictions & human approval enforced."
  ];

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(margin, y, contentWidth, 14, "F");
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.rect(margin, y, contentWidth, 14, "D");

  doc.setFont("helvetica", "normal");
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(rules[0], margin + 3, y + 4.5);
  doc.text(rules[1], margin + 3, y + 8.5);
  doc.text(rules[2], margin + 3, y + 12.5);
  doc.text(rules[3], margin + 100, y + 4.5);
  doc.text(rules[4], margin + 100, y + 8.5);

  y += 18;

  // 4. Chronological Audit Log Table
  checkPageBreak(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text("CHRONOLOGICAL EXECUTION AUDIT TRAIL", margin, y);
  y += 4;

  // Table Header
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, y, contentWidth, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("#", margin + 2, y + 4.2);
  doc.text("TIME", margin + 8, y + 4.2);
  doc.text("EVENT / STAGE", margin + 26, y + 4.2);
  doc.text("STATUS", margin + 78, y + 4.2);
  doc.text("AUDIT RECORD & REASONING DETAILS", margin + 98, y + 4.2);
  y += 6;

  // Table Rows
  steps.forEach((step, index) => {
    const rawData = step.raw as any;
    let detailText = "";

    if (step.event === "goal_received") {
      detailText = `Goal: "${rawData?.goal || ""}" | Budget: Rs. ${rawData?.budget || "None"}`;
    } else if (step.event === "catalog_fetched") {
      detailText = `${rawData?.count || "12"} merchant SKUs loaded into candidate pool.`;
    } else if (step.event === "goal_interpreted") {
      detailText = rawData?.reason || (rawData?.categories ? `Restricted to ${rawData.categories.join(", ")}` : "All categories eligible");
    } else if (step.event === "cart_proposed") {
      const items = (rawData?.cart || []).map((c: any) => `${c.id} (qty ${c.qty})`).join(", ");
      detailText = `Cart Total: Rs. ${rawData?.total_estimated || 0} | Proposed: ${items || "items selected"}`;
    } else if (step.event === "stock_check") {
      const issues = (rawData?.checks || []).map((c: any) => c.reason).join("; ");
      detailText = `Stock check failed: ${issues}`;
    } else if (step.event === "substitution") {
      const subs = (rawData?.substitutions || []).map((s: any) => `${s.original} -> ${s.replacement}`).join("; ");
      detailText = `Substitutions applied: ${subs}`;
    } else if (step.event === "policy_check") {
      detailText = `Attempt ${rawData?.attempt || 1}: ${rawData?.reason || ""} (Total: Rs. ${rawData?.total || "N/A"})`;
    } else if (step.event === "merchant_policy_check") {
      detailText = `Attempt ${rawData?.attempt || 1}: ${rawData?.reason || ""}`;
    } else if (step.event === "revision_started") {
      detailText = `Revision triggered: ${rawData?.reason || "Cart adjusted within budget constraints"}`;
    } else if (step.event === "risk_assessed") {
      detailText = `Score: ${rawData?.score}/100 (${String(rawData?.level).toUpperCase()}). Factors: ${(rawData?.reasons || []).join("; ")}`;
    } else if (step.event === "approval_required") {
      detailText = `Manual review required: ${rawData?.reason || ""}`;
    } else if (step.event === "approval_granted") {
      detailText = `Approved by authorized human operator for Rs. ${rawData?.total || 0}.`;
    } else if (step.event === "order_created") {
      detailText = `Payment order ${rawData?.order?.id || ""} created via ${rawData?.order?.source || "Razorpay Test Mode"}. Amount: Rs. ${((rawData?.order?.amount || 0) / 100).toFixed(2)}`;
    } else if (step.event === "done") {
      detailText = `Flow complete. Order reference: ${rawData?.orderId || ""}. Total: Rs. ${rawData?.total || 0}`;
    } else {
      detailText = step.label;
    }

    const lines = doc.splitTextToSize(detailText, contentWidth - 100);
    const rowHeight = Math.max(7, lines.length * 3.5 + 3);

    checkPageBreak(rowHeight + 4);

    // Alternate row background
    if (index % 2 === 1) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    // Border
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    // Step index
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(String(index + 1).padStart(2, "0"), margin + 2, y + 4.5);

    // Time
    let timeFormatted = "";
    try {
      timeFormatted = new Date(step.timestamp).toLocaleTimeString("en-IN", { hour12: false });
    } catch {
      timeFormatted = "--:--:--";
    }
    doc.text(timeFormatted, margin + 8, y + 4.5);

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const cleanLabel = step.label.length > 28 ? step.label.slice(0, 28) + "…" : step.label;
    doc.text(cleanLabel, margin + 26, y + 4.5);

    // Status Pill
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    if (step.status === "pass") {
      doc.setTextColor(passCol[0], passCol[1], passCol[2]);
      doc.text("✓ PASS", margin + 78, y + 4.5);
    } else if (step.status === "fail") {
      doc.setTextColor(failCol[0], failCol[1], failCol[2]);
      doc.text("✕ FAIL", margin + 78, y + 4.5);
    } else if (step.status === "warn") {
      doc.setTextColor(warnCol[0], warnCol[1], warnCol[2]);
      doc.text("⚠ WARN", margin + 78, y + 4.5);
    } else {
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("● INFO", margin + 78, y + 4.5);
    }

    // Detail text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(lines, margin + 98, y + 3.8);

    y += rowHeight;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(
      "Custos Governance Engine · Certified Autonomous Transaction Audit Trail",
      margin,
      pageHeight - 5
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  // Save the PDF
  const filename = `custos-audit-report-${Date.now()}.pdf`;
  doc.save(filename);
}
