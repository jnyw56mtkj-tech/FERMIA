import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Save, Trash2, Pencil, X, Users, TrendingUp, Wallet, Download } from "lucide-react";

type Section = "sales" | "expenses" | "customers";
type Row = { id: string; [key: string]: any };
type Field = { key: string; label: string; type?: "date" | "number" | "textarea" | "select" | "customer"; required?: boolean; options?: string[]; placeholder?: string };
const today = new Date().toLocaleDateString("sv-SE");
const configs: Record<Section, { title: string; description: string; fields: Field[]; columns: {key:string;label:string}[] }> = {
  sales: {
    title: "売上管理", description: "販売日・販売品目・取引先・数量・売上金額・入金状況を管理します。",
    fields: [
      {key:"sold_on",label:"販売日",type:"date",required:true},
      {key:"product_name",label:"販売品目",required:true,placeholder:"例：令和8年産 コシヒカリ"},
      {key:"customer_id",label:"取引先",type:"customer"},
      {key:"quantity",label:"数量",type:"number",placeholder:"例：30"},
      {key:"unit",label:"単位",placeholder:"kg・袋・箱など"},
      {key:"unit_price",label:"単価（円）",type:"number"},
      {key:"amount",label:"売上金額（円）",type:"number",required:true},
      {key:"payment_status",label:"入金状況",type:"select",options:["unpaid","partial","paid"]},
      {key:"notes",label:"メモ",type:"textarea"}
    ],
    columns:[{key:"sold_on",label:"販売日"},{key:"product_name",label:"販売品目"},{key:"customer_name",label:"取引先"},{key:"quantity",label:"数量"},{key:"amount",label:"売上金額"},{key:"payment_status",label:"入金状況"}]
  },
  expenses: {
    title:"経費管理",description:"肥料・農薬・燃料・機械・人件費など、農業経営にかかる支出を記録します。",
    fields:[
      {key:"spent_on",label:"支出日",type:"date",required:true},
      {key:"category",label:"費目",type:"select",options:["肥料費","農薬費","種苗費","飼料費","燃料費","動力光熱費","修繕費","機械・設備費","資材費","人件費","運賃・荷造費","地代・賃借料","その他"],required:true},
      {key:"description",label:"内容",required:true,placeholder:"例：追肥用肥料 20袋"},
      {key:"vendor",label:"購入先・支払先",placeholder:"例：農協・資材店"},
      {key:"amount",label:"金額（円）",type:"number",required:true},
      {key:"payment_method",label:"支払方法",placeholder:"現金・振込・カードなど"},
      {key:"notes",label:"メモ",type:"textarea"}
    ],
    columns:[{key:"spent_on",label:"支出日"},{key:"category",label:"費目"},{key:"description",label:"内容"},{key:"vendor",label:"支払先"},{key:"amount",label:"金額"}]
  },
  customers: {
    title:"取引先管理",description:"JA・市場・卸売業者・飲食店・直売所など、販売先や取引先の情報を管理します。",
    fields:[
      {key:"name",label:"取引先名",required:true,placeholder:"例：〇〇青果市場"},
      {key:"contact_name",label:"担当者名"},
      {key:"phone",label:"電話番号"},
      {key:"email",label:"メールアドレス"},
      {key:"address",label:"住所"},
      {key:"notes",label:"メモ",type:"textarea"}
    ],
    columns:[{key:"name",label:"取引先名"},{key:"contact_name",label:"担当者"},{key:"phone",label:"電話番号"},{key:"email",label:"メールアドレス"},{key:"address",label:"住所"}]
  }
};
const statusLabel: Record<string,string> = {unpaid:"未入金",partial:"一部入金",paid:"入金済み"};
const money=(v:number)=>"¥"+Number(v||0).toLocaleString("ja-JP");
const blankForm=(section:Section)=>Object.fromEntries(configs[section].fields.map(f=>[f.key, f.key==="sold_on"||f.key==="spent_on"?today:f.key==="payment_status"?"unpaid":""]));

export default function Finance(){
  const [org,setOrg]=useState(()=>localStorage.getItem("fermia_org_id")||"");
  const [section,setSection]=useState<Section>("sales");
  const [rows,setRows]=useState<Row[]>([]);
  const [customers,setCustomers]=useState<Row[]>([]);
  const [form,setForm]=useState<Record<string,string>>({});
  const [editing,setEditing]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const query="?organization_id="+encodeURIComponent(org);
  const api=async(url:string,init?:RequestInit)=>{const r=await fetch(url,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...(init?.headers||{})}});if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(b.error||"通信に失敗しました。");}return r.status===204?null:r.json();};
  const load=async()=>{if(!org.trim())return;setBusy(true);setError("");try{const [current,c]=await Promise.all([api("/api/finance/"+section+query),api("/api/finance/customers"+query)]);setRows(current.items||[]);setCustomers(c.items||[]);}catch(e){setError(e instanceof Error?e.message:"読み込みに失敗しました。");}finally{setBusy(false);}};
  useEffect(()=>{void load();},[org,section]);
  const totals=useMemo(()=>({sales:rows.filter(r=>section==="sales").reduce((s,r)=>s+Number(r.amount||0),0),expenses:rows.filter(r=>section==="expenses").reduce((s,r)=>s+Number(r.amount||0),0)}),[rows,section]);
  const reset=()=>{setForm(blankForm(section));setEditing("");setShow(false);};
  const startEdit=(r:Row)=>{const next:Record<string,string>={};for(const f of configs[section].fields){const v=r[f.key];next[f.key]=v==null?"":String(v);}setForm(next);setEditing(r.id);setShow(true);setNotice("");};
  const submit=async(e:FormEvent)=>{e.preventDefault();setError("");setNotice("");const body:Record<string,unknown>={...form};for(const f of configs[section].fields){if(f.type==="number")body[f.key]=form[f.key]===""?null:Number(form[f.key]);if(form[f.key]==="")body[f.key]=null;}try{await api(editing?"/api/finance/"+section+"/"+encodeURIComponent(editing)+query:"/api/finance/"+section+query,{method:editing?"PATCH":"POST",body:JSON.stringify(body)});reset();setNotice(editing?"内容を更新しました。":"登録しました。");await load();}catch(e){setError(e instanceof Error?e.message:"保存に失敗しました。");}};
  const remove=async(id:string)=>{if(!window.confirm("この記録を削除しますか？"))return;try{await api("/api/finance/"+section+"/"+encodeURIComponent(id)+query,{method:"DELETE"});setNotice("削除しました。");await load();}catch(e){setError(e instanceof Error?e.message:"削除に失敗しました。");}};
  const exportCsv=()=>{const cols=configs[section].columns;const quote=(v:unknown)=>{let s=v==null?"":String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const csv=[cols.map(c=>quote(c.label)).join(","),...rows.map(r=>cols.map(c=>quote(c.key==="payment_status"?statusLabel[r[c.key]]||r[c.key]:r[c.key])).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="fermia-"+section+"-"+today+".csv";a.click();URL.revokeObjectURL(url);};
  const labelValue=(key:string,value:any)=>key==="payment_status"?statusLabel[value]||value:key==="amount"?money(value):value==null||value===""?"—":String(value);
  return <section className="manage finance">
    <div className="manage-intro"><div><small>FERMIA BUSINESS</small><h2>経営・売上・経費</h2><p>取引先、販売実績、支出をまとめて、農業経営の数字を管理します。</p></div><div className="manage-top-actions"><button className="manage-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={15}/>更新</button><button className="manage-refresh" onClick={exportCsv} disabled={!rows.length}><Download size={15}/>CSV出力</button></div></div>
    {!org&&<div className="manage-empty"><b>組織IDが未設定です</b><span>農場・圃場管理で組織IDを設定してください。</span></div>}
    {error&&<div className="manage-error">{error}</div>}{notice&&<div className="manage-success">{notice}</div>}
    <div className="finance-tabs">{(["sales","expenses","customers"] as Section[]).map(s=><button key={s} className={section===s?"selected":""} onClick={()=>{setSection(s);setForm(blankForm(s));setShow(false);setEditing("");}}>{s==="sales"?"売上管理":s==="expenses"?"経費管理":"取引先管理"}</button>)}</div>
    <div className="harvest-metrics finance-metrics">
      <div><span><TrendingUp size={18}/> {section==="sales"?"登録売上合計":"今表示中の売上"}</span><strong>{section==="sales"?money(totals.sales):"—"}</strong></div>
      <div><span><Wallet size={18}/> {section==="expenses"?"登録経費合計":"今表示中の経費"}</span><strong>{section==="expenses"?money(totals.expenses):"—"}</strong></div>
      <div><span><Users size={18}/> 登録取引先</span><strong>{customers.length}<small>社</small></strong></div>
    </div>
    <div className="manage-toolbar"><div><b>{configs[section].title}</b><span>{rows.length} 件</span></div><button className="add" disabled={!org} onClick={()=>{setForm(blankForm(section));setEditing("");setShow(v=>!v);}}><Plus size={16}/>{show?"閉じる":"新規登録"}</button></div>
    {show&&<form className="manage-form" onSubmit={submit}><div className="manage-form-head"><b>{editing?"登録内容を編集":"新しい記録を登録"}</b><button type="button" onClick={reset}><X size={16}/></button></div><div className="manage-form-grid">
      {configs[section].fields.map(f=><label key={f.key} className={f.type==="textarea"?"wide":""}>{f.label}{f.type==="textarea"?<textarea required={f.required} maxLength={2000} value={form[f.key]||""} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}/>:f.type==="select"?<select required={f.required} value={form[f.key]||""} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}>{f.key==="payment_status"&&<option value="unpaid">未入金</option>}{(f.options||[]).filter(o=>f.key!=="payment_status").map(o=><option key={o} value={o}>{o}</option>)}{f.key==="payment_status"&&<><option value="partial">一部入金</option><option value="paid">入金済み</option></>}</select>:f.type==="customer"?<select value={form[f.key]||""} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}><option value="">取引先を選択（任意）</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:<input type={f.type||"text"} required={f.required} min={f.type==="number"?"0":undefined} step={f.type==="number"?"any":undefined} value={form[f.key]||""} placeholder={f.placeholder} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}/>}</label>)}
    </div><div className="manage-form-actions"><button type="button" className="cancel" onClick={reset}>キャンセル</button><button className="add" type="submit"><Save size={15}/>保存する</button></div></form>}
    <div className="manage-table-wrap"><table className="manage-table"><thead><tr>{configs[section].columns.map(c=><th key={c.key}>{c.label}</th>)}<th>操作</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>{configs[section].columns.map(c=><td key={c.key}>{labelValue(c.key,r[c.key])}</td>)}<td><div className="manage-actions"><button title="編集" onClick={()=>startEdit(r)}><Pencil size={15}/></button><button title="削除" onClick={()=>void remove(r.id)}><Trash2 size={15}/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan={configs[section].columns.length+1} className="manage-no-data">{busy?"読み込み中…":"登録データはまだありません。"}</td></tr>}</tbody></table></div>
    <p className="manage-footnote">売上・経費データは組織単位で分離され、オーナー・管理者・マネージャーのみ閲覧・登録・編集できます。削除はオーナー・管理者に限定されます。税務申告や会計帳簿の代替ではありません。</p>
  </section>;
}
