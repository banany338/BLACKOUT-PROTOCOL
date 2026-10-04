import { useEffect, useRef, useState } from 'react';
import { Download, Copy, X, Printer } from 'lucide-react';
import { download } from '../api';
export type ExportFile = {
  content: string;
  name: string;
  type: string;
  readable?: boolean;
  title?: string;
};
export function ExportDialog({ file, onClose }: { file: ExportFile; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null),
    frame = useRef<HTMLIFrameElement>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  function keydown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      const items = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),textarea,iframe,[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      if (
        e.shiftKey &&
        (document.activeElement === items[0] || document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        items.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0]?.focus();
      }
    }
  }
  return (
    <div className="modal-backdrop" onKeyDown={keydown}>
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        ref={dialog}
        tabIndex={-1}
      >
        <header>
          <div>
            <h2 id="export-title">
              {file.title ??
                (file.readable ? 'Your readable recovery plan' : 'Your encrypted backup')}
            </h2>
            <p>
              {file.readable
                ? 'Read it here, save the HTML file, or print a copy for authorised people.'
                : 'Save this file and keep its passphrase separately. You will need both to restore your plans.'}
            </p>
          </div>
          <button className="icon-button" aria-label="Close saved copy" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="button-row">
          <button
            className="button primary"
            onClick={() => {
              download(file.content, file.name, file.type);
              setNotice(
                'Download requested. If your browser does not save the file, use the copy option below.',
              );
            }}
          >
            <Download size={16} />
            Download {file.readable ? 'HTML plan' : 'backup file'}
          </button>
          {file.readable && (
            <button className="button" onClick={() => frame.current?.contentWindow?.print()}>
              <Printer size={16} />
              Print / save as PDF
            </button>
          )}
        </div>
        {notice && (
          <p role="status" className="small">
            {notice}
          </p>
        )}
        {file.readable && (
          <iframe
            ref={frame}
            title="Readable recovery plan"
            srcDoc={file.content}
            sandbox="allow-same-origin allow-modals"
          />
        )}
        <details className="simple-details">
          <summary>Download not working? Copy the file contents</summary>
          <p className="small muted">
            Copy the text into a plain-text file named <strong>{file.name}</strong>. Keep the full
            text unchanged.
          </p>
          <textarea
            aria-label="File contents"
            readOnly
            rows={6}
            value={file.content}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(file.content);
                setNotice('File contents copied.');
              } catch {
                setNotice('Select the text above and copy it using your keyboard.');
              }
            }}
          >
            <Copy size={16} />
            Copy file contents
          </button>
        </details>
        {file.readable && (
          <p className="small muted">
            This readable copy is not encrypted. It includes account names and recovery procedures.
          </p>
        )}
      </section>
    </div>
  );
}
