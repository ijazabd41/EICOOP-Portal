window.EIC_OPS = {
  baseUrl: window.location.origin + (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '/proxy.php' : ''),
  pollSeconds: 30,
  endpoints: {
    dashboard: '/api/shareholder/dashboard',
    shareholders: '/api/shareholder/shareholders',
    transfers: '/api/shareholder/transfers',
    applications: '/api/shareholder/applications',
    certificates: '/api/shareholder/certificates',
    rewards: '/api/shareholder/rewards',
    notifications: '/api/shareholder/notifications',
    audit: '/api/shareholder/audit'
  }
};

window.api = async function(path, options = {}) {
  const sess = localStorage.getItem('cd_session_id');
  if (!sess) {
    window.location.href = 'index.html';
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Session-Token': sess,
    ...options.headers
  };
  
  const r = await fetch(EIC_OPS.baseUrl + path, {
    ...options,
    headers
  });
  
  let j = {};
  try {
    j = await r.json();
  } catch(e) {}
  
  if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status));
  if (j.error) throw new Error(j.error.data?.message || j.error.message || 'API Error');
  
  if (j.jsonrpc && j.hasOwnProperty('result')) {
    return j.result;
  }
  return j.data || j;
};

let current = 'dashboard', allRows = [];
let opsPermissions = {};
const $ = x => document.getElementById(x);

function money(v) {
  return 'AED ' + Number(v||0).toLocaleString(undefined, {maximumFractionDigits:2});
}

function show(x) {
  current = x;
  $('dashboard').classList.toggle('hidden', x !== 'dashboard');
  $('list').classList.toggle('hidden', x === 'dashboard');
  if (x === 'dashboard') loadDashboard();
}

async function loadDashboard() {
  try {
    const d = await api(EIC_OPS.endpoints.dashboard);
    const k = d.kpis || d;
    const a = [
      ['Total Shareholders', k.total_shareholders],
      ['Total Shares', k.total_shares],
      ['Share Capital', money(k.share_capital)],
      ['Amount Paid', money(k.amount_paid)],
      ['Outstanding', money(k.outstanding)],
      ['Shareholder Sales', money(k.shareholder_sales)],
      ['Rewards / Profit', money(k.rewards)],
      ['Certificates', k.certificates]
    ];
    $('kpis').innerHTML = a.map(x => `<div class="kpi"><span class="muted">${x[0]}</span><b>${x[1]??0}</b></div>`).join('');
    
    const c = d.capital_check || {};
    $('capital').innerHTML = `
      <div class=row>Shares source: <b>${c.shares_source||'Backend aggregate'}</b></div>
      <div class=row>Unit share value: <b>${money(c.unit_share_value||1)}</b></div>
      <div class=row>Computed capital: <b>${money(c.computed_capital||k.share_capital)}</b></div>
      <div class=row>${c.message||''}</div>`;
    $('error').textContent = '';
  } catch(e) {
    $('error').innerHTML = '<p class=bad>' + e.message + '</p>';
  }
}

async function loadList(kind) {
  show(kind);
  $('listTitle').textContent = kind.replaceAll('_', ' ').toUpperCase();
  $('actionsContainer').innerHTML = ''; // Reset actions
  
  // Inject Chairman actions if permissions allow
  if (opsPermissions.chairman_approve || opsPermissions.protected_share_change_approve || opsPermissions.final_transfer_approve) {
      if (kind === 'transfers' && opsPermissions.final_transfer_approve) {
          $('actionsContainer').innerHTML = `<button style="background:#ffb417; color:#041f35; border:0; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Chairman: Final Transfer Approval</button>`;
      } else if (kind === 'applications' && opsPermissions.chairman_approve) {
          $('actionsContainer').innerHTML = `<button style="background:#ffb417; color:#041f35; border:0; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Chairman: Approve Application</button>`;
      } else if (kind === 'shareholders' && opsPermissions.protected_share_change_approve) {
          $('actionsContainer').innerHTML = `<button style="background:#ffb417; color:#041f35; border:0; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Chairman: Approve Share Change</button>`;
      }
  }
  
  try {
    const d = await api(EIC_OPS.endpoints[kind]);
    allRows = d.items || d.records || [];
    render(allRows);
  } catch(e) {
    $('rows').innerHTML = '<p class=bad>' + e.message + '</p>';
  }
}

function render(rows) {
  $('rows').innerHTML = rows.map(r => `
    <div class=row>
      <b>${r.name || r.reference || r.membership_no || r.title || ('Record ' + r.id)}</b><br>
      <span class=muted>${r.status || r.state || ''}</span>
    </div>
  `).join('') || '<p class=muted>No records</p>';
}

function filterRows() {
  const q = $('search').value.toLowerCase();
  render(allRows.filter(x => JSON.stringify(x).toLowerCase().includes(q)));
}

function refresh() {
  current === 'dashboard' ? loadDashboard() : loadList(current);
}

function logoutOps() {
    localStorage.removeItem('cd_session_id');
    localStorage.removeItem('cd_user_id');
    window.location.href = 'index.html';
}

async function initOps() {
    try {
        const bootstrap = await api('/api/shareholder/ops/bootstrap');
        opsPermissions = bootstrap.permissions || {};
        const roles = bootstrap.role_codes || [];
        
        let roleName = 'Access Denied';
        let allowed = false;
        if (roles.includes('shareholder_chairman')) {
            roleName = 'Chairman';
            allowed = true;
        } else if (roles.includes('shareholder_operation_manager')) {
            roleName = 'Ops Manager';
            allowed = true;
        }
        
        if (!allowed) {
            alert('Access Denied: You do not have the required Operations role. Server returned: ' + JSON.stringify(bootstrap));
            window.location.href = 'index.html';
            return;
        }
        
        $('roleBadge').textContent = roleName;
        $('roleBadge').style.display = 'inline-block';
        
        loadDashboard();
        
        setInterval(() => {
          if (current === 'dashboard') loadDashboard();
        }, EIC_OPS.pollSeconds * 1000);
        
    } catch(e) {
        alert('Init failed: ' + e.message);
        window.location.href = 'index.html';
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    initOps();
});
