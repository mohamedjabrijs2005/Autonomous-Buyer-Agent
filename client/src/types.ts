import type { ReactNode } from "react";

export type CartLine = { id: string; qty: number; reason: string };
export type RejectedLine = { id: string; reason: string };
export type Substitution = { original: string; replacement: string; reason: string };
export type Order = { id: string; source: string; amount: number; currency: string; status?: string };

export type StepStatus = "info" | "pass" | "fail" | "warn";

export type TimelineStep = {
  id: string;
  event: string;
  label: string;
  status: StepStatus;
  timestamp: string;
  detail?: ReactNode;
  raw?: unknown;
};

export type RunSummary = {
  id: string;
  goal: string;
  budget: string;
  timestamp: string;
  status: "passed" | "failed";
  total: number;
  steps: TimelineStep[];
};
