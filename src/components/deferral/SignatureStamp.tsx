export function SignatureStamp(props: {
  signatureUrl?: string | null;
  signerName?: string | null;
  signedAt?: string | Date | null;
}) {
  const ts = props.signedAt ? new Date(props.signedAt).toLocaleString() : "—";

  if (props.signatureUrl) {
    return (
      <div className="w-full max-w-full space-y-1 sm:w-auto">
        <img
          src={props.signatureUrl}
          alt="signature"
          className="h-12 w-full max-w-[220px] object-contain border rounded-md bg-white sm:w-auto"
        />
        <div className="text-xs text-muted-foreground break-words">{ts}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-1 sm:w-auto">
      <div className="text-sm font-medium break-words">
        Signed by: {props.signerName || "—"}
      </div>
      <div className="text-xs text-muted-foreground break-words">{ts}</div>
    </div>
  );
}
