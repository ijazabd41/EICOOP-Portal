const BASE_URL = window.location.origin + '/proxy.php?_path=';
const root = document.getElementById('ops-root');
let session = null;
let dashboard = null;
let transferPolicy = null;
let marketplaceConfig = null;

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

function shell(content, activeKey=''){
  const isChairman = session?.role_codes?.includes('shareholder_chairman');
  const role = isChairman ? 'Shareholder Chairman' : 'Shareholder Operation Manager';
  const p=session?.permissions||{};
  const navItems = [{key:'home',label:'Dashboard'}];
  if(p.view_transfers) navItems.push({key:'transfers',label:'Transfers'});
  if(p.view_applications) navItems.push({key:'applications',label:'Applications'});
  if(p.view_certificates) navItems.push({key:'certificates',label:'Certificates'});
  if(p.view_rewards) navItems.push({key:'rewards',label:'Rewards'});
  if(p.view_notifications) navItems.push({key:'notifications',label:'Notifications'});
  if(p.view_audit) navItems.push({key:'audit',label:'Audit'});
  if(p.chairman_final_approval) navItems.push({key:'approvals',label:'Final Approvals'});
  if(!isChairman || p.manage_marketplace) navItems.push({key:'marketplace',label:'Marketplace'});
  
  const navHtml = `<nav class="ops-nav">${navItems.map(item=>`<a href="#" class="${activeKey===item.key?'active':''}" data-nav="${item.key}">${esc(item.label)}</a>`).join('')}</nav>`;

  root.innerHTML = `<div class="shell"><header class="topbar"><div><h1>EIC Shareholder Operations</h1><div class="role">${role}</div></div><div>${esc(session?.user?.name||'')} <button onclick="localStorage.removeItem('cd_session_id'); localStorage.removeItem('cd_user_id'); window.location.href='index.html'" style="margin-left: 15px; background: transparent; border: 1px solid currentColor; color: inherit; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.9em;">Logout</button></div></header>${navHtml}<main class="content">${content}</main></div>`;

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const k = el.dataset.nav;
      if (k === 'home') renderHome();
      else loadSection(k);
    };
  });
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
  if(!session?.role_codes?.includes('shareholder_chairman') || p.manage_marketplace) cards.push(card('Marketplace','Manage share listings and offers','marketplace'));
  return cards.join('');
}
function card(title,sub,key,chairman=false){
  return `<div class="card ${chairman?'chairman':''}" data-section="${key}">
    <div style="display:flex; flex-direction:column; gap:5px;">
      <span class="badge" style="${chairman ? 'background:#fef3c7; color:#b45309;' : 'background:#e0f2fe; color:#0369a1;'}">${chairman?'Chairman':'Live data'}</span>
      <strong>${esc(title)}</strong>
      <div class="muted">${esc(sub)}</div>
    </div>
    <div class="arrow">➔</div>
  </div>`;
}

async function init(){
  root.innerHTML='<div class="loading">Loading Operations Portal…</div>';
  try{
    session=await requestJson('/api/shareholder/ops/bootstrap');
    dashboard=await requestJson('/api/shareholder/ops/dashboard');
    transferPolicy=await requestJson('/api/shareholder/ops/transfer-policy');
    try { marketplaceConfig = await requestJson('/api/shareholder/ops/marketplace/config'); } catch(e) { marketplaceConfig = { is_trading_active: false }; }
    renderHome();
  }catch(e){shell(`<div class="panel"><strong>OPS access unavailable</strong><p class="error">${esc(e.message)}</p><p class="muted">Use the authenticated Odoo session and confirm the user is mapped to shareholder_operation_manager or shareholder_chairman.</p></div>`);}
}

function renderHome(){
  const k=dashboard.kpis||{}, o=dashboard.ops_kpis||{};
  const auto=transferPolicy?.auto_complete_after_receiver_otp===true;
  const policyLabel=auto?'Automatic after Receiver OTP':'Chairman Final Approval';
  let notifs = '';
  if(o.transfers_waiting_operations>0) notifs += `<div class="notice-banner alert-ops" style="display:flex; justify-content:space-between; align-items:center;"><div><strong>Attention:</strong> ${fmt(o.transfers_waiting_operations)} transfer(s) waiting for Operations approval.</div><button class="secondary" style="margin:0; padding:4px 12px; font-size:12px;" onclick="loadSection('transfers')">View ➔</button></div>`;
  if(o.transfers_waiting_chairman>0) notifs += `<div class="notice-banner alert-chair" style="display:flex; justify-content:space-between; align-items:center;"><div><strong>Attention:</strong> ${fmt(o.transfers_waiting_chairman)} transfer(s) waiting for Chairman approval.</div><button class="secondary" style="margin:0; padding:4px 12px; font-size:12px;" onclick="loadSection('approvals')">View ➔</button></div>`;
  
  shell(`${notifs}<div class="hero"><div><h2>${session.role_codes.includes('shareholder_chairman')?'Chairman Decision Center':'Operations Control Center'}</h2><div class="muted">Operations approval before receiver notification is always mandatory.</div></div><button id="refresh">Refresh</button></div>
  <section class="panel policy-panel">
    <div><span class="badge">Transfer Policy · affects new transfers only</span><h3>Final gate: ${esc(policyLabel)}</h3>
      <div class="muted">${auto?'After Operations approval, receiver acceptance and receiver OTP, the system completes automatically.':'After Operations approval, receiver acceptance and receiver OTP, Chairman final approval is required.'}</div>
      <div class="muted">Each transfer keeps the policy that was active when it was created.</div>
    </div>
    ${session.permissions?.manage_transfer_policy?`<button id="toggle-policy" class="${auto?'danger':'gold'}">${auto?'Disable Automatic Completion':'Enable Automatic Completion'}</button>`:''}
  </section>
  <section class="panel policy-panel">
    <div><span class="badge">Marketplace Configuration</span><h3>Trading Status: ${marketplaceConfig?.is_trading_active ? 'Active' : 'Halted'}</h3>
      <div class="muted">Min share price: ${fmt(marketplaceConfig?.min_share_price)} AED | Max share price: ${fmt(marketplaceConfig?.max_share_price)} AED</div>
    </div>
    ${session.permissions?.manage_marketplace || !session?.role_codes?.includes('shareholder_chairman')?`<button id="config-marketplace" class="secondary">Edit Config</button>`:''}
  </section>
  <div class="grid">
    ${kpi('Shareholders',k.total_shareholders)}${kpi('Pending Transfers',k.transfers_pending)}${kpi('Waiting Operations',o.transfers_waiting_operations)}${kpi('Waiting Chairman',o.transfers_waiting_chairman)}
    ${kpi('Pending Applications',o.applications_submitted)}${kpi('Certificates',k.certificates)}${kpi('Unread Notifications',k.unread_notifications)}${kpi('Pending Invitations',k.pending_invitations)}
  </div><div class="grid">${navCards()}</div><section class="panel"><strong>Recent Activity</strong>${recentTable(dashboard.recent_activities||[])}</section>`, 'home');
  document.getElementById('refresh').onclick=init;
  const toggle=document.getElementById('toggle-policy');
  if(toggle) toggle.onclick=()=>changeTransferPolicy(!auto);
  const cfgBtn=document.getElementById('config-marketplace');
  if(cfgBtn) cfgBtn.onclick=editMarketplaceConfig;
  document.querySelectorAll('[data-section]').forEach(el=>el.onclick=()=>loadSection(el.dataset.section));
}

async function changeTransferPolicy(enabled){
  const effect=enabled
    ? 'New transfers will still require Operations approval before the receiver is notified, then will complete automatically after receiver OTP.'
    : 'New transfers will still require Operations approval before the receiver is notified, then will require Chairman final approval after receiver OTP.';
  if(!await customConfirm('Confirm Policy Change', `${enabled?'Enable':'Disable'} automatic completion?\n\n${effect}\n\nExisting transfers will keep their snapshotted policy.`)) return;
  const note=(await customPrompt('Note', 'Management note / reason (optional)'))||'';
  try{
    await requestJson('/api/shareholder/ops/transfer-policy',{method:'POST',body:{auto_complete_after_receiver_otp:enabled,note}});
    await init();
  }catch(e){alert(e.message);}
}

async function editMarketplaceConfig() {
  const isActive = await customConfirm("Change Trading Status", `Current Trading Status: ${marketplaceConfig.is_trading_active ? 'ACTIVE' : 'HALTED'}\n\nDo you want trading to be ACTIVE? (Cancel for HALTED)`);
  const minPrice = await customPrompt("Config", "Enter minimum share price (AED):", marketplaceConfig.min_share_price || "100.0");
  if (minPrice === null) return;
  const maxPrice = await customPrompt("Config", "Enter maximum share price (AED):", marketplaceConfig.max_share_price || "100.0");
  if (maxPrice === null) return;
  
  try {
    await requestJson('/api/shareholder/ops/marketplace/config', {
      method: 'POST',
      body: {
        is_trading_active: isActive,
        min_share_price: parseFloat(minPrice),
        max_share_price: parseFloat(maxPrice)
      }
    });
    alert("Marketplace configuration updated.");
    await init();
  } catch(e) {
    alert("Failed to update config: " + e.message);
  }
}

function kpi(label,value){return `<div class="kpi"><span class="muted">${esc(label)}</span><strong>${fmt(value||0)}</strong></div>`;}
function recentTable(rows){if(!rows.length)return '<div class="empty">No activity</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Name</th><th>Membership</th><th>Activity</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.date)}</td><td>${fmt(r.name)}</td><td>${fmt(r.membership)}</td><td>${fmt(r.activity)}</td></tr>`).join('')}</tbody></table></div>`;}

async function loadSection(key){
  shell(`<div class="hero"><button class="secondary" id="back">← Dashboard</button><h2>${esc(titleFor(key))}</h2></div><div class="panel loading">Loading…</div>`, key);
  document.getElementById('back').onclick=renderHome;
  try{
    let path={transfers:'/api/shareholder/ops/transfers',applications:'/api/shareholder/ops/applications',certificates:'/api/shareholder/ops/certificates',rewards:'/api/shareholder/ops/rewards',notifications:'/api/shareholder/ops/notifications',audit:'/api/shareholder/ops/audit',approvals:'/api/shareholder/ops/approvals',marketplace:'/api/shareholder/ops/marketplace/listings'}[key];
    const data=await requestJson(path); renderSection(key,data);
  }catch(e){document.querySelector('.panel').innerHTML=`<p class="error">${esc(e.message)}</p>`;}
}
function titleFor(k){return ({transfers:'Transfers',applications:'Applications',certificates:'Certificates',rewards:'Rewards / Dividends',notifications:'Notifications',audit:'Audit',approvals:'Final Approvals',marketplace:'Marketplace'})[k]||k;}

function renderSection(key,data){
  const content={
    transfers:()=>transferTable(data.transfers||[]),
    approvals:()=>transferTable(data.approvals||[]),
    applications:()=>applicationTable(data.applications||[]),
    certificates:()=>certificateTable(data.certificates||[]),
    rewards:()=>rewardTable(data.rewards||[]),
    notifications:()=>notificationTable(data.notifications||[]),
    audit:()=>auditTable(data.audit||[]),
    marketplace:()=>marketplaceTable(data.listings||data.data||[]),
  }[key]();
  shell(`<div class="hero"><button class="secondary" id="back">← Dashboard</button><div><h2>${esc(titleFor(key))}</h2><div class="muted">${fmt(data.total ?? '')}</div></div><button id="reload">Refresh</button></div><section class="panel">${content}</section>`, key);
  document.getElementById('back').onclick=renderHome; document.getElementById('reload').onclick=()=>loadSection(key);
  document.querySelectorAll('[data-transfer]').forEach(el=>el.onclick=()=>openTransfer(Number(el.dataset.transfer),key));
  document.querySelectorAll('[data-application]').forEach(el=>el.onclick=()=>openApplication(Number(el.dataset.application),key));
  document.querySelectorAll('[data-listing]').forEach(el=>el.onclick=()=>openListing(el.dataset.listing,key));
}

function transferTable(rows){if(!rows.length)return '<div class="empty">No transfer records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Sender</th><th>Receiver</th><th>Shares</th><th>State</th><th>Final Gate</th><th>Ops</th><th>Chairman</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr class="rowlink" data-transfer="${r.id}"><td>${fmt(r.reference)}</td><td>${fmt(r.sender?.membership_number)} · ${fmt(r.sender?.name)}</td><td>${fmt(r.receiver?.membership_number)} · ${fmt(r.receiver?.name)}</td><td>${fmt(r.shares)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td><td>${r.auto_complete_after_receiver_otp?'Automatic':'Chairman'}</td><td>${fmt(r.operations_review?.status)}</td><td>${fmt(r.chairman_review?.status)}</td><td><button class="row-btn" style="padding:4px 10px; font-size:11px; font-weight:bold; background:#087f8c; color:#fff; border:0; border-radius:6px; cursor:pointer;">Open</button></td></tr>`).join('')}</tbody></table></div>`;}
function applicationTable(rows){if(!rows.length)return '<div class="empty">No application records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Applicant</th><th>Mobile</th><th>Shares</th><th>Total</th><th>State</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr class="rowlink" data-application="${r.id}"><td>${fmt(r.reference)}</td><td>${fmt(r.applicant_name)}</td><td>${fmt(r.mobile)}</td><td>${fmt(r.requested_shares)}</td><td>${fmt(r.total_amount)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td><td><button class="row-btn" style="padding:4px 10px; font-size:11px; font-weight:bold; background:#087f8c; color:#fff; border:0; border-radius:6px; cursor:pointer;">Open</button></td></tr>`).join('')}</tbody></table></div>`;}
function certificateTable(rows){if(!rows.length)return '<div class="empty">No certificate/share records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Certificate</th><th>Shareholder</th><th>Membership</th><th>Shares</th><th>Value</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.certificate_number||r.reference)}</td><td>${fmt(r.shareholder?.name)}</td><td>${fmt(r.shareholder?.membership_number)}</td><td>${fmt(r.shares)}</td><td>${fmt(r.total_share_value)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td></tr>`).join('')}</tbody></table></div>`;}
function rewardTable(rows){if(!rows.length)return '<div class="empty">No reward records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Period</th><th>Dates</th><th>Purchases</th><th>Reward</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.reference)}</td><td>${fmt(r.period_type)}</td><td>${fmt(r.date_from)} → ${fmt(r.date_to)}</td><td>${fmt(r.total_purchase)}</td><td>${fmt(r.total_reward)}</td><td class="state ${stateClass(r.state)}">${fmt(r.workflow_phase_label||r.state_label)}</td></tr>`).join('')}</tbody></table></div>`;}
function notificationTable(rows){if(!rows.length)return '<div class="empty">No notification records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Shareholder</th><th>Title</th><th>Category</th><th>State</th><th>Channels</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.created_at)}</td><td>${fmt(r.shareholder?.membership_number)} · ${fmt(r.shareholder?.name)}</td><td>${fmt(r.title)}</td><td>${fmt(r.category)}</td><td class="state ${stateClass(r.state)}">${fmt(r.state)}</td><td>S:${fmt(r.sms_state)} E:${fmt(r.email_state)} P:${fmt(r.push_state)} W:${fmt(r.whatsapp_state)}</td></tr>`).join('')}</tbody></table></div>`;}
function auditTable(rows){if(!rows.length)return '<div class="empty">No audit records found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Actor</th><th>Model</th><th>Record</th><th>Message</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmt(r.date)}</td><td>${fmt(r.author)}</td><td>${fmt(r.model)}</td><td>${fmt(r.res_id)}</td><td>${fmt(r.body)}</td></tr>`).join('')}</tbody></table></div>`;}
function marketplaceTable(rows){if(!rows.length)return '<div class="empty">No marketplace listings found.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Seller</th><th>Shares</th><th>Price</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr class="rowlink" data-listing="${r.id}"><td>${fmt(r.reference)}</td><td>${r.seller?.membership_number ? (fmt(r.seller.membership_number) + ' · ' + fmt(r.seller.name)) : fmt(r.seller?.name || r.seller_name || r.seller)}</td><td>${fmt(r.number_of_shares)}</td><td>${fmt(r.asking_price_per_share)}</td><td>${fmt(r.total_asking_amount)}</td><td class="state ${stateClass(r.state)}">${fmt(r.state)}</td><td><button class="row-btn" style="padding:4px 10px; font-size:11px; font-weight:bold; background:#087f8c; color:#fff; border:0; border-radius:6px; cursor:pointer;">Open</button></td></tr>`).join('')}</tbody></table></div>`;}

async function openListing(id, backKey='marketplace') {
  try {
    const res = await requestJson(`/api/shareholder/ops/marketplace/listings/${id}`);
    const r = res.listing || res.data || res;
    const acceptedOffer = r.accepted_offer;
    
    let offerHtml = '';
    if (acceptedOffer) {
      offerHtml = `<div class="panel" style="margin-top:15px; border-left:4px solid var(--blue);">
        <h3>Accepted Offer</h3>
        <div class="detail-grid">
          ${field('Buyer', acceptedOffer.buyer?.membership_number ? (acceptedOffer.buyer.membership_number + ' · ' + acceptedOffer.buyer.name) : (acceptedOffer.buyer?.name || acceptedOffer.buyer_name))}
          ${field('Requested Shares', acceptedOffer.number_of_shares)}
          ${field('Offer Price', acceptedOffer.offer_price_per_share)}
          ${field('Offer Status', acceptedOffer.state)}
        </div>
      </div>`;
    }
    
    shell(`<div class="hero"><button class="secondary" id="back">← ${esc(titleFor(backKey))}</button><div><h2>Listing ${fmt(r.reference)}</h2><div class="muted">Status: ${fmt(r.state)}</div></div></div>
    <section class="panel">
      <div class="detail-grid">
        ${field('Seller', r.seller?.membership_number ? (r.seller.membership_number + ' · ' + r.seller.name) : (r.seller?.name || r.seller_name))}
        ${field('Shares Available', r.number_of_shares)}
        ${field('Asking Price', r.asking_price_per_share)}
        ${field('Total Amount', r.total_asking_amount)}
        ${field('Created At', r.create_date)}
        ${field('Expires At', r.expiry_date)}
      </div>
      ${offerHtml}
      <div class="actions" id="actions"></div>
    </section>`, backKey);
    
    document.getElementById('back').onclick=()=>loadSection(backKey);
    const a=document.getElementById('actions');
    
    if (r.state === 'submitted' || r.state === 'pending' || r.state === 'pending_operations_approval') {
      a.innerHTML += `<button data-act="approve-listing">Approve Listing</button><button class="danger" data-act="reject-listing">Reject Listing</button>`;
    }
    if (r.state === 'offer_accepted' && (acceptedOffer?.state === 'pending_operations_approval' || acceptedOffer?.state === 'submitted' || acceptedOffer?.state === 'pending')) {
      a.innerHTML += `<button data-act="approve-offer">Approve Offer (Create Invoices)</button><button class="danger" data-act="reject-offer">Reject Offer</button>`;
    }
    if (r.state === 'invoices_created') {
      a.innerHTML += `<button data-act="complete-transaction">Complete Transaction</button>`;
    }
    
    a.querySelectorAll('button').forEach(btn=>btn.onclick=()=>runListingAction(id,btn.dataset.act,backKey));
  } catch(e) {
    shell(`<div class="panel"><p class="error">${esc(e.message)}</p></div>`);
  }
}

async function runListingAction(id, act, backKey) {
  const note=(await customPrompt(act.includes('reject')?'Reject Listing':'Approve Listing', act.includes('reject')?'Reason / note':'Approval note (optional)'))||'';
  try {
    if (act === 'approve-listing') await requestJson(`/api/shareholder/ops/marketplace/listings/${id}/review`,{method:'POST',body:{action:'approve',note}});
    else if (act === 'reject-listing') await requestJson(`/api/shareholder/ops/marketplace/listings/${id}/review`,{method:'POST',body:{action:'reject',note}});
    else if (act === 'approve-offer') await requestJson(`/api/shareholder/ops/marketplace/listings/${id}/accepted-offer/review`,{method:'POST',body:{action:'approve',note}});
    else if (act === 'reject-offer') await requestJson(`/api/shareholder/ops/marketplace/listings/${id}/accepted-offer/review`,{method:'POST',body:{action:'reject',note}});
    else if (act === 'complete-transaction') await requestJson(`/api/shareholder/ops/marketplace/listings/${id}/complete`,{method:'POST',body:{}});
    
    await loadSection(backKey);
  } catch(e) {
    alert(e.message);
  }
}


async function openTransfer(id,backKey='transfers'){
  try{
    const d=await requestJson(`/api/shareholder/ops/transfers/${id}`), r=d.transfer;
    const finalGate=r.auto_complete_after_receiver_otp?'Automatic after Receiver OTP':'Chairman Final Approval';
    shell(`<div class="hero"><button class="secondary" id="back">← ${esc(titleFor(backKey))}</button><div><h2>${fmt(r.reference)}</h2><div class="muted">${fmt(r.workflow_phase_label||r.state_label)} · Policy snapshotted at creation</div></div></div><section class="panel"><div class="detail-grid">
      ${field('Sender',`${r.sender?.membership_number||''} · ${r.sender?.name||''}`)}${field('Receiver',`${r.receiver?.membership_number||''} · ${r.receiver?.name||''}`)}${field('Shares',r.shares)}
      ${field('Sender OTP',r.sender_otp_verified?'Verified':'Pending')}${field('Receiver Acceptance',r.receiver_approval)}${field('Receiver OTP',r.receiver_otp_verified?'Verified':'Pending')}
      ${field('Operations Review',r.operations_review?.status)}${field('Chairman Review',r.chairman_review?.status)}${field('Final Gate',finalGate)}
      ${field('Workflow Stage',r.workflow_phase_label||r.state_label)}
    </div><div class="notice">Operations approval before the receiver is notified is mandatory for every transfer. This transfer will ${r.auto_complete_after_receiver_otp?'complete automatically after receiver OTP.':'wait for Chairman final approval after receiver OTP.'}</div><div class="actions" id="actions"></div></section>`, backKey);
    document.getElementById('back').onclick=()=>loadSection(backKey);
    const a=document.getElementById('actions');
    const showOps = r.can_operations_review === true;
    const showChair = r.can_chairman_approve === true;
    const showComplete = r.can_complete === true;

    if(showOps){a.innerHTML+=`<button data-act="ops-approve">Approve & Send to Receiver</button><button class="danger" data-act="ops-reject">Operations Reject</button>`;}
    if(showChair){a.innerHTML+=`<button class="gold" data-act="chair-approve">Chairman Approve</button><button class="danger" data-act="chair-reject">Chairman Reject</button>`;}
    if(showComplete){a.innerHTML+=`<button data-act="complete">Complete Transfer</button>`;}
    a.querySelectorAll('button').forEach(btn=>btn.onclick=()=>runTransferAction(id,btn.dataset.act,backKey));
  }catch(e){shell(`<div class="panel"><p class="error">${esc(e.message)}</p></div>`);}
}
function field(label,value){return `<div class="field"><label>${esc(label)}</label><b>${fmt(value)}</b></div>`;}
async function runTransferAction(id,act,backKey){
  const note=(await customPrompt(act.includes('reject')?'Reject Transfer':'Approve Transfer', act.includes('reject')?'Reason / note':'Approval note (optional)'))||'';
  try{
    if(act==='ops-approve'||act==='ops-reject') await requestJson(`/api/shareholder/ops/transfers/${id}/review`,{method:'POST',body:{action:act.endsWith('approve')?'approve':'reject',note}});
    else if(act==='chair-approve'||act==='chair-reject') await requestJson(`/api/shareholder/ops/transfers/${id}/chairman`,{method:'POST',body:{action:act.endsWith('approve')?'approve':'reject',note}});
    else if(act==='complete') await requestJson(`/api/shareholder/ops/transfers/${id}/complete`,{method:'POST',body:{}});
    await openTransfer(id, backKey);
  }catch(e){alert(e.message);}
}

async function openApplication(id,backKey='applications'){
  const d=await requestJson(`/api/shareholder/ops/applications/${id}`), r=d.application;
  shell(`<div class="hero"><button class="secondary" id="back">← Applications</button><div><h2>${fmt(r.reference)}</h2><div class="muted">${fmt(r.state_label)}</div></div></div><section class="panel"><div class="detail-grid">${field('Applicant',r.applicant_name)}${field('Mobile',r.mobile)}${field('Email',r.email)}${field('Requested Shares',r.requested_shares)}${field('Total Amount',r.total_amount)}${field('UAE Citizen',r.uae_citizen?'Yes':'No')}${field('Emirates ID',r.emirates_id)}${field('Family Book',r.family_book_number)}${field('Operator',r.operator)}</div><div class="actions" id="actions"></div></section>`, backKey);
  document.getElementById('back').onclick=()=>loadSection(backKey);
  const a=document.getElementById('actions');
  const isOps = session?.role_codes?.includes('shareholder_operation_manager');
  const canReview = session?.permissions?.membership_review ?? isOps;

  if(canReview){
    if(r.state==='submitted' || isOps) a.innerHTML+='<button data-act="document_review">Documents Reviewed</button>';
    if(r.state==='document_review' || isOps) a.innerHTML+='<button data-act="finance">Send to Finance</button>';
    if(['submitted','document_review','finance'].includes(r.state) || isOps) a.innerHTML+='<button data-act="approve">Approve Membership</button><button class="danger" data-act="reject">Reject</button>';
  }
  a.querySelectorAll('button').forEach(btn=>btn.onclick=async()=>{const reason=btn.dataset.act==='reject'?((await customPrompt('Reject', 'Rejection reason'))||''):'';try{await requestJson(`/api/shareholder/ops/applications/${id}/action`,{method:'POST',body:{action:btn.dataset.act,reason}});await loadSection(backKey);}catch(e){alert(e.message);}});
}

init();



window.customPrompt = function(title, message, placeholder = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(8, 15, 30, 0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; opacity: 0; transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    const box = document.createElement('div');
    box.style = `
      background: #fff; padding: 32px; border-radius: 24px; width: 90%; max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      transform: translateY(20px) scale(0.95); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: inherit;
    `;
    box.innerHTML = `
      <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 1px solid #fee2e2;">
        <span style="font-size: 24px;">💬</span>
      </div>
      <h3 style="margin-top:0; color: #0f172a; font-size: 20px; font-weight:800; margin-bottom:8px; letter-spacing:-0.5px;">${title}</h3>
      <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">${message}</p>
      <input type="text" id="customPromptInput" placeholder="${placeholder}" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 24px; font-size: 14.5px; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="customPromptCancel" style="border: 1px solid #cbd5e1; background: #fff; color: #334155; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">Cancel</button>
        <button id="customPromptOk" style="border: 1px solid #087f8c; background: #087f8c; color: #fff; padding: 10px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(8, 127, 140, 0.2);">Submit</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#customPromptInput');
    const cancelBtn = overlay.querySelector('#customPromptCancel');
    const okBtn = overlay.querySelector('#customPromptOk');
    
    input.onfocus = () => input.style.borderColor = '#087f8c';
    input.onblur = () => input.style.borderColor = '#cbd5e1';
    
    setTimeout(() => {
      overlay.style.opacity = '1';
      box.style.transform = 'translateY(0) scale(1)';
      input.focus();
    }, 10);
    
    const cleanup = (val) => {
      overlay.style.opacity = '0';
      box.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        document.body.removeChild(overlay);
        resolve(val);
      }, 200);
    };
    
    cancelBtn.onclick = () => cleanup(null);
    okBtn.onclick = () => cleanup(input.value);
    input.onkeyup = (e) => {
      if (e.key === 'Enter') cleanup(input.value);
    };
  });
};



window.customConfirm = function(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(8, 15, 30, 0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; opacity: 0; transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    const box = document.createElement('div');
    box.style = `
      background: #fff; padding: 32px; border-radius: 24px; width: 90%; max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      transform: translateY(20px) scale(0.95); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      text-align: center; font-family: inherit;
    `;
    box.innerHTML = `
      <div style="width: 64px; height: 64px; background: #fffbeb; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; border: 1px solid #fef3c7;">
        <span style="font-size: 28px;">⚠️</span>
      </div>
      <h3 style="margin-top:0; color: #0f172a; font-size: 20px; font-weight:800; margin-bottom:12px; letter-spacing:-0.5px;">${title}</h3>
      <p style="color: #64748b; font-size: 14.5px; line-height: 1.6; margin-bottom: 28px; padding: 0 10px;">${message}</p>
      <div style="display: flex; gap: 12px;">
        <button id="customConfirmCancel" style="flex:1; border: 1px solid #cbd5e1; background: #fff; color: #334155; padding: 12px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">Cancel</button>
        <button id="customConfirmOk" style="flex:1; border: 1px solid #087f8c; background: #087f8c; color: #fff; padding: 12px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(8, 127, 140, 0.2);">Yes, Proceed</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const cancelBtn = overlay.querySelector('#customConfirmCancel');
    const okBtn = overlay.querySelector('#customConfirmOk');
    
    cancelBtn.onmouseenter = () => cancelBtn.style.background = '#f8fafc';
    cancelBtn.onmouseleave = () => cancelBtn.style.background = '#fff';
    okBtn.onmouseenter = () => okBtn.style.transform = 'translateY(-1px)';
    okBtn.onmouseleave = () => okBtn.style.transform = 'none';

    setTimeout(() => {
      overlay.style.opacity = '1';
      box.style.transform = 'translateY(0) scale(1)';
    }, 10);
    
    const cleanup = (val) => {
      overlay.style.opacity = '0';
      box.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        document.body.removeChild(overlay);
        resolve(val);
      }, 200);
    };
    
    cancelBtn.onclick = () => cleanup(false);
    okBtn.onclick = () => cleanup(true);
  });
};
