/**
 * EICOOP Portal V2 Auth Controller
 */
let shProfileData = null;
let shNumber = '';
let shTimerInterval = null;

function openLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeLogin() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function backToLookup() {
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('stepVerify').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
  document.getElementById('lookupError').style.display = 'none';
  shProfileData = null;
  shNumber = '';
}

async function showOtp() {
  const numInp = document.getElementById('memberInput');
  const num = numInp?.value?.trim();
  const btn = document.querySelector('#step1 button');
  const err = document.getElementById('lookupError');

  if (err) err.style.display = 'none';

  if (!num) {
    if(err) { err.textContent = 'Please enter shareholder or membership number'; err.style.display = 'block'; }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Looking up...';
  }

  try {
    const r = await API.shareholderLookup(num);
    
    // Check if the lookup failed or was unauthorized without returning a profile
    if (!r || r.error || (r.success === false && !r.shareholder && !r.partner)) {
       throw new Error(r.error || r.message || 'Shareholder not found or invalid response');
    }
    
    const profile = r.shareholder || r.partner || (r.data && r.data[0]) || (r.result && (r.result.shareholder || r.result.partner || (Array.isArray(r.result) ? r.result[0] : null)));
    
    if (profile) {
      shProfileData = profile;
      shNumber = num;
      
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('stepVerify').classList.remove('hidden');
      
      const name = profile.name || 'Unknown Shareholder';
      document.getElementById('lookupName').textContent = name;
      // document.getElementById('lookupInitial').textContent = name.charAt(0).toUpperCase();
      
      const phone = profile.phone || profile.mobile || 'N/A';
      // Mask phone number
      const maskedPhone = phone.length > 4 ? '***-***-' + phone.slice(-4) : phone;
      document.getElementById('lookupPhone').textContent = 'Phone: ' + maskedPhone;
      
    } else {
      throw new Error('Shareholder not found');
    }
  } catch (e) {
    if(err) { 
        err.textContent = '❌ ' + (e.message || 'Shareholder not found or server unavailable'); 
        err.style.display = 'block'; 
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Lookup Shareholder →';
    }
  }
}

async function confirmAndSendOtp() {
  const btn = document.getElementById('btnSendOtp');
  if(btn) {
      btn.disabled = true;
      btn.textContent = 'Sending OTP...';
  }
  
  try {
    await API.shareholderSendOtp(shNumber);
    
    document.getElementById('stepVerify').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    
    const phone = shProfileData.phone || shProfileData.mobile || '';
    const maskedPhone = phone.length > 4 ? '***-***-' + phone.slice(-4) : phone;
    document.getElementById('otpPhone').textContent = maskedPhone;
    
    // Focus first OTP input
    const inputs = document.querySelectorAll('.otp-row input');
    inputs.forEach(input => input.value = '');
    if (inputs[0]) inputs[0].focus();
    
    // Setup OTP input traversal
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });
  } catch(e) {
      alert('Failed to send OTP: ' + e.message);
  } finally {
      if(btn) {
          btn.disabled = false;
          btn.textContent = 'Yes, Send OTP →';
      }
  }
}

async function enterPortal() {
  const inputs = document.querySelectorAll('.otp-row input');
  let otp = '';
  inputs.forEach(i => otp += i.value);

  const btn = document.querySelector('#step2 .btn-primary');

  if (otp.length < 6) {
    alert('Please enter the 6-digit OTP code');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }

  try {
    const r = await API.shareholderVerifyOtp(shNumber, otp);
    const resultData = r.result || r;
    const isSuccess = r.success === 1 || r.success === true
      || resultData.success === 1 || resultData.success === true
      || !!(resultData.session_id || resultData.uid || resultData.user_id || resultData.session);
      
    if (isSuccess) {
      const rd = r.result || r;
      const sessId = rd.__session_id || r.__session_id || rd.session_id || r.session_id || '';
      
      const session = {
        uid: rd.uid || rd.user_id || r.uid || 2,
        name: (rd.shareholder && rd.shareholder.name) || shProfileData.name,
        username: shNumber,
        partner_id: (rd.shareholder && rd.shareholder.partner_id) || shProfileData.id || 0,
        session_id: sessId,
        login_time: Date.now()
      };

      localStorage.setItem('cd_session', JSON.stringify(session));
      if (sessId) localStorage.setItem('cd_session_id', sessId);
      localStorage.setItem('cd_user_id', String(session.uid));
      localStorage.setItem('cd_shareholder_number', shNumber);
      
      closeLogin();
      document.getElementById('site').classList.add('hidden');
      document.getElementById('portal').classList.remove('hidden');
      window.scrollTo(0,0);
      
      if (window.loadPortalData) {
        window.loadPortalData();
      }

    } else {
      throw new Error(r.error || r.message || 'Invalid OTP code');
    }
  } catch (e) {
    alert(e.message || 'OTP verification failed');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Verify & Continue →';
    }
  }
}

function logout() {
  API.clearSess();
  localStorage.removeItem('cd_session_id');
  localStorage.removeItem('cd_user_id');
  localStorage.removeItem('cd_shareholder_number');
  
  document.getElementById('portal').classList.add('hidden');
  document.getElementById('site').classList.remove('hidden');
  backLogin();
  window.scrollTo(0,0);
}

document.addEventListener('DOMContentLoaded', () => {
  if (API.loggedIn() && localStorage.getItem('cd_shareholder_number')) {
    shNumber = localStorage.getItem('cd_shareholder_number');
    document.getElementById('site').classList.add('hidden');
    document.getElementById('portal').classList.remove('hidden');
    if (window.loadPortalData) {
      window.loadPortalData();
    }
  }
});
