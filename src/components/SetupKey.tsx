/**
 * Shows an authenticator setup: a QR code to scan and the key to type by hand.
 */

import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * The QR code is drawn in the browser from the setup link, so the key never
 * goes to another service.
 */
export function SetupKey({
  secret,
  otpauthUri,
}: {
  secret: string;
  otpauthUri: string;
}) {
  const svg = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(otpauthUri);
    code.make();
    return code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [otpauthUri]);

  return (
    <div className="setup-key">
      <div
        className="qr"
        role="img"
        aria-label="QR code for your authenticator app"
        // The markup comes from the QR library, built only from the setup link.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="setup-key-text">
        <p className="muted small">
          Scan with Google Authenticator (or any authenticator app). Cannot scan?
          Choose <em>Enter a setup key</em> and type:
        </p>
        <code className="token-value">{secret}</code>
      </div>
    </div>
  );
}
