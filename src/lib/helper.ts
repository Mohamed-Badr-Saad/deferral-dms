function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function validateLafdWindow(lafdStart: Date | null, lafdEnd: Date | null) {
  if (!lafdStart || !lafdEnd) return null;

  const max = addMonths(lafdStart, 6);
  if (lafdEnd.getTime() > max.getTime()) {
    return "Maximum deferred period is 6 months from Current LAFD.";
  }
  if (lafdEnd.getTime() < lafdStart.getTime()) {
    return "Deferred To (New LAFD) cannot be earlier than Current LAFD.";
  }
  return null;
}
