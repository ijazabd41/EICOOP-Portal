/**
 * EICOOP Portal V2 Data & Tab Controller
 */

function switchTab(index, btnEl) {
  document.querySelectorAll('.menu button').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  
  const side = document.querySelector('.side');
  if (side) side.classList.remove('open');
  
  document.querySelectorAll('.portal-tab').forEach(tab => tab.classList.add('hidden'));
  document.getElementById('tab-' + index).classList.remove('hidden');
  
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
}

async function loadDashboard() {
  try {
    const [ordR, invR, profR] = await Promise.allSettled([API.myOrders(), API.myInvoices(), API.myProfile()]);
    const orders = ordR.status === 'fulfilled' ? (ordR.value.data || []) : [];
    const invoices = invR.status === 'fulfilled' ? (invR.value.data || []) : [];
    const prof = profR.status === 'fulfilled' ? (profR.value.data && profR.value.data[0]) : null;
    
    document.getElementById('metric-orders').textContent = orders.length;
    document.getElementById('metric-invoices').textContent = invoices.length;
    
    let shares = 0;
    if (prof && prof.shares) shares = prof.shares;
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
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
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
      
      <div style="margin-top: 20px;">
        <h3>Membership Benefits</h3>
        <div class="impact-grid" style="grid-template-columns: 1fr 1fr; margin-top: 15px;">
          <div class="impact-card" style="padding: 20px;">
            <strong style="font-size: 24px;">5%</strong>
            <h3 style="font-size: 16px;">Store Pickup Discount</h3>
            <p style="font-size: 13px;">Save 5% on your orders when selecting Store Pickup.</p>
          </div>
          <div class="impact-card" style="padding: 20px;">
            <strong style="font-size: 24px;">Bulk</strong>
            <h3 style="font-size: 16px;">Wholesale Pricing</h3>
            <p style="font-size: 13px;">Access to exclusive multi-pack and carton pricing.</p>
          </div>
        </div>
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
      container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">No orders found.</div>';
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
      container.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">No invoices found.</div>';
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
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No shares available right now.</div>';
      return;
    }
    
    let html = '<div class="table-responsive"><table style="width:100%;border-collapse:collapse;">';
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
  
  const receiver = document.getElementById('transferReceiver').value.trim();
  const btn = document.getElementById('btnLookupReceiver');

  // Frontend validation
  if (receiver === shNum) {
      return showToast('Cannot transfer shares to your own membership number.', true);
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  
  try {
      btn.textContent = 'Validating...';
      const lookupRes = await API.lookupRecipient(receiver);
      
      const isApiSuccess = lookupRes && (lookupRes.success === true || lookupRes.success === "true" || lookupRes.success === 1 || lookupRes.success === "1");
      const isValidRecipient = isApiSuccess && lookupRes.exists !== "" && lookupRes.exists !== false; 
      
      if (!isApiSuccess || (lookupRes.exists !== undefined && !isValidRecipient)) {
          showToast(lookupRes?.message || 'Invalid recipient. Transfer aborted.', true);
          document.getElementById('transferStep2').style.display = 'none';
      } else {
          showToast('Recipient validated successfully!');
          
          let detailsHtml = `Verified Recipient: ${receiver}`;
          if (lookupRes.recipient) {
              const r = lookupRes.recipient;
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
                          <span>${r.membership_no || receiver}</span>
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
      }
  } catch(err) {
      showToast('Lookup failed: ' + err.message, true);
  } finally {
      btn.disabled = false;
      btn.textContent = originalText;
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
          currentTransferId = res.transfer_id || res.id || res.reference || shNum;
          
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
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Invitations...</div>';
  try {
    const res = await API.getReceivedInvitations(shNum);
    let data = res?.data || res?.invitations || res?.result || [];
    if(!Array.isArray(data)) data = [data];

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No pending invitations received.</p>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;text-align:left;font-size:14px;">';
    html += '<tr style="background:#f8f9fa;border-bottom:2px solid #eee"><th style="padding:12px 10px">Date</th><th style="padding:12px 10px">Sender</th><th style="padding:12px 10px">Shares</th><th style="padding:12px 10px">Status</th><th style="padding:12px 10px">Action</th></tr>';
    
    data.forEach(inv => {
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.date || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.sender_name || inv.sender_membership_no || 'Unknown'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${inv.number_of_shares || 0}</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><span class="status">${inv.status || 'Pending'}</span></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          <button class="btn btn-primary" style="padding:5px 10px;font-size:12px;" onclick="promptReceiverOtp('${inv.id || inv.transfer_id || inv.reference}')">Accept</button>
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error loading invitations: ${e.message}</div>`;
  }
}

window.promptReceiverOtp = async function(transferId) {
  const otp = prompt("Please enter the 6-digit OTP sent to your registered mobile number to accept this transfer:");
  if (!otp) return;
  if (otp.length < 6) return showToast("Invalid OTP format", true);
  
  try {
    const res = await API.verifyTransferReceiverOtp(transferId, otp);
    const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
    if (isSuccess) {
      showToast('Transfer accepted successfully!');
      loadReceivedInvitations();
      loadDashboard();
    } else {
      showToast('Error accepting transfer: ' + (res?.message || res?.error || 'Invalid OTP'), true);
    }
  } catch(e) {
    showToast('Failed to accept transfer: ' + e.message, true);
  }
};


async function handleSellShares(e) {
  e.preventDefault();
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  const qty = parseInt(document.getElementById('sellSharesQty').value, 10);
  const price = parseFloat(document.getElementById('sellSharesPrice').value);
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  try {
      const res = await API.sellShares(shNum, qty, price);
      const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success');
      if (isSuccess) showToast('Sell request submitted successfully!');
      else showToast('Error submitting request: ' + (res?.message || res?.error || 'Unknown error'), true);
      e.target.reset();
  } catch(err) {
      showToast('Sell failed: ' + err.message, true);
  } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Sell Request';
  }
}

async function handleBuyInterest(listingId) {
  const shNum = localStorage.getItem('cd_shareholder_number');
  if (!shNum) return showToast('Not logged in as shareholder', true);
  const offerPrice = prompt("Enter your offer price per share (AED) for listing #" + listingId + ":");
  if (!offerPrice) return;
  try {
      const res = await API.buyInterest(shNum, listingId, parseFloat(offerPrice));
      if (res && (res.success || res.status === 'success' || !res.error)) showToast('Buy interest submitted successfully!');
      else showToast('Error submitting request: ' + (res.message || res.error || 'Unknown error'), true);
  } catch(err) {
      showToast('Buy request failed: ' + err.message, true);
  }
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:20px;right:20px;background:${isError ? '#b5242e' : '#138a65'};color:#fff;padding:15px 25px;border-radius:12px;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-weight:700;transition:opacity 0.3s ease;opacity:0;`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; }, 10);
  setTimeout(() => { 
      t.style.opacity = '0'; 
      setTimeout(() => t.remove(), 300);
  }, 4000);
}
