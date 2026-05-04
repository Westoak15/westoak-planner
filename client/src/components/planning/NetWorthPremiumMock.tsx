import React from "react";

export function NetWorthPremiumMock({ entries = [] }: { entries: any[] }) {
  const assets     = entries.filter((e) => e.type === "asset");
  const liabilities = entries.filter((e) => e.type === "liability");
  const totalAssets      = assets.reduce((s, e) => s + parseFloat(e.value ?? 0), 0);
  const totalLiabilities = liabilities.reduce((s, e) => s + parseFloat(e.value ?? 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Assets</p>
          <p className="text-xl font-semibold text-green-600">{fmt(totalAssets)}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Liabilities</p>
          <p className="text-xl font-semibold text-red-500">{fmt(totalLiabilities)}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-sm text-muted-foreground">Net Worth</p>
          <p className={`text-xl font-semibold ${netWorth >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {fmt(netWorth)}
          </p>
        </div>
      </div>

      {entries.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">
          No net worth entries yet.
        </p>
      )}

      {assets.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">Assets</h4>
          <table className="w-full text-sm">
            <tbody>
              {assets.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-1.5 text-muted-foreground">{e.category}</td>
                  <td className="py-1.5">{e.name}</td>
                  <td className="py-1.5 text-right font-mono">{fmt(parseFloat(e.value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {liabilities.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">Liabilities</h4>
          <table className="w-full text-sm">
            <tbody>
              {liabilities.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-1.5 text-muted-foreground">{e.category}</td>
                  <td className="py-1.5">{e.name}</td>
                  <td className="py-1.5 text-right font-mono text-red-500">{fmt(parseFloat(e.value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
