import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2, Pencil, Save, X, Database, ShieldAlert } from "lucide-react";

type ModuleKey = "fields" | "crops" | "work" | "inventory";
type ActiveKey = ModuleKey | "farms";
type Item = Record<string, unknown> & { id: string };
type FieldDef = { key: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string };
const configs: Record<ActiveKey, { resource: string; title: string; description: string; fields: FieldDef[]; columns: { key: string; label: string }[] }> = {
  farms: {
    resource: "farms", title: "農場管理", description: "経営する農場の基本情報と所在地、面積を管理します。",
    fields: [
      { key: "name", label: "農場名", required: true, placeholder: "例：みどりファーム" },
      { key: "location", label: "所在地", placeholder: "市区町村など" },
      { key: "areaHectares", label: "総面積（ha）", type: "number" },
      { key: "notes", label: "メモ", type: "textarea" }
    ],
    columns: [{key:"name",label:"農場名"},{key:"location",label:"所在地"},{key:"areaHectares",label:"総面積（ha）"}]
  },
  fields: {
    resource: "fields", title: "圃場管理", description: "農場ごとの区画、面積、土壌・水利情報を管理します。",
    fields: [
      { key: "farm_id", label: "所属農場", type: "farm", required: true },
      { key: "name", label: "圃場名", required: true, placeholder: "例：第1水田" },
      { key: "area_hectares", label: "面積（ha）", type: "number" },
      { key: "soil_type", label: "土壌", placeholder: "例：粘土質" },
      { key: "water_source", label: "水源", placeholder: "例：用水路" },
      { key: "notes", label: "メモ", type: "textarea" }
    ],
    columns: [{key:"name",label:"圃場名"},{key:"farm_id",label:"農場ID"},{key:"area_hectares",label:"面積（ha）"},{key:"soil_type",label:"土壌"}]
  },
  crops: {
    resource: "crops", title: "作物・栽培管理", description: "圃場に作付けした作物と栽培期間を記録します。",
    fields: [
      { key: "field_id", label: "対象圃場", type: "field", required: true },
      { key: "crop_name", label: "作物名", required: true, placeholder: "例：水稲" },
      { key: "variety", label: "品種", placeholder: "例：コシヒカリ" },
      { key: "season", label: "作期", placeholder: "例：2026年産" },
      { key: "status", label: "状態", type: "select", options: [{value:"planned",label:"計画中"},{value:"growing",label:"栽培中"},{value:"harvested",label:"収穫済み"},{value:"archived",label:"アーカイブ"}] },
      { key: "planting_date", label: "播種・定植日", type: "date" },
      { key: "expected_harvest_date", label: "収穫予定日", type: "date" },
      { key: "notes", label: "メモ", type: "textarea" }
    ],
    columns: [{key:"crop_name",label:"作物"},{key:"variety",label:"品種"},{key:"field_id",label:"圃場ID"},{key:"status",label:"状態"},{key:"expected_harvest_date",label:"収穫予定"}]
  },
  work: {
    resource: "tasks", title: "作業・スケジュール", description: "農場の作業予定と進捗を共有します。",
    fields: [
      { key: "title", label: "作業名", required: true, placeholder: "例：追肥作業" },
      { key: "category", label: "分類", placeholder: "例：栽培管理" },
      { key: "farm_id", label: "農場ID（任意）", placeholder: "農場IDを入力" },
      { key: "description", label: "内容", type: "textarea" },
      { key: "scheduled_at", label: "予定日時", type: "datetime-local" },
      { key: "status", label: "進捗", type: "select", options: [{value:"todo",label:"未着手"},{value:"in_progress",label:"進行中"},{value:"done",label:"完了"},{value:"cancelled",label:"中止"}] }
    ],
    columns: [{key:"title",label:"作業名"},{key:"category",label:"分類"},{key:"scheduled_at",label:"予定日時"},{key:"status",label:"進捗"}]
  },
  inventory: {
    resource: "inventory", title: "資材・在庫管理", description: "肥料・種苗・飼料・資材などの在庫を管理します。",
    fields: [
      { key: "name", label: "資材名", required: true, placeholder: "例：水稲用肥料" },
      { key: "category", label: "分類", required: true, placeholder: "例：肥料・農薬・種苗・飼料" },
      { key: "unit", label: "単位", required: true, placeholder: "例：袋・kg・L・個" },
      { key: "quantity", label: "在庫数量", type: "number" },
      { key: "reorder_threshold", label: "発注目安", type: "number" },
      { key: "storage_location", label: "保管場所" },
      { key: "lot_number", label: "ロット番号" },
      { key: "expires_on", label: "期限", type: "date" },
      { key: "notes", label: "メモ", type: "textarea" }
    ],
    columns: [{key:"name",label:"資材名"},{key:"category",label:"分類"},{key:"quantity",label:"数量"},{key:"unit",label:"単位"},{key:"reorder_threshold",label:"発注目安"}]
  }
};

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function Management({ tab }: { tab: ModuleKey }) {
  const [showFarms, setShowFarms] = useState(true);
  const activeKey: ActiveKey = tab === "fields" && showFarms ? "farms" : tab;
  const config = configs[activeKey];
  const [organizationId, setOrganizationId] = useState(() => localStorage.getItem("fermia_org_id") || "");
  const [draftOrg, setDraftOrg] = useState(organizationId);
  const [items, setItems] = useState<Item[]>([]);
  const [farms, setFarms] = useState<Item[]>([]);
  const [fields, setFields] = useState<Item[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useMemo(() => "?organization_id=" + encodeURIComponent(organizationId), [organizationId]);
  const api = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      credentials: "same-origin"
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "通信に失敗しました。");
    }
    if (response.status === 204) return null;
    return response.json();
  };

  const load = async () => {
    if (!organizationId.trim()) return;
    setLoading(true); setError("");
    try {
      const [main, farmResult, fieldResult] = await Promise.all([
        activeKey === "farms" ? api(`/api/farms${query}`) : api(`/api/records/${config.resource}${query}`),
        activeKey === "farms" ? api(`/api/farms${query}`) : api(`/api/farms${query}`),
        api(`/api/records/fields${query}`)
      ]);
      setItems(activeKey === "farms" ? (main.farms || []) : (main.items || []));
      setFarms(farmResult.farms || []);
      setFields(fieldResult.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データを読み込めませんでした。");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [activeKey, organizationId]);

  const reset = () => {
    setForm({});
    setEditing(null);
    setShowForm(false);
  };
  const startEdit = (item: Item) => {
    const next: Record<string, string> = {};
    for (const field of config.fields) {
      const value = item[field.key];
      next[field.key] = value === null || value === undefined ? "" : String(value);
    }
    setForm(next); setEditing(item.id); setShowForm(true); setMessage("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    const body: Record<string, unknown> = {};
    for (const field of config.fields) {
      const value = form[field.key] ?? "";
      if (field.type === "number") body[field.key] = value === "" ? null : Number(value);
      else body[field.key] = value === "" ? null : value;
    }
    try {
      if (tab === "fields" || tab === "crops" || tab === "work" || tab === "inventory") {
        const base = activeKey === "farms" ? "/api/farms" : `/api/records/${config.resource}`;
        const url = editing
          ? `${base}/${encodeURIComponent(editing)}${query}`
          : `${base}${query}`;
        await api(url, { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      }
      reset(); setMessage(editing ? "変更を保存しました。" : "登録しました。"); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm("このデータを削除しますか？")) return;
    setError(""); setMessage("");
    try {
      const base = activeKey === "farms" ? "/api/farms" : `/api/records/${config.resource}`;
      await api(`${base}/${encodeURIComponent(id)}${query}`, { method: "DELETE" });
      setMessage("削除しました。"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "削除できませんでした。"); }
  };
  const saveOrg = () => {
    const value = draftOrg.trim();
    if (!value) { setError("組織IDを入力してください。"); return; }
    localStorage.setItem("fermia_org_id", value);
    setOrganizationId(value); setError(""); setMessage("組織IDを設定しました。");
  };

  return <section className="manage">
    <div className="manage-intro">
      <div><small>FERMIA DATA WORKSPACE</small><h2>{config.title}</h2><p>{config.description}</p></div>
      <button className="manage-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>更新</button>
    </div>
    <div className="org-setup">
      <div><b><Database size={16}/> データ接続設定</b><p>Cloudflare AccessとD1の設定が完了している場合、組織IDを入力してデータを読み込みます。</p></div>
      <div className="org-controls"><input value={draftOrg} onChange={e=>setDraftOrg(e.target.value)} placeholder="組織ID（例：org-example）"/><button onClick={saveOrg}>設定</button></div>
    </div>
    {!organizationId && <div className="manage-empty"><ShieldAlert/><b>組織IDが未設定です</b><span>管理者から案内された組織IDを入力してください。ログイン認証・D1設定が完了していない場合は利用できません。</span></div>}
    {error && <div className="manage-error">{error}</div>}
    {message && <div className="manage-success">{message}</div>}
    <div className="manage-toolbar"><div><b>登録データ</b><span>{items.length} 件</span></div><button className="add" onClick={()=>{setForm({});setEditing(null);setShowForm(v=>!v);}} disabled={!organizationId}><Plus size={16}/>{showForm ? "閉じる" : "新規登録"}</button></div>
    {showForm && <form className="manage-form" onSubmit={submit}>
      <div className="manage-form-head"><b>{editing ? "データを編集" : "新しいデータを登録"}</b><button type="button" onClick={reset}><X size={16}/></button></div>
      <div className="manage-form-grid">{config.fields.map(field=><label key={field.key}>{field.label}{field.required && <em>必須</em>}
        {field.type === "textarea" ? <textarea required={field.required} value={form[field.key] || ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))}/>
        : field.type === "select" ? <select value={form[field.key] || ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))}>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : field.type === "farm" ? <select required value={form[field.key] || ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))}><option value="">農場を選択</option>{farms.map(x=><option key={x.id} value={x.id}>{String(x.name)}</option>)}</select>
        : field.type === "field" ? <select required value={form[field.key] || ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))}><option value="">圃場を選択</option>{fields.map(x=><option key={x.id} value={x.id}>{String(x.name)}</option>)}</select>
        : <input type={field.type || "text"} required={field.required} min={field.type==="number" ? "0" : undefined} placeholder={field.placeholder} value={form[field.key] || ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))}/>}
      </label>)}</div>
      <div className="manage-form-actions"><button type="button" className="cancel" onClick={reset}>キャンセル</button><button className="add" type="submit"><Save size={15}/>保存する</button></div>
    </form>}
    <div className="manage-table-wrap"><table className="manage-table"><thead><tr>{config.columns.map(c=><th key={c.key}>{c.label}</th>)}<th>操作</th></tr></thead><tbody>
      {items.map(item=><tr key={item.id}>{config.columns.map(c=><td key={c.key}>{display(item[c.key])}</td>)}<td><div className="manage-actions"><button title="編集" onClick={()=>startEdit(item)}><Pencil size={15}/></button><button title="削除" onClick={()=>void remove(item.id)}><Trash2 size={15}/></button></div></td></tr>)}
      {!items.length && <tr><td colSpan={config.columns.length+1} className="manage-no-data">{loading ? "読み込み中…" : "データがありません。新規登録から追加できます。"}</td></tr>}
    </tbody></table></div>
    <p className="manage-footnote">データは組織単位で管理されます。閲覧・編集できる範囲はアカウントの権限によって異なります。</p>
  </section>;
}
