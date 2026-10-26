import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez ce lien :', url);
    }
  }
  return (
    <div className="copy-link">
      <code>{url}</code>
      <button type="button" className="btn-ghost" onClick={copy}>{copied ? 'Copié' : 'Copier'}</button>
    </div>
  );
}
