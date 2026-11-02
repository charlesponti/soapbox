/**
 * components/MermaidArch.tsx — Mermaid-rendered architecture diagram:
 * single voice chat + background agents (retries + barge-in). Rendered
 * client-side into SVG; Astro never SSR-renders it.
 */
import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  themeVariables: { fontSize: "16px", padding: 12 },
});

const DIAGRAM = `flowchart TB
  U(["USER<br>one voice session"])
  V["VOICE LLM<br>streaming STT / TTS<br>replies under 500 ms"]
  O["ORCHESTRATOR<br>intent router"]
  U <-->|voice loop| V
  V -->|delegate| O
  U -->|says “stop that”| O
  subgraph BG["BACKGROUND · async"]
    direction LR
    A["AGENT A<br>research"]
    B["AGENT B<br>code + files"]
    C["AGENT C<br>bookings + calls"]
    R["RETRY POLICY<br>3 tries · backoff"]
    A -.-> R
    B -.-> R
    C -.-> R
  end
  O -->|spawn| A
  O -->|spawn| B
  O -->|spawn| C
  O -->|cancel_task| A
  O -->|cancel_task| B
  O -->|cancel_task| C
  A -->|heartbeat| S
  B -->|heartbeat| S
  C -->|heartbeat| S
  R -->|failed ×3 · tell voice| S
  S[("PROGRESS STORE<br>state + events")]
  S -.->|status events| V
  classDef lane fill:#141414,stroke:#525252,color:#f5f5f5
  class U,V,O,S,A,B,C,R lane
`;

export default function MermaidArch() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    mermaid
      .render(`voice-arch-${uid}`, DIAGRAM)
      .then(({ svg }) => {
        if (live) setSvg(svg);
      })
      .catch((err: unknown) => {
        console.error("mermaid render failed", err);
      });
    return () => {
      live = false;
    };
  }, [uid]);
  return (
    <div
      className="mermaid-arch"
      role="img"
      aria-label="Architecture diagram: single voice chat with background agents, retries, and barge-in"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
