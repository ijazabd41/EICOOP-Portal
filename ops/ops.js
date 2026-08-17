const BASE_URL = window.location.origin + '/proxy.php';
const root = document.getElementById('ops-root');
let session = null;
let dashboard = null;
let transferPolicy = null;

async function requestJson(path, {method='GET', body=null}={}) {
  const opts = {
    method,
    credentials: 'include',
    headers: {'Accept':'application/json'},
  };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {raw:text}; }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `${res.status}: ${text}`);
  }
  return data;
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmt(v){if(v===null||v===undefined||v===false||v==='')return '—'; if(typeof v==='number')return new Intl.NumberFormat().format(v); return esc(v);}
function stateClass(s){return ['done','approved','certificate','sent','distributed'].includes(s)?'ok':['rejected','cancelled','failed','expired'].includes(s)?'bad':'warn';}

function shell(content){
  const isChairman = session?.role_codes?.includes('shareholder_chairman');
  const role = isChairman ? 'Shareholder Chairman' : 'Shareholder Operation Manager';
  root.innerHTML = `<div class="shell"><header class="topbar"><div><h1>EIC Shareholder Operations</h1><div class="role">${role}</div></div><div>${esc(session?.user?.name||'')} <button onclick="localStorage.removeItem('cd_session_id'); localStorage.removeItem('cd_user_id'); window.location.href='index.html'" style="margin-left: 15px; background: transparent; border: 1px solid currentColor; color: inherit; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.9em;">Logout</button></div></header><main class="content">${content}</main></div>`;
}

function navCards(){
  const p=session.permissions||{}; const cards=[];
  if(p.view_transfers) cards.push(card('Transfers','Operational & final transfer queue','transfers'));
  if(p.view_applications) cards.push(card('Applications','Membership / Finance review','applications'));
  if(p.view_certificates) cards.push(card('Certificates','Share holdings & certificates','certificates'));
  if(p.view_rewards) cards.push(card('Rewards / Dividends','Reward calculations','rewards'));
  if(p.view_notifications) cards.push(card('Notifications','Global shareholder delivery history','notifications'));
  if(p.view_audit) cards.push(card('Audit','Odoo chatter / activity trail','audit'));
  if(p.chairman_final_approval) cards.push(card('Final Approvals','Chairman transfer decision queue','approvals',true));
  return cards.join('');
}
function card(title,sub,key,chairman=false){return `<div class="card ${chairman?'chairman':''}" data-section="${key}"><span class="badge">${chairman?'Chairman':'Live data'}</span><strong>${esc(title)}</strong><div class="muted">${esc(sub)}</div></div>`;}

async function init(){
  root.innerHTML='<div class="loading">Loading Operations Portal…</div>';
  try{
    session=await requestJson('/api/shareholder/ops/bootstrap');
    dashboard=await requestJson('/api/shareholder/ops/dashboard');
    transferPolicy=await requestJson('/api/shareholder/ops/transfer-policy');
    renderHome();
  }catch(e){shell(`<div class="panel"><strong>OPS access unavailable</strong><p class="error">${esc(e.message)}</p><p class="muted">Use the authenticated Odoo session and confirm the user is mapped to shareholder_operation_manager or shareholder_chairman.</p></div>`);}
}

function renderHome(){
  const k=dashboard.kpis||{}, o=dashboard.ops_kpis||{};
  const auto=transferPolicy?.auto_complete_after_receiver_otp===true;
  const policyLabel=auto?'Automatic after Receiver OTP':'Chairman Final Approval';
  shell(`<div class="hero"><div><h2>${session.role_codes.includes('shareholder_chairman')?'Chairman Decision Center':'Operations Control Center'}</h2><div class="muted">Operations approval before receiver notification is always mandatory.</div></div><button id="refresh">Refresh</button></div>
  <section class="panel policy-panel">
    <div><span class="badge">Transfer Policy · affects new transfers only</span><h3>Final gate: ${esc(policyLabel)}</h3>
      <div class="muted">${auto?'After Operations approval, receiver acceptance and receiver OTP, the system completes automatically.':'After Operations approval, receiver acceptance and receiver OTP, Chairman final approval is required.'}</div>
      <div class="muted">Each transfer keeps the policy that was active when it was created.</div>
    </div>
    ${session.permissions?.manage_transfer_policy?`<button id="toggle-policy" class="${auto?'danger':'gold'}">${auto?'Disable Automatic Completion':'Enable Automatic Completion'}</button>`:''}
  </section>
  <div class="grid">
    ${kpi('Shareholders',k.total_shareholders)}${kpi('Pending Transfers',k.transfers_pending)}${kpi('Waiting Operations',o.transfers_waiting_operations)}${kpi('Waiting Chairman',o.transfers_waiting_chairman)}
    ${kpi('Pending Applications',o.applications_submitted)}${kpi('Certificates',k.certificates)}${kpi('Unread Notifications',k.unread_notifications)}${kpi('Pending Invitations',k.pending_invitations)}
  </div><div class="grid">${navCards()}</div><section class="panel"><strong>Recent Activity</strong>${recentTable(dashboard.recent_activities||[])}</section>`);
  document.getElementById('refresh').onclick=init;
  const toggle=document.getElementById('toggle-policy');
  if(toggle) toggle.onclick=()=>changeTransferPolicy(!auto);
  document.querySelectorAll('[data-section]').forEach(el=>el.onclick=()=>loadSection(el.dataset.section));
}

async function changeTransferPolicy(enabled){
  const effect=enabled
    ? 'New transfers will still require Operations approval before the receiver is notified, then will complete automatically after receiver OTP.'
    : 'New transfers will still require Operations approval before the receiver is notified, then will require Chairman final approval after receiver OTP.';
  if(!confirm(`${enabled?'Enable':'Disable'} automatic completion?\n\n${effect}\n\nExisting transfers will keep their snapshotted policy.`)) return;
  const note=prompt('Management note / reason (optional)')||'';
  try{
    await requestJson('/api/shareholder/ops/transfer-policy',{method:'POST',body:{auto_complete_after_receiver_otp:enabled,note}});
    await init();
  }catch(e){alert(e.message);}
}

function kpi(label,value){return `<div class="kpi"><span class="muted">${esc(label)}</span><strong>${fmt(value||0)}</strong></div>`;}
function recentTable(rows){if(!rows.length)return '<div class="empty">No activity</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Name</th><th>Membership</th><th>Activity</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.date)}</td><td>${fmt(r.name)}</td><td>${fmt(r.membership)}</td><td>${fmt(r.activity)}</td></tr>`).join('')}</tbody></table></div>`;}

async function loadSection(key){
  shell(`<div class="hero"><button class="secondary" id="back">← Dashboard</button><h2>${esc(titleFor(key))}</h2></div><div class="panel loading">Loading…</div>`);
  document.getElementById('back').onclick=renderHome;
  try{
    let path={transfers:'/api/shareholder/ops/transfers',applications:'/api/shareholder/ops/applications',certificates:'/api/shareholder/ops/certificates',rewards:'/api/shareholder/ops/rewards',notifications:'/api/shareholder/ops/notifications',audit:'/api/shareholder/ops/audit',approvals:'/api/shareholder/ops/approvals'}[key];
    const data=await requestJson(path); renderSection(key,data);
  }catch(e){document.querySelector('.panel').innerHTML=`<p class="error">${esc(e.message)}</p>`;}
}
function titleFor(k){return ({transfers:'Transfers',applications:'Applications',certificates:'Certificates',rewards:'Rewards / Dividends',notifications:'Notifications',audit:'Audit',approvals:'Final Approvals'})[k]||k;}

function renderSection(key,data){
  const content={
    transfers:()=>transferTable(data.transfers||[]),
    approvals:()=>transferTable(data.approvals||[]),
    applications:()=>applicationTable(data.applications||[]),
    certificates:()=>certificateTable(data.certificates||[]),
    rewards:()=>rewardTable(data.rewards||[]),
    notifications:()=>notificationTable(data.notifications||[]),
    audit:()=>auditTable(data.audit||[]),
  }[key]();
  shell(`<div class="hero"><button class="secondary" id="back">← Dashboard</button><div><h2>${esc(titleFor(key))}</h2><div class="muted">${fmt(data.total ?? '')}</div></div><button id="reload">Refresh</button></div><section class="panel">${content}</section>`);
  document.getElementById('back').onclick=renderHome; document.getElementById('reload').onclick=()=>loadSection(key);
  document.querySelectorAll('[data-transfer]').forEach(el=>el.onclick=()=>openTransfer(Number(el.dataset.transfer),key));
  document.querySelectorAll('[data-application]').forEach(el=>el.onclick=()=>openApplication(Number(el.dataset.application),key));
}

function transferTable(rows){if(!rows.length)return '<div class="empty">No transfer records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Sender</th><th>Receiver</th><th>Shares</th><th>State</th><th>Final Gate</th><th>Ops</th><th>Chairman</th></tr></thead><tbody>${rows.map(r=>`<tr class="rowlink" data-transfer="${r.id}"><td>${fmt(r.reference)}</td><td>${fmt(r.sender?.membership_number)} · ${fmt(r.sender?.name)}</td><td>${fmt(r.receiver?.membership_number)} · ${fmt(r.receiver?.name)}</td><td>${fmt(r.shares)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td><td>${r.auto_complete_after_receiver_otp?'Automatic':'Chairman'}</td><td>${fmt(r.operations_review?.status)}</td><td>${fmt(r.chairman_review?.status)}</td></tr>`).join('')}</tbody></table></div>`;}
function applicationTable(rows){if(!rows.length)return '<div class="empty">No application records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Applicant</th><th>Mobile</th><th>Shares</th><th>Total</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr class="rowlink" data-application="${r.id}"><td>${fmt(r.reference)}</td><td>${fmt(r.applicant_name)}</td><td>${fmt(r.mobile)}</td><td>${fmt(r.requested_shares)}</td><td>${fmt(r.total_amount)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td></tr>`).join('')}</tbody></table></div>`;}
function certificateTable(rows){if(!rows.length)return '<div class="empty">No certificate/share records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Certificate</th><th>Shareholder</th><th>Membership</th><th>Shares</th><th>Value</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.certificate_number||r.reference)}</td><td>${fmt(r.shareholder?.name)}</td><td>${fmt(r.shareholder?.membership_number)}</td><td>${fmt(r.shares)}</td><td>${fmt(r.total_share_value)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td></tr>`).join('')}</tbody></table></div>`;}
function rewardTable(rows){if(!rows.length)return '<div class="empty">No reward records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Period</th><th>Dates</th><th>Purchases</th><th>Reward</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.reference)}</td><td>${fmt(r.period_type)}</td><td>${fmt(r.date_from)} → ${fmt(r.date_to)}</td><td>${fmt(r.total_purchase)}</td><td>${fmt(r.total_reward)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td></tr>`).join('')}</tbody></table></div>`;}
function notificationTable(rows){if(!rows.length)return '<div class="empty">No notification records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Shareholder</th><th>Title</th><th>Category</th><th>State</th><th>Channels</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.created_at)}</td><td>${fmt(r.shareholder?.membership_number)} · ${fmt(r.shareholder?.name)}</td><td>${fmt(r.title)}</td><td>${fmt(r.category)}</td><td class="state ${stateClass(r.state)}">${fmt(r.state)}</td><td>S:${fmt(r.sms_state)} E:${fmt(r.email_state)} P:${fmt(r.push_state)} W:${fmt(r.whatsapp_state)}</td></tr>`).join('')}</tbody></table></div>`;}
function auditTable(rows){if(!rows.length)return '<div class="empty">No audit records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Actor</th><th>Model</th><th>Record</th><th>Message</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.date)}</td><td>${fmt(r.author)}</td><td>${fmt(r.model)}</td><td>${fmt(r.res_id)}</td><td>${fmt(r.body)}</td></tr>`).join('')}</tbody></table></div>`;}

async function openTransfer(id,backKey='transfers'){
  try{
    const d=await requestJson(`/api/shareholder/ops/transfers/${id}`), r=d.transfer;
    const finalGate=r.auto_complete_after_receiver_otp?'Automatic after Receiver OTP':'Chairman Final Approval';
    shell(`<div class="hero"><button class="secondary" id="back">← ${esc(titleFor(backKey))}</button><div><h2>${fmt(r.reference)}</h2><div class="muted">${fmt(r.workflow_phase_label||r.state_label)} · Policy snapshotted at creation</div></div></div><section class="panel"><div class="detail-grid">
      ${field('Sender',`${r.sender?.membership_number||''} · ${r.sender?.name||''}`)}${field('Receiver',`${r.receiver?.membership_number||''} · ${r.receiver?.name||''}`)}${field('Shares',r.shares)}
      ${field('Sender OTP',r.sender_otp_verified?'Verified':'Pending')}${field('Receiver Acceptance',r.receiver_approval)}${field('Receiver OTP',r.receiver_otp_verified?'Verified':'Pending')}
      ${field('Operations Review',r.operations_review?.status)}${field('Chairman Review',r.chairman_review?.status)}${field('Final Gate',finalGate)}
      ${field('Workflow Stage',r.workflow_phase_label||r.state_label)}
    </div><div class="notice">Operations approval before the receiver is notified is mandatory for every transfer. This transfer will ${r.auto_complete_after_receiver_otp?'complete automatically after receiver OTP.':'wait for Chairman final approval after receiver OTP.'}</div><div class="actions" id="actions"></div></section>`);
    document.getElementById('back').onclick=()=>loadSection(backKey);
    const a=document.getElementById('actions');
    const isOps = session?.role_codes?.includes('shareholder_operation_manager');
    const isChair = session?.role_codes?.includes('shareholder_chairman');

    const showOps = r.can_operations_review ?? (isOps && ['operator', 'waiting_operations', 'submitted'].includes(r.state));
    const showChair = r.can_chairman_approve ?? (isChair && ['approved', 'waiting_chairman', 'operator'].includes(r.state));
    const showComplete = r.can_complete ?? (isOps && ['approved', 'operator'].includes(r.state));

    if(showOps || isOps){a.innerHTML+=`<button data-act="ops-approve"${!showOps ? ' disabled' : ''}>Approve & Send to Receiver</button><button class="danger" data-act="ops-reject"${!showOps ? ' disabled' : ''}>Operations Reject</button>`;}
    if(showChair || isChair){a.innerHTML+=`<button class="gold" data-act="chair-approve"${!showChair ? ' disabled' : ''}>Chairman Approve</button><button class="danger" data-act="chair-reject"${!showChair ? ' disabled' : ''}>Chairman Reject</button>`;}
    if(showComplete || isOps){a.innerHTML+=`<button data-act="complete"${!showComplete ? ' disabled' : ''}>Complete Transfer</button>`;}
    a.querySelectorAll('button').forEach(btn=>btn.onclick=()=>runTransferAction(id,btn.dataset.act,backKey));
  }catch(e){shell(`<div class="panel"><p class="error">${esc(e.message)}</p></div>`);}
}
function field(label,value){return `<div class="field"><label>${esc(label)}</label><b>${fmt(value)}</b></div>`;}
async function runTransferAction(id,act,backKey){
  const note=prompt(act.includes('reject')?'Reason / note':'Approval note (optional)')||'';
  try{
    if(act==='ops-approve'||act==='ops-reject') await requestJson(`/api/shareholder/ops/transfers/${id}/review`,{method:'POST',body:{action:act.endsWith('approve')?'approve':'reject',note}});
    else if(act==='chair-approve'||act==='chair-reject') await requestJson(`/api/shareholder/ops/transfers/${id}/chairman`,{method:'POST',body:{action:act.endsWith('approve')?'approve':'reject',note}});
    else if(act==='complete') await requestJson(`/api/shareholder/ops/transfers/${id}/complete`,{method:'POST',body:{}});
    await openTransfer(id,backKey);
  }catch(e){alert(e.message);}
}

async function openApplication(id,backKey='applications'){
  const d=await requestJson(`/api/shareholder/ops/applications/${id}`), r=d.application;
  shell(`<div class="hero"><button class="secondary" id="back">← Applications</button><div><h2>${fmt(r.reference)}</h2><div class="muted">${fmt(r.state_label)}</div></div></div><section class="panel"><div class="detail-grid">${field('Applicant',r.applicant_name)}${field('Mobile',r.mobile)}${field('Email',r.email)}${field('Requested Shares',r.requested_shares)}${field('Total Amount',r.total_amount)}${field('UAE Citizen',r.uae_citizen?'Yes':'No')}${field('Emirates ID',r.emirates_id)}${field('Family Book',r.family_book_number)}${field('Operator',r.operator)}</div><div class="actions" id="actions"></div></section>`);
  document.getElementById('back').onclick=()=>loadSection(backKey);
  const a=document.getElementById('actions');
  const isOps = session?.role_codes?.includes('shareholder_operation_manager');
  const canReview = session?.permissions?.membership_review ?? isOps;

  if(canReview){
    if(r.state==='submitted' || isOps) a.innerHTML+='<button data-act="document_review">Documents Reviewed</button>';
    if(r.state==='document_review' || isOps) a.innerHTML+='<button data-act="finance">Send to Finance</button>';
    if(['submitted','document_review','finance'].includes(r.state) || isOps) a.innerHTML+='<button data-act="approve">Approve Membership</button><button class="danger" data-act="reject">Reject</button>';
  }
  a.querySelectorAll('button').forEach(btn=>btn.onclick=async()=>{const reason=btn.dataset.act==='reject'?(prompt('Rejection reason')||''):'';try{await requestJson(`/api/shareholder/ops/applications/${id}/action`,{method:'POST',body:{action:btn.dataset.act,reason}});await openApplication(id,backKey);}catch(e){alert(e.message);}});
}

init();
