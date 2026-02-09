export type UnitOption = { label: string; toBase: number };

function pow(n: number, p: 2 | 3) {
  return p === 2 ? n * n : n * n * n;
}

export function unitOptionsForBase(baseUnit: string | null | undefined): UnitOption[] {
  const b = (baseUnit ?? "").replaceAll(" ", "");
  // Time
  if (b === "s") {
    return [
      { label: "ns", toBase: 1e-9 },
      { label: "µs", toBase: 1e-6 },
      { label: "ms", toBase: 1e-3 },
      { label: "seconds", toBase: 1 },
      { label: "minutes", toBase: 60 },
      { label: "hours", toBase: 3600 },
      { label: "days", toBase: 86400 },
    ];
  }
  // Length
  if (b === "m") {
    return [
      { label: "nm", toBase: 1e-9 },
      { label: "µm", toBase: 1e-6 },
      { label: "mm", toBase: 1e-3 },
      { label: "cm", toBase: 1e-2 },
      { label: "m", toBase: 1 },
    ];
  }
  // Area
  if (b === "m²" || b === "m2") {
    const length = unitOptionsForBase("m");
    return length.map(u => ({ label: `${u.label}²`, toBase: pow(u.toBase, 2) }));
  }
  // Volume
  if (b === "m³" || b === "m3") {
    const length = unitOptionsForBase("m");
    return length.map(u => ({ label: `${u.label}³`, toBase: pow(u.toBase, 3) }));
  }
  // Speed
  if (b === "m/s") {
    return [
      { label: "mm/s", toBase: 1e-3 },
      { label: "µm/s", toBase: 1e-6 },
      { label: "m/s", toBase: 1 },
    ];
  }
  // Volumetric rate
  if (b === "m³/s" || b === "m3/s") {
    const vol = unitOptionsForBase("m³");
    return vol.map(u => ({ label: `${u.label} / s`, toBase: u.toBase }));
  }

  // Hz
  if (b === "Hz") {
    return [
      { label: "Hz", toBase: 1 },
      { label: "kHz", toBase: 1e3 },
      { label: "MHz", toBase: 1e6 },
      { label: "GHz", toBase: 1e9 },
    ];
  }

  // Dimensionless default
  return [];
}
