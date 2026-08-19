/**
 * EICOOP Portal V2 Data & Tab Controller
 */

function switchTab(index, btnEl) {
  document.querySelectorAll('.menu button').forEach(btn => btn.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    let searchIndex = index;
    if ([8, 15, 18, 19, 20, 21].includes(index)) searchIndex = 18;
    const foundBtn = Array.from(document.querySelectorAll('.menu button')).find(b => 
b.getAttribute('onclick') && b.getAttribute('onclick').includes(`switchTab(${searchIndex}`));
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
    updateTransferAvailableShares();
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
  if (index === 22) loadMyListings();
  if (index === 23) loadMyOffers();
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
    else if (prof && (prof.shares || prof.number_of_shares || prof.num_shares)) shares = prof.shares || prof.number_of_shares || prof.num_shares;
    document.getElementById('metric-shares').textContent = shares;

    // UAT v19.0.2.0.8: Update notification badge with count from dashboard
    if (dash) {
      const unread = parseInt(dash.unread_notification_count || 0, 10);
      const dot = document.getElementById('top-notification-dot');
      if (dot) {
        if (unread > 0) {
          dot.style.display = 'flex';
          dot.style.cssText = 'display:flex;align-items:center;justify-content:center;position:absolute;top:-4px;right:-6px;min-width:18px;height:18px;background:#e53935;border-radius:50%;border:2px solid white;font-size:10px;font-weight:800;color:#fff;line-height:1;padding:0 3px;';
          dot.textContent = unread > 99 ? '99+' : String(unread);
        } else {
          dot.style.display = 'none';
          dot.textContent = '';
        }
      }
    }

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

    // UAT v19.0.2.0.8 (Phase 2): Render pending INCOMING share transfers on dashboard
    const incomingSection = document.getElementById('dash-incoming-transfers-section');
    const incomingTransfers = (dash && (dash.incoming_transfer_list || dash.pending_incoming_share_transfers)) || [];
    const incomingCount = (dash && dash.pending_incoming_transfers) !== undefined ? dash.pending_incoming_transfers : incomingTransfers.length;
    if (incomingSection) {
      if (incomingCount > 0 || incomingTransfers.length > 0) {
        incomingSection.style.display = 'block';
        incomingSection.innerHTML = `
          <section class="portalcard" style="border-left:4px solid var(--orange); background:linear-gradient(to right, #fff, #fefdfa); margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
              <h3 style="margin:0; color:var(--navy); display:flex; align-items:center; gap:10px;">
                📥 Incoming Share Transfers
                <span style="background:#e53935; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:20px;">${incomingCount}</span>
              </h3>
              <button class="btn btn-primary" style="padding:8px 18px; font-size:13px;" onclick="switchTab(20)">View All →</button>
            </div>
            ${incomingTransfers.map(t => `
              <div style="background:#fff; border:1px solid #f0e6d2; border-radius:14px; padding:18px 20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div>
                  <div style="font-size:11px; font-weight:800; color:var(--orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">${t.requires_action ? 'Action Required' : 'Waiting'}</div>
                  <div style="font-weight:700; font-size:15px; color:var(--navy);">From: ${t.sender_name || t.from || 'Sender'}</div>
                  <div style="font-size:12px; color:var(--muted); margin-top:3px;">Ref: ${t.transfer_reference || t.reference || '-'} &bull; ${(typeof t.status === 'object' && t.status !== null ? (t.status.label || t.status.code) : t.status) || t.status_label || 'Waiting Approval'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="text-align:center;">
                    <div style="font-size:22px; font-weight:800; color:var(--blue);">${parseFloat(t.shares || 0).toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase;">Shares</div>
                  </div>
                  <button class="btn btn-primary" style="padding:10px 16px; font-size:13px;" onclick="switchTab(20)">Review →</button>
                </div>
              </div>
            `).join('')}
          </section>`;
      } else {
        incomingSection.style.display = 'none';
        incomingSection.innerHTML = '';
      }
    }

    // UAT v19.0.2.0.8 (Phase 2): Render pending OUTGOING share transfers on dashboard
    const outgoingSection = document.getElementById('dash-outgoing-transfers-section');
    const outgoingTransfers = (dash && (dash.outgoing_transfer_list || dash.pending_outgoing_share_transfers)) || [];
    const outgoingCount = (dash && dash.pending_outgoing_transfers) !== undefined ? dash.pending_outgoing_transfers : outgoingTransfers.length;
    if (outgoingSection) {
      if (outgoingCount > 0 || outgoingTransfers.length > 0) {
        outgoingSection.style.display = 'block';
        outgoingSection.innerHTML = `
          <section class="portalcard" style="border-left:4px solid var(--blue); margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
              <h3 style="margin:0; color:var(--navy); display:flex; align-items:center; gap:10px;">
                ⏳ Pending Outgoing Transfers
                <span style="background:var(--blue); color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:20px;">${outgoingCount}</span>
              </h3>
              <button class="btn btn-white" style="padding:8px 18px; font-size:13px; border:1px solid var(--line);" onclick="switchTab(19)">View All →</button>
            </div>
            ${outgoingTransfers.map(t => `
              <div style="background:#f8fafc; border:1px solid var(--line); border-radius:12px; padding:14px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                  <div style="font-weight:700; font-size:14px; color:var(--navy);">To: ${t.receiver_name || t.to || t.to_name || 'Recipient'}</div>
                  <div style="font-size:12px; color:var(--muted); margin-top:3px;">Ref: ${t.transfer_reference || t.reference || '-'} &bull; ${(typeof t.status === 'object' && t.status !== null ? (t.status.label || t.status.code) : t.status) || t.status_label || t.state || 'Pending'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="text-align:center;">
                    <div style="font-size:18px; font-weight:800; color:var(--blue);">${parseFloat(t.shares || t.number_of_shares || 0).toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase;">Shares</div>
                  </div>
                  <button class="btn btn-white" style="padding:8px 12px; font-size:12px; border:1px solid var(--line);" onclick="switchTab(21); viewTransferStatus('${t.transfer_reference || t.reference || ''}')">Track</button>
                </div>
              </div>
            `).join('')}
          </section>`;
      } else {
        outgoingSection.style.display = 'none';
        outgoingSection.innerHTML = '';
      }
    }

    // UAT v19.0.2.0.8: Render pending invitations on dashboard
    const invitationsSection = document.getElementById('dash-pending-invitations-section');
    const pendingInvitations = (dash && dash.pending_invitations) || [];
    const invitationCount = parseInt((dash && dash.pending_invitation_count) || pendingInvitations.length, 10);
    if (invitationsSection) {
      if (invitationCount > 0) {
        invitationsSection.style.display = 'block';
        invitationsSection.innerHTML = `
          <section class="portalcard" style="border-left:4px solid var(--gold); margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <h3 style="margin:0; color:var(--navy); display:flex; align-items:center; gap:10px;">
                ✉️ Pending Invitations
                <span style="background:var(--gold,#f59e0b); color:#7c3f00; font-size:11px; font-weight:800; padding:3px 8px; border-radius:20px;">${invitationCount}</span>
              </h3>
              <button class="btn btn-white" style="padding:8px 18px; font-size:13px; border:1px solid var(--line);" onclick="switchTab(15)">Manage →</button>
            </div>
          </section>`;
      } else {
        invitationsSection.style.display = 'none';
        invitationsSection.innerHTML = '';
      }
    }

    // Shareholder Marketplace Dashboard Summary
    const marketplaceSection = document.getElementById('dash-marketplace-section');
    if (marketplaceSection) {
      // Additive marketplace fields from dash API
      const mktShares = dash && dash.shares_available_for_sale ? dash.shares_available_for_sale : 0;
      const mktNewListings = dash && dash.new_listings_count ? dash.new_listings_count : 0;
      const mktMyListings = dash && dash.my_active_listings ? dash.my_active_listings : 0;
      const mktMyOffers = dash && dash.my_submitted_offers ? dash.my_submitted_offers : 0;
      const mktNewOffers = dash && dash.new_offers_received ? dash.new_offers_received : 0;
      
      // Only show if there's any marketplace activity or listings available
      if (mktShares > 0 || mktNewListings > 0 || mktMyListings > 0 || mktMyOffers > 0 || mktNewOffers > 0) {
        marketplaceSection.style.display = 'block';
        marketplaceSection.innerHTML = `
          <section class="portalcard" style="border-left:4px solid #4CAF50; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
              <h3 style="margin:0; color:var(--navy); display:flex; align-items:center; gap:10px;">
                🏪 Share Marketplace
                ${mktNewOffers > 0 ? `<span style="background:#e53935; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:20px;">${mktNewOffers} New Offers</span>` : ''}
              </h3>
              <div>
                <button class="btn btn-primary" style="padding:8px 15px; font-size:12px;" onclick="switchTab(13)">Browse Listings →</button>
              </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
              <div style="background:#f5f9fc; padding:15px; border-radius:8px; text-align:center; cursor:pointer;" onclick="switchTab(13)">
                <div style="font-size:24px; font-weight:800; color:var(--blue);">${parseFloat(mktShares).toLocaleString()}</div>
                <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase;">Available Shares</div>
              </div>
              <div style="background:#f5f9fc; padding:15px; border-radius:8px; text-align:center; cursor:pointer;" onclick="switchTab(13)">
                <div style="font-size:24px; font-weight:800; color:var(--blue);">${mktNewListings}</div>
                <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase;">New Listings</div>
              </div>
              <div style="background:#f5f9fc; padding:15px; border-radius:8px; text-align:center; cursor:pointer;" onclick="switchTab(22)">
                <div style="font-size:24px; font-weight:800; color:${mktMyListings > 0 ? 'var(--orange)' : 'var(--navy)'};">${mktMyListings}</div>
                <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase;">My Active Listings</div>
              </div>
              <div style="background:#f5f9fc; padding:15px; border-radius:8px; text-align:center; cursor:pointer;" onclick="switchTab(23)">
                <div style="font-size:24px; font-weight:800; color:${mktMyOffers > 0 ? 'var(--gold)' : 'var(--navy)'};">${mktMyOffers}</div>
                <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase;">My Submitted Offers</div>
              </div>
            </div>
          </section>`;
      } else {
        marketplaceSection.style.display = 'none';
        marketplaceSection.innerHTML = '';
      }
    }

    // Add red dot to Transfers Hub menu item if there are pending transfers
    const totalPendingTransfers = incomingCount + outgoingCount;
    const transferHubBtn = document.querySelector('button[onclick="switchTab(18, this)"]');
    if (transferHubBtn) {
      let dot = transferHubBtn.querySelector('.transfer-dot');
      if (!dot) {
        transferHubBtn.style.display = 'flex';
        transferHubBtn.style.alignItems = 'center';
        transferHubBtn.style.justifyContent = 'space-between';
        transferHubBtn.innerHTML = `<span>🔄 Transfers Hub</span><span class="transfer-dot" style="display:none;background:#e53935;border-radius:50%;width:8px;height:8px;"></span>`;
        dot = transferHubBtn.querySelector('.transfer-dot');
      }
      if (totalPendingTransfers > 0) {
        dot.style.display = 'inline-block';
      } else {
        dot.style.display = 'none';
      }
    }

    // Update tab header count badges dynamically
    document.querySelectorAll('.badge-pending-sent').forEach(el => {
      if (outgoingCount > 0) {
        el.textContent = outgoingCount;
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('.badge-incoming').forEach(el => {
      if (incomingCount > 0) {
        el.textContent = incomingCount;
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('.badge-invitations').forEach(el => {
      if (invitationCount > 0) {
        el.textContent = invitationCount;
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });

  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

async function updateTransferAvailableShares() {
  const availSharesEl = document.getElementById('transfer-avail-shares');
  const availValueEl = document.getElementById('transfer-avail-value');
  if (!availSharesEl || !availValueEl) return;
  
  try {
    const shNum = localStorage.getItem('cd_shareholder_number');
    if (!shNum) return;
    
    // Fetch profile or certificates to get accurate available shares and value
    const [profR, certR] = await Promise.allSettled([
      API.myProfile(),
      API.getShareholderCertificates(shNum)
    ]);
    
    let shares = 0;
    let totalValue = 0;
    
    if (profR.status === 'fulfilled') {
      const p = Array.isArray(profR.value.data) ? profR.value.data[0] : profR.value.data;
      if (p) {
        shares = parseFloat(p.shares || p.number_of_shares || p.num_shares || 0);
      }
    }
    
    if (certR.status === 'fulfilled') {
      const certs = certR.value?.certificates || certR.value?.result?.certificates || certR.value?.data || certR.value?.result || [];
      const certList = Array.isArray(certs) ? certs : [certs];
      let calculatedVal = 0;
      let calculatedShares = 0;
      certList.forEach(c => {
        if (c) {
          calculatedVal += parseFloat(c.total_value || c.total_share_value || 0);
          calculatedShares += parseFloat(c.number_of_shares || c.num_shares || 0);
        }
      });
      if (calculatedVal > 0) {
        // Use certificate-based values if available
        if (calculatedShares > 0 && Math.abs(calculatedShares - shares) < 1) {
          totalValue = calculatedVal;
        } else {
          // Calculate rate from certificates
          const rate = calculatedVal / calculatedShares;
          totalValue = shares * rate;
        }
      } else {
        // Fallback: 10 AED per share (nominal UAE cooperative value)
        totalValue = shares * 10;
      }
    } else {
      // Fallback rate if certs fetch fails
      totalValue = shares * 10;
    }
    
    availSharesEl.textContent = shares.toLocaleString();
    availValueEl.textContent = 'AED ' + totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  } catch (e) {
    console.error("Failed to load available shares for transfer:", e);
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
    const px = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '/proxy.php' : '';
    const r = await fetch(px + '/api/shareholder/lookup', {
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
    const shNum = localStorage.getItem('cd_shareholder_number');
    const [profR, certR, transR] = await Promise.allSettled([
      API.myProfile(),
      API.getShareholderCertificates(shNum),
      API.getTransferHistory()
    ]);
    
    const p = profR.status === 'fulfilled' ? (Array.isArray(profR.value.data) ? profR.value.data[0] : profR.value.data) : null;
    if (!p) throw new Error("No profile found");
    
    const memNo = shNum || p.partner_sequence || p.id;
    const shares = parseFloat(p.shares || p.number_of_shares || p.num_shares || 0);
    
    // Certificates count and value calculation
    let certCount = 0;
    let calculatedVal = 0;
    if (certR.status === 'fulfilled') {
      const certs = certR.value?.certificates || certR.value?.result?.certificates || certR.value?.data || certR.value?.result || [];
      const certList = Array.isArray(certs) ? certs : [certs];
      certList.forEach(c => {
        if (c && (c.id || c.share_id)) {
          certCount++;
          calculatedVal += parseFloat(c.total_value || c.total_share_value || 0);
        }
      });
    }
    const totalValue = calculatedVal > 0 ? calculatedVal : (shares * 10);
    
    // Pending transfers count
    let pendingTransfers = 0;
    if (transR.status === 'fulfilled') {
      const transfers = transR.value?.transfers || [];
      transfers.forEach(t => {
        const state = t.state || t.status?.code || '';
        if (['receiver_otp', 'sender_otp', 'waiting_operations', 'waiting_chairman'].includes(state)) {
          pendingTransfers++;
        }
      });
    }

    container.innerHTML = `
      <div class="portalmetrics" style="margin-bottom: 20px;">
        <div class="pmetric"><b>${shares.toLocaleString()}</b><small>Shares Owned</small></div>
        <div class="pmetric"><b style="color:var(--green);">AED ${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b><small>Estimated Value</small></div>
        <div class="pmetric"><b>${certCount}</b><small>Certificates</small></div>
        <div class="pmetric"><b>${pendingTransfers}</b><small>Pending Transfers</small></div>
      </div>
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
        const issueDate = cert.issue_date || cert.date || 'N/A';
        const status = cert.status || 'Active';
        
      return `
        <div class="portalcard" style="display:flex; flex-direction:column; gap:15px; margin-top:15px; padding:20px; border-left: 4px solid var(--gold); border-radius:12px; background:linear-gradient(to right, #fff, #fefdfa);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px;">
            <div style="flex:1; min-width:200px; max-width:100%; overflow:hidden;">
              <div style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">Official Document</div>
              <div style="font-weight:800; font-size:20px; color:var(--navy); word-wrap:break-word;">Certificate #${certNum}</div>
              <div style="font-size:14px; color:var(--muted); margin-top:8px;">
                <strong>Date:</strong> <span dir="auto">${issueDate}</span><br>
                <strong>Status:</strong> <span style="color:${status.toLowerCase() === 'active' ? 'green' : 'orange'}; text-transform:capitalize;">${status}</span>
              </div>
            </div>
            <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #f0e6d2; min-width:140px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
              <div style="font-size:11px; color:var(--muted); font-weight:800; text-transform:uppercase;">Registered Shares</div>
              <div style="font-size:24px; font-weight:800; color:var(--blue); margin:5px 0;">${parseFloat(shares).toLocaleString()}</div>
              <div style="font-size:12px; color:var(--green); font-weight:600;">Value: AED ${parseFloat(val).toLocaleString()}</div>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; border-top:1px solid #f0e6d2; padding-top:15px;">
            <button onclick="previewCertificate('${shareId}')" class="btn btn-white" style="flex:1; padding:10px; border:1px solid var(--blue); color:var(--blue);">👁️ Preview</button>
            <button onclick="downloadCertificate('${shareId}')" class="btn btn-primary" style="flex:1; padding:10px; background:var(--blue);">📥 Download PDF</button>
          </div>
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
    const res = await API.getMarketplaceListings();
    const listings = res.listings || res.data || [];
    if (listings.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No active listings</b><br><br>There are currently no shares listed for sale by other members. Check back later!</div>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;font-size:14px;">';
    html += '<tr style="background:#f5f5f5;text-align:left;">' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Reference</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Seller</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Shares</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Price/Share</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Total</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Action</th>' +
            '</tr>';
            
    listings.forEach(l => {
      const shares = parseFloat(l.number_of_shares || l.shares || 0);
      const price = parseFloat(l.asking_price_per_share || l.price_per_share || 0);
      const total = parseFloat(l.total_asking_amount || (shares * price)).toFixed(2);
      const seller = l.seller_name || l.seller || 'N/A';
      const ref = l.reference || l.id || l.listing_id || 'N/A';
      const stateBadge = l.state === 'published' 
        ? `<button class="btn btn-primary" style="padding:5px 10px;border-radius:3px;font-size:12px" onclick="promptSubmitOffer('${l.id}', ${price})">Make Offer</button>`
        : `<span style="font-size:11px;color:var(--orange);font-weight:700;text-transform:uppercase;">${l.state.replace('_', ' ')}</span>`;
      
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${ref}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${seller}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${shares.toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${price.toFixed(2)} AED</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><strong>${total} AED</strong></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          ${stateBadge}
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error: ${e.message}</div>`;
  }
}

async function loadMyListings() {
  const container = document.getElementById('myListingsContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Your Listings...</div>';
  
  try {
    const res = await API.getMyListings();
    const listings = res.listings || res.data || [];
    if (listings.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No active listings</b><br><br>You have not listed any shares for sale.</div>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;font-size:14px;">';
    html += '<tr style="background:#f5f5f5;text-align:left;">' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Reference</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Shares</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Price/Share</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Total</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Status</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Actions</th>' +
            '</tr>';
            
    listings.forEach(l => {
      const shares = parseFloat(l.number_of_shares || 0);
      const price = parseFloat(l.asking_price_per_share || 0);
      const total = parseFloat(l.total_asking_amount || (shares * price)).toFixed(2);
      
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${l.reference || l.id}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${shares.toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${price.toFixed(2)} AED</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><strong>${total} AED</strong></td>
        <td style="padding:10px;border-bottom:1px solid #eee"><span style="text-transform:capitalize;font-weight:bold;color:${l.state === 'published' ? 'var(--blue)' : 'var(--muted)'}">${l.state}</span></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          <button class="btn btn-white" style="padding:5px 10px;font-size:12px;border:1px solid var(--line);" onclick="viewListingOffers('${l.id}')">View Offers</button>
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error: ${e.message}</div>`;
  }
}

window.viewListingOffers = async function(listingId) {
  const container = document.getElementById('myListingsContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Offers for Listing...</div>';
  
  try {
    const res = await API.getListingOffers(listingId);
    const offers = res.offers || res.data || [];
    
    let html = `<div style="margin-bottom:15px;"><button class="btn btn-white" style="padding:5px 10px;font-size:12px;border:1px solid var(--line);" onclick="loadMyListings()">← Back to My Listings</button></div>`;
    
    if (offers.length === 0) {
      html += '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No offers yet</b><br><br>There are currently no offers from buyers for this listing.</div>';
      container.innerHTML = html;
      return;
    }
    
    html += '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;font-size:14px;">';
    html += '<tr style="background:#f5f5f5;text-align:left;">' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Buyer</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Shares Requested</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Offer Price/Share</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Total Offer</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Status</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Action</th>' +
            '</tr>';
            
    offers.forEach(o => {
      const shares = parseFloat(o.number_of_shares || 0);
      const price = parseFloat(o.offer_price_per_share || 0);
      const total = parseFloat(o.total_offer_amount || (shares * price)).toFixed(2);
      const buyer = o.buyer_name || o.buyer || 'N/A';
      
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${buyer}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${shares.toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${price.toFixed(2)} AED</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><strong>${total} AED</strong></td>
        <td style="padding:10px;border-bottom:1px solid #eee"><span style="text-transform:capitalize;font-weight:bold;">${o.state}</span></td>
        <td style="padding:10px;border-bottom:1px solid #eee">
          ${o.state === 'pending' || o.state === 'submitted' ? `
            <button class="btn btn-primary" style="padding:5px 10px;border-radius:3px;font-size:12px;margin-right:5px;" onclick="handleAcceptOffer('${o.id}', '${listingId}')">Accept</button>
            <button class="btn btn-white" style="padding:5px 10px;border-radius:3px;font-size:12px;border:1px solid var(--red);color:var(--red);" onclick="handleRejectOffer('${o.id}', '${listingId}')">Reject</button>
          ` : `-`}
        </td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="margin-bottom:15px;"><button class="btn btn-white" style="padding:5px 10px;font-size:12px;border:1px solid var(--line);" onclick="loadMyListings()">← Back to My Listings</button></div><div style="padding:20px;color:red;">Error: ${e.message}</div>`;
  }
}

window.handleAcceptOffer = async function(offerId, listingId) {
  if (!await customConfirm("Accept Offer", "Are you sure you want to ACCEPT this offer?")) return;
  try {
    const res = await API.acceptBuyerOffer(offerId, "");
    if (res.error) throw new Error(res.error);
    showToast("Offer accepted successfully!");
    viewListingOffers(listingId); // Reload
  } catch (e) {
    showToast("Failed to accept offer: " + e.message, true);
  }
}

window.handleRejectOffer = async function(offerId, listingId) {
  if (!await customConfirm("Reject Offer", "Are you sure you want to REJECT this offer?")) return;
  try {
    const res = await API.rejectBuyerOffer(offerId, "");
    if (res.error) throw new Error(res.error);
    showToast("Offer rejected successfully!");
    viewListingOffers(listingId); // Reload
  } catch (e) {
    showToast("Failed to reject offer: " + e.message, true);
  }
}

async function loadMyOffers() {
  const container = document.getElementById('myOffersContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading Your Offers...</div>';
  
  try {
    const res = await API.getMyOffers();
    const offers = res.offers || res.data || [];
    if (offers.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:#f9fafb;border-radius:12px;border:1px dashed #dbe7ef;"><b>No offers submitted</b><br><br>You have not submitted any offers for share listings.</div>';
      return;
    }
    
    let html = '<div style="overflow-x:auto;"><table style="width:100%;min-width:600px;border-collapse:collapse;font-size:14px;">';
    html += '<tr style="background:#f5f5f5;text-align:left;">' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Listing Ref</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Shares Requested</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Offer Price/Share</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Total Offer</th>' +
            '<th style="padding:10px;border-bottom:2px solid #ddd">Status</th>' +
            '</tr>';
            
    offers.forEach(o => {
      const shares = parseFloat(o.number_of_shares || 0);
      const price = parseFloat(o.offer_price_per_share || 0);
      const total = parseFloat(o.total_offer_amount || (shares * price)).toFixed(2);
      
      html += `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${o.listing_reference || o.listing_id}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${shares.toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #eee">${price.toFixed(2)} AED</td>
        <td style="padding:10px;border-bottom:1px solid #eee"><strong>${total} AED</strong></td>
        <td style="padding:10px;border-bottom:1px solid #eee"><span style="text-transform:capitalize;font-weight:bold;">${o.state}</span></td>
      </tr>`;
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:red;">Error: ${e.message}</div>`;
  }
}

async function promptSubmitOffer(listingId, defaultPrice) {
  const result = await customMultiPrompt('Submit Offer', `Enter your offer details for listing #${listingId}:`, [
    { id: 'offerPrice', label: 'Offer price per share (AED)', type: 'number', placeholder: 'e.g. 100', value: defaultPrice || '' },
    { id: 'offerShares', label: 'Number of shares you want to buy', type: 'number', placeholder: 'e.g. 50' },
    { id: 'offerNote', label: 'Note for the seller (Optional)', type: 'text', placeholder: 'Optional note' }
  ]);
  
  if (!result) return; // User cancelled
  
  const price = result.offerPrice;
  const shares = result.offerShares;
  const note = result.offerNote || '';
  
  if (!price || !shares) return showToast('Please enter price and shares.', true);
  
  try {
    const res = await API.submitBuyerOffer(listingId, {
      offer_price_per_share: parseFloat(price),
      number_of_shares: parseFloat(shares),
      note: note,
      source: "web"
    });
    
    if (res.error_code || res.error) throw new Error(res.message || res.error_code || res.error);
    showToast("Offer submitted successfully!");
    switchTab(23); // Go to My Offers
  } catch (e) {
    showToast("Failed to submit offer: " + e.message, true);
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
    
      // UAT v19.0.2.0.8: RECIPIENT_NOT_FOUND with can_invite = true
      if ((errorCode === "RECIPIENT_NOT_FOUND" || res.exists === false || res.exists === "false") && (res.can_invite === "true" || res.can_invite === true)) {
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

      // UAT v19.0.2.0.8: exists but can_transfer = false (ineligible)
      if (res.exists === true || res.exists === "true") {
        if (res.can_transfer === false || res.can_transfer === "false") {
          const msg = res.message || 'This recipient is not eligible to receive shares at this time.';
          document.getElementById('lookupReceiverRes').innerHTML = `<div style="color:#b45309;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">⚠️ ${msg}</div>`;
          document.getElementById('lookupReceiverRes').style.display = 'block';
          return;
        }
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
      
      // UAT v19.0.2.0.8: Read from res.shareholder first, fall back to res.recipient
      const sh = res.shareholder || res.recipient || {};
      const englishName  = sh.name || sh.english_name || 'N/A';
      const arabicName   = sh.name_ar || sh.arabic_name || '';
      const membershipNo = sh.membership_no || sh.membership_number || num;
      const status       = sh.status || sh.shareholder_status || 'N/A';
      const isActive     = (status.toLowerCase() === 'active');
      const eligible     = (sh.eligible_to_receive !== undefined) ? sh.eligible_to_receive : sh.eligible_to_receive_shares;
      const isEligible   = eligible === true || eligible === 'true';
      const photoUrl     = sh.photo_url || sh.shareholder_photo || sh.photo || '';
      
      const photoHtml = photoUrl
        ? `<img src="${photoUrl}" alt="${englishName}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--deep));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0;">${(englishName[0]||'?').toUpperCase()}</div>`;

      const detailsHtml = `
        <div style="background:#f0fdf4; padding:20px; border-radius:14px; border:1px solid #bbf7d0; color:#166534;">
          <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
            ${photoHtml}
            <div>
              <div style="font-weight:800; font-size:17px; color:var(--navy);">${englishName}</div>
              ${arabicName ? `<div style="font-size:14px; color:var(--muted); direction:rtl; text-align:right;">${arabicName}</div>` : ''}
              <div style="font-size:12px; color:var(--muted); margin-top:3px;">${membershipNo}</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
            <div style="background:#fff; border-radius:10px; padding:10px 14px; border:1px solid #d1fae5;">
              <div style="font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase; margin-bottom:3px;">Status</div>
              <div style="font-weight:700; color:${isActive ? '#047857' : '#b45309'}; text-transform:capitalize;">${isActive ? '✅' : '⚠️'} ${status}</div>
            </div>
            <div style="background:#fff; border-radius:10px; padding:10px 14px; border:1px solid #d1fae5;">
              <div style="font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase; margin-bottom:3px;">Eligible</div>
              <div style="font-weight:700; color:${isEligible ? '#047857' : '#b45309'};">${isEligible ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>
        </div>
      `;
      
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
          currentTransferId = res.transfer_reference || res.transfer?.reference || res.transfer?.id || res.id || shNum;
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
      const isSuccess = res && (res.success === true || res.success === "true" || res.success === 1 || res.success === "1" || res.status === 'success' || res.next_action === 'WAIT_RECEIVER_APPROVAL' || res.next_action_code === 'WAIT_RECEIVER_APPROVAL');
      
      if (isSuccess) {
          showToast('Sender successfully verified! Waiting for receiver approval.');
          document.getElementById('transferReceiver').disabled = false;
          document.getElementById('lookupReceiverForm').reset();
          document.getElementById('transferSharesForm').reset();
          document.getElementById('transferStep3').style.display = 'none';
          document.getElementById('btnLookupReceiver').style.display = 'inline-block';
          
          if (window.transferProgress) {
            window.transferProgress.setStep(5);
            setTimeout(() => {
              if (window.transferProgress) window.transferProgress.setStep(1);
            }, 3000);
          }
          
          // Switch to Status tab to track it!
          switchTab(21);
          viewTransferStatus(currentTransferId);
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
          const isApproval = res.approval_required === 'true' || res.approval_required === true || res.state === 'submitted';
          const title = isApproval ? 'Request Submitted for Approval' : 'Share Listing Published!';
          const msg = res.message || `Your offer to sell <strong>${qty.toLocaleString()} shares</strong> at <strong>${price.toFixed(2)} AED</strong> per share has been successfully processed.`;
          
          cardContainer.innerHTML = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:18px; padding:28px; text-align:center; color:#166534; box-shadow:0 8px 20px rgba(0,0,0,0.03);">
              <div style="font-size:44px; margin-bottom:12px;">✅</div>
              <h3 style="margin-top:0; margin-bottom:8px; color:#15803d; font-size:20px;">${title}</h3>
              <p style="margin:0 0 20px; font-size:13.5px; line-height:1.6; color:#166534;">
                ${msg}
              </p>
              ${res.reference ? `<p style="font-size:12px; margin-top:-10px; margin-bottom:20px; opacity:0.8;">Reference: <b>${res.reference}</b></p>` : ''}
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
  const offerPrice = await customPrompt('Submit Offer', `Enter your offer price per share (AED) for listing #${listingId}:`, 'Price (AED)');
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
    
    // Helper to safely get nested values or fallback to false
    const getPref = (category, channel) => {
      if (prefs[category] && typeof prefs[category] === 'object') return prefs[category][channel] ? 'checked' : '';
      return ''; // Default unchecked if format doesn't match
    };

    const categories = [
      { id: 'share_notifications', label: 'Share Notifications' },
      { id: 'dividend_notifications', label: 'Dividend Notifications' },
      { id: 'transfer_notifications', label: 'Transfer Notifications' },
      { id: 'agm_notifications', label: 'AGM Notifications' },
      { id: 'news_notifications', label: 'News Notifications' },
      { id: 'marketing_notifications', label: 'Marketing Notifications' }
    ];
    const channels = [
      { id: 'sms', label: 'SMS' },
      { id: 'email', label: 'Email' },
      { id: 'push', label: 'Push Notification' },
      { id: 'whatsapp', label: 'WhatsApp' }
    ];

    let html = `
      <div style="overflow-x:auto; margin-bottom:20px; border:1px solid var(--line); border-radius:8px;">
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
          <thead>
            <tr style="background:var(--slate); border-bottom:1px solid var(--line);">
              <th style="padding:12px; text-align:left; font-size:13px; color:var(--muted);">Notification Type</th>
              ${channels.map(c => `<th style="padding:12px; text-align:center; font-size:13px; color:var(--muted);">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    categories.forEach((cat, idx) => {
      html += `<tr style="border-bottom:1px solid var(--line); background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
                 <td style="padding:12px; font-size:14px; color:var(--navy); font-weight:600;">${cat.label}</td>`;
      channels.forEach(chan => {
        html += `<td style="padding:12px; text-align:center;">
                   <input type="checkbox" id="pref_${cat.id}_${chan.id}" ${getPref(cat.id, chan.id)} style="width:18px;height:18px;cursor:pointer;">
                 </td>`;
      });
      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
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
    const categories = ['share_notifications', 'dividend_notifications', 'transfer_notifications', 'agm_notifications', 'news_notifications', 'marketing_notifications'];
    const channels = ['sms', 'email', 'push', 'whatsapp'];
    
    const payload = {};
    categories.forEach(cat => {
      payload[cat] = {};
      channels.forEach(chan => {
        const el = document.getElementById(`pref_${cat}_${chan}`);
        payload[cat][chan] = el ? el.checked : false;
      });
    });

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

// ====== NEW TRANSFER WORKFLOW (v19.0.2.0.8) ====== //

let statusPollInterval = null;

async function loadPendingTransfers() {
  const container = document.getElementById('pendingTransfersContent');
  if (!container) return;
  container.innerHTML = 'Loading pending transfers...';
  
  try {
    const res = await API.getTransferHistory();
    const transfers = res.transfers || [];
    const pending = transfers.filter(t => 
      t.from_membership_no === localStorage.getItem('cd_shareholder_number') && 
      !['done', 'rejected', 'cancelled', 'expired'].includes((t.status_code || t.state || '').toLowerCase())
    );
    
    if (pending.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;">No pending transfers.</div>';
      return;
    }
    
    let html = '';
    pending.forEach(t => {
      // UAT v19.0.2.0.8: Use backend's cancellable field; cancel is only allowed at receiver_approval stage
      const isCancellable = t.cancellable === true || t.cancellable === "true";
      html += `
        <div style="border:1px solid var(--line); border-radius:12px; padding:15px; margin-bottom:15px; background:#fff; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b style="font-size:16px;">Ref: ${t.reference || t.id}</b><br>
            <small style="color:var(--muted);">To: ${t.to_membership_no}</small><br>
            <span class="status" style="margin-top:5px; display:inline-block;">${t.status_label || t.state || 'Pending'}</span>
          </div>
          <div>
            <div style="font-size:20px; font-weight:800; color:var(--blue); margin-bottom:8px; text-align:right;">${t.number_of_shares} Shares</div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary" style="padding:8px 12px; font-size:12px;" onclick="switchTab(21); viewTransferStatus('${t.reference || t.id}')">View Status</button>
              ${isCancellable ? `<button class="btn btn-white" style="padding:8px 12px; font-size:12px; color:red; border:1px solid red;" onclick="cancelTransferRequest('${t.reference || t.id}')">Cancel</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:red;">Error loading pending transfers: ' + e.message + '</div>';
  }
}

async function loadIncomingTransfers() {
  const container = document.getElementById('incomingTransfersContent');
  if (!container) return;
  container.innerHTML = 'Loading incoming requests...';
  
  try {
    const res = await API.getTransferHistory();
    const transfers = res.transfers || [];
    const incoming = transfers.filter(t => {
      const loggedInUser = localStorage.getItem('cd_shareholder_number');
      const loggedInUserUid = localStorage.getItem('cd_user_id');
      const isReceiver = t.to_membership_no === loggedInUser || 
                         String(t.to_partner_id) === loggedInUser || 
                         String(t.to_partner_id) === loggedInUserUid ||
                         (t.to_partner_id && typeof t.to_partner_id === 'object' && String(t.to_partner_id.id) === loggedInUserUid);
                         
      const state = (t.state || (t.status && typeof t.status === 'string' ? t.status : t.status?.code) || t.status_code || '').toLowerCase();
      return isReceiver && ['receiver_approval', 'receiver_otp'].includes(state);
    });
    
    if (incoming.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;">No incoming transfer requests requiring your action.</div>';
      return;
    }
    
    let html = '';
    incoming.forEach(t => {
      const state = (t.state || (t.status && typeof t.status === 'string' ? t.status : t.status?.code) || t.status_code || '').toLowerCase();
      const safeRef = (t.reference || t.id).replace(/\//g, '-');
      
      let actionButtonsHtml = '';
      if (state === 'receiver_approval') {
        actionButtonsHtml = `
          <div style="background:#fff3cd; color:#856404; padding:12px 15px; border-radius:8px; font-size:13px; border:1px solid #ffeeba; display:flex; gap:10px; align-items:center;">
            <span style="font-size:18px;">⚠️</span>
            <span>By accepting, you agree to receive these shares. An OTP will be sent to your registered mobile number for final authorization.</span>
          </div>
          <div style="display:flex; gap:12px; margin-top:5px; flex-wrap:wrap;">
            <button class="btn btn-primary" style="flex:1; padding:14px; font-size:14px; background:var(--green); border-color:var(--green); box-shadow:0 4px 12px rgba(40, 167, 69, 0.2);" onclick="acceptIncomingTransfer('${t.reference || t.id}')">✅ Accept Transfer</button>
            <button class="btn btn-white" style="flex:1; padding:14px; font-size:14px; color:#dc3545; border:1px solid #dc3545; background:#fff;" onclick="rejectIncomingTransfer('${t.reference || t.id}')">❌ Reject Transfer</button>
          </div>
        `;
      } else if (state === 'receiver_otp') {
        actionButtonsHtml = `
          <div style="background:#fff3cd; color:#856404; padding:12px 15px; border-radius:8px; font-size:13px; border:1px solid #ffeeba; display:flex; gap:10px; align-items:center;">
            <span style="font-size:18px;">⚠️</span>
            <span>This transfer is awaiting OTP verification. Please enter the 6-digit code sent to your registered mobile number.</span>
          </div>
          <div style="padding: 20px; text-align: center; background: #fff; border: 1px solid var(--line); border-radius: 16px; margin-top: 5px;">
            <h4 style="margin: 0 0 15px 0; color: var(--navy); font-weight:800;">Verify OTP for ${t.reference || t.id}</h4>
            <div class="field" style="max-width: 350px; margin: 0 auto 20px;">
              <div class="otp-row" id="otp-row-${safeRef}">
                <input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1">
              </div>
            </div>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-primary" style="padding:10px 20px; font-size:13px; background:var(--blue);" onclick="submitIncomingReceiverOtp('${t.reference || t.id}')">Verify & Complete</button>
              <button class="btn btn-white" style="padding:10px 20px; font-size:13px; border:1px solid var(--line);" onclick="resendIncomingReceiverOtp('${t.reference || t.id}')">Resend OTP</button>
              <button class="btn btn-white" style="padding:10px 20px; font-size:13px; color:#dc3545; border:1px solid #dc3545;" onclick="rejectIncomingTransfer('${t.reference || t.id}')">Reject</button>
            </div>
          </div>
        `;
      }

      html += `
        <div class="portalcard" style="border-left: 4px solid var(--orange); margin-bottom: 20px; padding: 25px; display:flex; flex-direction:column; gap:15px; background:linear-gradient(to right, #fff, #fefdfa);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px;">
            <div>
              <div style="font-size:12px; font-weight:800; color:var(--orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">Action Required</div>
              <div style="font-weight:800; font-size:22px; color:var(--navy);">Incoming Transfer Request</div>
              <div style="font-size:14px; color:var(--muted); margin-top:8px;">
                <strong>From:</strong> <span style="color:var(--navy); font-weight:600;">${t.from_name || t.from_membership_no}</span><br>
                <strong>Reference:</strong> ${t.reference || t.id}
              </div>
            </div>
            <div style="background:#fff; padding:15px 25px; border-radius:12px; border:1px solid #f0e6d2; text-align:center; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
              <div style="font-size:11px; color:var(--muted); font-weight:800; text-transform:uppercase;">Shares to Receive</div>
              <div style="font-size:32px; font-weight:800; color:var(--blue); margin:5px 0;">${parseFloat(t.number_of_shares).toLocaleString()}</div>
            </div>
          </div>
          <div id="action-area-${safeRef}" style="display:flex; flex-direction:column; gap:15px;">
            ${actionButtonsHtml}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
    
    // Attach traversal to all inline OTP rows
    container.querySelectorAll('.otp-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      inputs.forEach((input, index) => {
        input.value = '';
        input.addEventListener('keyup', function(e) {
          if (e.key === 'Backspace') {
            if (input.value === '' && index > 0) inputs[index - 1].focus();
          } else if (input.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        });
      });
    });
  } catch (e) {
    container.innerHTML = '<div style="color:red; padding:20px;">Error loading incoming transfers: ' + e.message + '</div>';
  }
}

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
        <button id="customConfirmCancel" class="btn btn-white" style="flex:1; border: 1px solid #e2e8f0; padding: 12px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">Cancel</button>
        <button id="customConfirmOk" class="btn btn-primary" style="flex:1; padding: 12px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; background: var(--blue); border-color: var(--blue); color: #fff; transition: all 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);">Yes, Proceed</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    // Add button hovers
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


window.customMultiPrompt = function(title, message, fields) {
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
    let fieldsHtml = fields.map(f => `
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px;">${f.label}</label>
        <input type="${f.type || 'text'}" id="${f.id}" placeholder="${f.placeholder || ''}" value="${f.value || ''}" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14.5px; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
      </div>
    `).join('');

    box.innerHTML = `
      <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 1px solid #fee2e2;">
        <span style="font-size: 24px;">💬</span>
      </div>
      <h3 style="margin-top:0; color: #0f172a; font-size: 20px; font-weight:800; margin-bottom:8px; letter-spacing:-0.5px;">${title}</h3>
      <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">${message}</p>
      ${fieldsHtml}
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button id="customPromptCancel" class="btn btn-white" style="border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">Cancel</button>
        <button id="customPromptOk" class="btn btn-primary" style="padding: 10px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; background: var(--blue); border-color: var(--blue); color: #fff; transition: all 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);">Submit</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const cancelBtn = overlay.querySelector('#customPromptCancel');
    const okBtn = overlay.querySelector('#customPromptOk');
    
    fields.forEach((f, i) => {
      const input = overlay.querySelector('#' + f.id);
      input.onfocus = () => input.style.borderColor = 'var(--blue)';
      input.onblur = () => input.style.borderColor = '#cbd5e1';
      if (i === 0) {
        setTimeout(() => input.focus(), 15);
      }
    });

    cancelBtn.onmouseenter = () => cancelBtn.style.background = '#f8fafc';
    cancelBtn.onmouseleave = () => cancelBtn.style.background = '#fff';
    okBtn.onmouseenter = () => okBtn.style.transform = 'translateY(-1px)';
    okBtn.onmouseleave = () => okBtn.style.transform = 'none';

    setTimeout(() => {
      overlay.style.opacity = '1';
      box.style.transform = 'translateY(0) scale(1)';
    }, 10);
    
    const cleanup = (isOk) => {
      overlay.style.opacity = '0';
      box.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        document.body.removeChild(overlay);
        if (!isOk) resolve(null);
        else {
          const vals = {};
          fields.forEach(f => vals[f.id] = overlay.querySelector('#' + f.id).value);
          resolve(vals);
        }
      }, 200);
    };
    
    cancelBtn.onclick = () => cleanup(false);
    okBtn.onclick = () => cleanup(true);
  });
};

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
      <input type="text" id="customPromptInput" placeholder="${placeholder}" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 24px; font-size: 14.5px; outline: none; transition: border-color 0.2s;" />
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="customPromptCancel" class="btn btn-white" style="border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">Cancel</button>
        <button id="customPromptOk" class="btn btn-primary" style="padding: 10px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; background: var(--blue); border-color: var(--blue); color: #fff; transition: all 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);">Submit</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#customPromptInput');
    const cancelBtn = overlay.querySelector('#customPromptCancel');
    const okBtn = overlay.querySelector('#customPromptOk');
    
    input.onfocus = () => input.style.borderColor = 'var(--blue)';
    input.onblur = () => input.style.borderColor = '#cbd5e1';
    cancelBtn.onmouseenter = () => cancelBtn.style.background = '#f8fafc';
    cancelBtn.onmouseleave = () => cancelBtn.style.background = '#fff';
    okBtn.onmouseenter = () => okBtn.style.transform = 'translateY(-1px)';
    okBtn.onmouseleave = () => okBtn.style.transform = 'none';

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

async function acceptIncomingTransfer(reference) {
  if (!await customConfirm('Accept Transfer', 'Are you sure you want to accept this share transfer? This will generate an OTP for final verification.')) return;
  try {
    showToast('Accepting transfer...');
    // UAT v19.0.2.0.8: Use primary receiver_action endpoint with action='accept'
    const res = await API.receiverAction(reference, 'accept');
    if (res.success || res.status === 'success' || res.next_action === 'VERIFY_RECEIVER_OTP' || res.next_action_code === 'VERIFY_RECEIVER_OTP') {
      showToast('Transfer accepted. Please verify OTP to complete.');
      
      const safeRef = reference.replace(/\//g, '-');
      const actionArea = document.getElementById(`action-area-${safeRef}`);
      if (actionArea) {
        actionArea.innerHTML = `
          <div style="background:#fff3cd; color:#856404; padding:12px 15px; border-radius:8px; font-size:13px; border:1px solid #ffeeba; display:flex; gap:10px; align-items:center;">
            <span style="font-size:18px;">⚠️</span>
            <span>This transfer is awaiting OTP verification. Please enter the 6-digit code sent to your registered mobile number.</span>
          </div>
          <div style="padding: 20px; text-align: center; background: #fff; border: 1px solid var(--line); border-radius: 16px; margin-top: 5px;">
            <h4 style="margin: 0 0 15px 0; color: var(--navy); font-weight:800;">Verify OTP for ${reference}</h4>
            <div class="field" style="max-width: 350px; margin: 0 auto 20px;">
              <div class="otp-row" id="otp-row-${safeRef}">
                <input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1"><input value="" maxlength="1">
              </div>
            </div>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-primary" style="padding:10px 20px; font-size:13px; background:var(--blue);" onclick="submitIncomingReceiverOtp('${reference}')">Verify & Complete</button>
              <button class="btn btn-white" style="padding:10px 20px; font-size:13px; border:1px solid var(--line);" onclick="resendIncomingReceiverOtp('${reference}')">Resend OTP</button>
              <button class="btn btn-white" style="padding:10px 20px; font-size:13px; color:#dc3545; border:1px solid #dc3545;" onclick="rejectIncomingTransfer('${reference}')">Reject</button>
            </div>
          </div>
        `;
        
        // Attach keyup listeners to the new inputs
        const inputs = actionArea.querySelectorAll(`#otp-row-${safeRef} input`);
        inputs.forEach((input, index) => {
          input.value = '';
          input.addEventListener('keyup', function(e) {
            if (e.key === 'Backspace') {
              if (input.value === '' && index > 0) inputs[index - 1].focus();
            } else if (input.value.length === 1 && index < inputs.length - 1) {
              inputs[index + 1].focus();
            }
          });
        });
        if (inputs[0]) inputs[0].focus();
      } else {
        loadIncomingTransfers();
      }
    } else {
      showToast('Error accepting transfer: ' + (res.message || res.error), true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

async function rejectIncomingTransfer(reference) {
  const reason = await customPrompt('Reject Transfer', 'Please enter a reason for rejecting this transfer (optional):', 'Reason for rejection');
  if (reason === null) return;
  try {
    showToast('Rejecting transfer...');
    // UAT v19.0.2.0.8: Use primary receiver_action endpoint with action='reject'
    const res = await API.receiverAction(reference, 'reject', reason || '');
    if (res.success || res.status === 'success' || res.next_action === 'CLOSED' || res.next_action_code === 'CLOSED') {
      showToast('Transfer rejected successfully.');
      loadIncomingTransfers();
    } else {
      showToast('Error rejecting transfer: ' + (res.message || res.error), true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

window.submitIncomingReceiverOtp = async function(reference) {
  const safeRef = reference.replace(/\//g, '-');
  const inputs = document.querySelectorAll(`#otp-row-${safeRef} input`);
  let otp = '';
  inputs.forEach(i => otp += i.value);
  if (otp.length < 6) return showToast('Please enter the full 6-digit OTP', true);
  
  try {
    showToast('Verifying OTP...');
    const res = await API.verifyTransferReceiverOtp(reference, otp);
    if (res.success || res.status === 'success' || res.next_action === 'COMPLETE_TRANSFER' || res.next_action_code === 'COMPLETE_TRANSFER' || res.next_action === 'COMPLETED' || res.next_action_code === 'COMPLETED') {
      showToast('Transfer completed successfully!');
      loadIncomingTransfers();
      loadDashboard();
    } else {
      showToast('Error verifying OTP: ' + (res.message || res.error), true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

window.resendIncomingReceiverOtp = async function(reference) {
  try {
    showToast('Resending OTP...');
    // UAT v19.0.2.0.8: Use dedicated resend_receiver_otp endpoint (NOT acceptTransfer)
    const res = await API.resendReceiverOtp(reference);
    if (res.success || res.status === 'success' || res.status === 'receiver_otp') {
      const remaining = res.remaining_resends !== undefined ? ` (${res.remaining_resends} remaining)` : '';
      showToast(`OTP resent successfully!${remaining}`);
      const safeRef = reference.replace(/\//g, '-');
      const row = document.getElementById(`otp-row-${safeRef}`);
      if (row) {
        const inputs = row.querySelectorAll('input');
        inputs.forEach(inp => inp.value = '');
        if (inputs[0]) inputs[0].focus();
      }
    } else {
      showToast('Error resending OTP: ' + (res.message || res.error), true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

async function cancelTransferRequest(reference) {
  const reason = await customPrompt('Cancel Transfer', 'Please enter a reason for cancelling this transfer (optional):', 'Reason for cancellation');
  if (reason === null) return;
  try {
    showToast('Cancelling transfer...');
    const res = await API.cancelTransfer(reference, reason);
    if (res.success || res.status === 'success') {
      showToast('Transfer cancelled successfully.');
      loadPendingTransfers();
    } else {
      showToast('Error cancelling transfer: ' + (res.message || res.error), true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

async function viewTransferStatus(reference) {
  document.getElementById('statusPageTitle').textContent = `📊 Transfer Status: ${reference}`;
  document.getElementById('currentTransferState').textContent = 'Loading...';
  document.getElementById('transferTimeline').innerHTML = '';
  
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
  
  const fetchStatus = async () => {
    try {
      const res = await API.getTransferStatus(reference);
      
      const transferData = res.transfer || res;
      const statusObj = transferData.status || {};
      
      if (!window.statusStepProgress) {
        window.statusStepProgress = new StepProgress('transferStatusProgress', [
          { title: 'Sender', description: 'Initiation & OTP' },
          { title: 'Operations', description: 'Operations Review' },
          { title: 'Receiver', description: 'Acceptance & OTP' },
          { title: 'Chairman', description: 'Final Approval' },
          { title: 'Completed', description: 'Transfer Done' }
        ], 1);
      }
      
      const rawState = String(statusObj.code || transferData.state || '').toLowerCase();
      let step = 1;
      if (['operator', 'waiting_operations', 'submitted'].includes(rawState)) step = 2;
      else if (['receiver_approval', 'waiting_receiver_approval', 'receiver_otp', 'verify_receiver_otp'].includes(rawState)) step = 3;
      else if (['approved', 'waiting_chairman', 'chairman'].includes(rawState)) step = 4;
      else if (['done', 'completed', 'closed', 'rejected', 'cancelled', 'expired'].includes(rawState)) step = 5;
      
      window.statusStepProgress.setStep(step);
      
      const formatNextAction = (code) => {
        if (!code) return '';
        const mapping = {
          'sender_otp': 'Awaiting Sender OTP Verification',
          'receiver_approval': 'Awaiting Receiver Approval',
          'wait_receiver_approval': 'Awaiting Receiver Approval',
          'receiver_otp': 'Awaiting Receiver OTP Verification',
          'verify_receiver_otp': 'Awaiting Receiver OTP Verification',
          'wait_backend_review': 'Awaiting Operations Review',
          'wait_operations_review': 'Awaiting Operations Review',
          'operator': 'Awaiting Operations Review',
          'wait_chairman_approval': 'Awaiting Chairman Approval',
          'chairman_approval': 'Awaiting Chairman Approval',
          'complete_transfer': 'Completing Share Transfer...',
          'completed': 'Transfer Completed',
          'closed': 'Closed',
          'closed_rejected': 'Closed (Rejected)',
          'closed_cancelled': 'Closed (Cancelled)',
          'closed_expired': 'Closed (Expired)',
          'rejected': 'Rejected',
          'cancelled': 'Cancelled',
          'expired': 'Expired'
        };
        const normalized = String(code).toLowerCase().trim().replace(/\s+/g, '_');
        return mapping[normalized] || normalized.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      };
      
      document.getElementById('currentTransferState').textContent = statusObj.label || transferData.status_label || transferData.state || transferData.status || 'Processing';
      
      const nextActionRaw = statusObj.next_action || transferData.next_action_label || transferData.next_action_code || transferData.next_action || '';
      document.getElementById('estimatedNextStep').textContent = formatNextAction(nextActionRaw);
      
      let timelineHtml = '';
      if (transferData.timeline && Array.isArray(transferData.timeline)) {
        transferData.timeline.forEach((item, idx) => {
          const isDone = item.completed === 'true' || item.completed === true || item.date || item.at;
          const isRejected = item.status === 'rejected' || item.terminal_state === 'rejected';
          const color = isRejected ? 'var(--red)' : (isDone ? 'var(--green)' : 'var(--muted)');
          const icon = isRejected ? '❌' : (isDone ? '✓' : (idx === transferData.timeline.findIndex(x => (!x.completed || x.completed === 'false') && !x.date && !x.at) ? '⏳' : '⬜'));
          timelineHtml += `
            <div style="display:flex; gap:15px; margin-bottom:15px;">
              <div style="color:${color}; font-size:18px;">${icon}</div>
              <div>
                <b style="color:${isRejected ? 'var(--red)' : 'var(--navy)'};">${item.step || item.label || item.state || item.action || 'Unknown Step'}</b>
                <div style="font-size:12px; color:var(--muted);">${item.date || item.at || 'Pending'}</div>
              </div>
            </div>
          `;
        });
      }
      document.getElementById('transferTimeline').innerHTML = timelineHtml;
      
      const rawStatus = transferData.status_code || statusObj.code || transferData.state || (typeof transferData.status === 'string' ? transferData.status : '') || '';
      const isTerminal = statusObj.is_terminal === 'true' || statusObj.is_terminal === true || ['done', 'rejected', 'cancelled', 'expired'].includes(String(rawStatus).toLowerCase());
      if (isTerminal && statusPollInterval) {
        clearInterval(statusPollInterval);
        statusPollInterval = null;
      }
    } catch (e) {
      document.getElementById('currentTransferState').textContent = 'Error fetching status: ' + e.message;
      if (statusPollInterval) clearInterval(statusPollInterval);
    }
  };
  
  await fetchStatus();
  statusPollInterval = setInterval(fetchStatus, 10000);
}

const originalLoadDashboard = loadDashboard;
loadDashboard = async function() {
  await originalLoadDashboard();
  if (document.getElementById('tab-19') && !document.getElementById('tab-19').classList.contains('hidden')) loadPendingTransfers();
  if (document.getElementById('tab-20') && !document.getElementById('tab-20').classList.contains('hidden')) loadIncomingTransfers();
};

const originalSwitchTab = switchTab;
switchTab = function(index, btnEl) {
  originalSwitchTab(index, btnEl);
  if (index === 19) loadPendingTransfers();
  if (index === 20) loadIncomingTransfers();
  if (index !== 21 && statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
};

window.resetSellSharesForm = function() {
  const form = document.getElementById('sellSharesForm');
  if (form) form.reset();
  const btn = form ? form.querySelector('button[type="submit"]') : null;
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Create Share Listing';
  }
};

window.handleSellShares = async function(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const qty = parseInt(document.getElementById('sellSharesQty').value, 10);
  const price = parseFloat(document.getElementById('sellSharesPrice').value);
  
  if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
    return showToast("Please enter valid positive numbers for shares and price.", true);
  }
  
  btn.disabled = true;
  btn.textContent = "Creating Listing...";
  
  try {
    const res = await API.createSellListing({
      number_of_shares: qty,
      asking_price_per_share: price
    });
    
    if (res.error) throw new Error(res.error);
    
    showToast("Share listing created successfully!");
    if (window.sellProgress) window.sellProgress.setStep(2);
    setTimeout(() => {
      switchTab(22); // Go to My Listings
    }, 1500);
  } catch (err) {
    showToast("Failed to create listing: " + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Create Share Listing';
  }
};
