/* ═══════════════════════════════════════════════════════════
   VIBE — app.js (Optimized for Speed, Network & Safety)
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ───────────────────────── CONFIG ─────────────────────────
const SUPABASE_URL = 'https://zlhufgzcwvpimuspmtjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsaHVmZ3pjd3ZwaW11c3BtdGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE3MzAsImV4cCI6MjEwNzExNzczMH0.cHuE4qZBfqmH874D30QuwJ6P12FnjaOoGbygljENDFo';

const ADMIN_USERNAMES = ['amirali', 'admin', 'premium'];
const CREATOR_USERNAMES = ['amirali'];
const ONLINE_TIMEOUT = 90000;
const FEED_COUNT = 20;
const HEARTBEAT_INTERVAL = 30000;
const NET_TIMEOUT_DEFAULT = 15000;
const BACKGROUND_REINIT_THRESHOLD = 30000;
const POLL_INTERVAL = 5000;         // ⬅️ بهینه‌شده: از 1.5s به 5s افزایش یافت
const POLL_INTERVAL_SLOW = 15000;   // ⬅️ بهینه‌شده: برای تب مخفی

const BADGE_COLORS = {
    cyan: { hex: '#06b6d4', label: 'Cyan' },
    purple: { hex: '#8b5cf6', label: 'Purple' },
    red: { hex: '#ef4444', label: 'Red' },
    green: { hex: '#10b981', label: 'Green' },
    black: { hex: '#374151', label: 'Black' }
};

const DB = {
    users: 'zmz_users',
    posts: 'zmz_posts',
    session: 'zmz_session',
    chat: 'zmz_chat',
    notifs: 'zmz_notifs',
    blocks: 'zmz_blocks',
    dms: 'zmz_dms',
    dmRead: 'zmz_dm_read',
    dmConvIdCache: 'zmz_dm_conv_cache',
    saved: 'zmz_saved',
    reports: 'zmz_reports',
    online: 'zmz_online'
};

const GRADIENTS = [
    'linear-gradient(135deg,#06b6d4,#3b82f6)',
    'linear-gradient(135deg,#22d3ee,#0ea5e9)',
    'linear-gradient(135deg,#fbbf24,#ef4444)',
    'linear-gradient(135deg,#f472b6,#a855f7)',
    'linear-gradient(135deg,#34d399,#06b6d4)',
    'linear-gradient(135deg,#f97316,#dc2626)',
    'linear-gradient(135deg,#8b5cf6,#6366f1)',
    'linear-gradient(135deg,#14b8a6,#0891b2)',
    'linear-gradient(135deg,#ec4899,#8b5cf6)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#10b981,#84cc16)',
    'linear-gradient(135deg,#f59e0b,#fbbf24)',
    'linear-gradient(135deg,#ef4444,#f472b6)',
    'linear-gradient(135deg,#06b6d4,#8b5cf6)',
    'linear-gradient(135deg,#64748b,#334155)',
    'linear-gradient(135deg,#a855f7,#ec4899)',
    'linear-gradient(135deg,#0f766e,#06b6d4)',
    'linear-gradient(135deg,#dc2626,#7c2d12)'
];

const EMOJIS = ['👑', '💎', '⭐', '🔥', '❄️', '⚡', '🌊', '🌙', '☀️', '🦁', '🐉', '🦊', '🦋', '🎭', '🎨', '👾', '🐷', '🫧', '🧸', '🎲', '🎶', '🌈', '☄️'];

// ───────────────────────── SUPABASE CLIENT ─────────────────────────
let supa = null;
function initSupaClient() {
    if (!window.supabase) {
        console.error('Supabase SDK not loaded!');
        return false;
    }
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        realtime: {
            params: { eventsPerSecond: 20 } // ⬅️ بهینه‌شده: کاهش بار سرور
        },
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
    return true;
}

// ───────────────────────── GLOBAL STATE ─────────────────────────
let currentUser = null;
let supaUserId = null;
let currentTab = 'foryou';
let viewingUser = null;
let currentPostId = null;
let viewStack = [];
let connUser = null;
let connType = 'followers';
let pendingAction = null;
let editingAvatar = '';
let editingColor = 0;
let replyingTo = null;
let currentNotifTab = 'follows';
let quotingPostId = null;
let composerImage = null;
let composerImageUploading = false;
let activeDmUser = null;
let dmReplyingTo = null;
let banTarget = null;
let reportTargetId = null;
let deleteChatTarget = null;
let publishing = false;
let currentFeedLimit = FEED_COUNT;
let authMode = 'login';
let confirmCallback = null;
let isOnline = navigator.onLine;
let lastHeartbeatOk = Date.now();
let networkStatus = 'online';
let backgroundedAt = null;
let pendingReinit = false;
let syncing = false;
let skipRealtimeUntil = 0;
let onlineIntervalId = null;
let pollIntervalId = null;
let searchDebounceTimer = null;
let toastTimeout;
let localSeqCounter = Date.now();
const pendingTimers = new Map();
const nestedOpenTargets = {};
const nestedInputTargets = {};
const viewedThisSession = new Set();
const _memCache = {};
let userIndex = new Map();
let postMenuEl = null;
let postMenuPostId = null;

// ───────────────────────── CACHE ─────────────────────────
function read(k, fb = []) {
    if (k in _memCache) return _memCache[k];
    try { _memCache[k] = JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }
    catch (e) { _memCache[k] = fb; }
    return _memCache[k];
}
function write(k, v) {
    _memCache[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { }
    if (k === DB.users) rebuildUserIndex();
}
function rebuildUserIndex() {
    userIndex.clear();
    const list = _memCache[DB.users] || [];
    list.forEach(u => userIndex.set(u.username, u));
}

// ───────────────────────── HELPERS ─────────────────────────
function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'now';
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return 'long ago';
}
function clockTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function dateString(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}
function escapeAttr(s) {
    return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
function isSafeImageSrc(src) {
    if (!src || typeof src !== 'string') return false;
    const s = src.trim().toLowerCase();
    return s.startsWith('data:image/') || s.startsWith('https://') || s.startsWith('blob:');
}
function safeImageSrc(src) { return isSafeImageSrc(src) ? src : ''; }
function isEmojiAvatar(a) {
    if (!a || typeof a !== 'string' || a.length === 0 || a.length > 12) return false;
    if (a.startsWith('data:') || a.startsWith('http') || a.startsWith('blob:')) return false;
    try {
        const chars = [...a];
        if (chars.length === 1) {
            const code = chars[0].codePointAt(0);
            if ((code >= 0x1F000 && code <= 0x1FAFF) || (code >= 0x2600 && code <= 0x27BF)) return true;
        }
        if (chars.length <= 4 && chars.every(c => c.codePointAt(0) > 0x2000)) return true;
    } catch (e) { }
    return false;
}
function cleanupExpired() {
    const now = Date.now();
    write(DB.chat, read(DB.chat).filter(m => m.expiresAt > now));
}

// ───────────────────────── USER HELPERS ─────────────────────────
function getUserData(u) { return userIndex.get(u); }
function gradFor(username) {
    const u = getUserData(username);
    const idx = u && typeof u.avatarBg === 'number' ? u.avatarBg : ((username || 'a').charCodeAt(0) % GRADIENTS.length);
    return GRADIENTS[idx % GRADIENTS.length];
}
function isUserBanned(username) { const u = getUserData(username); return !!(u && u.banned); }
function isUserCreator(username) { return username && CREATOR_USERNAMES.includes(username.toLowerCase()); }
function isUserAdmin(username) {
    if (!username) return false;
    if (ADMIN_USERNAMES.includes(username.toLowerCase())) return true;
    const u = getUserData(username);
    return !!(u && u.isAdmin);
}
function isCurrentUserAdmin() { return currentUser && isUserAdmin(currentUser); }
function isUserVerified(username) {
    if (isUserAdmin(username)) return true;
    const u = getUserData(username);
    return !!(u && u.verified);
}
function getBadgeColor(username) {
    const u = getUserData(username);
    if (u && u.badgeColor && BADGE_COLORS[u.badgeColor]) return BADGE_COLORS[u.badgeColor].hex;
    return BADGE_COLORS.cyan.hex;
}
function userTypeLabel(username) {
    if (isUserBanned(username)) return 'Suspended';
    if (isUserCreator(username)) return 'Creator';
    if (isUserAdmin(username)) return 'Admin';
    if (isUserVerified(username)) return 'Pro';
    return 'Member';
}
function userTypeClass(username) {
    if (isUserBanned(username)) return 'banned-type';
    if (isUserCreator(username) || isUserAdmin(username) || isUserVerified(username)) return 'pro';
    return 'member';
}
function dailyLimitFor(username) {
    if (!username) return 3;
    if (isUserAdmin(username)) return Infinity;
    return isUserVerified(username) ? 10 : 3;
}
function isUnlimited(username) { return dailyLimitFor(username) === Infinity; }
function verifiedSVG(color) {
    const c = color || BADGE_COLORS.cyan.hex;
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="${c}"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
}
function verifiedInline(username) {
    if (isUserBanned(username)) return '';
    if (!isUserVerified(username)) return '';
    return `<span class="inline-verified">${verifiedSVG(getBadgeColor(username))}</span>`;
}
function displayNameOf(username) {
    const u = getUserData(username);
    if (u && u.banned) return 'Suspended';
    return (u && u.displayName) ? u.displayName : username;
}

// ───────────────────────── AVATAR ─────────────────────────
function avatarInner(username, size = 'md', clickAttr = '') {
    const u = getUserData(username);
    const banned = isUserBanned(username);
    const cls = `avatar ${size}${banned ? ' banned' : ''}`;
    if (u && isSafeImageSrc(u.avatar)) {
        return `<div class="${cls}" style="background:#fff" ${clickAttr}><img src="${escapeHtml(safeImageSrc(u.avatar))}" alt=""></div>`;
    }
    if (u && isEmojiAvatar(u.avatar)) {
        return `<div class="${cls}" style="background:${gradFor(username)}" ${clickAttr}>${escapeHtml(u.avatar)}</div>`;
    }
    const letter = (displayNameOf(username) || username || '?').slice(0, 1).toUpperCase();
    return `<div class="${cls}" style="background:${gradFor(username)}" ${clickAttr}>${escapeHtml(letter)}</div>`;
}
function avatarSimple(u, s = 'md') { return avatarInner(u, s); }
function avatarClickable(u, s = 'md') { return avatarInner(u, s, `onclick="event.stopPropagation();openProfileView('${escapeAttr(u)}')"`); }
function avatarChat(u, s = 'sm') { return avatarInner(u, s, `onclick="event.stopPropagation();openProfileFromChat('${escapeAttr(u)}')"`); }
function avatarDm(u, s = 'sm') { return avatarInner(u, s, `onclick="event.stopPropagation();openProfileFromDm('${escapeAttr(u)}')"`); }

// ───────────────────────── FOLLOW / BLOCK / SAVE ─────────────────────────
function followingList(username) {
    const u = getUserData(username);
    return (u && Array.isArray(u.following)) ? u.following : [];
}
function followersOf(username) {
    const out = [];
    const all = read(DB.users);
    for (let i = 0; i < all.length; i++) {
        if (followingList(all[i].username).includes(username)) out.push(all[i].username);
    }
    return out;
}
function isFollowing(me, target) { return me && followingList(me).includes(target); }
function getBlocks(username) { const all = read(DB.blocks, {}); return all[username] || []; }
function saveBlocks(username, list) {
    const all = read(DB.blocks, {});
    all[username] = list;
    write(DB.blocks, all);
}
function iBlocked(target) { return currentUser && getBlocks(currentUser).includes(target); }
function blocksMe(target) { return currentUser && getBlocks(target).includes(currentUser); }
function isBlockedBetween(target) { return iBlocked(target) || blocksMe(target); }
function getSavedFor(user) {
    if (!user) return [];
    const all = read(DB.saved, {});
    return all[user] || [];
}
function isSaved(postId) { return currentUser && getSavedFor(currentUser).includes(postId); }
function getReports() { return read(DB.reports, []); }
function hasReported(postId) {
    if (!currentUser) return false;
    return getReports().some(r => r.postId === postId && r.reporter === currentUser);
}
function groupReports() {
    const all = getReports();
    const map = {};
    all.forEach(r => {
        if (!map[r.postId]) map[r.postId] = [];
        map[r.postId].push(r);
    });
    return Object.keys(map).map(postId => ({ postId, reports: map[postId] }))
        .sort((a, b) => Math.max(...b.reports.map(r => r.createdAt)) - Math.max(...a.reports.map(r => r.createdAt)));
}

// ───────────────────────── NETWORK WRAPPER ─────────────────────────
function abortable(promise, timeoutMs, tag) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('TIMEOUT:' + (tag || 'request')));
        }, timeoutMs);
        Promise.resolve(promise).then(
            v => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); },
            e => { if (settled) return; settled = true; clearTimeout(timer); reject(e); }
        );
    });
}

const NetLayer = (function () {
    const inflight = new Map();
    async function run(fn, options = {}) {
        const { timeout = NET_TIMEOUT_DEFAULT, retries = 2, tag = 'op', dedupeKey = null } = options;
        if (dedupeKey && inflight.has(dedupeKey)) return inflight.get(dedupeKey);
        const exec = (async () => {
            let lastErr = null;
            for (let attempt = 0; attempt <= retries; attempt++) {
                if (!navigator.onLine) throw new Error('OFFLINE');
                try {
                    return await abortable(fn(), timeout, tag);
                } catch (e) {
                    lastErr = e;
                    if (attempt < retries) await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
                }
            }
            throw lastErr;
        })();
        if (dedupeKey) {
            inflight.set(dedupeKey, exec);
            exec.finally(() => inflight.delete(dedupeKey));
        }
        return exec;
    }
    async function safe(fn, fallback = null, options = {}) {
        try { return await run(fn, options); }
        catch (e) {
            const msg = (e && e.message) || '';
            if (msg === 'OFFLINE' || !navigator.onLine) setNetworkStatus('offline');
            else if (msg.startsWith('TIMEOUT:')) setNetworkStatus('slow');
            else setNetworkStatus('server_error'); // ⬅️ تشخیص خطای سرور
            return fallback;
        }
    }
    return { run, safe };
})();

function setNetworkStatus(status) {
    if (networkStatus === status) return;
    networkStatus = status;
    renderNetworkBanner();
}
function renderNetworkBanner() {
    const banner = document.getElementById('networkBanner');
    if (!banner) return;
    if (networkStatus === 'online' || !currentUser) {
        banner.classList.add('hidden');
        banner.className = 'network-banner hidden';
        banner.innerHTML = '';
        return;
    }
    if (networkStatus === 'offline') {
        banner.className = 'network-banner offline';
        banner.innerHTML = `<span>Offline</span><button onclick="retryNetwork()">Retry</button>`;
    } else if (networkStatus === 'slow') {
        banner.className = 'network-banner slow';
        banner.innerHTML = `<span>Slow connection</span>`;
    } else if (networkStatus === 'server_error') {
        banner.className = 'network-banner offline';
        banner.innerHTML = `<span>Server unreachable</span><button onclick="retryNetwork()">Retry</button>`;
    }
}
async function retryNetwork() {
    showToast('Reconnecting...');
    const ok = await heartbeat();
    if (ok) {
        setNetworkStatus('online');
        showToast('Connected');
        if (currentUser) {
            await supaSyncAll(false);
            rerenderCurrent();
        }
    } else showToast('Still offline');
}
async function heartbeat() {
    if (!navigator.onLine) { lastHeartbeatOk = 0; return false; }
    try {
        const t0 = Date.now();
        const result = await abortable(supa.from('profiles').select('id').limit(1), 5000, 'heartbeat');
        const dt = Date.now() - t0;
        if (result.error) { setNetworkStatus('server_error'); return false; }
        lastHeartbeatOk = Date.now();
        if (dt > 3000) setNetworkStatus('slow'); else setNetworkStatus('online');
        return true;
    } catch (e) {
        const msg = (e && e.message) || '';
        if (msg === 'OFFLINE' || !navigator.onLine) setNetworkStatus('offline');
        else if (msg.startsWith('TIMEOUT:')) setNetworkStatus('slow');
        else setNetworkStatus('server_error');
        return false;
    }
}

// ───────────────────────── SVG ICONS ─────────────────────────
function spinnerSVG() {
    return `<svg class="spinner-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>`;
}
function tickSingleSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="4 12.5 9 17 20 6"/></svg>`;
}
function tickDoubleSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="1 12.5 6 17 15 6"/><polyline points="9 12.5 14 17 23 6"/></svg>`;
}
function failedSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}

// ───────────────────────── PENDING STATE ─────────────────────────
function markSent(msg) {
    if (!msg) return;
    delete msg._pending;
    delete msg._failed;
    if (pendingTimers.has(msg.id)) {
        clearTimeout(pendingTimers.get(msg.id));
        pendingTimers.delete(msg.id);
    }
}
function markFailed(msg) {
    if (!msg) return;
    delete msg._pending;
    msg._failed = true;
}

// ═══════════════════════════════════════════════════════════
// REALTIME — Direct payload processing + Polling fallback
// ═══════════════════════════════════════════════════════════

// Helper: convert supa user_id to username
function idToUsername(id) {
    if (!id) return null;
    const u = read(DB.users).find(x => x._supaId === id);
    return u ? u.username : null;
}

// ─── Payload handlers (direct update, no refetch) ───
function handleChatPayload(eventType, newRow, oldRow) {
    const msgs = read(DB.chat);
    if (eventType === 'INSERT' && newRow) {
        if (msgs.some(m => m.id === newRow.id)) return false;
        const username = idToUsername(newRow.user_id) || 'unknown';
        const tempIdx = msgs.findIndex(m => m._pending && m.username === username && m.text === newRow.text);
        if (tempIdx !== -1) {
            msgs[tempIdx].id = newRow.id;
            msgs[tempIdx].createdAt = new Date(newRow.created_at).getTime();
            msgs[tempIdx].expiresAt = msgs[tempIdx].createdAt + 86400000;
            markSent(msgs[tempIdx]);
        } else {
            msgs.push({
                id: newRow.id,
                username: username,
                text: newRow.text,
                createdAt: new Date(newRow.created_at).getTime(),
                expiresAt: new Date(newRow.created_at).getTime() + 86400000,
                replyTo: newRow.reply_to_id || null
            });
        }
        msgs.sort((a, b) => a.createdAt - b.createdAt);
        write(DB.chat, msgs);
        return true;
    }
    if (eventType === 'DELETE' && oldRow) {
        const filtered = msgs.filter(m => m.id !== oldRow.id);
        if (filtered.length !== msgs.length) {
            write(DB.chat, filtered);
            return true;
        }
    }
    return false;
}

function handleDmPayload(eventType, newRow, oldRow) {
    const allDms = read(DB.dms, {});
    if (eventType === 'INSERT' && newRow) {
        let convKey = null;
        for (const key in allDms) {
            if (allDms[key]._supaId === newRow.conversation_id) {
                convKey = key;
                break;
            }
        }
        if (!convKey) return false;
        const conv = allDms[convKey];
        if (!conv.messages) conv.messages = [];
        if (conv.messages.some(m => m.id === newRow.id)) return false;
        const fromUser = idToUsername(newRow.sender_id) || 'unknown';
        const tempIdx = conv.messages.findIndex(m => m._pending && m.from === fromUser && m.text === newRow.text);
        if (tempIdx !== -1) {
            conv.messages[tempIdx].id = newRow.id;
            conv.messages[tempIdx].createdAt = new Date(newRow.created_at).getTime();
            markSent(conv.messages[tempIdx]);
        } else {
            conv.messages.push({
                id: newRow.id,
                from: fromUser,
                text: newRow.text,
                createdAt: new Date(newRow.created_at).getTime(),
                replyTo: newRow.reply_to_id || null
            });
        }
        conv.messages.sort((a, b) => a.createdAt - b.createdAt);
        allDms[convKey] = conv;
        write(DB.dms, allDms);
        return true;
    }
    if (eventType === 'UPDATE' && newRow) {
        for (const key in allDms) {
            if (allDms[key]._supaId === newRow.id) {
                allDms[key].user1LastRead = newRow.user1_last_read ? new Date(newRow.user1_last_read).getTime() : 0;
                allDms[key].user2LastRead = newRow.user2_last_read ? new Date(newRow.user2_last_read).getTime() : 0;
                write(DB.dms, allDms);
                return true;
            }
        }
    }
    return false;
}

function handleNotifPayload(eventType, newRow, oldRow) {
    const list = read(DB.notifs);
    if (eventType === 'INSERT' && newRow) {
        if (list.some(n => n.id === newRow.id)) return false;
        const fromUser = idToUsername(newRow.actor_id) || 'unknown';
        const toUser = idToUsername(newRow.user_id) || 'unknown';
        list.push({
            id: newRow.id,
            type: newRow.type,
            to: toUser,
            from: fromUser,
            postId: newRow.post_id || null,
            text: newRow.text || null,
            createdAt: new Date(newRow.created_at).getTime(),
            read: newRow.is_read || false
        });
        if (list.length > 300) list.splice(0, list.length - 300);
        write(DB.notifs, list);
        return true;
    }
    if (eventType === 'UPDATE' && newRow) {
        const idx = list.findIndex(n => n.id === newRow.id);
        if (idx !== -1 && list[idx].read !== newRow.is_read) {
            list[idx].read = newRow.is_read || false;
            write(DB.notifs, list);
            return true;
        }
    }
    if (eventType === 'DELETE' && oldRow) {
        const filtered = list.filter(n => n.id !== oldRow.id);
        if (filtered.length !== list.length) {
            write(DB.notifs, filtered);
            return true;
        }
    }
    return false;
}

function handlePostLikePayload(eventType, newRow, oldRow) {
    const posts = read(DB.posts);
    if (eventType === 'INSERT' && newRow) {
        const p = posts.find(x => x.id === newRow.post_id);
        if (!p) return false;
        const username = idToUsername(newRow.user_id);
        if (!username) return false;
        if (!Array.isArray(p.likes)) p.likes = [];
        if (!p.likes.includes(username)) {
            p.likes.push(username);
            write(DB.posts, posts);
            return true;
        }
    }
    if (eventType === 'DELETE' && oldRow) {
        const p = posts.find(x => x.id === oldRow.post_id);
        if (!p || !Array.isArray(p.likes)) return false;
        const username = idToUsername(oldRow.user_id);
        if (!username) return false;
        const idx = p.likes.indexOf(username);
        if (idx !== -1) {
            p.likes.splice(idx, 1);
            write(DB.posts, posts);
            return true;
        }
    }
    return false;
}

function handlePostReplyPayload(eventType, newRow, oldRow) {
    const posts = read(DB.posts);
    if (eventType === 'INSERT' && newRow) {
        const p = posts.find(x => x.id === newRow.post_id);
        if (!p) return false;
        if (!p.replies) p.replies = [];
        if (p.replies.some(r => r.id === newRow.id)) return false;
        const username = idToUsername(newRow.user_id) || 'unknown';
        const tempIdx = p.replies.findIndex(r => r._pending && r.username === username && r.text === newRow.text);
        if (tempIdx !== -1) {
            p.replies[tempIdx].id = newRow.id;
            p.replies[tempIdx].createdAt = new Date(newRow.created_at).getTime();
            markSent(p.replies[tempIdx]);
        } else {
            p.replies.push({
                id: newRow.id,
                username: username,
                text: newRow.text,
                createdAt: new Date(newRow.created_at).getTime(),
                replyTo: newRow.parent_reply_id || null
            });
        }
        p.replies.sort((a, b) => a.createdAt - b.createdAt);
        write(DB.posts, posts);
        return true;
    }
    if (eventType === 'DELETE' && oldRow) {
        const p = posts.find(x => x.id === oldRow.post_id);
        if (!p || !p.replies) return false;
        const filtered = p.replies.filter(r => r.id !== oldRow.id);
        if (filtered.length !== p.replies.length) {
            p.replies = filtered;
            write(DB.posts, posts);
            return true;
        }
    }
    return false;
}

function handlePostPayload(eventType, newRow, oldRow) {
    const posts = read(DB.posts);
    if (eventType === 'INSERT' && newRow) {
        if (posts.some(p => p.id === newRow.id)) return false;
        const username = idToUsername(newRow.user_id) || 'unknown';
        const tempIdx = posts.findIndex(p => p._pending && p.username === username && p.text === (newRow.text || ''));
        if (tempIdx !== -1) {
            posts[tempIdx].id = newRow.id;
            posts[tempIdx].createdAt = new Date(newRow.created_at).getTime();
            markSent(posts[tempIdx]);
        } else {
            posts.push({
                id: newRow.id,
                username: username,
                text: newRow.text || '',
                image: newRow.image || null,
                createdAt: new Date(newRow.created_at).getTime(),
                likes: [],
                replies: [],
                quotedPostId: newRow.quoted_post_id || null,
                views: 0
            });
        }
        write(DB.posts, posts);
        return true;
    }
    if (eventType === 'DELETE' && oldRow) {
        const filtered = posts.filter(p => p.id !== oldRow.id);
        if (filtered.length !== posts.length) {
            write(DB.posts, filtered);
            return true;
        }
    }
    return false;
}

// ─── Realtime Manager ───
const RealtimeManager = (function () {
    let channel = null;
    let reconnectAttempts = 0;
    let isSubscribed = false;
    let lastSuccessfulEvent = Date.now();

    function subscribe() {
        if (!supa) return;
        if (channel) {
            try { supa.removeChannel(channel); } catch (e) { }
            channel = null;
        }
        channel = supa.channel('vibe-realtime-v3', {
            config: { broadcast: { self: false } }
        });

        channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (handleChatPayload('INSERT', payload.new, null)) {
                    if (!document.getElementById('chatView').classList.contains('hidden')) {
                        const body = document.getElementById('chatBody');
                        const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 150;
                        const typing = document.activeElement && document.activeElement.id === 'chatInput';
                        if (!typing) renderChat(atBottom, atBottom);
                    }
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                const et = payload.eventType;
                if (handleDmPayload(et, payload.new, payload.old)) {
                    if (!document.getElementById('dmChatView').classList.contains('hidden')) {
                        const body = document.getElementById('dmBody');
                        const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 150;
                        const typing = document.activeElement && document.activeElement.id === 'dmInput';
                        if (!typing) renderDmBody(atBottom);
                    }
                    if (!document.getElementById('dmView').classList.contains('hidden')) renderDmList();
                    updateDmBadge();
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                handleDmPayload(payload.eventType, payload.new, payload.old);
                if (!document.getElementById('dmView').classList.contains('hidden')) renderDmList();
                updateDmBadge();
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (handleNotifPayload(payload.eventType, payload.new, payload.old)) {
                    updateNotifBadge();
                    if (!document.getElementById('notificationsView').classList.contains('hidden')) {
                        renderNotifications();
                    }
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (handlePostLikePayload(payload.eventType, payload.new, payload.old)) {
                    safeRerender();
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'post_replies' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (handlePostReplyPayload(payload.eventType, payload.new, payload.old)) {
                    if (!document.getElementById('postView').classList.contains('hidden')) {
                        renderPostDetail(currentPostId);
                    } else if (!document.getElementById('feedView').classList.contains('hidden')) {
                        safeRerender();
                    } else if (viewingUser) {
                        renderProfileContent();
                    }
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'posts' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (handlePostPayload(payload.eventType, payload.new, payload.old)) {
                    safeRerender();
                }
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'follows' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                supaSyncTableOnly('follows').then(() => safeRerender());
            });

        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },
            (payload) => {
                lastSuccessfulEvent = Date.now();
                if (payload.new && payload.new.username) {
                    const users = read(DB.users);
                    const u = users.find(x => x.username === payload.new.username);
                    if (u) {
                        u.displayName = payload.new.display_name || u.displayName;
                        u.bio = payload.new.bio || u.bio;
                        u.avatar = payload.new.avatar || u.avatar;
                        u.avatarBg = payload.new.avatar_bg || u.avatarBg;
                        u.badgeColor = payload.new.badge_color || u.badgeColor;
                        u.verified = payload.new.is_verified || false;
                        u.banned = payload.new.is_banned || false;
                        u.lastSeen = payload.new.last_seen ? new Date(payload.new.last_seen).getTime() : u.lastSeen;
                        write(DB.users, users);
                        safeRerender();
                    }
                }
            });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                reconnectAttempts = 0;
                isSubscribed = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                isSubscribed = false;
                scheduleReconnect();
            }
        });
    }

    function scheduleReconnect() {
        if (reconnectAttempts > 8) return;
        reconnectAttempts++;
        const delay = Math.min(1500 * Math.pow(2, reconnectAttempts), 20000);
        setTimeout(() => {
            if (!currentUser) return;
            subscribe();
        }, delay);
    }

    function unsubscribe() {
        if (channel) {
            try { supa.removeChannel(channel); } catch (e) { }
            channel = null;
        }
        isSubscribed = false;
    }

    function isHealthy() {
        return isSubscribed && (Date.now() - lastSuccessfulEvent < 60000);
    }

    return { subscribe, unsubscribe, isHealthy };
})();

// ───────────────────────── POLLING FALLBACK (OPTIMIZED) ─────────────────────────
function startPolling() {
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (!currentUser) return;

    async function poll() {
        if (!currentUser || document.visibilityState === 'hidden' || !isOnline || syncing) return;

        try {
            syncing = true;

            // ⬇️ بررسی اینکه کاربر در کدام صفحه است تا فقط دیتای لازم سینک شود
            const isChatOpen = !document.getElementById('chatView').classList.contains('hidden');
            const isDmOpen = !document.getElementById('dmChatView').classList.contains('hidden') || !document.getElementById('dmView').classList.contains('hidden');
            const isFeedOpen = !document.getElementById('feedView').classList.contains('hidden');
            const isNotifsOpen = !document.getElementById('notificationsView').classList.contains('hidden');

            // سینک اعلان‌ها همیشه (چون سبک است)
            await supaSyncTableOnly('notifications');

            // فقط در صورت نیاز چت‌ها را سینک کن
            if (isChatOpen) await supaSyncChatOnly();
            if (isDmOpen) await supaSyncDmOnly();

            // فید را فقط اگر کاربر در صفحه اصلی است و به بالای صفحه اسکرول کرده سینک کن
            if (isFeedOpen) {
                const feed = document.getElementById('feed');
                if (feed && feed.scrollTop < 50) {
                    await supaSyncTableOnly('posts');
                }
            }

            syncing = false;

            // آپدیت UI
            updateDmBadge();
            updateNotifBadge();

            if (isDmOpen && !document.getElementById('dmView').classList.contains('hidden')) renderDmList();
            if (isDmOpen && !document.getElementById('dmChatView').classList.contains('hidden')) {
                const body = document.getElementById('dmBody');
                const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 150;
                renderDmBody(atBottom);
            }
            if (isChatOpen) {
                const body = document.getElementById('chatBody');
                const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 150;
                renderChat(false, atBottom);
            }
            if (isNotifsOpen) renderNotifications();
            if (isFeedOpen) renderFeed();

        } catch (e) {
            console.error('[FastPoll] Error:', e);
            syncing = false;
        }
    }

    pollIntervalId = setInterval(poll, POLL_INTERVAL);
    setTimeout(poll, 500);
}
function stopPolling() {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
    }
}

// ───────────────────────── APP REINIT ─────────────────────────
async function reinitializeApp() {
    if (pendingReinit) return;
    pendingReinit = true;
    try {
        const splash = document.getElementById('landingScreen');
        if (splash) {
            splash.classList.remove('hidden', 'fade-out');
            const st = splash.querySelector('.splash-text');
            const sl = splash.querySelector('.splash-line');
            if (st) { st.style.animation = 'none'; void st.offsetWidth; st.style.animation = ''; }
            if (sl) { sl.style.animation = 'none'; void sl.offsetWidth; sl.style.animation = ''; }
        }
        document.body.classList.add('loading-lock');
        RealtimeManager.unsubscribe();
        stopPolling();
        if (currentUser) await supaSyncAll(false);
        RealtimeManager.subscribe();
        startPolling();
        await new Promise(r => setTimeout(r, 1000));
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.classList.add('hidden');
                document.body.classList.remove('loading-lock');
            }, 500);
        }
        rerenderCurrent();
        showToast('Refreshed');
    } catch (e) {
        console.error('Reinit error:', e);
        document.body.classList.remove('loading-lock');
        const splash = document.getElementById('landingScreen');
        if (splash) splash.classList.add('hidden');
    } finally {
        pendingReinit = false;
    }
}

// ═══════════════════════════════════════════════════════════
// SYNC FUNCTIONS (OPTIMIZED)
// ═══════════════════════════════════════════════════════════

async function supaGetUserId(username) {
    if (!username) return null;
    if (username === currentUser && supaUserId) return supaUserId;
    const u = getUserData(username);
    if (u && u._supaId) return u._supaId;
    try {
        const { data } = await supa.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
        return data ? data.id : null;
    } catch (e) { return null; }
}

async function supaRegister(username, password) {
    try {
        const email = username.toLowerCase() + '@vibe.app';
        const { data, error } = await supa.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (!data.user) throw new Error('Sign up failed');
        return { user: data.user, error: null };
    } catch (e) { return { user: null, error: e.message || String(e) }; }
}
async function supaLogin(username, password) {
    try {
        const email = username.toLowerCase() + '@vibe.app';
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { user: data.user, error: null };
    } catch (e) { return { user: null, error: e.message || String(e) }; }
}
async function supaLogout() {
    try { await supa.auth.signOut(); } catch (e) { }
    supaUserId = null;
    currentUser = null;
}

async function supaSyncChatOnly() {
    try {
        const t0 = Date.now() - 86400000;
        const { data, error } = await supa.from('chat_messages').select('*')
            .gte('created_at', new Date(t0).toISOString())
            .order('created_at', { ascending: true }).limit(100); // ⬅️ کاهش limit
        if (error || !data) return;
        const idToName = {};
        userIndex.forEach(u => { if (u._supaId) idToName[u._supaId] = u.username; });
        const server = data.map(m => ({
            id: m.id,
            username: idToName[m.user_id] || 'unknown',
            text: m.text,
            createdAt: new Date(m.created_at).getTime(),
            expiresAt: new Date(m.created_at).getTime() + 86400000,
            replyTo: m.reply_to_id || null
        }));
        const serverIds = new Set(server.map(m => m.id));
        const local = read(DB.chat);
        const pending = local.filter(m => !serverIds.has(m.id) && (m._pending || m._failed));
        const pendingFiltered = pending.filter(p =>
            !server.some(s => s.username === p.username && s.text === p.text && Math.abs(s.createdAt - p.createdAt) < 120000));
        const merged = [...server, ...pendingFiltered].sort((a, b) => a.createdAt - b.createdAt);
        write(DB.chat, merged);
    } catch (e) { }
}

async function supaSyncDmOnly() {
    try {
        const [dcRes, dmRes] = await Promise.all([
            supa.from('dm_conversations').select('*'),
            supa.from('dm_messages').select('*').order('created_at', { ascending: true }).limit(500) // ⬅️ کاهش limit
        ]);
        const dmConvData = dcRes.data || [];
        const dmMsgsData = dmRes.data || [];
        const idToName = {};
        userIndex.forEach(u => { if (u._supaId) idToName[u._supaId] = u.username; });
        const localDms = read(DB.dms, {});
        const dms = {};
        dmConvData.forEach(c => {
            const u1 = idToName[c.user1_id];
            const u2 = idToName[c.user2_id];
            if (!u1 || !u2) return;
            const key = [u1, u2].sort().join('__');
            const serverMsgs = dmMsgsData.filter(m => m.conversation_id === c.id).map(m => ({
                id: m.id,
                from: idToName[m.sender_id] || 'unknown',
                text: m.text,
                createdAt: new Date(m.created_at).getTime(),
                replyTo: m.reply_to_id || null
            }));
            const serverIds = new Set(serverMsgs.map(m => m.id));
            const localConv = localDms[key];
            const pending = ((localConv && localConv.messages) || []).filter(m => !serverIds.has(m.id) && (m._pending || m._failed));
            const pendingFiltered = pending.filter(p =>
                !serverMsgs.some(s => s.from === p.from && s.text === p.text && Math.abs(s.createdAt - p.createdAt) < 120000));
            const allMsgs = [...serverMsgs, ...pendingFiltered].sort((a, b) => a.createdAt - b.createdAt);
            dms[key] = {
                messages: allMsgs,
                _supaId: c.id,
                user1Id: c.user1_id,
                user2Id: c.user2_id,
                user1LastRead: c.user1_last_read ? new Date(c.user1_last_read).getTime() : 0,
                user2LastRead: c.user2_last_read ? new Date(c.user2_last_read).getTime() : 0
            };
        });
        Object.keys(localDms).forEach(k => {
            if (dms[k]) return;
            const conv = localDms[k];
            if ((conv.messages || []).some(m => m._pending || m._failed)) dms[k] = conv;
        });
        write(DB.dms, dms);
    } catch (e) { }
}

async function supaSyncTableOnly(table) {
    try {
        const { data, error } = await supa.from(table).select('*');
        if (error || !data) return;
        const idToName = {};
        userIndex.forEach(u => { if (u._supaId) idToName[u._supaId] = u.username; });

        if (table === 'post_replies') {
            const posts = read(DB.posts);
            const byPost = {};
            data.forEach(r => {
                if (!byPost[r.post_id]) byPost[r.post_id] = [];
                byPost[r.post_id].push({
                    id: r.id,
                    username: idToName[r.user_id] || 'unknown',
                    text: r.text,
                    createdAt: new Date(r.created_at).getTime(),
                    replyTo: r.parent_reply_id || null
                });
            });
            posts.forEach(p => {
                const serverReplies = byPost[p.id] || [];
                const serverIds = new Set(serverReplies.map(r => r.id));
                const pending = (p.replies || []).filter(r => !serverIds.has(r.id) && (r._pending || r._failed));
                p.replies = [...serverReplies, ...pending].sort((a, b) => a.createdAt - b.createdAt);
            });
            write(DB.posts, posts);
        } else if (table === 'notifications') {
            const notifs = data.map(n => ({
                id: n.id,
                type: n.type,
                to: idToName[n.user_id] || 'unknown',
                from: idToName[n.actor_id] || 'unknown',
                postId: n.post_id || null,
                text: n.text || null,
                createdAt: new Date(n.created_at).getTime(),
                read: n.is_read || false
            }));
            write(DB.notifs, notifs);
        } else if (table === 'post_likes') {
            const posts = read(DB.posts);
            const byPost = {};
            data.forEach(l => {
                if (!byPost[l.post_id]) byPost[l.post_id] = [];
                const name = idToName[l.user_id];
                if (name) byPost[l.post_id].push(name);
            });
            posts.forEach(p => { p.likes = byPost[p.id] || []; });
            write(DB.posts, posts);
        } else if (table === 'posts') {
            const oldPosts = read(DB.posts);
            const [likesRes, repliesRes] = await Promise.all([
                supa.from('post_likes').select('*'),
                supa.from('post_replies').select('*').order('created_at', { ascending: true }).limit(500) // ⬅️ کاهش limit
            ]);
            const likes = likesRes.data || [];
            const replies = repliesRes.data || [];
            const likeByPost = {};
            likes.forEach(l => {
                if (!likeByPost[l.post_id]) likeByPost[l.post_id] = [];
                const n = idToName[l.user_id];
                if (n) likeByPost[l.post_id].push(n);
            });
            const repliesByPost = {};
            replies.forEach(r => {
                if (!repliesByPost[r.post_id]) repliesByPost[r.post_id] = [];
                repliesByPost[r.post_id].push({
                    id: r.id,
                    username: idToName[r.user_id] || 'unknown',
                    text: r.text,
                    createdAt: new Date(r.created_at).getTime(),
                    replyTo: r.parent_reply_id || null
                });
            });
            const newPosts = data.map(p => ({
                id: p.id,
                username: idToName[p.user_id] || 'unknown',
                text: p.text || '',
                image: p.image || null,
                createdAt: new Date(p.created_at).getTime(),
                likes: likeByPost[p.id] || [],
                replies: repliesByPost[p.id] || [],
                quotedPostId: p.quoted_post_id || null,
                views: oldPosts.find(x => x.id === p.id)?.views || 0
            }));
            const serverIds = new Set(newPosts.map(p => p.id));
            const pendingLocal = oldPosts.filter(p => !serverIds.has(p.id) && (p._pending || p._failed));
            write(DB.posts, [...newPosts, ...pendingLocal]);
        } else if (table === 'follows') {
            const users = read(DB.users);
            const followsData = data;
            users.forEach(u => {
                u.following = followsData.filter(f => f.follower_id === u._supaId).map(f => idToName[f.following_id]).filter(Boolean);
            });
            write(DB.users, users);
        }
    } catch (e) { }
}

async function supaSyncAll(showLoader) {
    if (showLoader) {
        const feed = document.getElementById('feed');
        if (feed) {
            feed.innerHTML = '<div class="feed-loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
            delete feed.dataset.lastHtml;
        }
    }
    try {
        // ⬇️ کاهش شدید درخواست‌های اولیه برای افزایش سرعت لود
        const [pRes, poRes, lRes, rRes, fRes, nRes, bRes, sRes, rpRes, cRes, dcRes, dmRes] = await Promise.all([
            supa.from('profiles').select('*'),
            supa.from('posts').select('*').order('created_at', { ascending: false }).limit(50), // ⬅️ از 150 به 50
            supa.from('post_likes').select('*'),
            supa.from('post_replies').select('*').order('created_at', { ascending: true }).limit(500), // ⬅️ از 800 به 500
            supa.from('follows').select('*'),
            supa.from('notifications').select('*').order('created_at', { ascending: false }).limit(100), // ⬅️ از 150 به 100
            supa.from('blocks').select('*'),
            supa.from('saved_posts').select('*'),
            supa.from('reports').select('*'),
            supa.from('chat_messages').select('*').gte('created_at', new Date(Date.now() - 86400000).toISOString()).order('created_at', { ascending: true }).limit(100), // ⬅️ از 200 به 100
            supa.from('dm_conversations').select('*'),
            supa.from('dm_messages').select('*').order('created_at', { ascending: true }).limit(500) // ⬅️ از 800 به 500
        ]);

        if (pRes.error || !pRes.data) throw new Error('profiles fetch failed');
        if (poRes.error || !poRes.data) throw new Error('posts fetch failed');

        const profiles = pRes.data || [];
        const postsData = poRes.data || [];
        const likesData = lRes.data || [];
        const repliesData = rRes.data || [];
        const followsData = fRes.data || [];
        const notifsData = nRes.data || [];
        const blocksData = bRes.data || [];
        const savedData = sRes.data || [];
        const reportsData = rpRes.data || [];
        const chatData = cRes.data || [];
        const dmConvData = dcRes.data || [];
        const dmMsgsData = dmRes.data || [];

        const userIdToName = {};
        profiles.forEach(p => { userIdToName[p.id] = p.username; });

        const users = profiles.map(p => ({
            username: p.username,
            displayName: p.display_name || p.username,
            bio: p.bio || '',
            avatar: p.avatar || '',
            avatarBg: p.avatar_bg || 0,
            badgeColor: p.badge_color || 'cyan',
            isAdmin: p.is_admin || false,
            verified: p.is_verified || false,
            banned: p.is_banned || false,
            banReason: p.ban_reason || null,
            bannedAt: p.banned_at ? new Date(p.banned_at).getTime() : null,
            following: followsData.filter(f => f.follower_id === p.id).map(f => userIdToName[f.following_id]).filter(Boolean),
            createdAt: new Date(p.created_at).getTime(),
            lastSeen: p.last_seen ? new Date(p.last_seen).getTime() : Date.now(),
            _supaId: p.id
        }));

        const posts = postsData.map(p => {
            const pLikes = likesData.filter(l => l.post_id === p.id);
            const pReplies = repliesData.filter(r => r.post_id === p.id);
            const oldP = (read(DB.posts) || []).find(x => x.id === p.id);
            return {
                id: p.id,
                username: userIdToName[p.user_id] || 'unknown',
                text: p.text || '',
                image: p.image || null,
                createdAt: new Date(p.created_at).getTime(),
                likes: pLikes.map(l => userIdToName[l.user_id]).filter(Boolean),
                replies: pReplies.map(r => ({
                    id: r.id,
                    username: userIdToName[r.user_id] || 'unknown',
                    text: r.text,
                    createdAt: new Date(r.created_at).getTime(),
                    replyTo: r.parent_reply_id || null
                })),
                quotedPostId: p.quoted_post_id || null,
                views: oldP ? (oldP.views || 0) : 0
            };
        });

        const notifs = notifsData.map(n => ({
            id: n.id, type: n.type,
            to: userIdToName[n.user_id] || 'unknown',
            from: userIdToName[n.actor_id] || 'unknown',
            postId: n.post_id || null, text: n.text || null,
            createdAt: new Date(n.created_at).getTime(),
            read: n.is_read || false
        }));

        const blocks = {};
        blocksData.forEach(b => {
            const blocker = userIdToName[b.blocker_id];
            const blocked = userIdToName[b.blocked_id];
            if (blocker && blocked) {
                if (!blocks[blocker]) blocks[blocker] = [];
                blocks[blocker].push(blocked);
            }
        });

        const saved = {};
        savedData.forEach(s => {
            const user = userIdToName[s.user_id];
            if (user) {
                if (!saved[user]) saved[user] = [];
                saved[user].push(s.post_id);
            }
        });

        const reports = reportsData.map(r => ({
            id: r.id, postId: r.post_id,
            reporter: userIdToName[r.reporter_id] || 'unknown',
            reason: r.reason,
            createdAt: new Date(r.created_at).getTime()
        }));

        const serverChat = chatData.map(m => ({
            id: m.id,
            username: userIdToName[m.user_id] || 'unknown',
            text: m.text,
            createdAt: new Date(m.created_at).getTime(),
            expiresAt: new Date(m.created_at).getTime() + 86400000,
            replyTo: m.reply_to_id || null
        }));
        const serverChatIds = new Set(serverChat.map(m => m.id));
        const localChat = read(DB.chat);
        const localPendingChat = localChat.filter(m => !serverChatIds.has(m.id) && (m._pending || m._failed));
        const pendingFilteredChat = localPendingChat.filter(p =>
            !serverChat.some(s => s.username === p.username && s.text === p.text && Math.abs(s.createdAt - p.createdAt) < 120000));
        const chat = [...serverChat, ...pendingFilteredChat].sort((a, b) => a.createdAt - b.createdAt);

        const dms = {};
        const localDmsAll = read(DB.dms, {});
        dmConvData.forEach(c => {
            const u1 = userIdToName[c.user1_id];
            const u2 = userIdToName[c.user2_id];
            if (!u1 || !u2) return;
            const key = [u1, u2].sort().join('__');
            const serverMsgs = dmMsgsData.filter(m => m.conversation_id === c.id).map(m => ({
                id: m.id,
                from: userIdToName[m.sender_id] || 'unknown',
                text: m.text,
                createdAt: new Date(m.created_at).getTime(),
                replyTo: m.reply_to_id || null
            }));
            const serverIds = new Set(serverMsgs.map(m => m.id));
            const localConv = localDmsAll[key];
            const pending = ((localConv && localConv.messages) || []).filter(m => !serverIds.has(m.id) && (m._pending || m._failed));
            const pendingFiltered = pending.filter(p =>
                !serverMsgs.some(s => s.from === p.from && s.text === p.text && Math.abs(s.createdAt - p.createdAt) < 120000));
            const allMsgs = [...serverMsgs, ...pendingFiltered].sort((a, b) => a.createdAt - b.createdAt);
            dms[key] = {
                messages: allMsgs,
                _supaId: c.id,
                user1Id: c.user1_id,
                user2Id: c.user2_id,
                user1LastRead: c.user1_last_read ? new Date(c.user1_last_read).getTime() : 0,
                user2LastRead: c.user2_last_read ? new Date(c.user2_last_read).getTime() : 0
            };
        });
        Object.keys(localDmsAll).forEach(k => {
            if (dms[k]) return;
            const conv = localDmsAll[k];
            if ((conv.messages || []).some(m => m._pending || m._failed)) dms[k] = conv;
        });

        write(DB.users, users);
        write(DB.posts, posts);
        write(DB.notifs, notifs);
        write(DB.blocks, blocks);
        write(DB.saved, saved);
        write(DB.reports, reports);
        write(DB.chat, chat);
        write(DB.dms, dms);
        return true;
    } catch (e) {
        console.error('Sync error:', e);
        return false;
    }
}

// ───────────────────────── UPLOAD ─────────────────────────
async function uploadPostImage(blob, uid) {
    try {
        const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supa.storage.from('posts').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        const { data } = supa.storage.from('posts').getPublicUrl(path);
        return data.publicUrl;
    } catch (e) { return null; }
}

// ───────────────────────── INSERT/DELETE OPS ─────────────────────────
async function supaInsertPost(post) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return null;
        const { data, error } = await supa.from('posts').insert({
            user_id: uid, text: post.text, image: post.image, quoted_post_id: post.quotedPostId
        }).select().single();
        if (error) { console.error('Insert post:', error); return null; }
        return data;
    } catch (e) { return null; }
}
async function supaDeletePost(id) { try { await supa.from('posts').delete().eq('id', id); } catch (e) { } }
async function supaToggleLike(postId, isLike) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return;
        if (isLike) await supa.from('post_likes').insert({ post_id: postId, user_id: uid });
        else await supa.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
    } catch (e) { }
}
async function supaInsertReply(postId, text, parentId) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return null;
        const { data, error } = await supa.from('post_replies').insert({
            post_id: postId, user_id: uid, text, parent_reply_id: parentId || null
        }).select().single();
        if (error) return null;
        return data;
    } catch (e) { return null; }
}
async function supaDeleteReply(id) { try { await supa.from('post_replies').delete().eq('id', id); } catch (e) { } }
async function supaToggleFollow(target, isFollow) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const tid = await supaGetUserId(target);
        if (!uid || !tid) return;
        if (isFollow) await supa.from('follows').insert({ follower_id: uid, following_id: tid });
        else await supa.from('follows').delete().eq('follower_id', uid).eq('following_id', tid);
    } catch (e) { }
}
async function supaInsertNotif(type, to, postId, text) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const tid = await supaGetUserId(to);
        if (!uid || !tid || uid === tid) return;
        if (type === 'follow' || type === 'unfollow') {
            await supa.from('notifications').delete().eq('user_id', tid).eq('actor_id', uid).in('type', ['follow', 'unfollow']);
        }
        await supa.from('notifications').insert({ user_id: tid, actor_id: uid, type, post_id: postId || null, text: text || null });
    } catch (e) { }
}
async function supaDeleteNotif(type, to, postId) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const tid = await supaGetUserId(to);
        if (!uid || !tid) return;
        let q = supa.from('notifications').delete().eq('user_id', tid).eq('actor_id', uid).eq('type', type);
        if (postId) q = q.eq('post_id', postId);
        await q;
    } catch (e) { }
}
async function supaToggleBlock(target, isBlock) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const tid = await supaGetUserId(target);
        if (!uid || !tid) return;
        if (isBlock) {
            await supa.from('blocks').insert({ blocker_id: uid, blocked_id: tid });
            await supa.from('follows').delete().eq('follower_id', uid).eq('following_id', tid);
            await supa.from('follows').delete().eq('follower_id', tid).eq('following_id', uid);
        } else await supa.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', tid);
    } catch (e) { }
}
async function supaToggleSave(postId, isSave) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return;
        if (isSave) await supa.from('saved_posts').insert({ user_id: uid, post_id: postId });
        else await supa.from('saved_posts').delete().eq('user_id', uid).eq('post_id', postId);
    } catch (e) { }
}
async function supaInsertReport(postId, reason) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return;
        await supa.from('reports').insert({ post_id: postId, reporter_id: uid, reason });
    } catch (e) { }
}
async function supaDeleteReportsByPost(postId) { try { await supa.from('reports').delete().eq('post_id', postId); } catch (e) { } }
async function supaAddView(postId) {
    if (!currentUser) return;
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return;
        const { error } = await supa.from('post_views').insert({ post_id: postId, user_id: uid });
        if (!error) {
            const posts = read(DB.posts);
            const p = posts.find(x => x.id === postId);
            if (p) { p.views = (p.views || 0) + 1; write(DB.posts, posts); }
        }
    } catch (e) { }
}

async function supaSendChat(text, replyToId) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (!uid) return null;
        const { data, error } = await supa.from('chat_messages').insert({
            user_id: uid, text, reply_to_id: replyToId || null
        }).select().single();
        if (error) return null;
        return data;
    } catch (e) { return null; }
}

async function supaSendDm(other, text, replyToId) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const convId = await supaGetDmConvId(other);
        if (!uid || !convId) return null;
        const { data, error } = await supa.from('dm_messages').insert({
            conversation_id: convId, sender_id: uid, text, reply_to_id: replyToId || null
        }).select().single();
        if (error) return null;
        return data;
    } catch (e) { return null; }
}

function getConvIdCache() { return read(DB.dmConvIdCache, {}); }
function setConvIdCache(key, id) { const c = getConvIdCache(); c[key] = id; write(DB.dmConvIdCache, c); }

async function supaGetDmConvId(other) {
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        const oid = await supaGetUserId(other);
        if (!uid || !oid) return null;
        const [a, b] = [uid, oid].sort();
        const cacheKey = `${a}__${b}`;
        const cache = getConvIdCache();
        if (cache[cacheKey]) return cache[cacheKey];
        const { data } = await supa.from('dm_conversations').select('id').eq('user1_id', a).eq('user2_id', b).maybeSingle();
        if (data) { setConvIdCache(cacheKey, data.id); return data.id; }
        const { data: created, error } = await supa.from('dm_conversations')
            .upsert({ user1_id: a, user2_id: b }, { onConflict: 'user1_id,user2_id' }).select().single();
        if (error) {
            const { data: refetched } = await supa.from('dm_conversations').select('id').eq('user1_id', a).eq('user2_id', b).maybeSingle();
            if (refetched) { setConvIdCache(cacheKey, refetched.id); return refetched.id; }
            return null;
        }
        setConvIdCache(cacheKey, created.id);
        return created.id;
    } catch (e) { return null; }
}

async function supaUpdateProfile(fields) {
    try { if (!currentUser || !supaUserId) return; await supa.from('profiles').update(fields).eq('id', supaUserId); } catch (e) { }
}
async function supaUpdateProfileById(id, fields) {
    if (!id) return;
    try { await supa.from('profiles').update(fields).eq('id', id); } catch (e) { }
}
async function supaMarkOnline() {
    if (!currentUser || !supaUserId) return;
    try { await supa.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', supaUserId); } catch (e) { }
}
async function supaDeleteDmConv(other) {
    try {
        const convId = await supaGetDmConvId(other);
        if (!convId) return true;
        const r1 = await supa.from('dm_messages').delete().eq('conversation_id', convId);
        if (r1.error) return false;
        const r2 = await supa.from('dm_conversations').delete().eq('id', convId);
        if (r2.error) return false;
        const c = getConvIdCache();
        const uid = supaUserId || '';
        const oid = (await supaGetUserId(other)) || '';
        const [a, b] = [uid, oid].sort();
        delete c[`${a}__${b}`];
        write(DB.dmConvIdCache, c);
        return true;
    } catch (e) { return false; }
}
async function supaClearDmMsgs(other) {
    try {
        const convId = await supaGetDmConvId(other);
        if (!convId) return true;
        const r = await supa.from('dm_messages').delete().eq('conversation_id', convId);
        return !r.error;
    } catch (e) { return false; }
}
async function supaFetchOnlineOnly() {
    try {
        const { data, error } = await supa.from('profiles').select('username,last_seen');
        if (error || !data) return;
        const users = read(DB.users);
        data.forEach(p => {
            const u = users.find(x => x.username === p.username);
            if (u && p.last_seen) u.lastSeen = new Date(p.last_seen).getTime();
        });
        write(DB.users, users);
    } catch (e) { }
}

// ───────────────────────── NOTIFICATIONS ─────────────────────────
function addNotification(type, to, from, data = {}) {
    if (!to || to === from || isUserBanned(to) || isUserBanned(from)) return;
    let list = read(DB.notifs);
    if (type === 'follow' || type === 'unfollow') {
        list = list.filter(n => !(n.to === to && n.from === from && (n.type === 'follow' || n.type === 'unfollow')));
    }
    list.push({
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type, to, from, postId: data.postId || null, text: data.text || null,
        createdAt: Date.now(), read: false
    });
    if (list.length > 300) list.splice(0, list.length - 300);
    write(DB.notifs, list);
    supaInsertNotif(type, to, data.postId || null, data.text || null);
    updateNotifBadge();
}
function myNotifications(type) {
    return read(DB.notifs).filter(n => {
        if (n.to !== currentUser) return false;
        if (!type) return true;
        if (type === 'mention') return n.type === 'mention' || n.type === 'quote';
        return n.type === type;
    }).sort((a, b) => b.createdAt - a.createdAt);
}
function unreadCount(type) {
    if (!currentUser) return 0;
    return read(DB.notifs).filter(n => {
        if (n.to !== currentUser || n.read) return false;
        if (isBlockedBetween(n.from) || isUserBanned(n.from)) return false;
        if (!type) return true;
        if (type === 'mention') return n.type === 'mention' || n.type === 'quote';
        return n.type === type;
    }).length;
}
function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    const badgeMob = document.getElementById('notifBadgeMob');
    if (!currentUser) {
        [badge, badgeMob].forEach(b => { if (b) b.classList.add('hidden'); });
        return;
    }
    const total = unreadCount();
    [badge, badgeMob].forEach(b => {
        if (!b) return;
        if (total > 0) { b.textContent = total; b.classList.remove('hidden'); }
        else b.classList.add('hidden');
    });
    const map = { follows: 'dotFollows', unfollows: 'dotUnfollows', replies: 'dotReplies', likes: 'dotLikes', mentions: 'dotMentions' };
    const typeMap = { follows: 'follow', unfollows: 'unfollow', replies: 'reply', likes: 'like', mentions: 'mention' };
    Object.keys(map).forEach(k => {
        const el = document.getElementById(map[k]);
        if (!el) return;
        el.innerHTML = unreadCount(typeMap[k]) > 0 ? '<span class="unread-dot"></span>' : '';
    });
}

// ───────────────────────── VIEW MANAGEMENT ─────────────────────────
function hideAllViews() {
    ['feedView', 'profileView', 'editProfileView', 'connectionsView', 'notificationsView', 'dmView', 'postView', 'composerView', 'reportsView', 'chatView', 'dmChatView', 'searchView', 'loginView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}
function showOnlyView(viewId) {
    hideAllViews();
    document.getElementById(viewId).classList.remove('hidden');
    const sa = document.getElementById('sideActions');
    if (viewId === 'feedView' && currentUser) sa.classList.remove('hidden');
    else sa.classList.add('hidden');
    updateMobileNavVisibility(viewId);
    requestAnimationFrame(() => {
        const scrollers = document.querySelectorAll('.content, .profile-content, .notif-list, .search-results');
        scrollers.forEach(el => { if (el) el.scrollTop = 0; });
        window.scrollTo(0, 0);
    });
}
function updateMobileNavVisibility(viewId) {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    if (!currentUser) { nav.style.display = 'none'; return; }
    const active = viewId || (document.querySelector('.sub-view:not(.hidden)') || {}).id || 'feedView';
    if (active === 'feedView') nav.style.display = '';
    else nav.style.display = 'none';
}
function showFeedView() {
    viewStack = [];
    viewingUser = null;
    currentPostId = null;
    currentFeedLimit = FEED_COUNT;
    showOnlyView('feedView');
    renderFeed();
    document.getElementById('feed').classList.add('fade-in');
    updateNotifBadge();
    updateDmBadge();
    updateReportsBadge();
}
function getScrollerIn(view) {
    if (!view) return null;
    return view.querySelector('.content, .profile-content, .notif-list, .chat-body, .search-results');
}
function getCurrentViewState() {
    let state = { type: 'feed' };
    if (!document.getElementById('profileView').classList.contains('hidden')) state = { type: 'profile', data: viewingUser };
    else if (!document.getElementById('postView').classList.contains('hidden')) state = { type: 'post', data: currentPostId };
    else if (!document.getElementById('notificationsView').classList.contains('hidden')) state = { type: 'notifications' };
    else if (!document.getElementById('dmView').classList.contains('hidden')) state = { type: 'dmList' };
    else if (!document.getElementById('dmChatView').classList.contains('hidden')) state = { type: 'dmChat', data: activeDmUser };
    else if (!document.getElementById('connectionsView').classList.contains('hidden')) state = { type: 'connections', data: { u: connUser, t: connType } };
    else if (!document.getElementById('reportsView').classList.contains('hidden')) state = { type: 'reports' };
    else if (!document.getElementById('chatView').classList.contains('hidden')) state = { type: 'chat' };
    else if (!document.getElementById('searchView').classList.contains('hidden')) state = { type: 'search' };
    else if (!document.getElementById('editProfileView').classList.contains('hidden')) state = { type: 'editProfile' };
    else if (!document.getElementById('composerView').classList.contains('hidden')) state = { type: 'composer' };
    const activeView = document.querySelector('.sub-view:not(.hidden)');
    const scroller = getScrollerIn(activeView);
    if (scroller) state.scrollTop = scroller.scrollTop;
    state._tab = currentTab;
    return state;
}
function pushView() { viewStack.push(getCurrentViewState()); }
function goBack() {
    if (viewStack.length === 0) { showFeedView(); return; }
    restoreViewState(viewStack.pop());
}
function restoreViewState(state) {
    hideAllViews();
    const v = state.type;
    if (v === 'profile') {
        viewingUser = state.data;
        document.getElementById('profileView').classList.remove('hidden');
        openProfileViewInternal(state.data, true);
    } else if (v === 'post') {
        currentPostId = state.data;
        const p = read(DB.posts).find(x => x.id === state.data);
        const el = document.getElementById('postDetailDate');
        if (el && p) el.textContent = dateString(p.createdAt);
        document.getElementById('postView').classList.remove('hidden');
        renderPostDetail(state.data);
    } else if (v === 'notifications') {
        document.getElementById('notificationsView').classList.remove('hidden');
        renderNotifications();
    } else if (v === 'dmList') {
        document.getElementById('dmView').classList.remove('hidden');
        renderDmList();
    } else if (v === 'dmChat') {
        if (state.data) {
            activeDmUser = state.data;
            document.getElementById('dmChatView').classList.remove('hidden');
            openDmWith(state.data, true);
        } else { showFeedView(); return; }
    } else if (v === 'connections') {
        document.getElementById('connectionsView').classList.remove('hidden');
        connUser = state.data.u;
        connType = state.data.t;
        document.getElementById('connTitle').textContent = state.data.t === 'followers' ? 'Followers' : 'Following';
        renderConnections();
    } else if (v === 'reports') {
        document.getElementById('reportsView').classList.remove('hidden');
        renderReports();
    } else if (v === 'chat') {
        document.getElementById('chatView').classList.remove('hidden');
        renderOnlineBar();
        renderChat(true);
    } else if (v === 'search') {
        document.getElementById('searchView').classList.remove('hidden');
    } else if (v === 'editProfile') {
        document.getElementById('editProfileView').classList.remove('hidden');
    } else if (v === 'composer') {
        document.getElementById('composerView').classList.remove('hidden');
    } else { showFeedView(); return; }
    if (state._tab && state.type === 'feed') currentTab = state._tab;
    updateMobileNavVisibility(v === 'feed' ? 'feedView' : document.querySelector('.sub-view:not(.hidden)')?.id);
    const activeView = document.querySelector('.sub-view:not(.hidden)');
    const scroller = getScrollerIn(activeView);
    if (scroller && state.scrollTop) {
        requestAnimationFrame(() => { if (scroller) scroller.scrollTop = state.scrollTop; });
    }
    const sa = document.getElementById('sideActions');
    if (v === 'feed' && currentUser) sa.classList.remove('hidden');
    else sa.classList.add('hidden');
}
function safeRerender() {
    const activeId = document.activeElement ? document.activeElement.id : '';
    const activeVal = document.activeElement && 'value' in document.activeElement ? document.activeElement.value : '';
    const selStart = document.activeElement && document.activeElement.selectionStart != null ? document.activeElement.selectionStart : 0;
    const selEnd = document.activeElement && document.activeElement.selectionEnd != null ? document.activeElement.selectionEnd : 0;
    rerenderCurrent();
    if (activeId && document.getElementById(activeId)) {
        const el = document.getElementById(activeId);
        if ('value' in el && el.value !== activeVal) el.value = activeVal;
        try { el.focus(); el.setSelectionRange(selStart, selEnd); } catch (e) { }
    }
}
function rerenderCurrent() {
    updateNotifBadge();
    updateDmBadge();
    updateReportsBadge();
    if (!document.getElementById('chatView').classList.contains('hidden')) { renderChat(false, false); renderOnlineBar(); }
    if (!document.getElementById('dmChatView').classList.contains('hidden')) renderDmBody();
    if (!document.getElementById('feedView').classList.contains('hidden')) { renderFeed(); return; }
    if (!document.getElementById('profileView').classList.contains('hidden') && viewingUser) {
        openProfileViewInternal(viewingUser, true);
        return;
    }
    if (!document.getElementById('postView').classList.contains('hidden') && currentPostId) {
        renderPostDetail(currentPostId);
        return;
    }
    if (!document.getElementById('dmView').classList.contains('hidden')) { renderDmList(); return; }
    if (!document.getElementById('notificationsView').classList.contains('hidden')) { renderNotifications(); return; }
    if (!document.getElementById('reportsView').classList.contains('hidden')) { renderReports(); return; }
    if (!document.getElementById('connectionsView').classList.contains('hidden')) { renderConnections(); return; }
}

// ───────────────────────── THEME / UTILS ─────────────────────────
function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) {
        if (theme === 'dark') icon.innerHTML = `<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>`;
        else icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
}
function toggleTheme() {
    const c = localStorage.getItem('zmz_theme') || 'light';
    const n = c === 'light' ? 'dark' : 'light';
    localStorage.setItem('zmz_theme', n);
    applyTheme(n);
}
function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
function musicComingSoon() { showToast('Coming soon'); }
function videoComingSoon() { showToast('Coming soon'); }
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2200);
}
function openConfirm(title, text, sub, cb, danger) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmSub').textContent = sub || '';
    const btn = document.getElementById('confirmBtn');
    btn.style.background = danger ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,var(--accent),var(--accent-2))';
    confirmCallback = cb;
    document.getElementById('confirmModal').classList.add('open');
}
function closeConfirm() { document.getElementById('confirmModal').classList.remove('open'); confirmCallback = null; }
function runConfirm() { const cb = confirmCallback; closeConfirm(); if (cb) cb(); }
function openLightbox(src) {
    if (!isSafeImageSrc(src)) return;
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
function openPremiumModal() { document.getElementById('premiumModal').classList.add('open'); }
function closePremiumModal() { document.getElementById('premiumModal').classList.remove('open'); }
function openAdminProfile() {
    closePremiumModal();
    const a = getUserData('premium');
    if (a) openProfileView('premium');
    else showToast('Premium admin not found');
}

// ───────────────────────── MENTIONS ─────────────────────────
function extractMentions(text) {
    if (!text) return [];
    const matches = text.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
    const result = [];
    matches.forEach(m => {
        const u = m.slice(1).toLowerCase();
        const user = userIndex.get(u);
        if (user && !result.includes(user.username)) result.push(user.username);
    });
    return result;
}
function renderMentions(escapedText) {
    if (!escapedText) return '';
    return escapedText.replace(/@([a-zA-Z0-9_]{3,20})/g, (match, username) => {
        const user = getUserData(username.toLowerCase());
        if (!user) return match;
        return `<span class="mention-link" onclick="event.stopPropagation();openProfileView('${escapeAttr(user.username)}')">@${escapeHtml(user.username)}</span>`;
    });
}
function notifyMentions(text, postId, contextType) {
    if (!text || !currentUser) return;
    const mentioned = extractMentions(text);
    mentioned.forEach(username => {
        if (username === currentUser || isUserBanned(username)) return;
        supaInsertNotif('mention', username, postId, text.slice(0, 80));
    });
}

// ───────────────────────── FEED ─────────────────────────
function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;
    currentFeedLimit = FEED_COUNT;
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const feed = document.getElementById('feed');
    feed.classList.remove('fade-in');
    renderFeed();
    feed.classList.add('fade-in');
}
function renderFeed() {
    cleanupExpired();
    const feed = document.getElementById('feed');
    if (!feed) return;
    const prevScroll = feed.scrollTop;
    let posts = read(DB.posts);
    if (currentUser) posts = posts.filter(p => !isBlockedBetween(p.username));
    posts = posts.filter(p => !isUserBanned(p.username));

    if (currentTab === 'foryou') {
        const now = Date.now();
        const fList = currentUser ? followingList(currentUser) : [];
        posts.forEach(p => {
            const hoursOld = Math.max(0, (now - p.createdAt) / 3600000);
            const freshness = Math.max(0, 1 - hoursOld / 48);
            const engagementScore = (p.likes.length * 2) + ((p.replies || []).length * 3) + ((p.views || 0) * 0.1);
            const engagementNorm = Math.min(1, engagementScore / 20);
            const followScore = fList.includes(p.username) ? 1 : 0;
            const selfBoost = (currentUser && p.username === currentUser) ? 0.15 : 0;
            p._score = (freshness * 0.35) + (engagementNorm * 0.40) + (followScore * 0.15) + selfBoost;
        });
        posts.sort((a, b) => b._score - a._score);
        const diversified = [], authorCount = {}, skipped = [];
        for (const p of posts) {
            const c = authorCount[p.username] || 0;
            if (c < 2) { diversified.push(p); authorCount[p.username] = c + 1; }
            else skipped.push(p);
        }
        posts = [...diversified, ...skipped];
    } else if (currentTab === 'following') {
        if (!currentUser) { feed.innerHTML = `<div class="empty"><strong>Log in</strong>to see who you follow</div>`; return; }
        const fList = followingList(currentUser);
        posts = posts.filter(p => fList.includes(p.username) || p.username === currentUser);
        posts.sort((a, b) => b.createdAt - a.createdAt);
    } else if (currentTab === 'saved') {
        if (!currentUser) { feed.innerHTML = `<div class="empty"><strong>Log in</strong>to see your saved vibes</div>`; return; }
        const savedIds = getSavedFor(currentUser);
        posts = posts.filter(p => savedIds.includes(p.id));
        posts.sort((a, b) => savedIds.indexOf(b.id) - savedIds.indexOf(a.id));
    } else {
        posts.sort((a, b) => b.createdAt - a.createdAt);
    }

    if (!posts.length) {
        let msg = 'No vibes yet';
        if (currentTab === 'following') msg = 'Nothing from people you follow';
        if (currentTab === 'saved') msg = 'No saved vibes yet';
        feed.innerHTML = `<div class="empty"><strong>${msg}</strong></div>`;
        feed.dataset.lastHtml = '';
        return;
    }
    const visible = posts.slice(0, currentFeedLimit);
    const newHtml = visible.map(p => renderPost(p, false, false)).join('');
    if (feed.dataset.lastHtml === newHtml && !feed.querySelector('.empty')) return;
    feed.dataset.lastHtml = newHtml;
    feed.innerHTML = newHtml;
    if (posts.length > currentFeedLimit) {
        const more = document.createElement('div');
        more.style.cssText = 'padding:16px;text-align:center;';
        more.innerHTML = `<button class="btn btn-outline" onclick="loadMore()">Load more</button>`;
        feed.appendChild(more);
    }

    feed.scrollTop = prevScroll;
}
function loadMore() { currentFeedLimit += FEED_COUNT; renderFeed(); }

function renderQuotedCard(quotedId) {
    if (!quotedId) return '';
    const q = read(DB.posts).find(x => x.id === quotedId);
    if (!q) return `<div class="quoted-card" onclick="event.stopPropagation();"><div class="quoted-card-inner"><div class="quoted-missing">Original vibe deleted</div></div></div>`;
    const blockedByMe = iBlocked(q.username);
    const blockedMe = blocksMe(q.username);
    if (blockedByMe || blockedMe) {
        return `<div class="quoted-card blocked-quote" onclick="event.stopPropagation();"><div class="quoted-card-inner"><div class="quoted-blocked"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><span>${blockedByMe ? 'You blocked this user' : 'Vibe unavailable'}</span></div></div></div>`;
    }
    const text = q.text || '';
    const imgHtml = isSafeImageSrc(q.image) ? `<div class="quoted-image-wrap"><img class="quoted-image" src="${escapeHtml(safeImageSrc(q.image))}" alt="" loading="lazy"></div>` : '';
    return `<div class="quoted-card" onclick="event.stopPropagation();openPostView('${escapeAttr(q.id)}')">
    <div class="quoted-card-inner">
      <div class="quoted-head">
        ${avatarSimple(q.username, 'xs')}
        <span class="quoted-name">${escapeHtml(displayNameOf(q.username))}${verifiedInline(q.username)}</span>
        <span class="quoted-handle"><span dir="ltr">@${escapeHtml(q.username)}</span><span class="dot-sep">·</span><span>${timeAgo(q.createdAt)}</span></span>
      </div>
      ${text ? `<div class="quoted-text" dir="auto">${renderMentions(escapeHtml(text))}</div>` : ''}
    </div>
    ${imgHtml}
  </div>`;
}

// ───────────────────────── COMMENTS (LTR enforced) ─────────────────────────
function renderComment(postId, comment, allComments, parentUser, depth) {
    const hasChildren = allComments.some(x => x.replyTo === comment.id);
    const key = postId + '__' + comment.id;
    const isOpen = nestedOpenTargets[key] === true;
    const inputOpen = nestedInputTargets[key];
    const d = depth || 0;
    const post = read(DB.posts).find(x => x.id === postId);
    const canDelete = currentUser && (currentUser === comment.username || isCurrentUserAdmin() || (post && post.username === currentUser));
    const childCount = allComments.filter(x => x.replyTo === comment.id).length;
    const menuBtn = canDelete ? `<button class="comment-menu-btn" onclick="event.stopPropagation();confirmDeleteComment('${escapeAttr(postId)}','${escapeAttr(comment.id)}')" title="Delete" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></button>` : '';
    const replyBadge = parentUser ? `<span class="reply-indicator"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>@${escapeHtml(parentUser)}</span>` : '';
    const pendingCls = comment._pending ? ' pending' : (comment._failed ? ' failed' : '');
    const statusHtml = comment._pending
        ? `<span class="comment-status sending">${spinnerSVG()}</span>`
        : (comment._failed
            ? `<span class="comment-status failed" onclick="retryComment('${escapeAttr(postId)}','${escapeAttr(comment.id)}')">${failedSVG()} Retry</span>`
            : '');

    return `<div class="comment${pendingCls}" data-depth="${d}" data-comment-id="${escapeAttr(comment.id)}">
    <div class="comment-avatar-col">${avatarClickable(comment.username, 'sm')}</div>
    <div class="comment-body">
      <div class="comment-head">
        <span class="comment-user" onclick="openProfileView('${escapeAttr(comment.username)}')">${escapeHtml(displayNameOf(comment.username))}${verifiedInline(comment.username)}</span>
        <span class="comment-time">· ${timeAgo(comment.createdAt)}</span>
        ${replyBadge}${statusHtml}${menuBtn}
      </div>
      <div class="comment-text" dir="ltr">${renderMentions(escapeHtml(comment.text))}</div>
      <div class="comment-actions">
        ${currentUser ? `<button class="comment-btn" onclick="toggleNestedInput('${escapeAttr(postId)}','${escapeAttr(comment.id)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>Reply</button>` : ''}
      </div>
      ${(hasChildren && !isOpen) ? `<button class="show-replies-btn" onclick="toggleNestedReplies('${escapeAttr(postId)}','${escapeAttr(comment.id)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>Show ${childCount} ${childCount === 1 ? 'reply' : 'replies'}</button>` : ''}
      ${isOpen && hasChildren ? `<button class="show-replies-btn open" onclick="toggleNestedReplies('${escapeAttr(postId)}','${escapeAttr(comment.id)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>Hide replies</button>` : ''}
      ${inputOpen ? `<div class="comment-reply-input"><textarea dir="ltr" placeholder="Reply..." maxlength="200" id="nestedInput_${postId}_${comment.id}" oninput="autoGrow(this)" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();submitNestedReply('${escapeAttr(postId)}','${escapeAttr(comment.id)}');}"></textarea><button class="reply-send" onclick="submitNestedReply('${escapeAttr(postId)}','${escapeAttr(comment.id)}')">↵</button></div>` : ''}
    </div>
  </div>`;
}
function renderRepliesTree(postId, allComments) {
    const flat = [];
    function walk(parentId, parentUsername, depth) {
        allComments.filter(c => (c.replyTo || null) === parentId).forEach(c => {
            flat.push({ c, depth, parentUsername });
            walk(c.id, c.username, depth + 1);
        });
    }
    walk(null, null, 0);
    const visible = flat.filter(item => {
        let p = item.c.replyTo;
        while (p) {
            const key = postId + '__' + p;
            if (!nestedOpenTargets[key]) return false;
            const parent = allComments.find(x => x.id === p);
            p = parent ? parent.replyTo : null;
        }
        return true;
    });
    return visible.map(item => renderComment(postId, item.c, allComments, item.parentUsername, item.depth)).join('');
}
function renderRepliesBlock(postId, replies) {
    return `<div class="replies">
    <div class="replies-head"><span class="replies-title">${replies.length ? replies.length + ' ' + (replies.length === 1 ? 'comment' : 'comments') : 'Comments'}</span></div>
    ${currentUser ? `<div class="reply-input-wrap"><div class="reply-input-row"><textarea dir="ltr" placeholder="Add a comment..." maxlength="200" id="replyInput_${postId}" oninput="autoGrow(this)" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();submitTopReply('${escapeAttr(postId)}');}"></textarea><button class="reply-send" onclick="submitTopReply('${escapeAttr(postId)}')">↵</button></div></div>` : ''}
    ${replies.length ? `<div class="replies-list">${renderRepliesTree(postId, replies)}</div>` : ''}
  </div>`;
}

// ───────────────────────── POST RENDER ─────────────────────────
function renderPost(p, inProfile, showComments) {
    const liked = currentUser && p.likes.includes(currentUser);
    const replies = (p.replies || []);
    const canDelete = currentUser && (currentUser === p.username || isCurrentUserAdmin());
    const saved = isSaved(p.id);
    const reported = hasReported(p.id);
    const views = p.views || 0;
    const pendingCls = p._pending ? ' pending' : (p._failed ? ' failed' : '');
    const imgHtml = isSafeImageSrc(p.image)
        ? `<div class="post-image-wrap" onclick="event.stopPropagation();openLightbox('${escapeAttr(safeImageSrc(p.image))}')"><img class="post-image" src="${escapeHtml(safeImageSrc(p.image))}" alt="" loading="lazy"></div>`
        : '';
    const menuBtn = currentUser
        ? `<button class="post-menu-btn" onclick="event.stopPropagation();togglePostMenu(event,'${escapeAttr(p.id)}','${canDelete}','${!!p.image}','${reported}')" title="Menu" aria-label="Post menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>`
        : '';
    return `<div class="post${pendingCls}" data-post-id="${escapeAttr(p.id)}">
    <div class="thread-line"></div>
    <div class="post-head">
      ${avatarClickable(p.username, 'md')}
      <div class="post-user" onclick="openProfileView('${escapeAttr(p.username)}')">
        <span class="post-username">${escapeHtml(displayNameOf(p.username))}${verifiedInline(p.username)}</span>
        <span class="post-handle"><span dir="ltr">@${escapeHtml(p.username)}</span><span class="dot-sep">·</span><span>${timeAgo(p.createdAt)}</span></span>
      </div>
      ${menuBtn}
    </div>
    ${p.text ? `<div class="post-text" dir="auto">${renderMentions(escapeHtml(p.text))}</div>` : ''}
    ${imgHtml}
    ${renderQuotedCard(p.quotedPostId)}
    <div class="post-actions">
      <div class="action ${liked ? 'liked' : ''}" onclick="requireAuth(()=>toggleLike('${escapeAttr(p.id)}'))" id="likeAction_${escapeAttr(p.id)}"><span class="heart">♥</span><span>${p.likes.length}</span></div>
      <div class="action" onclick="requireAuth(()=>openPostView('${escapeAttr(p.id)}'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>${replies.length ? `<span>${replies.length}</span>` : ''}</div>
      <div class="action" onclick="requireAuth(()=>startQuote('${escapeAttr(p.id)}'))" title="Quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="12" rx="2"/><rect x="7" y="9" width="14" height="12" rx="2"/></svg></div>
      <div class="action ${saved ? 'saved' : ''}" onclick="requireAuth(()=>toggleSave('${escapeAttr(p.id)}'))" title="Save"><svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div>
      <div class="action views" title="Views"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg><span>${views}</span></div>
    </div>
    ${showComments ? renderRepliesBlock(p.id, replies) : ''}
  </div>`;
}

// ───────────────────────── POST MENU ─────────────────────────
function togglePostMenu(ev, postId, canDelete, hasImage, reported) {
    ev.stopPropagation();
    if (postMenuEl && postMenuPostId === postId) { closePostMenu(); return; }
    closePostMenu();
    const menu = document.createElement('div');
    menu.className = 'post-menu-dropdown open';
    const cd = canDelete === 'true' || canDelete === true;
    const hi = hasImage === 'true' || hasImage === true;
    const items = [];
    items.push({ label: 'View Vibe', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>', action: `openPostView('${escapeAttr(postId)}')` });
    items.push({ label: 'Copy text', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', action: `copyPostText('${escapeAttr(postId)}')` });
    if (hi) items.push({ label: 'Download image', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', action: `downloadPostImage('${escapeAttr(postId)}')` });
    if (!cd) items.push({ label: 'Report', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>', action: `openReportModal('${escapeAttr(postId)}')`, divider: true });
    if (cd) items.push({ label: 'Delete', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>', action: `confirmDeletePost('${escapeAttr(postId)}')`, danger: true, divider: true });
    menu.innerHTML = items.map((it, i) => {
        let html = '';
        if (it.divider && i > 0) html += `<div class="post-menu-divider"></div>`;
        html += `<button class="post-menu-item ${it.danger ? 'danger' : ''}" onclick="event.stopPropagation();${it.action};closePostMenu()">${it.svg}<span>${it.label}</span></button>`;
        return html;
    }).join('');
    document.body.appendChild(menu);
    const rect = ev.currentTarget.getBoundingClientRect();
    let left = rect.right - 190, top = rect.bottom + 6;
    if (left < 10) left = 10;
    if (top + 220 > window.innerHeight) top = Math.max(10, rect.top - 6 - menu.offsetHeight);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    postMenuEl = menu;
    postMenuPostId = postId;
    setTimeout(() => { document.addEventListener('click', closePostMenuOnce); }, 10);
}
function closePostMenuOnce(e) {
    if (postMenuEl && !postMenuEl.contains(e.target)) closePostMenu();
    document.removeEventListener('click', closePostMenuOnce);
}
function closePostMenu() {
    if (postMenuEl) { postMenuEl.remove(); postMenuEl = null; postMenuPostId = null; }
}
function copyPostText(postId) {
    const p = read(DB.posts).find(x => x.id === postId);
    if (!p || !p.text) { showToast('No text'); return; }
    navigator.clipboard.writeText(p.text).then(() => showToast('Copied')).catch(() => showToast('Copy failed'));
}
function downloadPostImage(postId) {
    const p = read(DB.posts).find(x => x.id === postId);
    if (!p || !p.image) return;
    const a = document.createElement('a');
    a.href = p.image; a.download = 'vibe-' + postId + '.jpg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Downloading');
}
function refreshPost(postId) {
    const containers = ['feed', 'profileContent', 'postDetailContent', 'profilePosts'];
    const scrollPos = {};
    containers.forEach(id => { const el = document.getElementById(id); if (el) scrollPos[id] = el.scrollTop; });
    const p = read(DB.posts).find(x => x.id === postId);
    const els = document.querySelectorAll(`[data-post-id="${CSS.escape(String(postId))}"]`);
    els.forEach(el => {
        if (!p) { el.remove(); return; }
        const parentId = el.parentElement ? el.parentElement.id : '';
        const inProfile = (parentId === 'profilePosts' || parentId === 'profileContent');
        const temp = document.createElement('div');
        temp.innerHTML = renderPost(p, inProfile, parentId === 'postDetailContent');
        el.replaceWith(temp.firstElementChild);
    });
    containers.forEach(id => { const e = document.getElementById(id); if (e && scrollPos[id] !== undefined) e.scrollTop = scrollPos[id]; });
}

// ───────────────────────── POST DETAIL ─────────────────────────
function openPostView(postId) {
    const p = read(DB.posts).find(x => x.id === postId);
    if (!p) { showToast('Vibe not found'); return; }
    pushView();
    currentPostId = postId;
    const dateEl = document.getElementById('postDetailDate');
    if (dateEl) dateEl.textContent = dateString(p.createdAt);
    showOnlyView('postView');
    renderPostDetail(postId);
    supaAddView(postId);
}
function renderPostDetail(postId) {
    const el = document.getElementById('postDetailContent');
    const p = read(DB.posts).find(x => x.id === postId);
    if (!p) { el.innerHTML = `<div class="empty"><strong>Vibe not found</strong></div>`; return; }
    if (p.username !== currentUser && isBlockedBetween(p.username)) {
        const blockedByMe = iBlocked(p.username);
        el.innerHTML = `<div class="post-detail-blocked"><div class="post-detail-blocked-inner">${blockedByMe ? 'You blocked this user' : 'This user blocked you'}${blockedByMe ? `<div style="margin-top:12px;"><button class="btn btn-outline" onclick="toggleBlock('${escapeAttr(p.username)}');renderPostDetail('${escapeAttr(p.id)}');">Unblock</button></div>` : ''}</div></div>`;
        return;
    }
    el.innerHTML = renderPost(p, false, true);
}

// ───────────────────────── COMMENTS ACTIONS ─────────────────────────
function toggleNestedReplies(postId, commentId) {
    const key = postId + '__' + commentId;
    if (nestedOpenTargets[key]) delete nestedOpenTargets[key];
    else nestedOpenTargets[key] = true;
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
}
function toggleNestedInput(postId, commentId) {
    const key = postId + '__' + commentId;
    if (nestedInputTargets[key]) delete nestedInputTargets[key];
    else nestedInputTargets[key] = commentId;
    nestedOpenTargets[key] = true;
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
    setTimeout(() => { const el = document.getElementById('nestedInput_' + postId + '_' + commentId); if (el) el.focus(); }, 50);
}
async function submitNestedReply(postId, commentId) {
    if (!currentUser) return;
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const el = document.getElementById('nestedInput_' + postId + '_' + commentId);
    if (!el) return;
    const text = el.value.trim();
    if (!text) return;
    const posts = read(DB.posts);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.replies) post.replies = [];
    const tempId = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const parent = post.replies.find(x => x.id === commentId);
    post.replies.push({ id: tempId, username: currentUser, text, createdAt: Date.now(), replyTo: commentId, _pending: true });
    write(DB.posts, posts);
    if (parent && parent.username !== currentUser) {
        addNotification('reply', parent.username, currentUser, { postId: post.id, text: text.slice(0, 80) });
    }
    notifyMentions(text, post.id, 'comment');
    delete nestedInputTargets[postId + '__' + commentId];
    nestedOpenTargets[postId + '__' + commentId] = true;
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
    const sup = await NetLayer.safe(() => supaInsertReply(postId, text, commentId), null, { tag: 'reply' });
    if (sup) {
        const posts2 = read(DB.posts);
        const p2 = posts2.find(x => x.id === postId);
        if (p2 && p2.replies) {
            const r = p2.replies.find(x => x.id === tempId);
            if (r) { r.id = sup.id; markSent(r); }
            write(DB.posts, posts2);
        }
    } else {
        const posts2 = read(DB.posts);
        const p2 = posts2.find(x => x.id === postId);
        if (p2 && p2.replies) {
            const r = p2.replies.find(x => x.id === tempId);
            if (r) markFailed(r);
            write(DB.posts, posts2);
        }
    }
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
}
async function submitTopReply(postId) {
    if (!currentUser) return;
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const input = document.getElementById('replyInput_' + postId);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const posts = read(DB.posts);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.replies) post.replies = [];
    const tempId = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    post.replies.push({ id: tempId, username: currentUser, text, createdAt: Date.now(), replyTo: null, _pending: true });
    write(DB.posts, posts);
    if (post.username !== currentUser) addNotification('reply', post.username, currentUser, { postId: post.id, text: text.slice(0, 80) });
    notifyMentions(text, post.id, 'comment');
    input.value = ''; input.style.height = 'auto';
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
    const sup = await NetLayer.safe(() => supaInsertReply(postId, text, null), null, { tag: 'reply-top' });
    const posts2 = read(DB.posts);
    const p2 = posts2.find(x => x.id === postId);
    if (p2 && p2.replies) {
        const r = p2.replies.find(x => x.id === tempId);
        if (r) {
            if (sup) { r.id = sup.id; markSent(r); }
            else markFailed(r);
        }
        write(DB.posts, posts2);
    }
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
}
function retryComment(postId, commentId) {
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const posts = read(DB.posts);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = (post.replies || []).find(r => r.id === commentId);
    if (!comment) return;
    comment._pending = true; delete comment._failed;
    write(DB.posts, posts);
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
    (async () => {
        const sup = await NetLayer.safe(() => supaInsertReply(postId, comment.text, comment.replyTo || null), null, { tag: 'retry-reply' });
        const posts2 = read(DB.posts);
        const p2 = posts2.find(x => x.id === postId);
        if (p2) {
            const r = (p2.replies || []).find(x => x.id === commentId);
            if (r) { if (sup) { r.id = sup.id; markSent(r); } else markFailed(r); }
            write(DB.posts, posts2);
        }
        if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
        else refreshPost(postId);
    })();
}
function confirmDeleteComment(postId, commentId) {
    if (!currentUser) return;
    openConfirm('Delete comment', 'Delete this comment?', 'Replies under it will also be removed.', () => {
        const posts = read(DB.posts);
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        const toDelete = new Set([commentId]);
        let changed = true;
        while (changed) {
            changed = false;
            (post.replies || []).forEach(r => {
                if (r.replyTo && toDelete.has(r.replyTo) && !toDelete.has(r.id)) {
                    toDelete.add(r.id); changed = true;
                }
            });
        }
        post.replies = (post.replies || []).filter(r => !toDelete.has(r.id));
        write(DB.posts, posts);
        toDelete.forEach(id => supaDeleteReply(id));
        if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
        else refreshPost(postId);
        showToast('Comment deleted');
    }, true);
}

// ───────────────────────── LIKE / SAVE ─────────────────────────
async function toggleLike(postId) {
    if (!currentUser) return;
    const posts = read(DB.posts);
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const i = post.likes.indexOf(currentUser);
    const wasLiking = i === -1;
    if (wasLiking) {
        post.likes.push(currentUser);
        if (!viewedThisSession.has(postId)) { viewedThisSession.add(postId); supaAddView(postId); }
        if (post.username !== currentUser) {
            const notifs = read(DB.notifs);
            const already = notifs.some(n => n.type === 'like' && n.to === post.username && n.from === currentUser && n.postId === post.id);
            if (!already) addNotification('like', post.username, currentUser, { postId: post.id });
        }
    } else {
        post.likes.splice(i, 1);
        supaDeleteNotif('like', post.username, postId);
    }
    write(DB.posts, posts);
    supaToggleLike(postId, wasLiking);
    if (!document.getElementById('postView').classList.contains('hidden')) renderPostDetail(currentPostId);
    else refreshPost(postId);
    if (wasLiking) {
        setTimeout(() => {
            const el = document.getElementById('likeAction_' + postId);
            if (el) {
                const burst = document.createElement('span');
                burst.className = 'heart-burst';
                el.appendChild(burst);
                setTimeout(() => burst.remove(), 700);
            }
        }, 30);
    }
}
function toggleSave(postId) {
    if (!currentUser) return;
    const all = read(DB.saved, {});
    const list = all[currentUser] || [];
    const i = list.indexOf(postId);
    const isSave = i === -1;
    if (isSave) { list.push(postId); showToast('Saved'); }
    else { list.splice(i, 1); showToast('Removed'); }
    all[currentUser] = list;
    write(DB.saved, all);
    supaToggleSave(postId, isSave);
    refreshPost(postId);
    if (currentTab === 'saved') renderFeed();
}
function confirmDeletePost(postId) {
    if (!currentUser) return;
    const post = read(DB.posts).find(p => p.id === postId);
    if (!post) return;
    const isOwner = post.username === currentUser;
    const isAdmin = isCurrentUserAdmin();
    if (!isOwner && !isAdmin) { showToast('Not allowed'); return; }
    const who = isOwner ? 'your vibe' : displayNameOf(post.username) + "'s vibe";
    openConfirm('Delete Vibe', 'Delete ' + who + '?', 'This cannot be undone', async () => {
        write(DB.posts, read(DB.posts).filter(p => p.id !== postId));
        write(DB.reports, getReports().filter(r => r.postId !== postId));
        await Promise.all([supaDeletePost(postId), supaDeleteReportsByPost(postId)]);
        showToast('Deleted');
        if (!document.getElementById('postView').classList.contains('hidden')) goBack();
        rerenderCurrent();
        updatePostButtonState();
        updateReportsBadge();
    }, true);
}

// ───────────────────────── QUOTE ─────────────────────────
function startQuote(postId) { openComposer(postId); }
function renderQuotePreview() {
    const el = document.getElementById('quotePreview');
    if (!quotingPostId) { el.innerHTML = ''; return; }
    const q = read(DB.posts).find(x => x.id === quotingPostId);
    if (!q) { el.innerHTML = ''; return; }
    const text = q.text || '';
    const imgHtml = isSafeImageSrc(q.image) ? `<div class="quoted-image-wrap"><img class="quoted-image" src="${escapeHtml(safeImageSrc(q.image))}" alt=""></div>` : '';
    el.innerHTML = `
    <div style="margin-top:12px;position:relative;padding:0 54px;">
      <div class="quoted-card" style="margin:0;">
        <div class="quoted-card-inner">
          <div class="quoted-head">
            ${avatarSimple(q.username, 'xs')}
            <span class="quoted-name">${escapeHtml(displayNameOf(q.username))}${verifiedInline(q.username)}</span>
            <span class="quoted-handle"><span dir="ltr">@${escapeHtml(q.username)}</span><span class="dot-sep">·</span><span>${timeAgo(q.createdAt)}</span></span>
          </div>
          ${text ? `<div class="quoted-text" dir="auto">${escapeHtml(text)}</div>` : ''}
        </div>
        ${imgHtml}
      </div>
      <button onclick="clearQuote()" style="position:absolute;top:8px;right:60px;background:var(--card);border:1px solid var(--border);width:26px;height:26px;border-radius:50%;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center;font-size:13px;">✕</button>
    </div>`;
}
function clearQuote() {
    quotingPostId = null;
    document.getElementById('composerTitle').textContent = 'New Vibe';
    renderQuotePreview();
    updateCounter();
}

// ───────────────────────── IMAGE UPLOAD ─────────────────────────
function handlePostImageUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('Image too big (max 15MB)'); ev.target.value = ''; return; }

    let previewUrl;
    try { previewUrl = URL.createObjectURL(file); }
    catch (e) { showToast('Cannot open image'); ev.target.value = ''; return; }

    composerImage = previewUrl;
    composerImageUploading = true;
    renderComposerImage();
    updateCounter();

    const img = new Image();
    img.onerror = () => {
        uploadRawFile(file, previewUrl);
    };
    img.onload = async () => {
        try {
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.78));
            if (!blob) throw new Error('Canvas failed');
            await uploadBlob(blob, previewUrl);
        } catch (e) {
            uploadRawFile(file, previewUrl);
        }
    };
    img.src = previewUrl;
    ev.target.value = '';
}
async function uploadBlob(blob, previewUrl) {
    let finalUrl = null;
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (uid && blob) {
            const url = await NetLayer.safe(() => uploadPostImage(blob, uid), null, { tag: 'img-upload' });
            if (url) finalUrl = url;
        }
    } catch (e) { }
    if (finalUrl) {
        await new Promise((resolve) => {
            const pre = new Image();
            pre.onload = resolve;
            pre.onerror = resolve;
            pre.src = finalUrl;
        });
        composerImage = finalUrl;
    }
    composerImageUploading = false;
    renderComposerImage();
    updateCounter();
}
async function uploadRawFile(file, previewUrl) {
    let finalUrl = null;
    try {
        const uid = supaUserId || await supaGetUserId(currentUser);
        if (uid) {
            const url = await NetLayer.safe(() => uploadPostImage(file, uid), null, { tag: 'img-upload-raw' });
            if (url) finalUrl = url;
        }
    } catch (e) { }
    if (finalUrl) {
        await new Promise((resolve) => {
            const pre = new Image();
            pre.onload = resolve;
            pre.onerror = resolve;
            pre.src = finalUrl;
        });
        composerImage = finalUrl;
    } else {
        try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
            if (base64) composerImage = base64;
        } catch (e) { }
    }
    composerImageUploading = false;
    renderComposerImage();
    updateCounter();
}
function renderComposerImage() {
    const el = document.getElementById('composerImgPreview');
    if (!composerImage || !isSafeImageSrc(composerImage)) { el.innerHTML = ''; return; }
    const overlay = composerImageUploading
        ? `<div class="composer-img-uploading"><span class="publish-loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>`
        : '';
    el.innerHTML = `<div class="composer-img-preview"><img src="${escapeHtml(composerImage)}" alt="">${overlay}<button class="composer-img-remove" onclick="clearComposerImage()" title="Remove" aria-label="Remove image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
}
function clearComposerImage() {
    composerImage = null;
    composerImageUploading = false;
    renderComposerImage();
    updateCounter();
}

// ───────────────────────── COMPOSER ─────────────────────────
function postsTodayBy(user) {
    if (!user) return 0;
    const start = new Date().setHours(0, 0, 0, 0);
    return read(DB.posts).filter(p => p.username === user && p.createdAt >= start).length;
}
function updatePostButtonState() {
    const btn = document.getElementById('newPostBtn');
    const hdrChat = document.getElementById('hdrChatBtn');
    const hdrDm = document.getElementById('hdrDmBtn');
    if (hdrChat) hdrChat.classList.toggle('hidden', !currentUser);
    if (hdrDm) hdrDm.classList.toggle('hidden', !currentUser);
    const sa = document.getElementById('sideActions');
    if (sa) {
        const feedVisible = !document.getElementById('feedView').classList.contains('hidden');
        if (currentUser && feedVisible) sa.classList.remove('hidden');
        else sa.classList.add('hidden');
    }
    updateMobileNavVisibility();
    if (!btn) return;
    if (!currentUser) { btn.disabled = false; btn.title = 'New Vibe'; return; }
    if (isUserBanned(currentUser)) { btn.disabled = true; btn.title = 'Account suspended'; return; }
    btn.disabled = false;
    const used = postsTodayBy(currentUser);
    const limit = dailyLimitFor(currentUser);
    btn.title = (isUnlimited(currentUser) || used < limit) ? 'New Vibe' : 'Daily limit reached';
}
function openComposer(quoteId = null) {
    if (currentUser) {
        if (isUserBanned(currentUser)) { showToast('Account suspended'); return; }
        const used = postsTodayBy(currentUser);
        const limit = dailyLimitFor(currentUser);
        if (!isUnlimited(currentUser) && used >= limit) { openPremiumModal(); return; }
    }
    quotingPostId = quoteId || null;
    pushView();

    // ⬇️ لود کردن پیش‌نویس از sessionStorage
    const draft = sessionStorage.getItem('vibe_draft');
    document.getElementById('postText').value = draft || '';
    document.getElementById('postText').style.height = 'auto';

    composerImage = null;
    composerImageUploading = false;
    renderComposerImage();
    document.getElementById('composerTitle').textContent = quotingPostId ? 'Quote Vibe' : 'New Vibe';
    renderQuotePreview();
    renderComposerAvatar();
    updateCounter();
    showOnlyView('composerView');
    setTimeout(() => {
        document.getElementById('postText').focus();
        autoGrow(document.getElementById('postText'));
    }, 100);
}
function closeComposer() {
    if (publishing) return;
    quotingPostId = null;
    composerImage = null;
    composerImageUploading = false;
    renderQuotePreview();
    renderComposerImage();
    goBack();
}
function renderComposerAvatar() {
    const el = document.getElementById('composerAvatar');
    if (!el || !currentUser) return;
    const u = getUserData(currentUser);
    if (u && isSafeImageSrc(u.avatar)) {
        el.style.background = '#fff';
        el.innerHTML = `<img src="${escapeHtml(safeImageSrc(u.avatar))}" alt="">`;
    } else if (u && isEmojiAvatar(u.avatar)) {
        el.style.background = gradFor(currentUser);
        el.innerHTML = '';
        el.textContent = u.avatar;
    } else {
        el.style.background = gradFor(currentUser);
        el.innerHTML = '';
        el.textContent = (displayNameOf(currentUser) || currentUser).slice(0, 1).toUpperCase();
    }
}
function updateCounter() {
    const textEl = document.getElementById('postText');
    const text = textEl ? textEl.value : '';
    const len = text.length;

    // ⬇️ ذخیره خودکار پیش‌نویس
    if (text.trim()) sessionStorage.setItem('vibe_draft', text);
    else sessionStorage.removeItem('vibe_draft');

    const used = postsTodayBy(currentUser);
    const limit = dailyLimitFor(currentUser);
    const counter = document.getElementById('counter');
    if (isUnlimited(currentUser)) counter.innerHTML = `<strong>${len}</strong> / 280 · Unlimited`;
    else {
        const left = Math.max(0, limit - used);
        counter.innerHTML = `<strong>${len}</strong> / 280 · ${left} of ${limit} remaining`;
    }
    counter.classList.toggle('low', len > 250);
    const publishBtn = document.getElementById('publishBtn');
    if (publishBtn) {
        publishBtn.disabled = (!text.trim() && !composerImage && !quotingPostId) || composerImageUploading || networkStatus === 'offline';
    }
}
async function publishPost() {
    if (publishing) return;
    if (networkStatus === 'offline') { showToast('You are offline. Cannot post.'); return; }
    const text = document.getElementById('postText').value.trim();
    if (!text && !composerImage && !quotingPostId) return;
    if (currentUser) {
        if (isUserBanned(currentUser)) { showToast('Account suspended'); return; }
        const used = postsTodayBy(currentUser);
        const limit = dailyLimitFor(currentUser);
        if (!isUnlimited(currentUser) && used >= limit) { closeComposer(); openPremiumModal(); return; }
    }
    publishing = true;
    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.innerHTML = `<span class="publish-loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;

    const tempId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newPost = {
        id: tempId, username: currentUser, text: text || '',
        image: composerImage || null, createdAt: Date.now(),
        likes: [], replies: [], quotedPostId: quotingPostId || null,
        views: 0, _pending: true
    };
    const posts = read(DB.posts);
    posts.push(newPost);
    write(DB.posts, posts);

    publishing = false;
    btn.textContent = originalText;
    btn.disabled = false;
    quotingPostId = null;
    const savedImage = composerImage;
    composerImage = null;
    composerImageUploading = false;
    currentFeedLimit = FEED_COUNT;
    renderQuotePreview();
    renderComposerImage();
    viewStack = [];
    showFeedView();
    renderFeed();
    updatePostButtonState();

    // ⬇️ پاک کردن پیش‌نویس بعد از ارسال موفق
    sessionStorage.removeItem('vibe_draft');

    const sup = await NetLayer.safe(() => supaInsertPost({ ...newPost, image: savedImage }), null, { tag: 'post-create' });
    const posts2 = read(DB.posts);
    const p2 = posts2.find(x => x.id === tempId);
    if (p2) {
        if (sup) {
            p2.id = sup.id;
            markSent(p2);
            notifyMentions(p2.text, sup.id, 'post');
            if (newPost.quotedPostId) {
                const origPost = read(DB.posts).find(p => p.id === newPost.quotedPostId);
                if (origPost && origPost.username !== currentUser) {
                    addNotification('quote', origPost.username, currentUser, { postId: sup.id, text: text ? text.slice(0, 80) : '' });
                }
            }
        } else {
            markFailed(p2);
            showToast('Failed · Tap to retry');
        }
        write(DB.posts, posts2);
    }
    renderFeed();
}

// ───────────────────────── PROFILE ─────────────────────────
function openProfileView(username) {
    const user = getUserData(username);
    if (!user) { showToast('User not found'); return; }
    pushView();
    openProfileViewInternal(username, false);
}
function openProfileViewInternal(username, isRestoring) {
    const user = getUserData(username);
    if (!user) return;
    viewingUser = username;
    showOnlyView('profileView');
    const banned = isUserBanned(username);
    const av = document.getElementById('pvAvatar');
    av.classList.toggle('banned', banned);
    if (isSafeImageSrc(user.avatar)) {
        av.style.background = '#fff';
        av.innerHTML = `<img src="${escapeHtml(safeImageSrc(user.avatar))}" alt="">`;
    } else if (isEmojiAvatar(user.avatar)) {
        av.style.background = gradFor(username);
        av.innerHTML = '';
        av.textContent = user.avatar;
    } else {
        av.style.background = gradFor(username);
        av.innerHTML = '';
        av.textContent = (displayNameOf(username) || username).slice(0, 1).toUpperCase();
    }
    const isMe = username === currentUser;
    const verified = isUserVerified(username);
    const blockedByMe = iBlocked(username);
    const blockedMe = blocksMe(username);
    const isBlocked = blockedByMe || blockedMe;
    document.getElementById('pvNameRow').innerHTML = `
    <span class="profile-display${banned ? ' banned-name' : ''}">${escapeHtml(displayNameOf(username))}</span>
    ${(!banned && verified) ? `<span class="verified-badge">${verifiedSVG(getBadgeColor(username))}</span>` : ''}`;
    document.getElementById('pvHandle').textContent = '@' + username;
    const typeEl = document.getElementById('pvType');
    typeEl.textContent = userTypeLabel(username);
    typeEl.className = 'profile-type ' + userTypeClass(username);
    const premiumBtn = document.getElementById('premiumBtn');
    if (premiumBtn) premiumBtn.classList.toggle('hidden', !(isMe && !verified && !banned));
    const bioEl = document.getElementById('pvBio');
    if (banned) {
        bioEl.innerHTML = `<span class="bio-label">Suspension reason:</span>${escapeHtml(user.banReason || '—')}`;
        bioEl.classList.remove('empty-bio');
        bioEl.classList.add('banned-bio');
    } else if (user.bio && user.bio.trim()) {
        bioEl.textContent = user.bio;
        bioEl.classList.remove('empty-bio');
        bioEl.classList.remove('banned-bio');
    } else {
        bioEl.textContent = isMe ? "You haven't written a bio" : 'No bio';
        bioEl.classList.add('empty-bio');
        bioEl.classList.remove('banned-bio');
    }
    const bannerEl = document.getElementById('profileBlockBanner');
    if (isBlocked && !isMe && !banned) {
        bannerEl.innerHTML = `<div class="block-banner"><span>${blockedByMe ? 'You blocked this user' : 'This user blocked you'}</span>${blockedByMe ? `<button onclick="toggleBlock('${escapeAttr(username)}')">Unblock</button>` : ''}</div>`;
    } else bannerEl.innerHTML = '';
    const postsCount = banned ? 0 : read(DB.posts).filter(p => p.username === username).length;
    const followers = banned ? [] : followersOf(username);
    const following = banned ? [] : followingList(username);
    document.getElementById('pvStats').innerHTML = `
    <div class="stat-item"><div class="stat-num">${postsCount}</div><div class="stat-label">Vibes</div></div>
    <div class="stat-item" onclick="openConnections('${escapeAttr(username)}','followers')"><div class="stat-num">${followers.length}</div><div class="stat-label">Followers</div></div>
    <div class="stat-item" onclick="openConnections('${escapeAttr(username)}','following')"><div class="stat-num">${following.length}</div><div class="stat-label">Following</div></div>`;
    const actions = document.getElementById('pvActions');
    let actionsHtml = '';
    if (isMe) {
        if (banned) actionsHtml = `<button class="btn btn-ghost" onclick="logout()">Log out</button>`;
        else actionsHtml = `<button class="btn btn-outline" onclick="openEditProfile()">Edit Profile</button><button class="btn btn-ghost btn-logout" onclick="logout()">Log out</button>`;
    } else if (banned) {
        if (isCurrentUserAdmin()) actionsHtml = `<button class="btn btn-outline" onclick="unbanUser('${escapeAttr(username)}')">Unsuspend</button>`;
    } else if (currentUser && isBlocked) {
        actionsHtml = blockedByMe ? `<button class="btn btn-outline" onclick="toggleBlock('${escapeAttr(username)}')">Unblock</button>` : '';
    } else if (currentUser) {
        const f = isFollowing(currentUser, username);
        actionsHtml = f
            ? `<button class="btn btn-outline follow-btn unfollow" onclick="toggleFollow('${escapeAttr(username)}')">Unfollow</button>`
            : `<button class="btn btn-primary follow-btn follow" onclick="toggleFollow('${escapeAttr(username)}')">Follow</button>`;
        actionsHtml += `<button class="btn btn-outline" onclick="openDmWith('${escapeAttr(username)}')">Message</button>`;
        actionsHtml += `<button class="btn btn-danger-outline" onclick="askBlock('${escapeAttr(username)}')">Block</button>`;
    } else {
        actionsHtml = `<button class="btn btn-primary" onclick="requireAuth(()=>toggleFollow('${escapeAttr(username)}'))">Follow</button><button class="btn btn-outline" onclick="requireAuth(()=>openDmWith('${escapeAttr(username)}'))">Message</button>`;
    }
    if (isCurrentUserAdmin() && !isMe && !banned) {
        actionsHtml += `<button class="admin-verify-btn ${verified ? 'on' : ''}" onclick="toggleVerify('${escapeAttr(username)}')">${verified ? 'Remove badge' : 'Give badge'}</button>`;
        if (!isUserAdmin(username)) actionsHtml += `<button class="btn btn-danger-outline" onclick="openBanModal('${escapeAttr(username)}')">Suspend</button>`;
    }
    actions.innerHTML = actionsHtml;
    const pickerEl = document.getElementById('pvBadgeColorPicker');
    const currentColorKey = (user.badgeColor && BADGE_COLORS[user.badgeColor]) ? user.badgeColor : 'cyan';
    if (isCurrentUserAdmin() && !banned && verified && !isMe) {
        pickerEl.innerHTML = `<div class="badge-color-picker"><div class="badge-color-label">Badge color</div><div class="badge-color-row">${Object.keys(BADGE_COLORS).map(k => `<div class="badge-color-dot ${k} ${currentColorKey === k ? 'selected' : ''}" onclick="setBadgeColor('${escapeAttr(username)}','${k}')" title="${BADGE_COLORS[k].label}"></div>`).join('')}</div></div>`;
    } else if (isCurrentUserAdmin() && isMe && verified && !banned) {
        pickerEl.innerHTML = `<div class="badge-color-picker"><div class="badge-color-label">Your badge color</div><div class="badge-color-row">${Object.keys(BADGE_COLORS).map(k => `<div class="badge-color-dot ${k} ${currentColorKey === k ? 'selected' : ''}" onclick="setBadgeColor('${escapeAttr(username)}','${k}')" title="${BADGE_COLORS[k].label}"></div>`).join('')}</div></div>`;
    } else pickerEl.innerHTML = '';
    renderProfileContent();
    if (!isRestoring) {
        const pc = document.getElementById('profileContent');
        if (pc) pc.scrollTop = 0;
    }
}
function renderProfileContent() {
    if (!viewingUser) return;
    const el = document.getElementById('profilePosts');
    if (isUserBanned(viewingUser)) {
        el.innerHTML = `<div class="empty"><strong>This account is suspended</strong></div>`;
        return;
    }
    let posts = read(DB.posts).filter(p => p.username === viewingUser);
    if (viewingUser !== currentUser && isBlockedBetween(viewingUser)) posts = [];
    posts.sort((a, b) => b.createdAt - a.createdAt);
    if (!posts.length) {
        el.innerHTML = `<div class="empty"><strong>No vibes yet</strong></div>`;
        return;
    }
    el.innerHTML = posts.map(p => renderPost(p, true, false)).join('');
}
function askBlock(target) {
    openConfirm('Block', 'Block ' + displayNameOf(target) + '?', '', () => toggleBlock(target), true);
}

// ───────────────────────── CONNECTIONS ─────────────────────────
function openConnections(username, type) {
    const user = getUserData(username);
    if (!user) return;
    pushView();
    connUser = username;
    connType = type;
    showOnlyView('connectionsView');
    document.getElementById('connTitle').textContent = type === 'followers' ? 'Followers' : 'Following';
    renderConnections();
}
function renderConnections() {
    const el = document.getElementById('connectionsContent');
    let list = connType === 'followers' ? followersOf(connUser) : followingList(connUser);
    if (currentUser) list = list.filter(u => !isBlockedBetween(u));
    list = list.filter(u => !isUserBanned(u));
    if (!list.length) { el.innerHTML = `<div class="empty"><strong>Empty</strong></div>`; return; }
    el.innerHTML = list.map(u => {
        if (!getUserData(u)) return '';
        const iFollow = currentUser && u !== currentUser && isFollowing(currentUser, u);
        const isMe = u === currentUser;
        const btn = isMe ? '' : iFollow
            ? `<button class="follow-btn unfollow" onclick="toggleFollow('${escapeAttr(u)}')">Unfollow</button>`
            : `<button class="follow-btn follow" onclick="requireAuth(()=>toggleFollow('${escapeAttr(u)}'))">Follow</button>`;
        return `<div class="user-row">${avatarSimple(u, 'md')}<div class="user-row-info" onclick="openProfileView('${escapeAttr(u)}')"><div class="user-row-name">${escapeHtml(displayNameOf(u))}${verifiedInline(u)}</div><div class="user-row-handle">@${escapeHtml(u)}</div></div>${btn}</div>`;
    }).join('');
}

// ───────────────────────── FOLLOW / BLOCK ─────────────────────────
function toggleFollow(target) {
    if (!currentUser || target === currentUser) return;
    if (isBlockedBetween(target)) { showToast('Not possible'); return; }
    if (isUserBanned(target)) { showToast('User is suspended'); return; }
    const users = read(DB.users);
    const me = users.find(u => u.username === currentUser);
    const t = users.find(u => u.username === target);
    if (!me || !t) return;
    if (!Array.isArray(me.following)) me.following = [];
    const i = me.following.indexOf(target);
    const isFollow = i === -1;
    if (isFollow) { me.following.push(target); showToast('Following ' + displayNameOf(target)); addNotification('follow', target, currentUser); }
    else { me.following.splice(i, 1); showToast('Unfollowed'); addNotification('unfollow', target, currentUser); }
    write(DB.users, users);
    supaToggleFollow(target, isFollow);
    if (!document.getElementById('connectionsView').classList.contains('hidden')) renderConnections();
    else if (viewingUser) openProfileViewInternal(viewingUser, true);
}
function toggleBlock(target) {
    if (!currentUser || target === currentUser) return;
    const list = getBlocks(currentUser);
    const i = list.indexOf(target);
    const isBlock = i === -1;
    if (isBlock) { list.push(target); saveBlocks(currentUser, list); showToast('Blocked'); }
    else { list.splice(i, 1); saveBlocks(currentUser, list); showToast('Unblocked'); }
    supaToggleBlock(target, isBlock);
    if (isBlock) {
        const users = read(DB.users);
        const me = users.find(u => u.username === currentUser);
        const t = users.find(u => u.username === target);
        if (me && Array.isArray(me.following)) {
            const j = me.following.indexOf(target);
            if (j !== -1) me.following.splice(j, 1);
        }
        if (t && Array.isArray(t.following)) {
            const j = t.following.indexOf(currentUser);
            if (j !== -1) t.following.splice(j, 1);
        }
        write(DB.users, users);
    }
    if (viewingUser) openProfileViewInternal(viewingUser, true);
}

// ───────────────────────── NOTIFICATIONS ─────────────────────────
function openNotifications() {
    pushView();
    showOnlyView('notificationsView');
    currentNotifTab = 'follows';
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.toggle('active', t.dataset.ntab === 'follows'));
    renderNotifications();
    markNotifTabRead('follows');
}
function switchNotifTab(tab) {
    currentNotifTab = tab;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.toggle('active', t.dataset.ntab === tab));
    renderNotifications();
    markNotifTabRead(tab);
}
function markNotifTabRead(tab) {
    const typeMap = { follows: 'follow', unfollows: 'unfollow', replies: 'reply', likes: 'like', mentions: 'mention' };
    const type = typeMap[tab];
    if (!type) return;
    const list = read(DB.notifs);
    let changed = false;
    list.forEach(n => {
        if (n.to !== currentUser || n.read) return;
        const match = type === 'mention' ? (n.type === 'mention' || n.type === 'quote') : n.type === type;
        if (match) { n.read = true; changed = true; }
    });
    if (changed) {
        write(DB.notifs, list);
        if (supaUserId) {
            const types = type === 'mention' ? ['mention', 'quote'] : [type];
            supa.from('notifications').update({ is_read: true }).eq('user_id', supaUserId).in('type', types).eq('is_read', false).then(() => { });
        }
    }
    updateNotifBadge();
}
function renderNotifications() {
    const el = document.getElementById('notifList');
    const typeMap = { follows: 'follow', unfollows: 'unfollow', replies: 'reply', likes: 'like', mentions: 'mention' };
    let list = myNotifications(typeMap[currentNotifTab]);
    if (currentUser) list = list.filter(n => !isBlockedBetween(n.from));
    list = list.filter(n => !isUserBanned(n.from));
    if (!list.length) { el.innerHTML = `<div class="notif-empty">Nothing here yet</div>`; return; }
    el.innerHTML = list.map(n => {
        const fromName = displayNameOf(n.from);
        let text = '', preview = '';
        if (n.type === 'follow') text = `<b>${escapeHtml(fromName)}</b> followed you`;
        else if (n.type === 'unfollow') text = `<b>${escapeHtml(fromName)}</b> unfollowed you`;
        else if (n.type === 'reply') { text = `<b>${escapeHtml(fromName)}</b> replied to your vibe`; if (n.text) preview = escapeHtml(n.text); }
        else if (n.type === 'like') text = `<b>${escapeHtml(fromName)}</b> liked your vibe`;
        else if (n.type === 'mention') { text = `<b>${escapeHtml(fromName)}</b> mentioned you`; if (n.text) preview = escapeHtml(n.text); }
        else if (n.type === 'quote') { text = `<b>${escapeHtml(fromName)}</b> quoted your vibe`; if (n.text) preview = escapeHtml(n.text); }
        return `<div class="notif-item ${!n.read ? 'unread' : ''}" onclick="openNotifTarget('${escapeAttr(n.from)}','${n.postId ? escapeAttr(n.postId) : ''}')">
      ${avatarSimple(n.from, 'md')}
      <div class="notif-body">
        <div class="notif-text">${text}</div>
        ${preview ? `<div class="notif-preview">${preview}</div>` : ''}
        <span class="notif-time">${timeAgo(n.createdAt)}</span>
      </div>
    </div>`;
    }).join('');
}
function openNotifTarget(from, postId) {
    if (postId && read(DB.posts).find(x => x.id === postId)) { openPostView(postId); return; }
    openProfileView(from);
}

// ───────────────────────── DM ─────────────────────────
function dmKey(a, b) { return [a, b].sort().join('__'); }
function getDmConv(a, b) {
    const all = read(DB.dms, {});
    return all[dmKey(a, b)] || { messages: [] };
}
function saveDmConv(a, b, conv) {
    const all = read(DB.dms, {});
    all[dmKey(a, b)] = conv;
    write(DB.dms, all);
}
function dmConversationsFor(user) {
    const all = read(DB.dms, {});
    const list = [];
    Object.keys(all).forEach(key => {
        if (!key.includes('__')) return;
        const parts = key.split('__');
        if (parts.includes(user)) {
            const other = parts[0] === user ? parts[1] : parts[0];
            const msgs = all[key].messages || [];
            const last = msgs.length ? msgs[msgs.length - 1] : null;
            list.push({
                key, other,
                lastAt: last ? last.createdAt : 0,
                lastText: last ? last.text : '',
                lastFrom: last ? last.from : null
            });
        }
    });
    return list.sort((a, b) => b.lastAt - a.lastAt);
}
function dmUnreadCount() {
    if (!currentUser) return 0;
    const readMap = read(DB.dmRead, {});
    let total = 0;
    dmConversationsFor(currentUser).forEach(c => {
        if (isBlockedBetween(c.other) || isUserBanned(c.other)) return;
        const seen = readMap[c.key + '__' + currentUser] || 0;
        const conv = getDmConv(currentUser, c.other);
        total += (conv.messages || []).filter(m => m.from !== currentUser && m.createdAt > seen).length;
    });
    return total;
}
function updateDmBadge() {
    const badge = document.getElementById('dmBadge');
    if (!badge) return;
    if (!currentUser) { badge.classList.add('hidden'); return; }
    const n = dmUnreadCount();
    if (n > 0) { badge.textContent = n; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}
function openDmList() {
    pushView();
    showOnlyView('dmView');
    renderDmList();
}
function renderDmList() {
    const el = document.getElementById('dmListContent');
    let list = dmConversationsFor(currentUser).filter(c => !isBlockedBetween(c.other) && !isUserBanned(c.other));
    if (!list.length) {
        el.innerHTML = `<div class="empty"><strong>No messages yet</strong>Go to someone's profile and send a message</div>`;
        return;
    }
    const readMap = read(DB.dmRead, {});
    el.innerHTML = list.map(c => {
        const seen = readMap[c.key + '__' + currentUser] || 0;
        const conv = getDmConv(currentUser, c.other);
        const unread = (conv.messages || []).filter(m => m.from !== currentUser && m.createdAt > seen).length;
        const prefix = c.lastFrom === currentUser ? 'You: ' : '';
        return `<div class="dm-user-row" data-other="${escapeAttr(c.other)}" oncontextmenu="event.preventDefault();openDeleteChatModal('${escapeAttr(c.other)}')">
      ${avatarSimple(c.other, 'md')}
      <div class="dm-user-info">
        <div class="dm-user-name">${escapeHtml(displayNameOf(c.other))}${verifiedInline(c.other)}</div>
        <div class="dm-user-last">${prefix}${escapeHtml(c.lastText || '')}</div>
      </div>
      <div class="dm-user-meta">
        <span class="dm-user-time">${c.lastAt ? timeAgo(c.lastAt) : ''}</span>
        ${unread > 0 ? `<span class="dm-unread-dot">${unread}</span>` : ''}
      </div>
    </div>`;
    }).join('');
    document.querySelectorAll('.dm-user-row').forEach(row => {
        let holdTimer = null;
        row.addEventListener('touchstart', () => {
            holdTimer = setTimeout(() => {
                row.classList.add('holding');
                if (navigator.vibrate) navigator.vibrate(30);
                openDeleteChatModal(row.dataset.other);
            }, 600);
        }, { passive: true });
        row.addEventListener('touchend', () => {
            if (holdTimer) clearTimeout(holdTimer);
            row.classList.remove('holding');
        });
        row.addEventListener('touchmove', () => {
            if (holdTimer) clearTimeout(holdTimer);
            row.classList.remove('holding');
        });
        row.addEventListener('click', (e) => {
            if (row.classList.contains('holding')) { e.preventDefault(); e.stopPropagation(); return; }
            openDmWith(row.dataset.other);
        });
    });
}
function openDeleteChatModal(other) {
    if (!currentUser) return;
    deleteChatTarget = other;
    document.getElementById('deleteChatText').textContent = `Delete chat with ${displayNameOf(other)}?`;
    document.getElementById('deleteForBoth').checked = false;
    document.getElementById('blockAfterDelete').checked = false;
    document.getElementById('deleteChatModal').classList.add('open');
}
function closeDeleteChatModal() {
    document.getElementById('deleteChatModal').classList.remove('open');
    deleteChatTarget = null;
    document.querySelectorAll('.dm-user-row.holding').forEach(r => r.classList.remove('holding'));
}
async function confirmDeleteChat() {
    if (!deleteChatTarget) return;
    const other = deleteChatTarget;
    const forBoth = document.getElementById('deleteForBoth').checked;
    const block = document.getElementById('blockAfterDelete').checked;
    const key = dmKey(currentUser, other);
    if (forBoth) {
        const ok = await NetLayer.safe(() => supaDeleteDmConv(other), false, { tag: 'dm-del' });
        if (!ok) { showToast('Failed to delete'); return; }
        const all = read(DB.dms, {});
        delete all[key];
        write(DB.dms, all);
    } else {
        const ok = await NetLayer.safe(() => supaClearDmMsgs(other), false, { tag: 'dm-clear' });
        if (!ok) { showToast('Failed to clear'); return; }
        const all = read(DB.dms, {});
        if (all[key]) { all[key].messages = []; write(DB.dms, all); }
    }
    if (block && !iBlocked(other)) toggleBlock(other);
    closeDeleteChatModal();
    renderDmList();
    updateDmBadge();
    showToast('Chat deleted');
}
function openDmWith(target, isRestoring) {
    if (!currentUser || target === currentUser) return;
    if (isBlockedBetween(target)) { showToast('Not possible'); return; }
    if (isUserBanned(target)) { showToast('User is suspended'); return; }
    markOnline();
    if (!isRestoring) pushView();
    activeDmUser = target;
    cancelDmReply();
    const u = getUserData(target);
    const av = document.getElementById('dmAvatar');
    if (u && isSafeImageSrc(u.avatar)) {
        av.style.background = '#fff';
        av.innerHTML = `<img src="${escapeHtml(safeImageSrc(u.avatar))}" alt="">`;
    } else if (u && isEmojiAvatar(u.avatar)) {
        av.style.background = gradFor(target);
        av.innerHTML = '';
        av.textContent = u.avatar;
    } else {
        av.style.background = gradFor(target);
        av.innerHTML = '';
        av.textContent = (displayNameOf(target) || target).slice(0, 1).toUpperCase();
    }
    document.getElementById('dmName').innerHTML = `${escapeHtml(displayNameOf(target))}${verifiedInline(target)}`;
    document.getElementById('dmHandle').textContent = '@' + target;
    showOnlyView('dmChatView');
    renderDmBody();
    markDmRead();
    setTimeout(() => {
        const b = document.getElementById('dmBody');
        if (b) b.scrollTop = b.scrollHeight;
    }, 100);
}
function openProfileViewFromDm() {
    if (!activeDmUser) return;
    openProfileView(activeDmUser);
}
function renderDmBody(scrollBottom) {
    if (!activeDmUser) return;
    const body = document.getElementById('dmBody');
    const conv = getDmConv(currentUser, activeDmUser);
    const msgs = (conv.messages || []).slice().sort((a, b) => a.createdAt - b.createdAt);
    if (!msgs.length) { body.innerHTML = `<div class="chat-empty">No messages yet</div>`; return; }
    const byId = {};
    msgs.forEach(m => { byId[m.id] = m; });
    const readMap = read(DB.dmRead, {});
    const mySupaId = supaUserId || (getUserData(currentUser) && getUserData(currentUser)._supaId);
    let otherRead = 0;
    if (conv.user1Id && conv.user2Id && mySupaId) {
        otherRead = (mySupaId === conv.user1Id) ? (conv.user2LastRead || 0) : (conv.user1LastRead || 0);
    } else {
        otherRead = readMap[dmKey(currentUser, activeDmUser) + '__' + activeDmUser] || 0;
    }
    const atBottom = scrollBottom === true || (body.scrollHeight - body.scrollTop - body.clientHeight < 100);
    body.innerHTML = msgs.map(m => {
        const mine = m.from === currentUser;
        let quoteHtml = '';
        if (m.replyTo && byId[m.replyTo]) {
            const q = byId[m.replyTo];
            const qBlocked = iBlocked(q.from) || blocksMe(q.from);
            if (qBlocked) quoteHtml = `<div class="chat-quote-inline blocked">blocked</div>`;
            else {
                const qLabel = q.from === currentUser ? 'You' : displayNameOf(q.from);
                quoteHtml = `<div class="chat-quote-inline" onclick="scrollToMsg('${escapeAttr(q.id)}')"><span class="q-label">Reply to ${escapeHtml(qLabel)}</span><div class="q-text">${escapeHtml(q.text)}</div></div>`;
            }
        }
        const isPending = !!m._pending;
        const isFailed = !!m._failed;
        const seen = mine && !isPending && !isFailed && m.createdAt <= otherRead;
        let tickHtml = '';
        if (mine) {
            if (isPending) tickHtml = `<span class="chat-tick sending">${spinnerSVG()}</span>`;
            else if (isFailed) tickHtml = `<span class="chat-tick failed" onclick="retryDmMsg('${escapeAttr(m.id)}')" title="Retry">${failedSVG()}</span>`;
            else if (seen) tickHtml = `<span class="chat-tick seen">${tickDoubleSVG()}</span>`;
            else tickHtml = `<span class="chat-tick">${tickSingleSVG()}</span>`;
        }
        return `<div class="chat-msg ${mine ? 'mine' : ''}" data-msg-id="${escapeAttr(m.id)}">
      ${avatarDm(m.from, 'sm')}
      <div class="chat-bubble-wrap">
        <span class="chat-name" onclick="event.stopPropagation();openProfileFromDm('${escapeAttr(m.from)}')">${escapeHtml(displayNameOf(m.from))}${verifiedInline(m.from)}</span>
        <div class="chat-bubble" id="bubble-${escapeAttr(m.id)}" dir="auto">${quoteHtml}<div>${renderMentions(escapeHtml(m.text))}</div></div>
        <div class="chat-meta">${tickHtml}<span class="chat-time">${clockTime(m.createdAt)}</span></div>
      </div>
      <button class="chat-reply-btn" onclick="startDmReply('${escapeAttr(m.id)}')" title="Reply" aria-label="Reply"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
    </div>`;
    }).join('');
    if (atBottom) body.scrollTop = body.scrollHeight;
}
function retryDmMsg(msgId) {
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const all = read(DB.dms, {});
    const key = dmKey(currentUser, activeDmUser);
    const conv = all[key];
    if (!conv) return;
    const msg = (conv.messages || []).find(m => m.id === msgId);
    if (!msg) return;
    msg._pending = true;
    delete msg._failed;
    write(DB.dms, all);
    renderDmBody(true);
    (async () => {
        const sup = await NetLayer.safe(() => supaSendDm(activeDmUser, msg.text, msg.replyTo || null), null, { tag: 'retry-dm' });
        const all2 = read(DB.dms, {});
        const c2 = all2[key];
        if (c2 && c2.messages) {
            const m = c2.messages.find(x => x.id === msgId);
            if (m) {
                if (sup) { m.id = sup.id; m.createdAt = new Date(sup.created_at).getTime(); markSent(m); }
                else markFailed(m);
            }
            write(DB.dms, all2);
        }
        renderDmBody(true);
    })();
}
function startDmReply(id) {
    const conv = getDmConv(currentUser, activeDmUser);
    const m = (conv.messages || []).find(x => x.id === id);
    if (!m) return;
    dmReplyingTo = id;
    document.getElementById('dmReplyBar').classList.remove('hidden');
    document.getElementById('dmReplyBarText').innerHTML = `Replying to <span class="q-user">${escapeHtml(displayNameOf(m.from))}</span>`;
    document.getElementById('dmInput').focus();
}
function cancelDmReply() {
    dmReplyingTo = null;
    document.getElementById('dmReplyBar').classList.add('hidden');
}
async function sendDm() {
    if (!activeDmUser) return;
    if (networkStatus === 'offline') { showToast('You are offline. Cannot send.'); return; }
    const input = document.getElementById('dmInput');
    const text = input.value.trim();
    if (!text) return;
    markOnline();
    const replyId = dmReplyingTo;
    const tempId = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const conv = getDmConv(currentUser, activeDmUser);
    conv.messages = conv.messages || [];
    conv.messages.push({
        id: tempId, from: currentUser, text, createdAt: Date.now(),
        replyTo: replyId, _pending: true
    });
    saveDmConv(currentUser, activeDmUser, conv);
    notifyMentions(text, null, 'dm');
    input.value = '';
    input.style.height = 'auto';
    cancelDmReply();
    renderDmBody(true);
    markDmRead();
    const sup = await NetLayer.safe(() => supaSendDm(activeDmUser, text, replyId), null, { tag: 'dm-send' });
    const all = read(DB.dms, {});
    const key = dmKey(currentUser, activeDmUser);
    if (all[key] && all[key].messages) {
        const m = all[key].messages.find(x => x.id === tempId);
        if (m) {
            if (sup) { m.id = sup.id; m.createdAt = new Date(sup.created_at).getTime(); markSent(m); }
            else markFailed(m);
        }
        write(DB.dms, all);
    }
    renderDmBody(true);
}
async function markDmRead() {
    if (!activeDmUser) return;
    const key = dmKey(currentUser, activeDmUser);
    const all = read(DB.dmRead, {});
    all[key + '__' + currentUser] = Date.now();
    write(DB.dmRead, all);
    updateDmBadge();
    try {
        const conv = getDmConv(currentUser, activeDmUser);
        if (!conv._supaId) return;
        const uid = supaUserId || await supaGetUserId(currentUser);
        const oid = await supaGetUserId(activeDmUser);
        if (!uid || !oid) return;
        const [a] = [uid, oid].sort();
        const field = uid === a ? 'user1_last_read' : 'user2_last_read';
        await supa.from('dm_conversations').update({ [field]: new Date().toISOString() }).eq('id', conv._supaId);
    } catch (e) { }
}
function openProfileFromChat(username) { openProfileView(username); }
function openProfileFromDm(username) { openProfileView(username); }

// ───────────────────────── PUBLIC CHAT ─────────────────────────
function openChat() {
    if (currentUser) markOnline();
    pushView();
    showOnlyView('chatView');
    cancelReply();
    renderOnlineBar();
    renderChat(true);
}
function renderChat(forceScroll, scrollBottom) {
    cleanupExpired();
    const body = document.getElementById('chatBody');
    if (!body) return;
    const allMsgs = read(DB.chat).sort((a, b) => a.createdAt - b.createdAt);
    const byId = {};
    allMsgs.forEach(m => { byId[m.id] = m; });
    let msgs = allMsgs;
    if (currentUser) msgs = msgs.filter(m => !isBlockedBetween(m.username));
    msgs = msgs.filter(m => !isUserBanned(m.username));
    if (!msgs.length) { body.innerHTML = `<div class="chat-empty">No messages yet</div>`; return; }
    const atBottom = forceScroll || scrollBottom === true || (body.scrollHeight - body.scrollTop - body.clientHeight < 100);
    body.innerHTML = msgs.map(m => {
        const mine = m.username === currentUser;
        let quoteHtml = '';
        if (m.replyTo && byId[m.replyTo]) {
            const q = byId[m.replyTo];
            const qBlocked = iBlocked(q.username) || blocksMe(q.username);
            if (qBlocked) quoteHtml = `<div class="chat-quote-inline blocked">blocked</div>`;
            else {
                const qLabel = q.username === currentUser ? 'You' : displayNameOf(q.username);
                quoteHtml = `<div class="chat-quote-inline" onclick="scrollToMsg('${escapeAttr(q.id)}')"><span class="q-label">Reply to ${escapeHtml(qLabel)}</span><div class="q-text">${escapeHtml(q.text)}</div></div>`;
            }
        }
        const isPending = !!m._pending;
        const isFailed = !!m._failed;
        let tickHtml = '';
        if (mine) {
            if (isPending) tickHtml = `<span class="chat-tick sending">${spinnerSVG()}</span>`;
            else if (isFailed) tickHtml = `<span class="chat-tick failed" onclick="retryChatMsg('${escapeAttr(m.id)}')" title="Retry">${failedSVG()}</span>`;
        }
        return `<div class="chat-msg ${mine ? 'mine' : ''}" data-msg-id="${escapeAttr(m.id)}">
      ${avatarChat(m.username, 'sm')}
      <div class="chat-bubble-wrap">
        <span class="chat-name" onclick="event.stopPropagation();openProfileFromChat('${escapeAttr(m.username)}')">${escapeHtml(displayNameOf(m.username))}${verifiedInline(m.username)}</span>
        <div class="chat-bubble" id="bubble-${escapeAttr(m.id)}" dir="auto">${quoteHtml}<div>${renderMentions(escapeHtml(m.text))}</div></div>
        <div class="chat-meta">${tickHtml}<span class="chat-time">${clockTime(m.createdAt)}</span></div>
      </div>
      <button class="chat-reply-btn" onclick="startReply('${escapeAttr(m.id)}')" title="Reply" aria-label="Reply"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
    </div>`;
    }).join('');
    if (atBottom) body.scrollTop = body.scrollHeight;
}
function scrollToMsg(msgId) {
    const bubble = document.getElementById('bubble-' + msgId);
    if (!bubble) return;
    bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
    bubble.classList.add('highlight');
    setTimeout(() => bubble.classList.remove('highlight'), 1500);
}
function startReply(id) {
    const m = read(DB.chat).find(x => x.id === id);
    if (!m) return;
    replyingTo = id;
    document.getElementById('replyBar').classList.remove('hidden');
    document.getElementById('replyBarText').innerHTML = `Replying to <span class="q-user">${escapeHtml(displayNameOf(m.username))}</span>`;
    document.getElementById('chatInput').focus();
}
function cancelReply() {
    replyingTo = null;
    document.getElementById('replyBar').classList.add('hidden');
}
function retryChatMsg(msgId) {
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const msgs = read(DB.chat);
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;
    msg._pending = true;
    delete msg._failed;
    write(DB.chat, msgs);
    renderChat(false);
    (async () => {
        const sup = await NetLayer.safe(() => supaSendChat(msg.text, msg.replyTo || null), null, { tag: 'retry-chat' });
        const msgs2 = read(DB.chat);
        const m = msgs2.find(x => x.id === msgId);
        if (m) {
            if (sup) {
                m.id = sup.id;
                m.createdAt = new Date(sup.created_at).getTime();
                m.expiresAt = m.createdAt + 86400000;
                markSent(m);
            } else markFailed(m);
        }
        write(DB.chat, msgs2);
        renderChat(false);
    })();
}
async function sendChat() {
    if (networkStatus === 'offline') { showToast('You are offline. Cannot send.'); return; }
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    if (isUserBanned(currentUser)) { showToast('Account suspended'); return; }
    markOnline();
    const replyId = replyingTo;
    const tempId = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const msgs = read(DB.chat);
    msgs.push({
        id: tempId, username: currentUser, text,
        createdAt: Date.now(), expiresAt: Date.now() + 86400000,
        replyTo: replyId, _pending: true
    });
    write(DB.chat, msgs);
    notifyMentions(text, null, 'chat');
    input.value = '';
    input.style.height = 'auto';
    cancelReply();
    renderChat(true);
    renderOnlineBar();
    const sup = await NetLayer.safe(() => supaSendChat(text, replyId), null, { tag: 'chat-send' });
    const msgs2 = read(DB.chat);
    const m = msgs2.find(x => x.id === tempId);
    if (m) {
        if (sup) {
            m.id = sup.id;
            m.createdAt = new Date(sup.created_at).getTime();
            m.expiresAt = m.createdAt + 86400000;
            markSent(m);
        } else markFailed(m);
    }
    write(DB.chat, msgs2);
    renderChat(false);
}
function getOnlineUsers() {
    const now = Date.now();
    const users = read(DB.users);
    const local = read(DB.online, {});
    return users.filter(u => {
        if (isUserBanned(u.username)) return false;
        if (currentUser && u.username !== currentUser && isBlockedBetween(u.username)) return false;
        const latest = Math.max(u.lastSeen || 0, local[u.username] || 0);
        return (now - latest) < ONLINE_TIMEOUT;
    }).map(u => u.username).sort((a, b) => ((getUserData(b) || {}).lastSeen || 0) - ((getUserData(a) || {}).lastSeen || 0));
}
function renderOnlineBar() {
    const bar = document.getElementById('onlineBar');
    const toggleBtn = document.getElementById('onlineToggleBtn');
    if (!bar) return;
    const closed = localStorage.getItem('zmz_online_closed');
    if (closed !== '0') {
        bar.classList.add('hidden');
        bar.innerHTML = '';
        if (toggleBtn) toggleBtn.classList.remove('active');
        return;
    }
    if (toggleBtn) toggleBtn.classList.add('active');
    const list = getOnlineUsers();
    if (!list.length) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `
    <button class="online-bar-close" onclick="closeOnlineBar()" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <span class="online-bar-label">${list.length} online</span>
    <div class="online-avatars">
      ${list.map(u => {
        const user = getUserData(u);
        let inner;
        if (user && isSafeImageSrc(user.avatar)) inner = `<img src="${escapeHtml(safeImageSrc(user.avatar))}" alt="">`;
        else if (user && isEmojiAvatar(user.avatar)) inner = escapeHtml(user.avatar);
        else inner = escapeHtml((displayNameOf(u) || u).slice(0, 1).toUpperCase());
        const bg = (user && isSafeImageSrc(user.avatar)) ? '#fff' : gradFor(u);
        return `<div class="online-user" onclick="event.stopPropagation();openProfileFromChat('${escapeAttr(u)}')" title="@${escapeAttr(u)}">
          <div class="online-avatar" style="background:${bg}">${inner}</div>
          <span class="online-name">@${escapeHtml(u)}${u === currentUser ? ' (you)' : ''}</span>
        </div>`;
    }).join('')}
    </div>`;
}
function closeOnlineBar() {
    localStorage.setItem('zmz_online_closed', '1');
    renderOnlineBar();
}
function toggleOnlineBar() {
    const c = localStorage.getItem('zmz_online_closed');
    if (c === '0') localStorage.setItem('zmz_online_closed', '1');
    else localStorage.setItem('zmz_online_closed', '0');
    renderOnlineBar();
}
function markOnline() {
    if (!currentUser) return;
    const all = read(DB.online, {});
    all[currentUser] = Date.now();
    write(DB.online, all);
    supaMarkOnline();
}

// ───────────────────────── AUTH ─────────────────────────
function switchAuth(mode) {
    authMode = mode;
    document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
    document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
    document.getElementById('authBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
    document.getElementById('authMsg').textContent = '';
}
function requireAuth(action) {
    if (currentUser) return action();
    pendingAction = action;
    openAuthModal();
}
function openAuthModal() {
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authMsg').textContent = '';
    switchAuth('login');
    pushView();
    showOnlyView('loginView');
    setTimeout(() => document.getElementById('authUsername').focus(), 100);
}
function closeAuthModal() { pendingAction = null; goBack(); }
async function submitAuth() {
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    const password = document.getElementById('authPassword').value;
    const msg = document.getElementById('authMsg');
    const btn = document.getElementById('authBtn');
    if (username.length < 3) { msg.textContent = 'Username must be at least 3 characters'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { msg.textContent = 'Only letters, numbers and _'; return; }
    if (password.length < 8) { msg.textContent = 'Password must be at least 8 characters'; return; }
    if (!/^[a-zA-Z0-9]+$/.test(password)) { msg.textContent = 'Password: only English letters and numbers'; return; }

    btn.disabled = true;
    btn.textContent = 'Loading...';
    let user, error;
    if (authMode === 'register') {
        const r = await supaRegister(username, password);
        user = r.user; error = r.error;
        if (user) await new Promise(res => setTimeout(res, 800));
    } else {
        const r = await supaLogin(username, password);
        user = r.user; error = r.error;
    }
    if (error) {
        msg.textContent = error;
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
        return;
    }
    supaUserId = user.id;
    currentUser = username;
    write(DB.session, { username });
    await new Promise(res => setTimeout(res, 300));
    const { data: prof } = await supa.from('profiles').select('is_banned,ban_reason').eq('id', user.id).maybeSingle();
    if (prof && prof.is_banned) {
        msg.textContent = 'Account suspended. Reason: ' + (prof.ban_reason || '—');
        await supaLogout();
        btn.disabled = false;
        btn.textContent = 'Login';
        return;
    }
    if (!prof) await new Promise(res => setTimeout(res, 800));
    await supaSyncAll(true);
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
    viewStack = [];
    showFeedView();
    showToast('Welcome ' + displayNameOf(currentUser));
    document.getElementById('guestBanner').classList.add('hidden');
    markOnline();
    updatePostButtonState();
    updateNotifBadge();
    updateDmBadge();
    updateReportsBadge();
    renderFeed();
    startOnlineInterval();
    RealtimeManager.subscribe();
    startPolling();
    if (pendingAction) { const a = pendingAction; pendingAction = null; a(); }
}
async function logout() {
    await supaLogout();
    localStorage.removeItem(DB.session);
    if (onlineIntervalId) { clearInterval(onlineIntervalId); onlineIntervalId = null; }
    stopPolling();
    viewStack = [];
    activeDmUser = null;
    document.getElementById('guestBanner').classList.remove('hidden');
    RealtimeManager.unsubscribe();
    showFeedView();
    updatePostButtonState();
    updateReportsBadge();
    showToast('Logged out');
}
function startOnlineInterval() {
    if (onlineIntervalId) clearInterval(onlineIntervalId);
    if (!currentUser) return;
    onlineIntervalId = setInterval(async () => {
        if (!currentUser) return;
        markOnline();
        await supaFetchOnlineOnly();
        if (!document.getElementById('chatView').classList.contains('hidden')) renderOnlineBar();
        updateNotifBadge();
        updateDmBadge();
        updateReportsBadge();
    }, 25000);
}

// ───────────────────────── SEARCH ─────────────────────────
function openSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = `<div class="search-hint">Type a username to find someone</div>`;
    pushView();
    showOnlyView('searchView');
    setTimeout(() => document.getElementById('searchInput').focus(), 100);
}
function doSearch(query) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => doSearchNow(query), 180);
}
function doSearchNow(query) {
    const el = document.getElementById('searchResults');
    const q = query.trim().toLowerCase();
    if (q.length < 2) { el.innerHTML = `<div class="search-hint">Type a username to find someone</div>`; return; }
    let users = read(DB.users).filter(u => u.username.toLowerCase().includes(q));
    if (currentUser) users = users.filter(u => {
        if (u.username === currentUser) return true;
        if (isBlockedBetween(u.username)) return u.username.toLowerCase() === q;
        return true;
    });
    if (!users.length) { el.innerHTML = `<div class="search-empty">No one found</div>`; return; }
    el.innerHTML = users.slice(0, 30).map(u => {
        const blocked = isBlockedBetween(u.username);
        const blockedByMe = iBlocked(u.username);
        let typeLabel, typeClass;
        if (blocked) { typeLabel = blockedByMe ? 'You blocked' : 'Blocked you'; typeClass = 'blocked-type'; }
        else { typeLabel = userTypeLabel(u.username); typeClass = userTypeClass(u.username); }
        const actionBtn = blocked && blockedByMe
            ? `<button class="follow-btn follow" style="margin-left:auto;" onclick="event.stopPropagation();quickUnblock('${escapeAttr(u.username)}')">Unblock</button>`
            : '';
        return `<div class="user-row" onclick="openProfileFromSearch('${escapeAttr(u.username)}')">
      ${avatarSimple(u.username, 'md')}
      <div class="user-row-info">
        <div class="user-row-name">${escapeHtml(displayNameOf(u.username))}${verifiedInline(u.username)}</div>
        <div class="user-row-handle">@${escapeHtml(u.username)}</div>
      </div>
      <span class="profile-type ${typeClass}" style="font-size:10.5px;padding:2px 8px;">${typeLabel}</span>
      ${actionBtn}
    </div>`;
    }).join('');
}
function quickUnblock(username) {
    toggleBlock(username);
    doSearchNow(document.getElementById('searchInput').value);
}
function openProfileFromSearch(username) { openProfileView(username); }

// ───────────────────────── REPORTS ─────────────────────────
function updateReportsBadge() {
    const badge = document.getElementById('reportsBadge');
    const btn = document.getElementById('hdrReportsBtn');
    if (!badge || !btn) return;
    if (!isCurrentUserAdmin()) { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');
    const count = groupReports().length;
    if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}
function openReports() {
    if (!isCurrentUserAdmin()) return;
    pushView();
    showOnlyView('reportsView');
    renderReports();
}
function renderReports() {
    const el = document.getElementById('reportsContent');
    const groups = groupReports();
    if (!groups.length) { el.innerHTML = `<div class="empty"><strong>No reports</strong>All clear</div>`; return; }
    const posts = read(DB.posts);
    el.innerHTML = groups.map(g => {
        const post = posts.find(p => p.id === g.postId);
        const postText = post ? (post.text || '(image only)') : 'Vibe deleted';
        const postAuthor = post ? displayNameOf(post.username) : '—';
        return `<div class="report-card">
      <div class="report-card-head">
        <div class="report-card-post" onclick="openReportedPost('${escapeAttr(g.postId)}')">
          <div class="report-card-post-text">${escapeHtml(postText)}</div>
          <div class="report-card-post-author">@${escapeHtml(post ? post.username : '—')} · ${escapeHtml(postAuthor)}</div>
        </div>
        <span class="report-card-count">${g.reports.length} ${g.reports.length === 1 ? 'report' : 'reports'}</span>
      </div>
      <div class="report-reasons">
        ${g.reports.map(r => `<div class="report-reason"><div class="report-reason-user">@${escapeHtml(r.reporter)} · ${timeAgo(r.createdAt)}</div><div class="report-reason-text">${escapeHtml(r.reason)}</div></div>`).join('')}
      </div>
      <div class="report-actions">
        <button class="btn btn-danger" onclick="deleteReportedPost('${escapeAttr(g.postId)}')">Delete vibe</button>
        <button class="btn btn-outline" onclick="dismissReportGroup('${escapeAttr(g.postId)}')">Dismiss</button>
      </div>
    </div>`;
    }).join('');
}
function openReportedPost(postId) {
    if (!read(DB.posts).find(x => x.id === postId)) { showToast('Vibe deleted'); return; }
    openPostView(postId);
}
function deleteReportedPost(postId) {
    if (!isCurrentUserAdmin()) return;
    openConfirm('Delete Vibe', 'Delete this vibe?', 'All reports will be removed too.', async () => {
        write(DB.posts, read(DB.posts).filter(p => p.id !== postId));
        write(DB.reports, getReports().filter(r => r.postId !== postId));
        await Promise.all([supaDeletePost(postId), supaDeleteReportsByPost(postId)]);
        showToast('Vibe deleted');
        renderReports();
        updateReportsBadge();
        if (currentPostId === postId) goBack();
        renderFeed();
    }, true);
}
async function dismissReportGroup(postId) {
    if (!isCurrentUserAdmin()) return;
    write(DB.reports, getReports().filter(r => r.postId !== postId));
    await supaDeleteReportsByPost(postId);
    showToast('Dismissed');
    renderReports();
    updateReportsBadge();
    refreshPost(postId);
}
function openReportModal(postId) {
    if (!currentUser) return;
    if (hasReported(postId)) { showToast('Already reported'); return; }
    reportTargetId = postId;
    document.getElementById('reportReason').value = '';
    document.getElementById('reportHint').textContent = '0 / 300';
    const btn = document.getElementById('reportSubmitBtn');
    btn.disabled = true;
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-ghost');
    document.getElementById('reportModal').classList.add('open');
    setTimeout(() => document.getElementById('reportReason').focus(), 100);
}
function closeReportModal() {
    document.getElementById('reportModal').classList.remove('open');
    reportTargetId = null;
}
function updateReportHint() {
    const el = document.getElementById('reportReason');
    const len = el.value.length;
    document.getElementById('reportHint').textContent = len + ' / 300';
    const btn = document.getElementById('reportSubmitBtn');
    btn.disabled = len < 1;
    if (len < 1) { btn.classList.remove('btn-danger'); btn.classList.add('btn-ghost'); }
    else { btn.classList.remove('btn-ghost'); btn.classList.add('btn-danger'); }
}
async function submitReport() {
    if (!reportTargetId || !currentUser) return;
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const reason = document.getElementById('reportReason').value.trim();
    if (reason.length < 1) { showToast('Reason required'); return; }
    const list = getReports();
    list.push({ id: 'rp_' + Date.now(), postId: reportTargetId, reporter: currentUser, reason, createdAt: Date.now() });
    write(DB.reports, list);
    await supaInsertReport(reportTargetId, reason);
    showToast('Reported');
    closeReportModal();
    refreshPost(reportTargetId);
    updateReportsBadge();
}

// ───────────────────────── BAN / VERIFY ─────────────────────────
function openBanModal(target) {
    if (!isCurrentUserAdmin()) return;
    if (target === currentUser) { showToast("Can't suspend yourself"); return; }
    if (isUserAdmin(target)) { showToast("Can't suspend an admin"); return; }
    if (isUserBanned(target)) { showToast('Already suspended'); return; }
    banTarget = target;
    const u = getUserData(target);
    const av = document.getElementById('banAvatar');
    if (u && isSafeImageSrc(u.avatar)) { av.style.background = '#fff'; av.innerHTML = `<img src="${escapeHtml(safeImageSrc(u.avatar))}" alt="">`; }
    else if (u && isEmojiAvatar(u.avatar)) { av.style.background = gradFor(target); av.innerHTML = ''; av.textContent = u.avatar; }
    else { av.style.background = gradFor(target); av.innerHTML = ''; av.textContent = (displayNameOf(target) || target).slice(0, 1).toUpperCase(); }
    document.getElementById('banName').textContent = displayNameOf(target);
    document.getElementById('banHandle').textContent = '@' + target;
    document.getElementById('banReason').value = '';
    const bbtn = document.getElementById('banSubmitBtn');
    bbtn.disabled = true;
    bbtn.classList.remove('btn-danger');
    bbtn.classList.add('btn-ghost');
    updateBanCounter();
    document.getElementById('banModal').classList.add('open');
    setTimeout(() => document.getElementById('banReason').focus(), 100);
}
function closeBanModal() {
    document.getElementById('banModal').classList.remove('open');
    banTarget = null;
}
function updateBanCounter() {
    const len = document.getElementById('banReason').value.length;
    document.getElementById('banHint').textContent = len + ' / 200';
    const btn = document.getElementById('banSubmitBtn');
    btn.disabled = len < 3;
    if (len < 3) { btn.classList.remove('btn-danger'); btn.classList.add('btn-ghost'); }
    else { btn.classList.remove('btn-ghost'); btn.classList.add('btn-danger'); }
}
async function submitBan() {
    if (!banTarget || !isCurrentUserAdmin()) return;
    if (networkStatus === 'offline') { showToast('You are offline'); return; }
    const reason = document.getElementById('banReason').value.trim();
    if (reason.length < 3) { showToast('Reason too short'); return; }
    const target = banTarget;
    const users = read(DB.users);
    const u = users.find(x => x.username === target);
    if (!u) return;
    u.banned = true;
    u.banReason = reason;
    u.bannedAt = Date.now();
    u.following = [];
    write(DB.users, users);
    const posts = read(DB.posts).filter(p => p.username !== target);
    posts.forEach(p => {
        if (Array.isArray(p.replies)) p.replies = p.replies.filter(r => r.username !== target);
        if (Array.isArray(p.likes)) { const i = p.likes.indexOf(target); if (i !== -1) p.likes.splice(i, 1); }
    });
    write(DB.posts, posts);
    if (u._supaId) supaUpdateProfileById(u._supaId, { is_banned: true, ban_reason: reason, banned_at: new Date().toISOString() });
    showToast('User suspended');
    closeBanModal();
    viewingUser = null;
    viewStack = [];
    showFeedView();
    updateNotifBadge();
    updateDmBadge();
}
function unbanUser(target) {
    if (!isCurrentUserAdmin()) return;
    const name = displayNameOf(target);
    openConfirm('Unsuspend', 'Unsuspend ' + name + '?', 'They can log in again.', () => {
        const users = read(DB.users);
        const u = users.find(x => x.username === target);
        if (!u) return;
        delete u.banned;
        delete u.banReason;
        delete u.bannedAt;
        write(DB.users, users);
        if (u._supaId) supaUpdateProfileById(u._supaId, { is_banned: false, ban_reason: null, banned_at: null });
        showToast('User unsuspended');
        if (viewingUser === target) openProfileViewInternal(target, true);
    });
}
function setBadgeColor(target, colorKey) {
    if (!isCurrentUserAdmin() || !BADGE_COLORS[colorKey]) return;
    const users = read(DB.users);
    const u = users.find(x => x.username === target);
    if (!u) return;
    u.badgeColor = colorKey;
    write(DB.users, users);
    if (u._supaId) supaUpdateProfileById(u._supaId, { badge_color: colorKey });
    showToast('Badge updated');
    if (viewingUser) openProfileViewInternal(viewingUser, true);
    if (!document.getElementById('feedView').classList.contains('hidden')) renderFeed();
}
function toggleVerify(target) {
    if (!isCurrentUserAdmin()) return;
    if (isUserAdmin(target)) { showToast("Can't remove admin badge"); return; }
    if (isUserBanned(target)) { showToast('User is suspended'); return; }
    const users = read(DB.users);
    const u = users.find(x => x.username === target);
    if (!u) return;
    u.verified = !u.verified;
    if (u.verified && !u.badgeColor) u.badgeColor = 'cyan';
    write(DB.users, users);
    if (u._supaId) supaUpdateProfileById(u._supaId, { is_verified: u.verified, badge_color: u.badgeColor });
    showToast(u.verified ? 'Badge given' : 'Badge removed');
    openProfileViewInternal(target, true);
}

// ───────────────────────── EDIT PROFILE / CROP ─────────────────────────
let cropImgObj = null;
let cropNatural = { w: 0, h: 0 };
let cropBaseScale = 1;
let cropZoom = 1;
let cropX = 0, cropY = 0;
let cropDragging = false;
let cropDragStart = { x: 0, y: 0 };
let cropDragOffset = { x: 0, y: 0 };
const CROP_SIZE = 240;

function openEditProfile() {
    const u = getUserData(currentUser);
    if (!u) return;
    pushView();
    editingAvatar = u.avatar || '';
    editingColor = typeof u.avatarBg === 'number' ? u.avatarBg : 0;
    document.getElementById('edDisplay').value = u.displayName || u.username;
    document.getElementById('edBio').value = u.bio || '';
    updateBioHint();
    buildEmojiGrid();
    buildColorRow();
    updateEditAvatar();
    showOnlyView('editProfileView');
}
function updateEditAvatar() {
    const el = document.getElementById('edAvatar');
    const u = getUserData(currentUser);
    if (isSafeImageSrc(editingAvatar)) {
        el.style.background = '#fff';
        el.innerHTML = `<img src="${escapeHtml(safeImageSrc(editingAvatar))}" alt="">`;
    } else if (isEmojiAvatar(editingAvatar)) {
        el.style.background = GRADIENTS[editingColor % GRADIENTS.length];
        el.innerHTML = '';
        el.textContent = editingAvatar;
    } else {
        el.style.background = GRADIENTS[editingColor % GRADIENTS.length];
        el.innerHTML = '';
        const dn = (u && u.displayName) || (u && u.username) || '?';
        el.textContent = dn.slice(0, 1).toUpperCase();
    }
}
function buildEmojiGrid() {
    const grid = document.getElementById('emojiGrid');
    const u = getUserData(currentUser);
    const firstLetter = (((u && u.displayName) || (u && u.username) || '?').slice(0, 1)).toUpperCase();
    const letterSelected = !editingAvatar;
    grid.innerHTML = `<div class="emoji-item letter-item ${letterSelected ? 'selected' : ''}" onclick="pickEmoji('')">${escapeHtml(firstLetter)}</div>`
        + EMOJIS.slice(0, 23).map(e => `<div class="emoji-item ${editingAvatar === e ? 'selected' : ''}" onclick="pickEmoji('${escapeAttr(e)}')">${e}</div>`).join('');
}
function pickEmoji(e) {
    editingAvatar = e;
    buildEmojiGrid();
    updateEditAvatar();
}
function buildColorRow() {
    const row = document.getElementById('colorRow');
    row.innerHTML = GRADIENTS.map((g, i) => `<div class="color-dot ${editingColor === i ? 'selected' : ''}" style="background:${g}" onclick="pickColor(${i})"></div>`).join('');
}
function pickColor(i) {
    editingColor = i;
    buildColorRow();
    updateEditAvatar();
}
function clearAvatar() {
    editingAvatar = '';
    buildEmojiGrid();
    updateEditAvatar();
}
function handleAvatarUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('Image too big'); ev.target.value = ''; return; }
    const reader = new FileReader();
    reader.onerror = () => showToast('Cannot read file');
    reader.onload = e => {
        const img = new Image();
        img.onerror = () => showToast('Format not supported');
        img.onload = () => { cropImgObj = img; openCropModal(); };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
}
function openCropModal() {
    const el = document.getElementById('cropImage');
    el.src = cropImgObj.src;
    el.onload = () => {
        cropNatural = { w: cropImgObj.naturalWidth, h: cropImgObj.naturalHeight };
        cropBaseScale = Math.max(CROP_SIZE / cropNatural.w, CROP_SIZE / cropNatural.h);
        cropZoom = 1;
        const dispW = cropNatural.w * cropBaseScale;
        const dispH = cropNatural.h * cropBaseScale;
        cropX = (CROP_SIZE - dispW) / 2;
        cropY = (CROP_SIZE - dispH) / 2;
        document.getElementById('cropZoom').value = 100;
        applyCropTransform();
    };
    document.getElementById('cropModal').classList.add('open');
}
function applyCropTransform() {
    const el = document.getElementById('cropImage');
    const scale = cropBaseScale * cropZoom;
    el.style.width = cropNatural.w * scale + 'px';
    el.style.height = cropNatural.h * scale + 'px';
    el.style.left = cropX + 'px';
    el.style.top = cropY + 'px';
}
function clampCrop() {
    const scale = cropBaseScale * cropZoom;
    const dispW = cropNatural.w * scale;
    const dispH = cropNatural.h * scale;
    if (cropX > 0) cropX = 0;
    if (cropY > 0) cropY = 0;
    if (cropX + dispW < CROP_SIZE) cropX = CROP_SIZE - dispW;
    if (cropY + dispH < CROP_SIZE) cropY = CROP_SIZE - dispH;
}
function cancelCrop() {
    document.getElementById('cropModal').classList.remove('open');
    cropImgObj = null;
}
function confirmCrop() {
    if (!cropImgObj) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const scale = cropBaseScale * cropZoom;
    const sx = -cropX / scale;
    const sy = -cropY / scale;
    const sSize = CROP_SIZE / scale;
    ctx.drawImage(cropImgObj, sx, sy, sSize, sSize, 0, 0, 400, 400);
    editingAvatar = canvas.toDataURL('image/jpeg', 0.88);
    document.getElementById('cropModal').classList.remove('open');
    cropImgObj = null;
    updateEditAvatar();
}
function setupCropHandlers() {
    const area = document.getElementById('cropArea');
    const slider = document.getElementById('cropZoom');
    area.addEventListener('pointerdown', e => {
        if (!cropImgObj) return;
        cropDragging = true;
        cropDragStart = { x: e.clientX, y: e.clientY };
        cropDragOffset = { x: cropX, y: cropY };
        try { area.setPointerCapture(e.pointerId); } catch (err) { }
    });
    area.addEventListener('pointermove', e => {
        if (!cropDragging) return;
        cropX = cropDragOffset.x + (e.clientX - cropDragStart.x);
        cropY = cropDragOffset.y + (e.clientY - cropDragStart.y);
        clampCrop();
        applyCropTransform();
    });
    area.addEventListener('pointerup', e => {
        cropDragging = false;
        try { area.releasePointerCapture(e.pointerId); } catch (err) { }
    });
    area.addEventListener('pointercancel', () => { cropDragging = false; });
    slider.addEventListener('input', e => {
        if (!cropImgObj) return;
        const newZoom = e.target.value / 100;
        const oldZoom = cropZoom;
        cropZoom = newZoom;
        const cx = CROP_SIZE / 2, cy = CROP_SIZE / 2;
        const ratio = cropZoom / oldZoom;
        cropX = cx - (cx - cropX) * ratio;
        cropY = cy - (cy - cropY) * ratio;
        clampCrop();
        applyCropTransform();
    });
}
function updateBioHint() {
    const len = document.getElementById('edBio').value.length;
    document.getElementById('bioHint').textContent = len + ' / 120';
}
async function saveProfile() {
    const display = document.getElementById('edDisplay').value.trim() || currentUser;
    const bio = document.getElementById('edBio').value.trim().slice(0, 120);
    const users = read(DB.users);
    const u = users.find(x => x.username === currentUser);
    if (!u) return;
    u.displayName = display;
    u.bio = bio;
    u.avatar = editingAvatar;
    u.avatarBg = editingColor;
    write(DB.users, users);
    await NetLayer.safe(() => supaUpdateProfile({ display_name: display, bio: bio, avatar: editingAvatar, avatar_bg: editingColor }), null, { tag: 'save-profile' });
    showToast('Saved');
    viewingUser = currentUser;
    goBack();
}

// ───────────────────────── PULL TO REFRESH ─────────────────────────
function setupPullToRefresh() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    const indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = `<svg class="ptr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg>`;
    const parent = feed.parentElement;
    if (parent) parent.style.position = 'relative';
    feed.parentElement.appendChild(indicator);
    let startY = 0, pulling = false, armed = false;
    const THRESHOLD = 70;
    feed.addEventListener('touchstart', e => {
        if (feed.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        pulling = true;
        armed = false;
    }, { passive: true });
    feed.addEventListener('touchmove', e => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - startY;
        if (dy <= 0) { indicator.classList.remove('visible', 'flipped'); return; }
        const capped = Math.min(dy, 120);
        indicator.classList.add('visible');
        if (capped > THRESHOLD) { indicator.classList.add('flipped'); armed = true; }
        else { indicator.classList.remove('flipped'); armed = false; }
    }, { passive: true });
    feed.addEventListener('touchend', async () => {
        if (!pulling) return;
        pulling = false;
        if (armed) {
            indicator.classList.add('refreshing');
            indicator.classList.remove('flipped');
            try {
                await supaSyncAll(false);
                renderFeed();
                showToast('Refreshed');
            } catch (e) { }
            setTimeout(() => { indicator.classList.remove('visible', 'refreshing'); }, 400);
        } else {
            indicator.classList.remove('visible', 'flipped');
        }
    }, { passive: true });
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS & INIT
// ═══════════════════════════════════════════════════════════
function setupEventListeners() {
    ['cropModal', 'confirmModal', 'premiumModal', 'banModal', 'reportModal', 'deleteChatModal'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', function (e) {
            if (e.target !== this) return;
            if (id === 'cropModal') cancelCrop();
            else if (id === 'confirmModal') closeConfirm();
            else if (id === 'premiumModal') closePremiumModal();
            else if (id === 'banModal') closeBanModal();
            else if (id === 'reportModal') closeReportModal();
            else if (id === 'deleteChatModal') closeDeleteChatModal();
        });
    });
    ['authUsername', 'authPassword'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
    });
    const edBio = document.getElementById('edBio');
    if (edBio) edBio.addEventListener('input', updateBioHint);
    const reportReason = document.getElementById('reportReason');
    if (reportReason) reportReason.addEventListener('input', updateReportHint);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeLightbox();
            closePostMenu();
            if (!document.getElementById('composerView').classList.contains('hidden')) closeComposer();
            else if (document.getElementById('premiumModal').classList.contains('open')) closePremiumModal();
        }
    });
    document.addEventListener('scroll', () => {
        if (postMenuEl) closePostMenu();
    }, true);

    window.addEventListener('online', async () => {
        isOnline = true;
        showToast('Back online');
        setNetworkStatus('online');
        try {
            await supaSyncAll(false);
            rerenderCurrent();
            updateNotifBadge();
            updateDmBadge();
            updateReportsBadge();
            RealtimeManager.subscribe();
            startPolling();
        } catch (e) { }
    });
    window.addEventListener('offline', () => {
        isOnline = false;
        setNetworkStatus('offline');
        showToast('Offline');
    });

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden') {
            backgroundedAt = Date.now();
            return;
        }
        const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
        backgroundedAt = null;
        if (!currentUser) return;
        if (away > BACKGROUND_REINIT_THRESHOLD) {
            await reinitializeApp();
        } else {
            markOnline();
            await supaSyncAll(false);
            rerenderCurrent();
            renderOnlineBar();
            updateNotifBadge();
            updateDmBadge();
            RealtimeManager.subscribe();
            startPolling();
        }
    });

    setInterval(async () => {
        if (!currentUser) return;
        await heartbeat();
    }, HEARTBEAT_INTERVAL);

    setupCropHandlers();
    setupPullToRefresh();
}

// ───────────────────────── SERVICE WORKER ─────────────────────────
function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
            if (!sessionStorage.getItem('sw-reloaded-' + event.data.version)) {
                sessionStorage.setItem('sw-reloaded-' + event.data.version, '1');
                setTimeout(() => window.location.reload(), 500);
            }
        }
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { });
    });
}

// ───────────────────────── PWA INSTALL ─────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('hdrInstallBtn');
    if (btn) btn.classList.remove('hidden');
});
function installPwa() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') {
            const btn = document.getElementById('hdrInstallBtn');
            if (btn) btn.classList.add('hidden');
        }
        deferredPrompt = null;
    });
}

// ───────────────────────── TYPING INDICATOR PLACEHOLDER ─────────────────────────
function broadcastTyping() { /* Placeholder */ }

// ───────────────────────── INIT ─────────────────────────
async function initApp() {
    applyTheme(localStorage.getItem('zmz_theme') || 'light');
    cleanupExpired();
    if (!initSupaClient()) return;

    try {
        const { data: { session } } = await supa.auth.getSession();
        if (session && session.user) {
            const { data: prof } = await supa.from('profiles').select('username,is_banned').eq('id', session.user.id).maybeSingle();
            if (prof && !prof.is_banned) {
                supaUserId = session.user.id;
                currentUser = prof.username;
            } else if (prof && prof.is_banned) await supa.auth.signOut();
        }
    } catch (e) { }

    await supaSyncAll(false);

    setTimeout(() => {
        const splash = document.getElementById('landingScreen');
        if (splash) splash.classList.add('fade-out');
        setTimeout(() => {
            if (splash) splash.classList.add('hidden');
            document.body.classList.remove('loading-lock');
            document.getElementById('mainScreen').classList.remove('hidden');
            showFeedView();
            updatePostButtonState();
            updateNotifBadge();
            updateDmBadge();
            updateReportsBadge();
            if (!currentUser) {
                document.getElementById('guestBanner').classList.remove('hidden');
            } else {
                document.getElementById('guestBanner').classList.add('hidden');
                markOnline();
                startOnlineInterval();
                RealtimeManager.subscribe();
                startPolling();
            }
            setNetworkStatus('online');
            setupAutoHideNav();
        }, 600);
    }, 1500);
}

function setupAutoHideNav() {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    document.addEventListener('scroll', (e) => {
        const target = e.target;
        if (!target || !target.classList) return;
        if (!target.classList.contains('content') &&
            !target.classList.contains('profile-content') &&
            !target.classList.contains('notif-list') &&
            !target.classList.contains('search-results') &&
            !target.classList.contains('chat-body')) return;
        if (window.innerWidth > 620) return;
        const atBottom = (target.scrollHeight - target.scrollTop - target.clientHeight) < 40;
        if (atBottom) nav.classList.add('autohide');
        else nav.classList.remove('autohide');
    }, true);
}

// ───────────────────────── BOOT ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupServiceWorker();
    initApp();
});

// ───────────────────────── EXPOSE GLOBALS ─────────────────────────
window.openReports = openReports;
window.installPwa = installPwa;
window.toggleTheme = toggleTheme;
window.requireAuth = requireAuth;
window.openChat = openChat;
window.openDmList = openDmList;
window.openAuthModal = openAuthModal;
window.switchTab = switchTab;
window.goBack = goBack;
window.openPremiumModal = openPremiumModal;
window.switchNotifTab = switchNotifTab;
window.openProfileView = openProfileView;
window.openPostView = openPostView;
window.openConnections = openConnections;
window.openComposer = openComposer;
window.closeComposer = closeComposer;
window.publishPost = publishPost;
window.updateCounter = updateCounter;
window.autoGrow = autoGrow;
window.videoComingSoon = videoComingSoon;
window.musicComingSoon = musicComingSoon;
window.handlePostImageUpload = handlePostImageUpload;
window.clearComposerImage = clearComposerImage;
window.startQuote = startQuote;
window.clearQuote = clearQuote;
window.toggleLike = toggleLike;
window.toggleSave = toggleSave;
window.confirmDeletePost = confirmDeletePost;
window.togglePostMenu = togglePostMenu;
window.closePostMenu = closePostMenu;
window.copyPostText = copyPostText;
window.downloadPostImage = downloadPostImage;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.toggleNestedReplies = toggleNestedReplies;
window.toggleNestedInput = toggleNestedInput;
window.submitNestedReply = submitNestedReply;
window.submitTopReply = submitTopReply;
window.retryComment = retryComment;
window.confirmDeleteComment = confirmDeleteComment;
window.toggleFollow = toggleFollow;
window.toggleBlock = toggleBlock;
window.askBlock = askBlock;
window.openEditProfile = openEditProfile;
window.saveProfile = saveProfile;
window.clearAvatar = clearAvatar;
window.handleAvatarUpload = handleAvatarUpload;
window.pickEmoji = pickEmoji;
window.pickColor = pickColor;
window.cancelCrop = cancelCrop;
window.confirmCrop = confirmCrop;
window.logout = logout;
window.submitAuth = submitAuth;
window.switchAuth = switchAuth;
window.closeAuthModal = closeAuthModal;
window.doSearch = doSearch;
window.quickUnblock = quickUnblock;
window.openProfileFromSearch = openProfileFromSearch;
window.sendChat = sendChat;
window.sendDm = sendDm;
window.startReply = startReply;
window.cancelReply = cancelReply;
window.startDmReply = startDmReply;
window.cancelDmReply = cancelDmReply;
window.retryChatMsg = retryChatMsg;
window.retryDmMsg = retryDmMsg;
window.scrollToMsg = scrollToMsg;
window.toggleOnlineBar = toggleOnlineBar;
window.closeOnlineBar = closeOnlineBar;
window.openProfileFromChat = openProfileFromChat;
window.openProfileFromDm = openProfileFromDm;
window.openProfileViewFromDm = openProfileViewFromDm;
window.openDeleteChatModal = openDeleteChatModal;
window.closeDeleteChatModal = closeDeleteChatModal;
window.confirmDeleteChat = confirmDeleteChat;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.updateReportHint = updateReportHint;
window.submitReport = submitReport;
window.openBanModal = openBanModal;
window.closeBanModal = closeBanModal;
window.updateBanCounter = updateBanCounter;
window.submitBan = submitBan;
window.unbanUser = unbanUser;
window.setBadgeColor = setBadgeColor;
window.toggleVerify = toggleVerify;
window.openAdminProfile = openAdminProfile;
window.closePremiumModal = closePremiumModal;
window.retryNetwork = retryNetwork;
window.openReportedPost = openReportedPost;
window.deleteReportedPost = deleteReportedPost;
window.dismissReportGroup = dismissReportGroup;
window.openNotifications = openNotifications;
window.updateBioHint = updateBioHint;
window.broadcastTyping = broadcastTyping;