import { useEffect, useState } from "react";
import { Clock3, Plus, RefreshCw, Save, Trash2, Pencil, X } from "lucide-react";

type Choice = { id: string; name?: string; title?: string };
type Log = { id: string; task_id?: string | null; field_id?: string | null; work_date: string; duration_minutes: number; notes?: string | null; task_title?: string | null; field_name?: string | null };
const today = new Date().toLocaleDateString("sv-SE");
const empty = { work_date: today, duration_minutes: "60", task_id: "", field_id: "", notes: "" };

export default function WorkLogs() {
  const [org, setOrg] = useState(() => localStorage.getItem("fermia_org_id") || "");
  const [logs, setLogs] = useState<Log[]>([]);
  const [tasks, setTasks] = useState<Choice[]>([]);
  const [fields, setFields] = useState<Choice[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = "?organization_id=" + encodeURIComponent(org);
  const api = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, credentials: "same-origin" });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "通信に失敗しました。"); }
    return response.status === 204 ? null : response.json();
  };
  const load = async () => {
    if (!org.trim()) return;
    setBusy(true); setError("");
    try {
      const [a,b,c] = await Promise.all([api("/api/work-logs"+query),api("/api/records/tasks"+query),api("/api/records/fields"+query)]);
      setLogs(a.items || []); setTasks(b.items || []); setFields(c.items || []);
    } catch (e) { setError(e instanceof Error ? e.message : "読み込みに失敗しました。"); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [org]);
  const reset = () => { setForm(empty); setEditing(""); setShow(false); };
  const edit = (log: Log) => {
    setForm({ work_date: log.work_date, duration_minutes: String(log.duration_minutes), task_id: log.task_id || "", field_id: log.field_id || "", notes: log.notes || "" });
    setEditing(log.id); setShow(true); setNotice("");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setNotice("");
    try {
      const body = { ...form, duration_minutes: Number(form.duration_minutes), task_id: form.task_id || null, field_id: form.field_id || null };
      await api(editing ? "/api/work-logs/"+encodeURIComponent(editing)+query : "/api/work-logs"+query, { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      reset(); setNotice(editing ? "作業記録を更新しました。" : "作業記録を保存しました。"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "保存に失敗しました。"); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("この作業記録を削除しますか？")) return;
    try { await api("/api/work-logs/"+encodeURIComponent(id)+query,{method:"DELETE"}); setNotice("削除しました。"); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : "削除に失敗しました。"); }
  };
  const total = logs.reduce((sum, item) => sum + item.duration_minutes, 0);
  return <section className="manage worklogs">
    <div className="manage-intro"><div><small>FERMIA WORK RECORDS</small><h2>作業時間・日報</h2><p>実際に行った作業時間を記録し、日々の作業実績を蓄積します。</p></div><div className="manage-top-actions"><button className="manage-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={15}/>更新</button></div></div>
    {!org && <div className="manage-empty"><b>組織IDが未設定です</b><span>上の「作業・スケジュール」で組織IDを設定してください。</span></div>}
    {error && <div className="manage-error">{error}</div>}{notice && <div className="manage-success">{notice}</div>}
    <div className="worklog-summary"><span><Clock3 size={20}/> 記録済みの合計時間</span><strong>{Math.floor(total/60)}時間 {total%60}分</strong><small>{logs.length} 件の記録</small></div>
    <div className="manage-toolbar"><div><b>作業実績</b><span>{logs.length} 件</span></div><button className="add" disabled={!org} onClick={()=>{setForm(empty);setEditing("");setShow(v=>!v);}}><Plus size={16}/>{show?"閉じる":"作業を記録"}</button></div>
    {show && <form className="manage-form" onSubmit={submit}><div className="manage-form-head"><b>{editing?"作業記録を編集":"作業時間を記録"}</b><button type="button" onClick={reset}><X size={16}/></button></div>
      <div className="manage-form-grid">
        <label>作業日 <input type="date" required value={form.work_date} onChange={e=>setForm(v=>({...v,work_date:e.target.value}))}/></label>
        <label>作業時間（分） <input type="number" min="1" max="1440" required value={form.duration_minutes} onChange={e=>setForm(v=>({...v,duration_minutes:e.target.value}))}/></label>
        <label>関連する作業予定 <select value={form.task_id} onChange={e=>setForm(v=>({...v,task_id:e.target.value}))}><option value="">選択しない</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label>圃場 <select value={form.field_id} onChange={e=>setForm(v=>({...v,field_id:e.target.value}))}><option value="">選択しない</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="wide">作業メモ <textarea maxLength={2000} value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} placeholder="作業内容・気づいたことなど"/></label>
      </div><div className="manage-form-actions"><button type="button" className="cancel" onClick={reset}>キャンセル</button><button className="add" type="submit"><Save size={15}/>保存する</button></div>
    </form>}
    <div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>作業日</th><th>作業予定</th><th>圃場</th><th>作業時間</th><th>メモ</th><th>操作</th></tr></thead><tbody>
      {logs.map(log=><tr key={log.id}><td>{log.work_date}</td><td>{log.task_title||"—"}</td><td>{log.field_name||"—"}</td><td>{Math.floor(log.duration_minutes/60)}時間 {log.duration_minutes%60}分</td><td>{log.notes||"—"}</td><td><div className="manage-actions"><button title="編集" onClick={()=>edit(log)}><Pencil size={15}/></button><button title="削除" onClick={()=>void remove(log.id)}><Trash2 size={15}/></button></div></td></tr>)}
      {!logs.length && <tr><td colSpan={6} className="manage-no-data">{busy?"読み込み中…":"作業記録はまだありません。作業を記録してみましょう。"}</td></tr>}
    </tbody></table></div>
    <p className="manage-footnote">スタッフは自分の記録を編集・削除できます。管理者・マネージャーは組織内の記録を編集でき、削除はオーナー・管理者に限定されます。</p>
  </section>;
}
