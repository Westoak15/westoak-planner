import React, { useState } from "react";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";

interface NetWorthEntry {
  id: number;
  type: string;
  category: string;
  name: string;
  value: string | number;
  owner?: string | null;
  notes?: string | null;
}

interface Props {
  entries?: NetWorthEntry[];
  onDelete?: (id: number) => void;
  onAdd?: () => void;
  onUpdate?: (id: number, value: string) => void;
}

export function NetWorthPremiumMock({ entries = [], onDelete, onAdd, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const assets      = entries.filter((e) => e.type === "asset");
  const liabilities = entries.filter((e) => e.type === "liability");
  const totalAssets      = assets.reduce((s, e) => s + parseFloat(String(e.value ?? 0)), 0);
  const totalLiabilities = liabilities.reduce((s, e) => s + parseFloat(String(e.value ?? 0)), 0);
  const netWorth = totalAssets - totalLiabilities;

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  const startEdit = (entry: NetWorthEntry) => {
    setEditingId(entry.id);
    setEditValue(String(entry.value));
  };

  const commitEdit = (id: number) => {
    onUpdate?.(id, editValue);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const EntryRow = ({ item, color }: { item: NetWorthEntry; color: string }) => (
    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group" data-testid={`fp-nw-${item.id}`}>
      <div>
        <span className="text-sm font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground ml-2">({item.category})</span>
      </div>
      <div className="flex items-center gap-2">
        {editingId === item.id ? (
          <>
            <input
              autoFocus
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-28 px-2 py-1 text-sm border border-blue-300 rounded-lg text-right focus:ring-2 focus:ring-blue-400 outline-none transition"
            />
            <button onClick={() => commitEdit(item.id)} className="p-1 hover:bg-green-50 rounded">
              <Check className="w-3 h-3 text-green-600" />
            </button>
            <button onClick={cancelEdit} className="p-1 hover:bg-muted rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </>
        ) : (
          <>
            <span className={`text-sm font-semibold ${color}`}>{fmt(parseFloat(String(item.value)))}</span>
            {onUpdate && (
              <button onClick={() => startEdit(item)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded">
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(item.id)} data-testid={`button-fp-del-nw-${item.id}`} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded">
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Net Worth Statement</h2>
        {onAdd && (
          <button onClick={onAdd} data-testid="button-fp-add-nw" className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /><span>Add Entry</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-green-200 rounded-2xl p-5 bg-green-50/50 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200" data-testid="fp-total-assets">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Total Assets</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalAssets)}</p>
        </div>
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200" data-testid="fp-total-liabilities">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalLiabilities)}</p>
        </div>
        <div className={`border rounded-2xl p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 ${netWorth >= 0 ? "border-primary/30 bg-primary/5" : "border-red-300 bg-red-50"}`} data-testid="fp-net-worth">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Worth</p>
          <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? "text-primary" : "text-red-600"}`}>{fmt(netWorth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border rounded-2xl p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200">
          <h3 className="text-lg font-bold text-green-700 mb-4">Assets</h3>
          {assets.map((item) => <EntryRow key={item.id} item={item} color="text-green-600" />)}
          {assets.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No assets added yet</p>
              {onAdd && <button onClick={onAdd} className="mt-3 text-blue-600 text-sm hover:underline">Add your first asset</button>}
            </div>
          )}
        </div>
        <div className="border border-border rounded-2xl p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200">
          <h3 className="text-lg font-bold text-red-600 mb-4">Liabilities</h3>
          {liabilities.map((item) => <EntryRow key={item.id} item={item} color="text-red-500" />)}
          {liabilities.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No liabilities added yet</p>
              {onAdd && <button onClick={onAdd} className="mt-3 text-blue-600 text-sm hover:underline">Add your first liability</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

