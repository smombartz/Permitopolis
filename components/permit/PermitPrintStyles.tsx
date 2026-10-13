/**
 * Print-only CSS, scoped with a visibility pattern instead of a print stylesheet on the shell
 * (which isn't ours to change, per CLAUDE.md): everything on the page is hidden on print except
 * the element with `id="permit-print-area"`, which is laid flat to one page with no shadows or
 * blur. `.no-print` hides a control (the back link, the Download PDF button) that should never
 * print.
 */
function PermitPrintStyles() {
  return (
    <style>{`
      @media print {
        body * {
          visibility: hidden;
        }
        #permit-print-area,
        #permit-print-area * {
          visibility: visible;
        }
        #permit-print-area {
          position: absolute;
          inset: 0;
          width: 100%;
          margin: 0;
          padding: 0.4in;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }
        .no-print {
          display: none !important;
        }
        @page {
          margin: 0.3in;
        }
      }
    `}</style>
  );
}

export { PermitPrintStyles };
