/**
 * Helper to determine if a certificate modal or credential export dialog is currently active.
 * Used by security hooks to suppress screen protection overlays during legitimate graduation credential export.
 */
export function isCertificateModalActive(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.body.classList.contains('certificate-modal-open') ||
    document.body.getAttribute('data-certificate-modal-open') === 'true' ||
    document.body.getAttribute('data-printing-active') === 'true' ||
    Boolean(document.querySelector('.certificate-portal-root')) ||
    Boolean(document.querySelector('#certificate-print-area'))
  );
}

