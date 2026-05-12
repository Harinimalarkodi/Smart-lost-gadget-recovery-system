// ============================================================
//  gotLost — shared app logic (localStorage "database")
//  Include this script on EVERY page
// ============================================================

const GL = {
  // ── Auth ────────────────────────────────────────────────
  getUsers() { return JSON.parse(localStorage.getItem('gl_users') || '[]'); },
  saveUsers(u) { localStorage.setItem('gl_users', JSON.stringify(u)); },
  getSession() { return JSON.parse(sessionStorage.getItem('gl_session') || 'null'); },
  setSession(user) { sessionStorage.setItem('gl_session', JSON.stringify(user)); },
  clearSession() { sessionStorage.removeItem('gl_session'); },
  isLoggedIn() { return !!this.getSession(); },

  register(name, email, password, extra) {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    const user = { id: Date.now(), name, email, password, ...extra };
    users.push(user);
    this.saveUsers(users);
    return { ok: true, user };
  },

  login(username, password) {
    const users = this.getUsers();
    const user = users.find(u => (u.email === username || u.name === username) && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid username or password.' };
    this.setSession(user);
    return { ok: true, user };
  },

  logout() { this.clearSession(); window.location.href = this._root() + 'index.html'; },

  // ── Items ───────────────────────────────────────────────
  getItems() { return JSON.parse(localStorage.getItem('gl_items') || '[]'); },
  saveItems(items) { localStorage.setItem('gl_items', JSON.stringify(items)); },

  addItem(type, data) {
    const items = this.getItems();
    const item = { id: Date.now(), type, ...data, ts: new Date().toISOString(), status: 'open' };
    items.unshift(item);
    this.saveItems(items);
    return item;
  },

  getLostItems()  { return this.getItems().filter(i => i.type === 'lost'); },
  getFoundItems() { return this.getItems().filter(i => i.type === 'found'); },

  deleteItem(id) {
    const session = this.getSession();
    let items = this.getItems();
    const item = items.find(i => i.id === id);
    if (!item) return false;
    if (item.postedBy !== session?.email) return false;
    items = items.filter(i => i.id !== id);
    this.saveItems(items);
    return true;
  },

  updateItem(id, data) {
    const session = this.getSession();
    let items = this.getItems();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    if (items[idx].postedBy !== session?.email) return false;
    items[idx] = { ...items[idx], ...data };
    this.saveItems(items);
    return true;
  },

  // ── Helpers ─────────────────────────────────────────────
  _root() {
    const p = window.location.pathname;
    return p.includes('/forms/') ? '../' : './';
  },

  timeAgo(ts) {
    const sec = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec/60) + ' min ago';
    if (sec < 86400) return Math.floor(sec/3600) + ' hrs ago';
    return Math.floor(sec/86400) + ' days ago';
  },

  formatDate(ts) { return new Date(ts).toLocaleDateString(); },

  // ── Compress image to base64 (max 600px wide, jpeg 0.7) ──
  compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const maxW = 600;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  // ── Navbar renderer ─────────────────────────────────────
  renderNav() {
    const session = this.getSession();
    const signinLinks = document.querySelectorAll('.gl-signin-link');
    signinLinks.forEach(el => {
      if (session) {
        el.innerHTML = `<i class="fas fa-user signin grow"></i> ${session.name} &nbsp;
          <a href="#" onclick="GL.logout(); return false;" style="color:#ffc107;font-size:0.8em;">(Logout)</a>`;
        el.removeAttribute('href');
        el.style.cursor = 'default';
      } else {
        el.innerHTML = `<i class="fas fa-user signin grow"></i> SignIn`;
        el.setAttribute('href', GL._root() + 'forms/login.html');
      }
    });
  },

  // ── Contact Modal ────────────────────────────────────────
  showContact(id) {
    const items = this.getItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Remove existing modal if any
    const old = document.getElementById('gl-contact-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'gl-contact-modal';
    modal.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.55);z-index:9999;
      display:flex;align-items:center;justify-content:center;`;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:36px 32px;max-width:400px;width:90%;
                  box-shadow:0 8px 32px rgba(0,0,0,0.22);position:relative;font-family:Arial,sans-serif;">
        <button onclick="document.getElementById('gl-contact-modal').remove()"
          style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;
                 cursor:pointer;color:#888;">&times;</button>
        <h5 style="margin-bottom:18px;color:#333;border-bottom:2px solid #007bff;padding-bottom:8px;">
          📋 Poster Details</h5>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:7px 0;color:#888;width:38%;">Name</td>
              <td style="padding:7px 0;font-weight:600;color:#222;">${this._esc(item.postedByName || item.name)}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Email</td>
              <td style="padding:7px 0;">
                <a href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(item.email)}" target="_blank" style="color:#007bff;">${this._esc(item.email)}</a></td></tr>
          ${item.phone ? `<tr><td style="padding:7px 0;color:#888;">Phone</td>
              <td style="padding:7px 0;color:#222;">${this._esc(item.phone)}</td></tr>` : ''}
          <tr><td style="padding:7px 0;color:#888;">Item</td>
              <td style="padding:7px 0;font-weight:600;color:#222;">${this._esc(item.item)}</td></tr>
          ${item.location ? `<tr><td style="padding:7px 0;color:#888;">Location</td>
              <td style="padding:7px 0;color:#222;">${this._esc(item.location)}</td></tr>` : ''}
          ${item.date ? `<tr><td style="padding:7px 0;color:#888;">Date</td>
              <td style="padding:7px 0;color:#222;">${item.date}</td></tr>` : ''}
          ${item.reward ? `<tr><td style="padding:7px 0;color:#888;">Reward</td>
              <td style="padding:7px 0;color:#28a745;font-weight:600;">${this._esc(item.reward)}</td></tr>` : ''}
        </table>
        <a href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(item.email)}&su=${encodeURIComponent('Re: ' + item.item + ' (' + (item.type==='lost'?'Lost':'Found') + ')')}&body=${encodeURIComponent('Hi ' + (item.postedByName||item.name) + ',\n\nI saw your post on gotLost about: ' + item.item + '\n\n')}"
           target="_blank"
           style="display:block;margin-top:20px;background:#007bff;color:#fff;text-align:center;
                  padding:10px;border-radius:6px;text-decoration:none;font-weight:bold;">
          ✉ Send Email via Gmail</a>
        ${item.phone ? `<a href="tel:${this._esc(item.phone)}"
           style="display:block;margin-top:8px;background:#28a745;color:#fff;text-align:center;
                  padding:10px;border-radius:6px;text-decoration:none;font-weight:bold;">
          📞 Call Now</a>` : ''}
      </div>`;
    // Close on backdrop click
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  },

  _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

// Auto-render nav on every page load
document.addEventListener('DOMContentLoaded', () => GL.renderNav());
