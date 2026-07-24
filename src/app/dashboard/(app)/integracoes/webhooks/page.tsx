"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { WebhooksView } from "@/components/dashboard/views/integracoes/WebhooksView";

export default function WebhooksPage() {
  return <WebhooksView v={useTraffik()} />;
}
