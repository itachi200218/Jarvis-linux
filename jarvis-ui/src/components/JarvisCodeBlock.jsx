import { useState } from "react";

export function JarvisCodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="jarvis-code-wrapper">
      <button
        className={`jarvis-copy-btn ${copied ? "copied" : ""}`}
        onClick={handleCopy}
        title="Copy code"
      />
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
