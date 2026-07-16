import type { Metadata } from "next";
import { X402DashboardClient } from "../components/X402DashboardClient";

export const metadata: Metadata = {
  title: "x402 Network | Huntlist",
  description: "Live read-only x402 network analytics powered by x402scan.",
};

export default function X402Page() {
  return <X402DashboardClient />;
}
