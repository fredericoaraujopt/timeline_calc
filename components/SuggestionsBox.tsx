"use client";

import { useState } from "react";

export function SuggestionsBox() {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    if (!endpoint) {
      setStatus("error");
      return;
    }
    if (!text.trim()) return;

    setStatus("sending");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ message: text, page: "connectome-timeline" }),
      });
      if (!res.ok) throw new Error("Bad response");
      setText("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div>
      <p className="popTitle" style={{ marginBottom: 8 }}><strong>Suggestions / corrections</strong></p>
      <div className="suggestBox">
        <textarea
          className="textarea"
          placeholder="Reach out to frdfaa2@cam.ac.uk if you have any feedback or questions : )"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="button" onClick={submit} disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Submit"}
        </button>
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        {status === "sent" && <strong>Sent. Thank you.</strong>}
        {status === "error" && <strong>Could not send right now.</strong>}
      </p>
    </div>
  );
}
