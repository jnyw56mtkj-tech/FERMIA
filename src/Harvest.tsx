import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Save, Trash2, Pencil, X, Wheat, TrendingUp, Boxes } from "lucide-react";

type Field = { id: string; name: string; farm_name?: string };
type Crop = { id: string; field_id: string; crop_name: string; variety?: string | null; season?: string | null };
type Harvest = { id: string; field_id: string; crop_cycle_id?: string | null; field_name: string; farm_name?: string; crop_name?: string | null; variety?: string | null; harvested_on: string; quantity: number; unit: string; quality_grade?: string | null; destination?: string | null; notes?: string | null };
const today = new Date().toLocaleDateString("sv-SE");
const blank = { field_id: "", crop_cycle_id: "", harvested_on: today, quantity: "", unit: "kg", quality_grade: "", destination: "", notes: "" };

export default function Harvest() {
  const [org,setOrg]=useState(()=>localStorage.getItem("fermia_org_id")||"");
  const [records,setRecords]=useState<Harvest[]>([]);
  const [fields,setFields]=useState<Field[]>([]);
  const [crops,setCrops]=useState<Crop[]>([]);
  const [form,setForm]=useState(blank);
  const [editing,setEditing]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const query="?organization_id="+encodeURIComponent(org);
  const api=async(url:string,init?:RequestInit)=>{const res=await fetch(url,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...(init?.headers||{})}});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error||"通信に失敗しました。");}return res.status===204?null:res.json();};
  const load=async()=>{if(!org.trim())return;setBusy(true);setError("");try{const [h,f,c]=await Promise.all([api("/api/harvest"+query),api("/api/records/fields"+query),api("/api/records/crops"+query)]);setRecords(h.items||[]);setFields(f.items||[]);setCrops(c.items||[]);}catch(e){setError(e instanceof Error?e.message:"読み込みに失敗しました。");}finally{setBusy(false);}};
  useEffect(()=>{void load();},[org]);
  const availableCrops=useMemo(()=>crops.filter(c=>c.field_id===form.field_id),[crops,form.field_id]);
  const quantityByUnit=records.reduce((map,r)=>{map.set(r.unit,(map.get(r.unit)||0)+r.quantity);return map;},new Map<string,number>());
  const quantitySummary=[...quantityByUnit.entries()].map(([unit,quantity])=>quantity.toLocaleString("ja-JP",{maximumFractionDigits:2})+" "+unit).join(" / ");
  const reset=()=>{setForm(blank);setEditing("");setShow(false);};
  const startEdit=(r:Harvest)=>{setForm({field_id:r.field_id,crop_cycle_id:r.crop_cycle_id||"",harvested_on:r.harvested_on,quantity:String(r.quantity),unit:r.unit,quality_grade:r.quality_grade||"",destination:r.destination||"",notes:r.notes||""});setEditing(r.id);setShow(true);setNotice("");};
  const submit=async(e:FormEvent)=>{e.preventDefault();setError("");setNotice("");try{const body={...form,quantity:Number(form.quantity),crop_cycle_id:form.crop_cycle_id||null,quality_grade:form.quality_grade||null,destination:form.destination||null,notes:form.notes||null};await api(editing?"/api/harvest/"+encodeURIComponent(editing)+query:"/api/harvest"+query,{method:editing?"PATCH":"POST",body:JSON.stringify(body)});reset();setNotice(editing?"収穫記録を更新しました。":"収穫記録を保存しました。");await load();}catch(e){setError(e instanceof Error?e.message:"保存に失敗しました。");}};
  const remove=async(id:string)=>{if(!window.confirm("この収穫記録を削除しますか？"))return;try{await api("/api/harvest/"+encodeURIComponent(id)+query,{method:"DELETE"});setNotice("削除しました。");await load();}catch(e){setError(e instanceof Error?e.message:"削除に失敗しました。");}};
  const exportCsv=()=>{const headers=["収穫日","農場","圃場","作物","品種","数量","単位","品質・規格","出荷先","メモ"];const rows=records.map(r=>[r.harvested_on,r.farm_name,r.field_name,r.crop_name,r.variety,r.quantity,r.unit,r.quality_grade,r.destination,r.notes].map(v=>{let s=v==null?"":String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(","));const blob=new Blob(["\uFEFF",[headers.map(v=>'"'+v+'"').join(","),...rows].join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="fermia-harvest-"+today+".csv";a.click();URL.revokeObjectURL(url);};
  return <section className="manage harvest">
    <div className="manage-intro"><div><small>FERMIA PRODUCTION</small><h2>収穫・生産実績</h2><p>収穫日・圃場・作物・数量・品質・出荷先を記録し、生産実績を蓄積します。</p></div><div className="manage-top-actions"><button className="manage-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={15}/>更新</button><button className="manage-refresh" onClick={exportCsv} disabled={!records.length}>CSV出力</button></div></div>
    {!org&&<div className="manage-empty"><b>組織IDが未設定です</b><span>農場・圃場管理で組織IDを設定してください。</span></div>}
    {error&&<div className="manage-error">{error}</div>}{notice&&<div className="manage-success">{notice}</div>}
    <div className="harvest-metrics"><div><span><Wheat size={18}/> 登録件数</span><strong>{records.length}<small>件</small></strong></div><div><span><TrendingUp size={18}/> 数量内訳（単位別）</span><strong className="harvest-quantity">{quantitySummary||"—"}</strong></div><div><span><Boxes size={18}/> 対象圃場</span><strong>{new Set(records.map(r=>r.field_id)).size}<small>筆</small></strong></div></div>
    <div className="manage-toolbar"><div><b>収穫記録一覧</b><span>{records.length} 件</span></div><button className="add" disabled={!org} onClick={()=>{setForm(blank);setEditing("");setShow(v=>!v);}}><Plus size={16}/>{show?"閉じる":"収穫を記録"}</button></div>
    {show&&<form className="manage-form" onSubmit={submit}><div className="manage-form-head"><b>{editing?"収穫記録を編集":"新しい収穫記録"}</b><button type="button" onClick={reset}><X size={16}/></button></div>
      <div className="manage-form-grid">
        <label>収穫日<input type="date" required value={form.harvested_on} onChange={e=>setForm(v=>({...v,harvested_on:e.target.value}))}/></label>
        <label>圃場<select required value={form.field_id} onChange={e=>setForm(v=>({...v,field_id:e.target.value,crop_cycle_id:""}))}><option value="">圃場を選択</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}{f.farm_name?" — "+f.farm_name:""}</option>)}</select></label>
        <label>作物・作付<select value={form.crop_cycle_id} onChange={e=>setForm(v=>({...v,crop_cycle_id:e.target.value}))}><option value="">作付を選択（任意）</option>{availableCrops.map(c=><option key={c.id} value={c.id}>{c.crop_name}{c.variety?" — "+c.variety:""}{c.season?" ("+c.season+")":""}</option>)}</select></label>
        <label>収穫数量<input type="number" min="0.001" step="any" required value={form.quantity} onChange={e=>setForm(v=>({...v,quantity:e.target.value}))} placeholder="例：1250"/></label>
        <label>単位<select value={form.unit} onChange={e=>setForm(v=>({...v,unit:e.target.value}))}>{["kg","t","袋","箱","個","束","本","ケース","L","その他"].map(u=><option key={u}>{u}</option>)}</select></label>
        <label>品質・規格<input maxLength={80} value={form.quality_grade} onChange={e=>setForm(v=>({...v,quality_grade:e.target.value}))} placeholder="例：秀・2L・A品"/></label>
        <label>出荷先・販売先<input maxLength={160} value={form.destination} onChange={e=>setForm(v=>({...v,destination:e.target.value}))} placeholder="例：JA・市場・直売所"/></label>
        <label className="wide">メモ<textarea maxLength={2000} value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} placeholder="収穫状況・品質・特記事項"/></label>
      </div><div className="manage-form-actions"><button type="button" className="cancel" onClick={reset}>キャンセル</button><button className="add" type="submit"><Save size={15}/>保存する</button></div>
    </form>}
    <div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>収穫日</th><th>農場・圃場</th><th>作物・品種</th><th>数量</th><th>品質</th><th>出荷先</th><th>操作</th></tr></thead><tbody>
      {records.map(r=><tr key={r.id}><td>{r.harvested_on}</td><td>{r.farm_name||"—"} / {r.field_name}</td><td>{r.crop_name||"未紐付け"}{r.variety?" / "+r.variety:""}</td><td>{r.quantity.toLocaleString("ja-JP",{maximumFractionDigits:2})} {r.unit}</td><td>{r.quality_grade||"—"}</td><td>{r.destination||"—"}</td><td><div className="manage-actions"><button title="編集" onClick={()=>startEdit(r)}><Pencil size={15}/></button><button title="削除" onClick={()=>void remove(r.id)}><Trash2 size={15}/></button></div></td></tr>)}
      {!records.length&&<tr><td colSpan={7} className="manage-no-data">{busy?"読み込み中…":"収穫記録はまだありません。収穫実績を登録してみましょう。"}</td></tr>}
    </tbody></table></div>
    <p className="manage-footnote">記録数量は単位ごとに保存されます。kgと箱など異なる単位を合算した値は、物理的な総重量を意味しません。登録・編集はオーナー、管理者、マネージャーのみ可能です。</p>
  </section>;
}
