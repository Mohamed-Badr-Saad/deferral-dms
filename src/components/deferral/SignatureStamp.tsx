export function SignatureStamp(props: {
  signatureUrl?: string | null;
  signerName?: string | null;
  signedAt?: string | Date | null;
}) {
  const ts = props.signedAt ? new Date(props.signedAt).toLocaleString() : "—";

  if (props.signatureUrl) {
    return (
      <div className="space-y-1">
        <img
          src={props.signatureUrl}
          alt="signature"
          className="h-12 w-auto max-w-[220px] object-contain border rounded-md bg-white"
        />
        <div className="text-xs text-muted-foreground">{ts}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Signed by: {props.signerName || "—"}</div>
      <div className="text-xs text-muted-foreground">{ts}</div>
    </div>
  );
}
