import { auth, db } from '../../src/core/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  ref, get, set, update, remove, onValue, onDisconnect,
  query, orderByChild, equalTo, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

(() => {
  'use strict';

  const ROOM_ROOT = 'soccerRooms';
  const api = {
    user: null,
    displayName: '',
    roomId: null,
    uid: null,
    slot: null,
    host: false,
    room: null,
    callbacks: {},
    unsubs: [],
    inputTimer: null,
    lastInput: null,
    inputSeq: 0
  };

  function emit(name, value) {
    try { api.callbacks[name]?.(value); } catch (e) { console.error('[Soccer Online]', e); }
  }

  function setCallbacks(callbacks) { api.callbacks = callbacks || {}; }

  async function loadDisplayName(user) {
    if (!user) return '';
    try {
      const profileSnap = await get(ref(db, `publicProfiles/${user.uid}`));
      const profile = profileSnap.val() || {};
      const profileName = String(profile.displayName || '').trim();
      if (profileName) return profileName;
    } catch {}
    try {
      const userSnap = await get(ref(db, `users/${user.uid}`));
      const userData = userSnap.val() || {};
      const username = String(userData.username || '').trim();
      if (username) return username;
    } catch {}
    return String(user.displayName || '').trim();
  }

  async function ensureUser() {
    if (!api.user) throw new Error('Bạn cần đăng nhập TienHub để chơi online.');
    if (!api.displayName) api.displayName = await loadDisplayName(api.user);
    if (!api.displayName) api.displayName = 'Player';
    return { uid: api.user.uid, displayName: api.displayName };
  }

  function code6() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'TH' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  function roomRef(roomId) { return ref(db, `${ROOM_ROOT}/${roomId}`); }
  function playersRef(roomId) { return ref(db, `${ROOM_ROOT}/${roomId}/players`); }
  function slotPath(roomId, slot) { return ref(db, `${ROOM_ROOT}/${roomId}/players/${slot}`); }

  function emptySlots() {
    return Array.from({ length: 10 }, (_, i) => ({
      slot: i, team: i < 5 ? 'blue' : 'red', type: 'empty',
      uid: null, displayName: '', number: null, online: false
    }));
  }

  function normalizeRoster(raw) {
    const slots = emptySlots();
    Object.entries(raw || {}).forEach(([key, value]) => {
      const i = Number(key);
      if (!Number.isInteger(i) || i < 0 || i > 9 || !value) return;
      slots[i] = {
        slot: i,
        team: i < 5 ? 'blue' : 'red',
        type: value.type === 'ai' ? 'ai' : 'human',
        uid: value.uid || null,
        displayName: value.displayName || (value.type === 'ai' ? 'AI' : 'Player'),
        number: value.number == null ? null : Number(value.number),
        online: value.type === 'ai' ? true : value.online !== false,
        host: !!value.host
      };
    });
    return slots;
  }

  function clearListeners() {
    api.unsubs.forEach(fn => { try { fn(); } catch {} });
    api.unsubs = [];
    if (api.inputTimer) clearInterval(api.inputTimer);
    api.inputTimer = null;
  }

  async function createRoom({ code, jerseyNumber, duration = 180 }) {
    const me = await ensureUser();
    clearListeners();
    const roomId = String(code || code6()).toUpperCase();
    const existing = await get(roomRef(roomId));
    if (existing.exists()) throw new Error('Mã phòng đã tồn tại. Hãy tạo lại.');

    const slots = emptySlots();
    slots[0] = {
      slot: 0, team: 'blue', type: 'human', uid: me.uid,
      displayName: me.displayName, number: Number(jerseyNumber), online: true, host: true
    };

    const data = {
      game: 'soccer5v5',
      roomId,
      status: 'waiting',
      duration: [180, 300, 420, 600].includes(Number(duration)) ? Number(duration) : 180,
      hostUid: me.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      players: { 0: slots[0] },
      state: null,
      inputs: null
    };
    await set(roomRef(roomId), data);
    api.roomId = roomId; api.uid = me.uid; api.slot = 0; api.host = true;
    await armPresence();
    watchRoom();
    emit('roomCreated', { roomId, host: true });
    return roomId;
  }

  async function getRoomInfo(roomId) {
    await ensureUser();
    roomId = String(roomId || '').trim().toUpperCase();
    if (!roomId) throw new Error('Chưa nhập mã phòng.');
    const snap = await get(roomRef(roomId));
    if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
    const room = snap.val();
    if (room.game !== 'soccer5v5') throw new Error('Mã phòng không phải Soccer 5v5.');
    if (room.status !== 'waiting') throw new Error('Phòng đã bắt đầu hoặc đã kết thúc.');
    const roster = normalizeRoster(room.players);
    if (!roster.some(s => s.type === 'empty')) throw new Error('Phòng đã đủ 10 người.');
    return { room, roster, takenNumbers: roster.map(s => Number(s.number)).filter(Number.isInteger) };
  }

  async function joinRoom(roomId, jerseyNumber) {
    const me = await ensureUser();
    clearListeners();
    roomId = String(roomId || '').trim().toUpperCase();
    if (!roomId) throw new Error('Chưa nhập mã phòng.');
    const snap = await get(roomRef(roomId));
    if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
    const room = snap.val();
    if (room.game !== 'soccer5v5') throw new Error('Mã phòng không phải Soccer 5v5.');
    if (room.status !== 'waiting') throw new Error('Phòng đã bắt đầu hoặc đã kết thúc.');

    const roster = normalizeRoster(room.players);
    const already = roster.find(s => s.uid === me.uid && s.type === 'human');
    // Never let a second device using the same account overwrite the existing
    // player/host slot. That was the cause of the "number 4 becomes host" bug:
    // the old code found the host by UID and updated that slot with the new jersey.
    if (already) {
      if (already.online !== false) {
        throw new Error('Tài khoản này đã ở trong phòng trên một thiết bị khác.');
      }
      // A stale/offline slot can be reclaimed by the same account.
      await remove(slotPath(roomId, already.slot));
    }
    let slot = null;
    {
      const blueCount = roster.filter(s => s.team === 'blue' && s.type !== 'empty').length;
      const redCount = roster.filter(s => s.team === 'red' && s.type !== 'empty').length;
      const preferredTeam = blueCount <= redCount ? 'blue' : 'red';
      slot = roster.findIndex(s => s.type === 'empty' && s.team === preferredTeam);
      if (slot < 0) slot = roster.findIndex(s => s.type === 'empty');
      if (slot < 0) throw new Error('Phòng đã đủ 10 người.');
      const usedNumbers = new Set(roster.map(s => Number(s.number)).filter(Boolean));
      if (usedNumbers.has(Number(jerseyNumber))) throw new Error(`Số áo ${jerseyNumber} đã có trong phòng.`);
      await set(slotPath(roomId, slot), {
        slot, team: slot < 5 ? 'blue' : 'red', type: 'human', uid: me.uid,
        displayName: me.displayName, number: Number(jerseyNumber), online: true, host: false
      });
    }

    // Joining a room can never grant host ownership. Only createRoom sets
    // hostUid, and start/close operations remain restricted to that UID.
    api.roomId = roomId; api.uid = me.uid; api.slot = slot; api.host = room.hostUid === me.uid;
    await armPresence();
    watchRoom();
    emit('joined', { roomId, slot, host: api.host });
    return roomId;
  }

  async function armPresence() {
    if (!api.roomId || api.slot == null) return;
    const presence = slotPath(api.roomId, api.slot);
    await onDisconnect(presence).remove();
    await update(presence, { online: true });
  }

  function watchRoom() {
    clearListeners();
    if (!api.roomId) return;

    const base = `${ROOM_ROOT}/${api.roomId}`;
    const playersNode = ref(db, `${base}/players`);
    const stateNode = ref(db, `${base}/state`);
    const inputsNode = ref(db, `${base}/inputs`);
    const statusNode = ref(db, `${base}/status`);
    const hostNode = ref(db, `${base}/hostUid`);
    const durationNode = ref(db, `${base}/duration`);

    const pushRoom = () => {
      const room = api.room || {};
      const roster = normalizeRoster(room.players);
      const mine = roster.find(s => s.uid === api.uid);
      if (mine) api.slot = mine.slot;
      emit('room', { room, roster });
    };
    const pUnsub = onValue(playersNode, snap => { api.room = api.room || {}; api.room.players = snap.val() || {}; pushRoom(); });
    const statusUnsub = onValue(statusNode, snap => {
      api.room = api.room || {}; api.room.status = snap.val(); pushRoom();
      if (snap.val() === 'finished') emit('finished', null);
    });
    const hostUnsub = onValue(hostNode, snap => { api.room = api.room || {}; api.room.hostUid = snap.val(); api.host = snap.val() === api.uid; pushRoom(); });
    const durationUnsub = onValue(durationNode, snap => { api.room = api.room || {}; api.room.duration = Number(snap.val()) || 180; pushRoom(); });
    const stateUnsub = onValue(stateNode, snap => { const value=snap.val(); if(value) emit('state', value); });
    const inputUnsub = onValue(inputsNode, snap => emit('inputs', snap.val() || {}));
    api.unsubs.push(pUnsub,statusUnsub,hostUnsub,durationUnsub,stateUnsub,inputUnsub);
  }

  async function addAI(slot) {
    if (!api.host || !api.roomId) return;
    const room = api.room || (await get(roomRef(api.roomId))).val();
    if (!room || room.status !== 'waiting') return;
    const roster = normalizeRoster(room.players);
    const s = roster[slot];
    if (!s || s.type !== 'empty') return;
    const used = new Set(roster.map(x => Number(x.number)).filter(Boolean));
    let n = slot + 2;
    while (used.has(n) || n > 99) n++;
    await set(slotPath(api.roomId, slot), {
      slot, team: slot < 5 ? 'blue' : 'red', type: 'ai', uid: `ai-${slot}`,
      displayName: 'AI', number: n, online: true, host: false
    });
  }

  async function switchTeam(targetSlot) {
    if (!api.roomId || api.slot == null) return;
    const roomSnap = await get(roomRef(api.roomId));
    const room = roomSnap.val();
    if (!room || room.status !== 'waiting') throw new Error('Chỉ có thể đổi đội trước khi bắt đầu trận.');

    const roster = normalizeRoster(room.players);
    const current = roster[api.slot];
    const target = roster[Number(targetSlot)];
    if (!current || current.type !== 'human' || current.uid !== api.uid) {
      throw new Error('Không tìm thấy cầu thủ của bạn trong phòng.');
    }
    if (!target || target.type !== 'empty') {
      throw new Error('Slot này vừa được người khác chọn.');
    }
    if (current.team === target.team) {
      throw new Error('Hãy chọn slot trống ở đội còn lại.');
    }

    // The target is written first so the player never disappears from the
    // lobby while switching. Then the old slot is released. hostUid is kept
    // unchanged, so moving the host never transfers room ownership.
    const moved = {
      slot: Number(targetSlot),
      team: Number(targetSlot) < 5 ? 'blue' : 'red',
      type: 'human',
      uid: api.uid,
      displayName: api.displayName,
      number: Number(current.number),
      online: true,
      host: !!api.host
    };
    await set(slotPath(api.roomId, Number(targetSlot)), moved);
    api.slot = Number(targetSlot);
    await armPresence();
    await remove(slotPath(api.roomId, Number(current.slot)));
  }

  async function removeSlot(slot) {
    if (!api.roomId) return;
    const snap = await get(slotPath(api.roomId, slot));
    const current = snap.val();
    if (!current) return;
    if (current.type === 'human' && current.uid !== api.uid && !api.host) return;
    if (current.type === 'human' && current.uid === api.uid) {
      await remove(slotPath(api.roomId, slot));
      await leaveRoom(true);
      return;
    }
    if (api.host) await remove(slotPath(api.roomId, slot));
  }

  async function startRoom() {
    if (!api.host || !api.roomId) return;
    const snap = await get(roomRef(api.roomId));
    const room = snap.val();
    if (!room || room.status !== 'waiting') return;
    const roster = normalizeRoster(room.players);
    const blue = roster.filter(s => s.team === 'blue' && s.type !== 'empty');
    const red = roster.filter(s => s.team === 'red' && s.type !== 'empty');
    if (!blue.length || !red.length) throw new Error('Cần ít nhất 1 người/cầu thủ ở mỗi đội để bắt đầu.');
    const initial = {
      blueScore: 0, redScore: 0, timeLeft: [180,300,420,600].includes(Number(room.duration)) ? Number(room.duration) : 180,
      players: {},
      ball: { x: 800, y: 450, vx: 0, vy: 0, owner: null, lastTouch: null, lastPasser: null, shotBy: null, shotTeam: null, isShot: false },
      startedAt: serverTimestamp()
    };
    roster.forEach(s => {
      if (s.type === 'empty') return;
      initial.players[s.slot] = {
        id: `p${s.slot}`, uid: s.uid, slot: s.slot, team: s.team,
        type: s.type, displayName: s.displayName, number: s.number,
        x: s.team === 'blue'
          ? (s.slot === 0 ? 280 : s.slot === 1 ? 460 : s.slot === 2 ? 520 : s.slot === 3 ? 460 : 520)
          : (s.slot === 5 ? 1320 : s.slot === 6 ? 1140 : s.slot === 7 ? 1080 : s.slot === 8 ? 1140 : 1080),
        y: [450, 220, 680, 360, 540][s.slot % 5],
        vx: 0, vy: 0, faceX: s.team === 'blue' ? 1 : -1, faceY: 0
      };
    });
    await update(roomRef(api.roomId), { status: 'playing', updatedAt: serverTimestamp(), state: initial });
    emit('start');
  }

  async function sendInput(input) {
    if (!api.roomId || api.slot == null) return;
    api.lastInput = {
      dx: Number(input.dx || 0), dy: Number(input.dy || 0),
      faceX: Number(input.faceX || 0), faceY: Number(input.faceY || 0),
      actionSeq: Number(input.actionSeq || 0), t: Date.now()
    };
    if (!api.host) {
      // Input nodes are only written by their own user; the host consumes them.
      await set(ref(db, `${ROOM_ROOT}/${api.roomId}/inputs/${api.uid}`), api.lastInput);
    }
  }

  async function publishState(state) {
    if (!api.host || !api.roomId) return;
    await update(ref(db, `${ROOM_ROOT}/${api.roomId}`), {
      state,
      updatedAt: serverTimestamp()
    });
  }

  async function finishRoom(state) {
    if (!api.host || !api.roomId) return;
    await update(ref(db, `${ROOM_ROOT}/${api.roomId}`), { status: 'finished', state, updatedAt: serverTimestamp() });
  }

  async function leaveRoom(silent = false) {
    const roomId = api.roomId, slot = api.slot;
    clearListeners();
    if (roomId && slot != null) {
      try {
        const roomSnap = await get(roomRef(roomId));
        const room = roomSnap.val();
        if (room?.hostUid === api.uid) {
          // The host leaving closes the waiting room. During a match it ends it.
          await update(roomRef(roomId), { status: 'finished', closed: true, updatedAt: serverTimestamp() });
        } else {
          await remove(slotPath(roomId, slot));
        }
      } catch (e) { console.warn('[Soccer Online] leave:', e); }
    }
    api.roomId = null; api.slot = null; api.host = false; api.room = null;
    if (!silent) emit('left');
  }

  function getLocalSlot() { return api.slot; }
  function isHost() { return api.host; }
  function getRoomId() { return api.roomId; }

  onAuthStateChanged(auth, async user => {
    api.user = user || null;
    api.uid = user?.uid || null;
    api.displayName = '';
    if (user) {
      try { api.displayName = await loadDisplayName(user); } catch (e) { console.warn('[Soccer Online] profile:', e); }
    }
    emit('auth', { user, displayName: api.displayName });
  });

  window.TienHubSoccerOnline = {
    setCallbacks,
    ensureUser,
    createRoom,
    joinRoom,
    getRoomInfo,
    addAI,
    removeSlot,
    switchTeam,
    startRoom,
    leaveRoom,
    sendInput,
    publishState,
    finishRoom,
    getLocalSlot,
    isHost,
    getRoomId,
    getDisplayName: () => api.displayName,
    getUid: () => api.uid,
    getRoom: () => api.room
  };
})();
