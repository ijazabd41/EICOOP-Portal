/**
 * EICOOP Portal V2 Data & Tab Controller
 */

function switchTab(index, btnEl) {
  document.querySelectorAll('.menu button').forEach(btn => btn.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const foundBtn = Array.from(document.querySelectorAll('.menu button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(`switchTab(${index}`));
    if (foundBtn) foundBtn.classList.add('active');
  }
  
  const side = document.querySelector('.side');
  if (side) side.classList.remove('open');
  
  document.querySelectorAll('.portal-tab').forEach(tab => tab.classList.add('hidden'));
  document.getElementById('tab-' + index).classList.remove('hidden');
  
  // Initialize step progress components on tab activation
  if (index === 1) { // Profile
    if (!window.profileProgress) {
      window.profileProgress = new StepProgress('profile-progress', [
        { title: 'Basic Lookup', description: 'Verified member' },
        { title: 'Contact Verification', description: 'Phone & email' },
        { title: 'Set Preferences', description: 'Alert settings' }
      ], 2);
    }
  }
  if (index === 8) { // Transfer
    if (!window.transferProgress) {
      window.transferProgress = new StepProgress('transfer-progress', [
        { title: 'Select/Invite Recipient', description: 'Search or invite member' },
        { title: 'Verify Recipient', description: 'Confirm member profile' },
        { title: 'Transfer Details', description: 'Enter quantity of shares' },
        { title: 'Review & Confirm', description: 'Review summary & OTP' },
        { title: 'Submit Request', description: 'Complete transfer' }
      ], 1);
      
      // Auto-update to step 3 when user focuses on quantity input
      setTimeout(() => {
        document.getElementById('transferSharesQty')?.addEventListener('focus', () => {
          if (window.transferProgress && window.transferProgress.currentStep === 2) {
            window.transferProgress.setStep(3);
          }
        });
      }, 100);
    } else {
      window.transferProgress.setStep(1);
    }
    
    // Close panel by default when entering tab
    const content = document.getElementById('invite-help-panel-content');
    const chevron = document.getElementById('invite-panel-chevron');
    if (content && chevron) {
      content.style.maxHeight = "0px";
      chevron.style.transform = 'rotate(0deg)';
    }
  }
  if (index === 12) { // Sell
    if (!window.sellProgress) {
      window.sellProgress = new StepProgress('sell-progress', [
        { title: 'Specify Details', description: 'Set quantity & price' },
        { title: 'Publish Listing', description: 'Listed on portal' }
      ], 1);
    } else {
      window.sellProgress.setStep(1);
    }
    window.resetSellSharesForm();
  }

  if (index === 0) loadDashboard();
  if (index === 1) loadProfile();
  if (index === 2) loadMembership();
  if (index === 3) loadOrders();
  if (index === 4) loadInvoices();
  if (index === 9) loadShareholderCertificates();
  if (index === 10) loadShareholderRewards();
  if (index === 11) loadShareholderPurchases();
  if (index === 13) loadShareholderListings();
  if (index === 15) loadReceivedInvitations();
  if (index === 16) loadShareholderNotifications();
  if (index === 17) loadShareholderPreferences();
  if (index === 18) loadTransferHistory();
}

async function loadPortalData() {
  const user = API.me();
  if (user) {
    document.querySelectorAll('.user-name').forEach(el => el.textContent = user.name || 'Shareholder');
    document.querySelectorAll('.user-email').forEach(el => el.textContent = user.username || '');
    const firstLetter = (user.name || 'S').charAt(0).toUpperCase();
    // document.querySelectorAll('.dash-avatar').forEach(el => el.textContent = firstLetter);
  }
  
  loadDashboard();
  updateUnreadNotificationsCount();
}

async function updateUnreadNotificationsCount() {
  try {
    const res = await API.getShareholderNotifications(1, 1, true);
    const unreadCount = (res.notifications && res.notifications.length) || 0;
    const dot = document.getElementById('top-notification-dot');
    if (dot) dot.style.display = unreadCount > 0 ? 'block' : 'none';
  } catch (e) {
    console.warn('Failed to fetch unread notifications count:', e);
  }
}

async function loadDashboard() {
  try {
    const [ordR, invR, profR, dashR] = await Promise.allSettled([API.myOrders(), API.myInvoices(), API.myProfile(), API.getShareholderDashboard()]);
    const orders = ordR.status === 'fulfilled' ? (ordR.value.data || []) : [];
    const invoices = invR.status === 'fulfilled' ? (invR.value.data || []) : [];
    const prof = profR.status === 'fulfilled' ? (profR.value.data && profR.value.data[0]) : null;
    const dash = dashR.status === 'fulfilled' ? (dashR.value.dashboard || dashR.value) : null;
    
    document.getElementById('metric-orders').textContent = orders.length;
    document.getElementById('metric-invoices').textContent = invoices.length;
    
    let shares = 0;
    if (dash && dash.total_shares !== undefined) shares = dash.total_shares;
    else if (prof && prof.shares) shares = prof.shares;
    document.getElementById('metric-shares').textContent = shares;

    // Load recent orders
    const recentOrders = orders.slice(0, 5);
    const ordersContainer = document.getElementById('recent-orders-list');
    if (ordersContainer) {
      if (recentOrders.length === 0) {
        ordersContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">No recent orders.</div>';
      } else {
        ordersContainer.innerHTML = recentOrders.map(o => {
          const state = Array.isArray(o.state) ? o.state[1] : (o.state || 'Draft');
          const date = (o.date_order || '').slice(0, 10);
          const total = parseFloat(o.amount_total || 0).toFixed(2);
          const isCancelled = state.toLowerCase().includes('cancel');
          const statusStyle = isCancelled ? 'background:#ffe9e9;color:#b5242e' : '';
          
          return `
            <div class="table-row">
              <div><b>${o.name}</b><br><small>${date}</small></div>
              <div><span class="status" style="${statusStyle}">${state.toUpperCase()}</span></div>
              <b>AED ${total}</b>
              <button class="signout" onclick="switchTab(3, document.querySelectorAll('.menu button')[3])">Details</button>
            </div>
          `;
        }).join('');
      }
    }
  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

async function loadProfile() {
  const container = document.getElementById('profile-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Profile...</div>';
  
  try {
    const shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) throw new Error('Not logged in as shareholder');
    
    // Fetch profile using the backend API
    const r = await fetch('/proxy.php/api/shareholder/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareholder_number: shNum })
    }).then(res => res.json());

    const profile = r.shareholder || r.partner || (r.data && r.data[0]) || (r.result && (r.result.shareholder || r.result.partner || (Array.isArray(r.result) ? r.result[0] : null)));
    if (!profile) throw new Error('Profile details not found');
    
    const name = profile.display_name || profile.name || 'Shareholder';

    const html = `
      <div class="portalcard">
        <div style="display:flex; align-items:center; gap: 20px; border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--orange)); color: var(--navy); display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900;">
            ${name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style="margin: 0 0 5px; font-size: 24px;">${name}</h3>
            <span class="status">ACTIVE SHAREHOLDER</span>
          </div>
        </div>
        
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div>
            <small style="color:var(--muted); display:block; margin-bottom:5px;">Shareholder Number</small>
            <b>${profile.shareholder_number || shNum}</b>
          </div>
          <div>
            <small style="color:var(--muted); display:block; margin-bottom:5px;">Phone Number</small>
            <b>${profile.phone || profile.mobile || 'N/A'}</b>
          </div>
          <div>
            <small style="color:var(--muted); display:block; margin-bottom:5px;">Email Address</small>
            <b>${profile.email || 'N/A'}</b>
          </div>
          <div>
            <small style="color:var(--muted); display:block; margin-bottom:5px;">Shares Owned</small>
            <b>${profile.shares || '0'}</b>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<div style="padding:20px;color:red;">❌ '+e.message+'</div>';
  }
}

async function loadMembership() {
  const container = document.getElementById('membership-details-content');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">Loading membership details...</div>';
  
  try {
    const profR = await API.myProfile();
    const p = Array.isArray(profR.data) ? profR.data[0] : profR.data;
    if (!p) throw new Error("No profile found");
    
    const memNo = localStorage.getItem('cd_shareholder_number') || p.partner_sequence || p.id;
    const shares = p.shares || 0;
    
    container.innerHTML = `
      <div class="membership-card">
        <div>
          <small>ACTIVE SHAREHOLDER</small>
          <strong>${memNo}</strong>
          <small>Member since ${p.create_date ? p.create_date.slice(0,4) : '2026'} · ${shares} Shares</small>
        </div>
        <img class="dash-avatar" src="assets/arab_businessman.png" style="object-fit:cover;">
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div style="color:red; padding:20px;">Error loading membership: ${e.message}</div>`;
  }
}

async function loadOrders() {
  const container = document.getElementById('full-orders-list');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">Loading orders...</div>';
  
  try {
    const r = await API.myOrders({limit: 50, offset: 0});
    const orders = r.data || [];
    if (orders.length === 0) {
      container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:40px; background:#f9fafb; border-radius:12px; border:1px dashed #dbe7ef;"><b>No orders found</b><br><br>You haven\'t placed any orders yet. Visit the shop to make your first purchase!</div>';
      return;
    }
    
    container.innerHTML = orders.map(o => {
      const state = Array.isArray(o.state) ? o.state[1] : (o.state || 'Draft');
      const date = (o.date_order || '').slice(0, 10);
      const total = parseFloat(o.amount_total || 0).toFixed(2);
      const isCancelled = state.toLowerCase().includes('cancel');
      const statusStyle = isCancelled ? 'background:#ffe9e9;color:#b5242e' : '';
      
      return `
        <div class="table-row">
          <div><b>${o.name}</b><br><small>${date}</small></div>
          <div><span class="status" style="${statusStyle}">${state.toUpperCase()}</span></div>
          <b>AED ${total}</b>
          <button class="signout">View Details</button>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div style="color:red; padding:20px;">Error loading orders: ${e.message}</div>`;
  }
}

async function loadInvoices() {
  const container = document.getElementById('full-invoices-list');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">Loading invoices...</div>';
  
  try {
    const r = await API.myInvoices({limit: 50, offset: 0});
    const invoices = r.data || [];
    if (invoices.length === 0) {
      container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:40px; background:#f9fafb; border-radius:12px; border:1px dashed #dbe7ef;"><b>No invoices found</b><br><br>Your invoices will appear here once your orders are processed.</div>';
      return;
    }
    
    container.innerHTML = invoices.map(inv => {
      const state = Array.isArray(inv.state) ? inv.state[1] : (inv.state || 'Draft');
      const date = (inv.invoice_date || '').slice(0, 10);
      const total = parseFloat(inv.amount_total || 0).toFixed(2);
      
      return `
        <div class="table-row">
          <div><b>${inv.name || 'Invoice'}</b><br><small>${date}</small></div>
          <div><span class="status">${state.toUpperCase()}</span></div>
          <b>AED ${total}</b>
          <button class="signout">Download PDF</button>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div style="color:red; padding:20px;">Error loading invoices: ${e.message}</div>`;
  }
}

// Global initialization hook
window.loadPortalData = loadPortalData;

  async function handleCertificateAction(action, shareId, lang) {
    try {
      const toast = (msg) => {
        const c = document.getElementById('certificatesContent');
        if (c) {
          const t = document.createElement('div');
          t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:10px 20px;border-radius:5px;z-index:9999';
          t.innerText = msg;
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 2000);
        }
      };

      toast(action === 'preview' ? 'Loading preview...' : 'Downloading certificate...');
      
      const sessionToken = localStorage.getItem('cd_session_id') || '';
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/pdf' };
      if (sessionToken) headers['Cookie'] = 'session_id=' + sessionToken;

      const url = API.PX + '/api/shareholder/certificate/' + (action === 'download' ? 'download' : 'preview') + '?by_AJR=1';
      const shNum = localStorage.getItem('cd_shareholder_number');

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ membership_no: shNum, lang: lang })
      });
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      
      const downloadBlob = async (buffer) => {
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const objUrl = window.URL.createObjectURL(blob);
        
        if (action === 'preview') {
          window.open(objUrl, '_blank');
        } else {
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = 'certificate_' + shareId + '_' + lang + '.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => window.URL.revokeObjectURL(objUrl), 5000);
      };
      
      return downloadBlob(await res.arrayBuffer());
    } catch (e) {
      alert('Certificate Error: ' + e.message);
    }
  }

function downloadCertificate(shNum) { return handleCertificateAction('download', shNum, 'en'); }
function previewCertificate(shNum) { return handleCertificateAction('preview', shNum, 'en'); }

async function loadShareholderCertificates() {
  const c = document.getElementById('certificatesContent');
  if(!c) return;
  c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Certificates...</div>';
  try {
    const shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) throw new Error('Shareholder number not found');
    const r = await API.getShareholderCertificates(shNum);
    let data = r?.certificates || r?.result?.certificates || r?.data || r?.result || [];
    if(!Array.isArray(data)) data = [data];
    if(!data.length || (data.length === 1 && !data[0].share_id && !data[0].id)){ c.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted)">No certificates found.</div>'; return; }
    
    c.innerHTML = data.map(cert => {
        if(!cert) return '';
        const certNum = cert.certificate_number || cert.reference || cert.name || cert.id || 'N/A';
        const shareId = cert.share_id || cert.id || '1';
        const shares = cert.number_of_shares || cert.num_shares || 0;
        const val = cert.total_value || cert.total_share_value || 0;
        let btns = '';
        btns += `<a href="javascript:void(0)" onclick="previewCertificate('${shareId}')" class="btn" style="padding:6px 12px;font-size:11px;background:#eaf7ff;color:var(--blue)">Preview</a> `;
        btns += `<a href="javascript:void(0)" onclick="downloadCertificate('${shareId}')" class="btn" style="padding:6px 12px;font-size:11px;background:var(--blue);color:#fff">Download PDF</a>`;
      
      return `
        <div class="portalcard" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px;padding:18px">
          <div><div style="font-weight:800;font-size:16px;">Certificate #${certNum}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">Shares: ${parseFloat(shares).toLocaleString()} | Value: AED ${parseFloat(val).toLocaleString()}</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${btns}</div>
        </div>`;
    }).join('');
  } catch(e) { c.innerHTML = '<div style="padding:20px;color:var(--red);">❌ '+e.message+'</div>'; }
}

async function loadShareholderRewards() {
  const c = document.getElementById('shRewardsContent');
  if(!c) return;
  c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Rewards...</div>';
  try {
    const shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) throw new Error('Shareholder number not found');
    const r = await API.getShareholderRewards(shNum);
    let data = r?.rewards || r?.result?.rewards || r?.data || r?.result || [];
    if(!Array.isArray(data)) data = [data];
    
    const totalPts = r?.total_points ?? r?.balance ?? r?.result?.total_points ?? null;
    let totalBalanceHtml = '';
    if (totalPts !== null) {
      totalBalanceHtml = `
        <div class="portalcard" style="margin-bottom:16px;text-align:center;background:linear-gradient(135deg,var(--gold),var(--orange));color:#fff;border:0;">
          <div style="font-size:13px;font-weight:800;text-transform:uppercase;margin-bottom:6px;opacity:0.9">Total Reward Balance</div>
          <div style="font-size:32px;font-weight:900;">${parseFloat(totalPts).toLocaleString()}</div>
        </div>`;
    }

    if(!data.length || (data.length === 1 && !data[0].id && !data[0].name)){ 
      c.innerHTML = totalBalanceHtml + '<div style="padding:40px;text-align:center;color:var(--muted)">No rewards found.</div>'; return; 
    }
    
    const html = data.map(rew => {
      if(!rew) return '';
      const name = rew?.name || 'Dividend/Reward';
      const amt = parseFloat(rew?.amount ?? 0);
      const points = rew?.points ?? null;
      const date = rew?.date ? String(rew.date).slice(0,10) : 'N/A';
      return `
        <div class="table-row">
          <div><b style="color:var(--blue)">${name}</b><br><small>Date: ${date} ${points !== null ? '| Points: '+parseFloat(points).toLocaleString() : ''}</small></div>
          <div></div>
          <b style="color:var(--orange)">AED ${amt.toLocaleString()}</b>
          <div></div>
        </div>`;
    }).join('');
    
    c.innerHTML = totalBalanceHtml + `<div class="portalcard" style="padding:10px 24px">${html}</div>`;
  } catch(e) { c.innerHTML = '<div style="padding:20px;color:red;">❌ '+e.message+'</div>'; }
}

async function loadShareholderPurchases() {
  const c = document.getElementById('shPurchasesContent');
  if(!c) return;
  c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Purchases...</div>';
  try {
    const shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) throw new Error('Shareholder number not found');
    const dFrom = document.getElementById('shPurchasesFrom')?.value;
    const dTo = document.getElementById('shPurchasesTo')?.value;
    const r = await API.getShareholderPurchases(shNum, dFrom, dTo);
    let data = r?.purchases || r?.result?.purchases || r?.orders || r?.data || r?.result || [];
    if(!Array.isArray(data)) data = [data];
    
    let totalAmt = parseFloat(r?.total_amount ?? r?.result?.total_amount ?? 0);
    if (totalAmt === 0 && data.length > 0) totalAmt = data.reduce((sum, order) => sum + parseFloat(order?.amount_total || order?.total || order?.amount || 0), 0);
    const totalOrders = parseInt(r?.total_orders ?? r?.result?.total_orders ?? data.length);
    let summaryHtml = '';
    
    if (totalAmt > 0 || totalOrders > 0) {
      summaryHtml = `
        <div class="portalcard" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff;border:0;">
          <div><div style="font-size:12px;font-weight:700;text-transform:uppercase;opacity:0.9">Total Purchases</div>
          <div style="font-size:14px;font-weight:600;margin-top:4px">${totalOrders} Orders</div></div>
          <div style="font-size:24px;font-weight:900;">AED ${totalAmt.toLocaleString()}</div>
        </div>`;
    }

    if(!data.length || (data.length === 1 && !data[0].id && !data[0].name)){ 
      c.innerHTML = summaryHtml + '<div style="padding:40px;text-align:center;color:var(--muted)">No linked purchases found.</div>'; return; 
    }
    
    const html = data.map(order => {
      if(!order) return '';
      const amt = parseFloat(order?.amount_total || order?.total || order?.amount || 0);
      const name = order?.name || order?.order_name || 'Order #'+(order?.id || 'Unknown');
      const d = order?.date_order || order?.date || '';
      return `
        <div class="table-row">
          <div><b>${name}</b><br><small>Date: ${d ? String(d).slice(0,10) : 'N/A'}</small></div>
          <div></div>
          <b>AED ${amt.toLocaleString()}</b>
          <div></div>
        </div>`;
    }).join('');
    
    c.innerHTML = summaryHtml + `<div class="portalcard" style="padding:10px 24px">${html}</div>`;
  } catch(e) { c.innerHTML = '<div style="padding:20px;color:red;">❌ '+e.message+'</div>'; }
}

async function linkShareholderOrder(event) {
  var btn = document.getElementById('shLinkBtn') || (event && event.currentTarget);
  var oid = document.getElementById('linkOrderId')?.value?.trim();
  var msg = document.getElementById('linkOrderMsg');
  
  if(!msg) return;
  if(!oid) { msg.textContent = 'Please enter an Order ID'; msg.style.color='var(--red)'; return; }
  
  msg.textContent = '⏳ Linking order...'; msg.style.color='var(--muted)';
  if(btn) btn.disabled = true;

  try {
    var shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) throw new Error('Shareholder session not found');
    
    var r = await API.linkShareholderOrder(shNum, oid);
    
    if(r && r.error) throw new Error(r.error);
    if(r && r.result && r.result.error) throw new Error(r.result.error);
    if(r && r.success === 0) throw new Error(r.message || r.error || 'Failed to link order');
    
    msg.textContent = '✅ Order successfully linked!'; msg.style.color='#065f46';
    document.getElementById('linkOrderId').value = '';
    
    loadShareholderPurchases(); // Reload the list
    
    setTimeout(function() {
      msg.textContent = '';
    }, 5000);
  } catch(e) {
    msg.textContent = '❌ '+(e.message || 'Failed to link order');
    msg.style.color = 'var(--red)';
  } finally {
    if(btn) btn.disabled = false;
  }
}

async function loadShareholderListings() {
  const container = document.getElementById('shareListingsContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Listings...</div>';
  
  try {
    const res = await API.getShareListings();
    const listings = res.data || res.listings || [];
    if (listings.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No active listings</b><br><br>There are currently no shares listed for sale by other members. Check back later!</div>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;font-size:14px;">';
    html += '<tr style="background:#f5f5f5;text-align:left;">' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Listing ID</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Shares</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Price/Share</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Total</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Action</th>' +
            '</tr>';
            
    listings.forEach(l => {
      const total = (parseFloat(l.shares || 0) * parseFloat(l.price_per_share || 0)).toFixed(2);
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${l.id || l.listing_id || 'N/A'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${l.shares || 0}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${parseFloat(l.price_per_share || 0).toFixed(2)} AED</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><strong>${total} AED</strong></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          <button class="btn btn-primary" style="padding:5px 10px;border-radius:3px;font-size:12px" onclick="handleBuyInterest(${l.id || l.listing_id})">Buy</button>
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error: ${e.message}</div>`;
  }
}

async function handleLookupReceiver(e) {
  e.preventDefault();
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  
  const num = document.getElementById('transferReceiver').value.trim();
  const btn = document.getElementById('btnLookupReceiver');

  if (num === shNum) {
      return showToast('Cannot transfer shares to your own membership number.', true);
  }

  btn.disabled = true;
  
  try {
      const res = await API.lookupRecipient(num);
      const errorCode = res.error_code || res.error;
    
      if (errorCode === "RECIPIENT_NOT_FOUND" && (res.can_invite === "true" || res.can_invite === true)) {
        document.getElementById('lookupReceiverRes').innerHTML = `
          <div style="background:#fef2f2;color:#991b1b;padding:24px;border:1px solid #fee2e2;border-radius:14px;text-align:center;margin-top:15px;">
            <div style="font-size:36px;margin-bottom:12px;">🔍</div>
            <h3 style="margin-top:0;margin-bottom:8px;color:#991b1b;font-size:18px;">Recipient not found</h3>
            <p style="margin:0 0 16px;color:#7f1d1d;font-size:13.5px;line-height:1.5;">
              We couldn't find a registered member with this ID. If this person has not yet joined EICOOP, you can invite them to become a member before transferring shares.
            </p>
            <button type="button" class="btn btn-primary" onclick="triggerDirectInviteFlow()" style="background:#991b1b;border-color:#991b1b;color:#fff;">Invite Member Now</button>
          </div>`;
        document.getElementById('lookupReceiverRes').style.display = 'block';
        return;
      }

      if (errorCode || res.success === "false" || res.success === false) {
        const msg = res.message || errorCode || "Unknown error";
        document.getElementById('lookupReceiverRes').innerHTML = '<div style="color:var(--red);padding:10px;background:#fff1f1;border:1px solid #ffcdcd;border-radius:8px;">Error: ' + msg + '</div>';
        document.getElementById('lookupReceiverRes').style.display = 'block';
        return;
      }

      document.getElementById('lookupReceiverRes').style.display = 'none';
      showToast('Recipient validated successfully!');
      if (window.transferProgress) window.transferProgress.setStep(2);
      
      let detailsHtml = `Verified Recipient: ${num}`;
      if (res.recipient) {
          const r = res.recipient;
          detailsHtml = `
              <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #e9ecef; color:#333; font-weight:normal;">
                  <h4 style="margin:0 0 10px 0; color:green;">✅ Recipient Verified</h4>
                  <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                      <span><strong>Name:</strong></span>
                      <span>${r.name || 'N/A'}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                      <span><strong>Mobile:</strong></span>
                      <span>${r.mobile_masked || 'N/A'}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                      <span><strong>Membership No:</strong></span>
                      <span>${r.membership_no || num}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                      <span><strong>Status:</strong></span>
                      <span style="text-transform:capitalize; color:${r.status === 'active' ? 'green' : 'orange'}">${r.status || 'N/A'}</span>
                  </div>
              </div>
          `;
      }
      
      document.getElementById('receiverDetails').innerHTML = detailsHtml;
      document.getElementById('transferReceiver').disabled = true;
      document.getElementById('transferStep2').style.display = 'block';
      btn.style.display = 'none';
  } catch(err) {
      showToast('Lookup failed: ' + err.message, true);
  } finally {
      btn.disabled = false;
  }
}

let currentTransferId = null;

async function handleTransferSubmit(e) {
  e.preventDefault();
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  
  const receiver = document.getElementById('transferReceiver').value.trim();
  const qty = parseInt(document.getElementById('transferSharesQty').value, 10);
  const btn = document.getElementById('btnSubmitTransfer');

  if (isNaN(qty) || qty <= 0) {
      return showToast('Number of shares must be greater than zero.', true);
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  
  try {
      btn.textContent = 'Submitting...';
      const res = await API.transferShares(shNum, receiver, qty);
      const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
      
      if (isSuccess) {
          showToast('Transfer request submitted! Please verify OTP.');
          currentTransferId = res.transfer?.reference || res.transfer_reference || res.reference || res.transfer?.id || res.transfer_id || res.id || shNum;
          if (window.transferProgress) window.transferProgress.setStep(4);
          
          document.getElementById('transferStep2').style.display = 'none';
          document.getElementById('transferStep3').style.display = 'block';
          
          // Setup OTP input traversal
          const inputs = document.querySelectorAll('#senderOtpRow input');
          inputs.forEach((input, index) => {
            input.value = '';
            input.addEventListener('keyup', function(e) {
              if (e.key === 'Backspace') {
                if (input.value === '' && index > 0) {
                  inputs[index - 1].focus();
                }
              } else if (input.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
              }
            });
          });
          if(inputs[0]) inputs[0].focus();
      } else {
          showToast('Error submitting request: ' + (res?.message || res?.error || 'Unknown error'), true);
      }
  } catch(err) {
      showToast('Transfer failed: ' + err.message, true);
  } finally {
      btn.disabled = false;
      btn.textContent = originalText;
  }
}

async function handleTransferOtpSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnVerifySenderOtp');
  const inputs = document.querySelectorAll('#senderOtpRow input');
  let otp = '';
  inputs.forEach(i => otp += i.value);

  if (otp.length < 6) {
    return showToast('Please enter the 6-digit OTP code', true);
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  
  try {
      btn.textContent = 'Verifying...';
      const res = await API.verifyTransferSenderOtp(currentTransferId, otp);
      const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
      
      if (isSuccess) {
          showToast('Transfer successfully verified!');
          document.getElementById('transferReceiver').disabled = false;
          document.getElementById('lookupReceiverForm').reset();
          document.getElementById('transferSharesForm').reset();
          document.getElementById('transferStep3').style.display = 'none';
          document.getElementById('btnLookupReceiver').style.display = 'inline-block';
          currentTransferId = null;
          if (window.transferProgress) {
            window.transferProgress.setStep(5);
            setTimeout(() => {
              if (window.transferProgress) window.transferProgress.setStep(1);
            }, 3000);
          }
      } else {
          showToast('Error verifying OTP: ' + (res?.message || res?.error || 'Invalid OTP'), true);
      }
  } catch(err) {
      showToast('Verification failed: ' + err.message, true);
  } finally {
      btn.disabled = false;
      btn.textContent = originalText;
  }
}

async function loadReceivedInvitations() {
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return;
  const container = document.getElementById('receivedInvitationsContent');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Pending Transfers...</div>';
  try {
    const res = await API.getTransferHistory();
    const allTransfers = res?.transfers || [];
    
    // Filter for transfers where the current user is the receiver and needs to verify OTP
    const pendingTransfers = allTransfers.filter(t => 
      t.to_membership_no === shNum && 
      (t.status?.code === 'receiver_otp' || t.state === 'receiver_otp' || t.next_action === 'verify_receiver_otp')
    );

    if (pendingTransfers.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No pending invitations</b><br><br>You haven\'t received any share transfer invitations. When another member initiates a transfer to you, it will appear here for your approval.</div>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;text-align:left;font-size:14px;">';
    html += '<tr style="background:#f8f9fa;border-bottom:2px solid #eee"><th style="padding:12px 10px">Date</th><th style="padding:12px 10px">Sender</th><th style="padding:12px 10px">Shares</th><th style="padding:12px 10px">Status</th><th style="padding:12px 10px">Action</th></tr>';
    
    pendingTransfers.forEach(inv => {
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.date || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.from_name || inv.from_membership_no || 'Unknown'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.number_of_shares || 0}</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><span class="status">${inv.status_label || inv.status?.label || 'Pending Receiver OTP'}</span></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          <button class="btn btn-primary" style="padding:5px 10px;font-size:12px;" onclick="promptReceiverOtp('${inv.reference || inv.id || inv.transfer_id}')">Accept Transfer</button>
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error loading pending transfers: ${e.message}</div>`;
  }
}

let currentTransferIdForOtp = null;

window.promptReceiverOtp = function(transferId) {
  currentTransferIdForOtp = transferId;
  document.getElementById('otpOverlay').classList.remove('hidden');
  const inputs = document.querySelectorAll('#receiverOtpRow input');
  inputs.forEach(inp => inp.value = '');
  if(inputs[0]) inputs[0].focus();
};

window.closeReceiverOtpModal = function() {
  document.getElementById('otpOverlay').classList.add('hidden');
  currentTransferIdForOtp = null;
};

window.submitReceiverOtp = async function() {
  if (!currentTransferIdForOtp) return;
  
  const inputs = document.querySelectorAll('#receiverOtpRow input');
  let otp = '';
  inputs.forEach(inp => otp += inp.value);
  
  if (otp.length < 6) return showToast("Please enter the complete 6-digit OTP", true);
  
  try {
    const btn = document.querySelector('#otpOverlay .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    
    const res = await API.verifyTransferReceiverOtp(currentTransferIdForOtp, otp);
    const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
    if (isSuccess) {
      showToast('Transfer accepted successfully!');
      closeReceiverOtpModal();
      loadReceivedInvitations();
      loadDashboard();
    } else {
      showToast('Error accepting transfer: ' + (res?.message || res?.error || 'Invalid OTP'), true);
    }
    
    btn.disabled = false;
    btn.textContent = 'Verify';
  } catch (e) {
    const btn = document.querySelector('#otpOverlay .btn-primary');
    btn.disabled = false;
    btn.textContent = 'Verify';
    showToast('Error accepting transfer: ' + e.message, true);
  }
};


async function handleSellShares(e) {
  e.preventDefault();
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  
  const qty = parseInt(document.getElementById('sellSharesQty').value, 10);
  const price = parseFloat(document.getElementById('sellSharesPrice').value);
  const btn = e.target.querySelector('button');
  const errorContainer = document.getElementById('sell-error-container');
  if (errorContainer) errorContainer.innerHTML = '';
  
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  
  try {
      const res = await API.sellShares(shNum, qty, price);
      const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
      
      if (isSuccess) {
        showToast('Sell request submitted successfully!');
        if (window.sellProgress) window.sellProgress.setStep(2);
        
        // Render persistent success message card
        const cardContainer = document.querySelector('#tab-12 .portalcard');
        if (cardContainer) {
          cardContainer.innerHTML = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:18px; padding:28px; text-align:center; color:#166534; box-shadow:0 8px 20px rgba(0,0,0,0.03);">
              <div style="font-size:44px; margin-bottom:12px;">✅</div>
              <h3 style="margin-top:0; margin-bottom:8px; color:#15803d; font-size:20px;">Share Listing Published!</h3>
              <p style="margin:0 0 20px; font-size:13.5px; line-height:1.6; color:#166534;">
                Your offer to sell <strong>${qty.toLocaleString()} shares</strong> at <strong>${price.toFixed(2)} AED</strong> per share has been successfully published. Other members can now view and accept this listing in the marketplace directory.
              </p>
              <button class="btn btn-primary" onclick="resetSellSharesForm()" style="background:#15803d; border-color:#15803d; color:#fff; padding:10px 24px;">Create Another Listing</button>
            </div>
          `;
        }
      } else {
        const errMsg = res?.message || res?.error || 'Unknown error';
        showToast('Error: ' + errMsg, true);
        showSellError(errMsg);
      }
  } catch(err) {
      showToast('Sell failed: ' + err.message, true);
      showSellError(err.message);
  } finally {
      btn.disabled = false;
      btn.textContent = 'Create Share Listing';
  }
}

window.resetSellSharesForm = function() {
  const cardContainer = document.querySelector('#tab-12 .portalcard');
  if (cardContainer) {
    cardContainer.innerHTML = `
      <div id="sell-error-container"></div>
      <form id="sellSharesForm" onsubmit="handleSellShares(event)">
        <div class="form-group" style="margin-bottom:15px">
          <label style="display:block;margin-bottom:5px">Number of Shares to Sell:</label>
          <input type="number" id="sellSharesQty" min="1" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;">
        </div>
        <div class="form-group" style="margin-bottom:15px">
          <label style="display:block;margin-bottom:5px">Asking Price per Share (AED):</label>
          <input type="number" step="0.01" id="sellSharesPrice" min="1" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;">
        </div>
        <button type="submit" class="btn btn-primary">Create Share Listing</button>
      </form>
    `;
  }
  if (window.sellProgress) window.sellProgress.setStep(1);
};

function showSellError(msg) {
  const container = document.getElementById('sell-error-container');
  if (container) {
    container.innerHTML = `
      <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:12px; padding:16px; margin-bottom:20px; color:#991b1b; font-size:13.5px; display:flex; flex-direction:column; gap:6px; text-align: left;">
        <strong style="display:flex; align-items:center; gap:6px;">❌ Listing Creation Failed</strong>
        <span>${msg}</span>
      </div>
    `;
  }
}

async function handleBuyInterest(listingId) {
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  const offerPrice = prompt("Enter your offer price per share (AED) for listing #" + listingId + ":");
  if (!offerPrice) return;
  try {
      const res = await API.buyInterest(shNum, listingId, parseFloat(offerPrice));
      if (res && (res.success || res.status === 'success' || !res.error)) {
        showToast('Buy interest submitted successfully!');
      } else {
        showToast('Error submitting request: ' + (res.message || res.error || 'Unknown error'), true);
      }
  } catch(err) {
      showToast('Buy request failed: ' + err.message, true);
  }
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translate(-50%, 20px);background:${isError ? '#b5242e' : '#138a65'};color:#fff;padding:14px 20px;border-radius:12px;z-index:99999;box-shadow:0 10px 25px rgba(0,0,0,0.25);font-weight:600;font-size:14px;transition:all 0.3s ease;opacity:0;cursor:pointer;max-width:90vw;text-align:center;display:flex;align-items:center;gap:12px;line-height:1.4;`;
  t.innerHTML = `<span>${msg}</span><span style="opacity:0.6;font-size:18px;line-height:1;">&times;</span>`;
  
  t.onclick = function() {
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, 20px)';
    setTimeout(() => t.remove(), 300);
  };
  
  document.body.appendChild(t);
  
  setTimeout(() => { 
    t.style.opacity = '1'; 
    t.style.transform = 'translate(-50%, 0)';
  }, 10);
  
  setTimeout(() => { 
      if (document.body.contains(t)) {
        t.style.opacity = '0'; 
        t.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => t.remove(), 300);
      }
  }, 4000);
}

window.handleEditProfile = async function(e) {
  e.preventDefault();
  const phone = document.getElementById('editProfilePhone').value;
  const email = document.getElementById('editProfileEmail').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Updating...';
  try {
    const res = await API.updateShareholderProfile({ mobile: phone, email: email });
    if (res.success || res.status === 'success') {
      showToast('Profile updated successfully!');
      if (window.profileProgress) window.profileProgress.setStep(3);
      loadProfile();
    } else {
      showToast('Update failed: ' + (res.message || res.error || 'Unknown error'), true);
    }
  } catch (err) {
    showToast('Update failed: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Profile';
  }
};

window.handleInviteShareholder = function(num) {
  const progressContainerId = 'invite-progress-' + num.replace(/[^a-zA-Z0-9]/g, '');
  
  // Detect if searched term is a phone number or email to prefill
  let prefillMobile = '';
  let prefillEmail = '';
  if (num && num !== 'New Member') {
    const clean = num.trim();
    if (/^\+?\d{8,15}$/.test(clean) || clean.startsWith('05') || clean.startsWith('00971')) {
      prefillMobile = clean;
    } else if (clean.includes('@')) {
      prefillEmail = clean;
    }
  }

  document.getElementById('lookupReceiverRes').innerHTML = `
    <div style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:8px; padding:15px; margin-top:15px;">
      <div id="${progressContainerId}"></div>
      
      <!-- Collapsible Instructional Info Card -->
      <div style="margin-bottom:20px; border: 1px solid var(--gold, #ffb417); border-radius:18px; overflow:hidden; background:var(--cream, #fff9ed);">
        <button type="button" onclick="toggleInviteProcessInfo()" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:var(--cream, #fff9ed); border:0; padding:16px 20px; cursor:pointer; text-align:left; font-weight:800; color:var(--orange, #f47c20); font-size:15px; border-radius:0; outline:none;">
          <span style="display:flex; align-items:center; gap:8px;">✉️ Shareholder Invitation Process</span>
          <span id="invite-info-chevron" style="transition: transform 0.3s; display:inline-block;">▼</span>
        </button>
        <div id="invite-info-content" style="max-height:0; overflow:hidden; transition: max-height 0.35s ease-out;">
          <div style="padding:0 20px 20px 20px; font-size:13px; line-height:1.5; color:var(--navy, #041f35);">
            <p style="margin-top:0; font-weight:500;">
              Invite a new member to join the EICOOP shareholder registry. This allows them to receive shared transfers and access exclusive cooperative privileges.
            </p>
            
            <div style="display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:12px;">
              <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid rgba(7,52,91,0.06);">
                <strong style="display:block; color:var(--blue, #0b72b9); margin-bottom:4px; font-size:12px;">📋 Prerequisites & Eligibility</strong>
                <ul style="margin:0; padding-left:14px; font-size:11px; color:var(--muted, #667788); line-height:1.4;">
                  <li>Must be a UAE National or Resident.</li>
                  <li>Must have a valid Emirates ID.</li>
                </ul>
              </div>
              <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid rgba(7,52,91,0.06);">
                <strong style="display:block; color:var(--blue, #0b72b9); margin-bottom:4px; font-size:12px;">✍️ Field Requirements</strong>
                <ul style="margin:0; padding-left:14px; font-size:11px; color:var(--muted, #667788); line-height:1.4;">
                  <li><strong>Full Name:</strong> Exactly as shown on Emirates ID.</li>
                  <li><strong>Mobile:</strong> Registered UAE phone number.</li>
                  <li><strong>Email:</strong> Active personal email.</li>
                </ul>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.6); padding:12px; border-radius:8px; margin-bottom:12px; border:1px dashed var(--gold, #ffb417);">
              <strong style="display:block; color:var(--navy, #041f35); margin-bottom:4px; font-size:12px;">🔗 What happens next?</strong>
              <ol style="margin:0; padding-left:14px; font-size:11px; color:var(--muted, #667788); line-height:1.4;">
                <li>The invitee receives a secure link via SMS and Email.</li>
                <li>They click the link to complete registration with their Emirates ID.</li>
                <li>The Registry Board reviews and activates their account (3-5 days).</li>
              </ol>
            </div>

            <div style="font-size:11px; color:var(--muted, #667788);">
              💡 <strong>Tips:</strong> Avoid spelling mismatches with Emirates ID to prevent registration rejection. Limit of invitations applies per user.
            </div>
          </div>
        </div>
      </div>

      <h4 style="margin:0 0 10px; color:var(--navy);">Invite Details</h4>
      <p style="margin:0 0 15px; font-size:13px; color:var(--muted);">Send an invitation to register as a new member.</p>
      
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;margin-bottom:5px;font-size:12px;font-weight:bold;">FULL NAME:</label>
        <input type="text" id="inviteNameInput" placeholder="e.g. Ahmed Ali" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;">
      </div>
      
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;margin-bottom:5px;font-size:12px;font-weight:bold;">MOBILE NUMBER:</label>
        <input type="tel" id="inviteMobileInput" placeholder="e.g. 05x xxx xxxx" value="${prefillMobile}" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;">
      </div>
      
      <div class="form-group" style="margin-bottom:15px">
        <label style="display:block;margin-bottom:5px;font-size:12px;font-weight:bold;">EMAIL ADDRESS:</label>
        <input type="email" id="inviteEmailInput" placeholder="e.g. name@example.com" value="${prefillEmail}" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;">
      </div>

      <button type="button" class="btn btn-primary" onclick="submitInviteShareholder('${num}', this)">Send Invitation</button>
      <button type="button" class="btn btn-white" style="margin-left:10px; border:1px solid #ccc;" onclick="cancelInviteShareholder()">Cancel</button>
    </div>
  `;
  
  setTimeout(() => {
    window.inviteProgress = new StepProgress(progressContainerId, [
      { title: 'Search Recipient', description: 'Validate number' },
      { title: 'Fill Details', description: 'Enter member info' },
      { title: 'Send Invite', description: 'Invitation sent' }
    ], 2);
  }, 50);
};

window.cancelInviteShareholder = function() {
  document.getElementById('lookupReceiverRes').style.display = 'none';
  document.getElementById('lookupReceiverRes').innerHTML = '';
};

window.submitInviteShareholder = async function(num, btn) {
  const name = document.getElementById('inviteNameInput').value.trim();
  const mobile = document.getElementById('inviteMobileInput').value.trim();
  const email = document.getElementById('inviteEmailInput').value.trim();
  
  if (!name || !mobile || !email) {
    showToast('Please fill in all fields (Name, Mobile, Email)', true);
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = 'Sending...';

  let formattedMobile = mobile;
  if (formattedMobile.startsWith('0')) {
    formattedMobile = '+971' + formattedMobile.substring(1);
  } else if (!formattedMobile.startsWith('+')) {
    formattedMobile = '+' + formattedMobile;
  }

  try {
    const res = await API.inviteShareholder({ 
      name: name,
      name_ar: name,
      mobile: formattedMobile,
      email: email,
      requested_shares: 10,
      source: "api",
      receive_share_notifications: true,
      receive_dividend_notifications: true,
      receive_transfer_notifications: true,
      receive_agm_notifications: true,
      receive_news_notifications: true,
      receive_marketing_notifications: false,
      notify_sms: true,
      notify_email: true,
      notify_push: true,
      notify_whatsapp: false,
      preferred_channel: "all"
    });
    if (res.success || res.status === 'success' || res.success === "true") {
      showToast('Invitation sent successfully!');
      if (window.inviteProgress) window.inviteProgress.setStep(3);
      
      const ref = res.registration_reference || res.reference || 'N/A';
      const token = res.invitation_token || 'N/A';
      const state = res.state || 'N/A';
      const expires = res.expires_at || 'N/A';
      const remInvites = res.remaining_invites_today || 'N/A';
      const minShares = res.minimum_initial_shares || 'N/A';
      const fee = res.registration_fee_percent || 'N/A';
      
      const emailSent = res.delivery?.email?.sent || 'false';
      const emailMsg = res.delivery?.email?.message || '';
      const smsSent = res.delivery?.sms?.sent || 'false';
      const smsProv = res.delivery?.sms?.provider || '';
      const inviteUrl = res.delivery?.invitation_url || (window.location.origin + '/shareholder/invitation?reference=' + ref + '&token=' + token);
      
      let emailStatusHtml = emailSent === 'true' || emailSent === true 
        ? '<span style="color:#047857;font-weight:700;">✅ Sent</span>' 
        : `<span style="color:#b91c1c;font-weight:700;">❌ Failed</span> <span style="font-size:11px;color:var(--muted)">(${emailMsg})</span>`;
        
      let smsStatusHtml = smsSent === 'true' || smsSent === true 
        ? `<span style="color:#047857;font-weight:700;">✅ Sent</span> <span style="font-size:11px;color:var(--muted)">(${smsProv})</span>` 
        : '<span style="color:#b91c1c;font-weight:700;">❌ Failed</span>';

      document.getElementById('lookupReceiverRes').innerHTML = `
        <div style="background:#fff; border:2px solid #bbf7d0; border-radius:18px; padding:28px; margin-top:15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: left;">
          <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:44px; margin-bottom:8px;">🎉</div>
            <h3 style="margin:0 0 4px; color:#047857; font-size:22px;">Invitation Created Successfully!</h3>
            <p style="margin:0; color:var(--muted); font-size:13.5px;">Complete documents and submit for approval.</p>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; background:#f8fafc; padding:20px; border-radius:14px; border:1px solid var(--line);">
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">Registration Reference</small>
              <strong style="font-size:15px; color:var(--navy);">${ref}</strong>
            </div>
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">State</small>
              <strong style="font-size:15px; text-transform:capitalize; color:var(--blue);">${state}</strong>
            </div>
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">Expires At</small>
              <strong style="font-size:13px; color:var(--navy);">${expires}</strong>
            </div>
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">Remaining Invites Today</small>
              <strong style="font-size:15px; color:var(--navy);">${remInvites}</strong>
            </div>
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">Min Initial Shares</small>
              <strong style="font-size:13px; color:var(--navy);">${minShares} Shares</strong>
            </div>
            <div>
              <small style="color:var(--muted); display:block; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:0.5px;">Reg Fee Percent</small>
              <strong style="font-size:13px; color:var(--navy);">${fee}%</strong>
            </div>
          </div>
          
          <div style="background:#f8fafc; padding:20px; border-radius:14px; border:1px solid var(--line); margin-bottom:20px;">
            <h4 style="margin-top:0; margin-bottom:12px; font-size:13px; text-transform:uppercase; color:var(--navy); letter-spacing:0.5px; border-bottom:1px solid var(--line); padding-bottom:8px;">Delivery Status</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:13px;">
              <span>📧 Email Delivery:</span>
              <span>${emailStatusHtml}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
              <span>💬 SMS Delivery:</span>
              <span>${smsStatusHtml}</span>
            </div>
          </div>

          <div style="background:#fffbeb; border:1px dashed #f59e0b; padding:18px; border-radius:12px; margin-bottom:24px;">
            <label style="display:block; font-size:11px; font-weight:800; color:#b45309; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">Direct Shareable Link</label>
            <div style="display:flex; gap:8px;">
              <input type="text" readonly value="${inviteUrl}" style="flex:1; padding:10px; border:1px solid #f59e0b; border-radius:8px; font-size:12px; background:#fff; color:var(--navy); font-family:monospace;" id="shInviteUrlField">
              <button class="btn btn-gold" onclick="copyInviteUrl(this)" style="padding:0 16px; font-size:12px; border-radius:8px; height:38px; white-space:nowrap;">📋 Copy Link</button>
            </div>
            <small style="display:block; color:#b45309; font-size:11px; margin-top:8px;">💡 If email failed, you can manually copy this link and send it directly to the recipient.</small>
          </div>
          
          <div style="text-align:center;">
            <button class="btn btn-white" onclick="cancelInviteShareholder()" style="border:1px solid var(--line); padding:10px 24px;">Close & Reset</button>
          </div>
        </div>
      `;
    } else {
      showToast('Invitation failed: ' + (res.message || res.error || 'Unknown error'), true);
      btn.disabled = false;
      btn.innerHTML = 'Send Invitation';
    }
  } catch (err) {
    showToast('Invitation failed: ' + err.message, true);
    btn.disabled = false;
    btn.innerHTML = 'Send Invitation';
  }
};

async function loadShareholderNotifications() {
  const container = document.getElementById('notificationsContent');
  container.innerHTML = 'Loading notifications...';
  try {
    const res = await API.getShareholderNotifications();
    const notifs = res.notifications || [];
    if (notifs.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;">No notifications found.</div>';
      return;
    }
    
    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    notifs.forEach(n => {
      const isRead = n.is_read || n.read;
      const bg = isRead ? '#fff' : '#f0f8ff';
      const markReadBtn = isRead ? '' : `<button class="btn btn-white" style="font-size:11px;padding:4px 8px;border:1px solid var(--line);" onclick="handleMarkNotificationRead(${n.id})">Mark Read</button>`;
      html += `
        <div style="background:${bg};border:1px solid var(--line);border-radius:8px;padding:15px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">${n.date || n.created_at || ''}</div>
            <div style="font-weight:700;color:var(--deep);">${n.title || 'Notification'}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px;">${n.message || n.body || ''}</div>
          </div>
          ${markReadBtn}
        </div>
      `;
    });
    html += '</div>';
    
    if (notifs.some(n => !(n.is_read || n.read))) {
      html = `<div style="margin-bottom:15px;text-align:right;"><button class="btn btn-white" style="font-size:12px;border:1px solid var(--line);" onclick="handleMarkNotificationRead('ALL')">Mark All as Read</button></div>` + html;
    }
    
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:red;padding:20px;">Error loading notifications: ' + e.message + '</div>';
  }
}

window.handleMarkNotificationRead = async function(id) {
  try {
    const ids = id === 'ALL' ? [] : [id];
    const markAll = id === 'ALL';
    await API.markNotificationsRead(ids, markAll);
    loadShareholderNotifications();
    updateUnreadNotificationsCount();
  } catch(e) {
    showToast('Failed to mark read: ' + e.message, true);
  }
};

async function loadShareholderPreferences() {
  const container = document.getElementById('preferencesCheckboxes');
  container.innerHTML = 'Loading preferences...';
  try {
    const res = await API.getShareholderPreferences();
    const prefs = res.preferences || {};
    
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 20px;">
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;">
          <input type="checkbox" id="pref_marketing" ${prefs.marketing ? 'checked' : ''} style="width:18px;height:18px;">
          Marketing & Promotions
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;">
          <input type="checkbox" id="pref_dividends" ${prefs.dividends ? 'checked' : ''} style="width:18px;height:18px;">
          Dividend Updates
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;">
          <input type="checkbox" id="pref_board" ${prefs.board_elections ? 'checked' : ''} style="width:18px;height:18px;">
          Board Elections
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;">
          <input type="checkbox" id="pref_news" ${prefs.cooperative_news ? 'checked' : ''} style="width:18px;height:18px;">
          Cooperative News
        </label>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div style="color:red;padding:20px;">Error loading preferences: ' + e.message + '</div>';
  }
}

window.handlePreferencesUpdate = async function(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const payload = {
      marketing: document.getElementById('pref_marketing').checked,
      dividends: document.getElementById('pref_dividends').checked,
      board_elections: document.getElementById('pref_board').checked,
      cooperative_news: document.getElementById('pref_news').checked
    };
    const res = await API.updateShareholderPreferences(payload);
    if (res.success || res.status === 'success') {
      showToast('Preferences saved successfully!');
      if (window.profileProgress) window.profileProgress.setStep(3);
    } else {
      showToast('Failed to save preferences: ' + (res.message || res.error), true);
    }
  } catch (err) {
    showToast('Error saving preferences: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Preferences';
  }
};

async function loadTransferHistory() {
  const container = document.getElementById('transferHistoryContent');
  container.innerHTML = 'Loading history...';
  try {
    const res = await API.getTransferHistory();
    const transfers = res.transfers || [];
    if (transfers.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;">No transfer history found.</div>';
      return;
    }
    
    let html = `
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;">
        <tr style="background:#f1f5f9;color:var(--deep)">
          <th style="padding:10px;border-bottom:1px solid var(--line)">Ref</th>
          <th style="padding:10px;border-bottom:1px solid var(--line)">Date</th>
          <th style="padding:10px;border-bottom:1px solid var(--line)">Sender / Receiver</th>
          <th style="padding:10px;border-bottom:1px solid var(--line)">Shares</th>
          <th style="padding:10px;border-bottom:1px solid var(--line)">Status</th>
        </tr>
    `;
    transfers.forEach(t => {
      html += `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee"><b>${t.reference || t.id}</b></td>
          <td style="padding:10px;border-bottom:1px solid #eee">${t.date || '-'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee">${t.from_membership_no} ➔ ${t.to_membership_no}</td>
          <td style="padding:10px;border-bottom:1px solid #eee">${t.number_of_shares}</td>
          <td style="padding:10px;border-bottom:1px solid #eee"><span class="status">${t.status_label || t.state || 'Pending'}</span></td>
        </tr>
      `;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:red;padding:20px;">Error loading transfer history: ' + e.message + '</div>';
  }
}

// Collapsible help panel for Transfer Invitations
window.toggleInviteHelpPanel = function() {
  const content = document.getElementById('invite-help-panel-content');
  const chevron = document.getElementById('invite-panel-chevron');
  if (!content || !chevron) return;

  if (content.style.maxHeight && content.style.maxHeight !== "0px" && content.style.maxHeight !== "0") {
    content.style.maxHeight = "0px";
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + "px";
    chevron.style.transform = 'rotate(180deg)';
  }
};

window.triggerDirectInviteFlow = function() {
  const searchVal = document.getElementById('transferReceiver')?.value?.trim() || 'New Member';
  
  // Show lookup result container and render invite form
  document.getElementById('lookupReceiverRes').style.display = 'block';
  handleInviteShareholder(searchVal);
  
  // Collapse the help panel
  const content = document.getElementById('invite-help-panel-content');
  const chevron = document.getElementById('invite-panel-chevron');
  if (content && chevron) {
    content.style.maxHeight = "0px";
    chevron.style.transform = 'rotate(0deg)';
  }
  
  // Update step progress state to Select/Invite
  if (window.transferProgress) {
    window.transferProgress.setStep(1);
  }
  
  // Smooth scroll to the form and focus the name input
  setTimeout(() => {
    document.getElementById('lookupReceiverRes').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('inviteNameInput')?.focus();
  }, 150);
};

window.toggleInviteProcessInfo = function() {
  const content = document.getElementById('invite-info-content');
  const chevron = document.getElementById('invite-info-chevron');
  if (!content || !chevron) return;

  if (content.style.maxHeight && content.style.maxHeight !== "0px" && content.style.maxHeight !== "0") {
    content.style.maxHeight = "0px";
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + "px";
    chevron.style.transform = 'rotate(180deg)';
  }
};

window.copyInviteUrl = function(btn) {
  const field = document.getElementById('shInviteUrlField');
  if (!field) return;
  field.select();
  field.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(field.value).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
};
