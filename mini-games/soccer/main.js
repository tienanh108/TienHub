import './online.js';
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const screens = {
    menu: $('#menuScreen'), lobby: $('#lobbyScreen'), create: $('#createScreen'),
    join: $('#joinScreen'), number: $('#numberScreen'), game: $('#gameScreen'), stats: $('#statsScreen')
  };
  const canvas = $('#pitch');
  const ctx = canvas.getContext('2d');

  // Bigger internal pitch. CSS scales it to the available viewport.
  const FIELD = { w: 1600, h: 900, goalDepth: 54, goalH: 190 };
  const COLORS = {
    blue: '#2aaeff', blueDark: '#0d72c6', red: '#ff536a', redDark: '#c52f46',
    white: '#f7fff9', grass: '#197443'
  };
  const keys = new Set();
  const state = {
    mode: 'menu', roomCode: 'TH7K9Q',
    blueScore: 0, redScore: 0, running: false, paused: false,
    last: 0, actionHeld: false, actionStart: 0, controlledId: 'b1',
    goalPause: 0, jerseyNumber: null, pendingAction: null,
    takenNumbers: [],
    timeLeft: 180,
    stats: {},
    passRequestFor: null,
    passRequestAt: 0,
    online: false,
    onlineHost: false,
    onlineInputs: {},
    onlineActionSeq: 0,
    onlinePublishAt: 0,
    onlineLastSnapshotAt: 0,
    onlineStarted: false,
    remoteTargets: {},
    remoteBallTarget: null,
    authenticated: false
  };

  // Formation positions are deliberately kept spread out. Only the nearest AI
  // actively attacks the ball; the others return toward their home positions.
  const HOME = {
    b1: [300, 450], b2: [520, 270], b3: [520, 630],
    r1: [1300, 450], r2: [1080, 270], r3: [1080, 630]
  };
  const players = [
    { id:'b1', team:'blue', uid:null, active:true, x:300, y:450, vx:0, vy:0, name:'Bạn', human:true, r:23, number:null, home:HOME.b1, faceX:1, faceY:0 },
    { id:'b2', team:'blue', uid:null, active:true, x:520, y:270, vx:0, vy:0, name:'AI', human:false, r:23, number:2, role:'attack', home:HOME.b2, faceX:1, faceY:0 },
    { id:'b3', team:'blue', uid:null, active:true, x:520, y:630, vx:0, vy:0, name:'AI', human:false, r:23, number:3, role:'defend', home:HOME.b3, faceX:1, faceY:0 },
    { id:'r1', team:'red', uid:null, active:true, x:1300, y:450, vx:0, vy:0, name:'AI', human:false, r:23, number:4, role:'attack', home:HOME.r1, faceX:-1, faceY:0 },
    { id:'r2', team:'red', uid:null, active:true, x:1080, y:270, vx:0, vy:0, name:'AI', human:false, r:23, number:5, role:'attack', home:HOME.r2, faceX:-1, faceY:0 },
    { id:'r3', team:'red', uid:null, active:true, x:1080, y:630, vx:0, vy:0, name:'AI', human:false, r:23, number:6, role:'defend', home:HOME.r3, faceX:-1, faceY:0 }
  ];
  const ball = { x:720, y:405, vx:0, vy:0, r:11, owner:null, cooldown:0 };
  const soccerAI = new window.TienHubSoccerAI(FIELD);

  function isTouchDevice() {
    const ua = navigator.userAgent || '';
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const iPadDesktopUA = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches === true;
    const touchPoints = Number(navigator.maxTouchPoints || 0) > 0;
    // Prefer an actual mobile/tablet signal. Do not use coarse alone because
    // some desktop/touchscreen browsers report a coarse pointer.
    return mobileUA || iPadDesktopUA || (touchPoints && /Android|Mobile/i.test(ua));
  }

  function setMobileControls(visible) {
    const controls = $('#mobileControls');
    if (!controls) return;
    const showControls = visible && isTouchDevice();
    controls.classList.toggle('hidden', !showControls);
    if (!showControls) {
      joy.x = 0; joy.y = 0; joy.id = null;
      const stick = $('.joy-stick');
      if (stick) stick.style.transform = 'translate(0,0)';
    }
  }

  function show(name) {
    Object.values(screens).forEach(x => x.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    setMobileControls(name === 'game');
  }
  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'TH' + Array.from({length:4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  function readAI() {
    try { return JSON.parse(sessionStorage.getItem('soccerLocalAI') || '[]'); }
    catch { return []; }
  }
  function writeAI(arr) { sessionStorage.setItem('soccerLocalAI', JSON.stringify(arr)); }
  function setRoomCode() {
    state.roomCode = randomCode();
    $('#roomCode').textContent = state.roomCode;
    $('#createCode').textContent = state.roomCode;
  }
  function createStat(p) {
    return { uid: p.id, number: p.number, name: p.name, goals: 0, assists: 0, shots: 0, passes: 0, saves: 0 };
  }
  function resetStats() {
    state.stats = {};
    players.forEach(p => { if (p.active !== false) state.stats[p.id] = createStat(p); });
  }
  function stat(p, key, amount = 1) {
    if (!p || !state.stats[p.id]) return;
    state.stats[p.id][key] += amount;
  }
  function formatTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }
  function updateTimer(dt) {
    if (!state.running || state.paused || state.goalPause > 0) return;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    $('#gameTimer').textContent = formatTime(state.timeLeft);
    if (state.timeLeft <= 0) endMatch('Hết giờ');
  }
  function endMatch(reason = 'Trận đấu kết thúc') {
    if (!state.running) return;
    state.running = false;
    $('#gameStatus').textContent = reason;
    renderMatchStats();
    if (state.online && state.onlineHost) {
      window.TienHubSoccerOnline.finishRoom(buildOnlineSnapshot()).catch(console.error);
    }
    show('stats');
  }
  function renderMatchStats() {
    const renderTeam = (team, root) => {
      root.innerHTML = '';
      players.filter(p => p.active !== false && p.team === team).forEach(p => {
        const x = state.stats[p.id] || createStat(p);
        const row = document.createElement('div');
        row.className = 'stat-player';
        row.innerHTML = `<div class="stat-player-head"><span class="stat-ball ${team}"></span><b>#${x.number ?? ''} ${x.name}</b></div><div class="stat-grid"><span>Ghi bàn <b>${x.goals}</b></span><span>Kiến tạo <b>${x.assists}</b></span><span>Sút <b>${x.shots}</b></span><span>Chuyền <b>${x.passes}</b></span><span>Cứu thua <b>${x.saves}</b></span></div>`;
        root.appendChild(row);
      });
    };
    renderTeam('blue', $('#blueStats'));
    renderTeam('red', $('#redStats'));
    $('#finalBlueScore').textContent = state.blueScore;
    $('#finalRedScore').textContent = state.redScore;
    $('#finalResult').textContent = state.blueScore === state.redScore ? 'Hòa' : state.blueScore > state.redScore ? 'Đội Xanh thắng' : 'Đội Đỏ thắng';
  }

  function resetPlayers() {
    players.forEach(p => {
      const pos = HOME[p.id];
      p.x = pos[0]; p.y = pos[1]; p.vx = 0; p.vy = 0;
      p.faceX = p.team === 'blue' ? 1 : -1; p.faceY = 0;
    });
    ball.x = FIELD.w / 2; ball.y = FIELD.h / 2;
    ball.vx = ball.vy = 0; ball.owner = null; ball.cooldown = 0; ball.lastTouch = null; ball.lastPasser = null; ball.shotBy = null; ball.shotTeam = null; ball.isShot = false;
    soccerAI.reset(players);
  }
  function setPlayerNumber(n) {
    state.jerseyNumber = n;
    const me = players.find(p => p.id === state.controlledId);
    if (me) me.number = n;
  }
  function getTakenNumbers() {
    const set = new Set();
    players.forEach(p => { if (p.number != null && !p.human) set.add(Number(p.number)); });
    if (Array.isArray(state.takenNumbers)) state.takenNumbers.forEach(n => set.add(Number(n)));
    return set;
  }
  function validateJersey(raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok:false, message:'Số áo phải từ 1 đến 99.' };

    // Online join/random uses the numbers actually read from Firebase.
    // Solo keeps the local AI-number protection.
    const onlineAction = state.pendingAction === 'join';
    const taken = onlineAction
      ? new Set((state.takenNumbers || []).map(Number).filter(Number.isInteger))
      : getTakenNumbers();

    if (taken.has(n)) return { ok:false, message:`Số áo ${n} đã có trong phòng.` };
    return { ok:true, number:n };
  }
  function openNumberEntry(action, taken = []) {
    state.pendingAction = action;
    state.takenNumbers = [...new Set(taken.map(Number).filter(Number.isInteger))];
    $('#jerseyNumber').value = '';
    $('#numberError').textContent = '';
    $('#numberTakenHint').textContent = state.takenNumbers.length
      ? `Số đã có trong phòng: ${state.takenNumbers.join(', ')}`
      : 'Chọn số áo từ 1 đến 99.';
    show('number');
    setTimeout(() => $('#jerseyNumber').focus(), 50);
  }
  function submitNumber() {
    const result = validateJersey($('#jerseyNumber').value.trim());
    if (!result.ok) {
      $('#numberError').textContent = result.message;
      $('#jerseyNumber').focus();
      return;
    }
    setPlayerNumber(result.number);
    const action = state.pendingAction;
    state.pendingAction = null;
    state.takenNumbers = [];
    if (action === 'solo') startSolo();
    else if (action === 'create') onlineCreate();
    else if (action === 'join') onlineJoin();
  }

  $('#backHub').onclick = () => location.href = '../../index.html';
  $('#gameMenu').onclick = () => { state.running = false; if (state.online) window.TienHubSoccerOnline.leaveRoom().catch(()=>{}); state.online=false; state.onlineStarted=false; show('menu'); };
  $('#statsBackMenu').onclick = () => show('menu');
  $('#statsPlayAgain').onclick = () => { openNumberEntry('solo'); };
  $('#lobbyBack').onclick = () => { if(state.online) window.TienHubSoccerOnline.leaveRoom().catch(()=>{}); state.online=false; show('menu'); };
  $('#leaveLobby').onclick = () => { if(state.online) window.TienHubSoccerOnline.leaveRoom().catch(()=>{}); state.online=false; show('menu'); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => show('menu'));

  document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => {
    const a = b.dataset.action;
    if (a === 'solo') openNumberEntry('solo');
    if (['create','join'].includes(a) && !state.authenticated) {
      alert('Bạn cần đăng nhập TienHub để chơi online.');
      return;
    }
    if (a === 'create') { setRoomCode(); show('create'); }
    if (a === 'join') { $('#joinCode').value = ''; show('join'); setTimeout(() => $('#joinCode').focus(), 50); }
  });

  $('#createConfirm').onclick = () => openNumberEntry('create');
  $('#joinConfirm').onclick = async () => {
    const c = $('#joinCode').value.trim().toUpperCase();
    if (c.length < 6) { $('#joinError').textContent = 'Mã phòng chưa đủ 6 ký tự.'; $('#joinCode').focus(); return; }
    $('#joinError').textContent = '';
    try {
      const info = await window.TienHubSoccerOnline.getRoomInfo(c);
      state.roomCode = c;
      openNumberEntry('join', info.takenNumbers);
    } catch (e) {
      $('#joinError').textContent = e.message || 'Không thể kiểm tra phòng.';
    }
  };
  $('#numberConfirm').onclick = submitNumber;
  $('#jerseyNumber').addEventListener('keydown', e => { if (e.key === 'Enter') submitNumber(); });
  $('#copyRoom').onclick = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      $('#copyRoom').textContent = '✓';
      setTimeout(() => $('#copyRoom').textContent = '📋', 1000);
    } catch {}
  };

  function enterLobby(title) {
    $('#lobbyTitle').textContent = title;
    $('#roomCode').textContent = state.roomCode;
    buildLobby();
    show('lobby');
  }

  function buildLobby() {
    if (state.online && window.TienHubSoccerOnline) {
      const room = window.TienHubSoccerOnline.getRoom();
      const roster = room ? onlineNormalizeRoster(room.players) : [];
      if (roster.length) return renderOnlineLobby(roster);
    }
    const blue = $('#blueSlots'), red = $('#redSlots');
    blue.innerHTML = ''; red.innerHTML = '';
    const slots = [
      {team:'blue', label:'Bạn', type:'human', number:state.jerseyNumber},
      {team:'blue', label:'', type:'empty'}, {team:'blue', label:'', type:'empty'},
      {team:'red', label:'', type:'empty'}, {team:'red', label:'', type:'empty'}, {team:'red', label:'', type:'empty'}
    ];
    const localAI = readAI();
    localAI.forEach(k => { if (slots[k]) slots[k] = { team:k < 3 ? 'blue' : 'red', label:'AI', type:'ai', number:autoAINumber(k) }; });
    slots.forEach((s, i) => {
      const el = document.createElement('div'); el.className = 'slot ' + (s.type === 'empty' ? 'empty' : 'filled');
      if (s.type === 'empty') {
        const btn = document.createElement('button'); btn.className='slot-plus'; btn.textContent='+'; btn.title='Thêm AI';
        btn.onclick=()=>{const arr=readAI();if(!arr.includes(i))arr.push(i);writeAI(arr);buildLobby();}; el.append(btn);
      } else {
        const number=document.createElement('div');number.className='slot-number';number.textContent=s.number??'—';
        const av=document.createElement('div');av.className='slot-avatar';av.textContent=s.type==='ai'?'🤖':'👤';
        const name=document.createElement('div');name.className='slot-name';name.textContent=s.label;
        const tag=document.createElement('div');tag.className='slot-tag';tag.textContent=s.type==='ai'?'AI':'PLAYER';
        const kick=document.createElement('button');kick.className='kick';kick.textContent='×';kick.title='Kick / xóa';
        kick.onclick=()=>{const arr=readAI().filter(x=>x!==i);writeAI(arr);buildLobby();}; el.append(number,av,name,tag,kick);
      }
      (i<3?blue:red).append(el);
    });
    const ai=readAI();$('#blueCount').textContent=`${1+ai.filter(i=>i<3).length}/3`;$('#redCount').textContent=`${ai.filter(i=>i>=3).length}/3`;
  }

  function onlineNormalizeRoster(raw) {
    const out = Array.from({length:6}, (_,i)=>({slot:i,team:i<3?'blue':'red',type:'empty',uid:null,displayName:'',number:null,online:false}));
    Object.entries(raw||{}).forEach(([k,v])=>{const i=Number(k);if(i>=0&&i<6&&v)out[i]={slot:i,team:i<3?'blue':'red',type:v.type||'human',uid:v.uid||null,displayName:v.displayName||'',number:v.number??null,online:v.online!==false,host:!!v.host};});
    return out;
  }

  function renderOnlineLobby(roster) {
    const blue=$('#blueSlots'), red=$('#redSlots'); blue.innerHTML=''; red.innerHTML='';
    roster.forEach((s,i)=>{
      const el=document.createElement('div'); el.className='slot '+(s.type==='empty'?'empty':'filled');
      if(s.type==='empty'){
        if(window.TienHubSoccerOnline?.isHost()){
          const btn=document.createElement('button');btn.className='slot-plus';btn.textContent='+';btn.title='Thêm AI';btn.onclick=()=>window.TienHubSoccerOnline.addAI(i).catch(showOnlineError);el.append(btn);
        } else { const wait=document.createElement('span');wait.className='slot-plus';wait.textContent='·';el.append(wait); }
      } else {
        const number=document.createElement('div');number.className='slot-number';number.textContent=s.number??'—';
        const av=document.createElement('div');av.className='slot-avatar';av.textContent=s.type==='ai'?'🤖':'👤';
        const name=document.createElement('div');name.className='slot-name';name.textContent=s.displayName||'Player';
        const tag=document.createElement('div');tag.className='slot-tag';tag.textContent=s.type==='ai'?'AI':(s.online?'PLAYER':'OFFLINE');
        const kick=document.createElement('button');kick.className='kick';kick.textContent='×';kick.title='Kick / xóa';
        kick.disabled=!(window.TienHubSoccerOnline?.isHost() || s.uid===window.TienHubSoccerOnline?.getUid());
        kick.onclick=()=>window.TienHubSoccerOnline.removeSlot(i).catch(showOnlineError);
        el.append(number,av,name,tag,kick);
      }
      (i<3?blue:red).append(el);
    });
    const bc=roster.filter(s=>s.team==='blue'&&s.type!=='empty').length;
    const rc=roster.filter(s=>s.team==='red'&&s.type!=='empty').length;
    $('#blueCount').textContent=`${bc}/3`;$('#redCount').textContent=`${rc}/3`;
    $('#lobbyHint').textContent=window.TienHubSoccerOnline?.isHost()?'Bạn là chủ phòng · + để thêm AI':'Đang chờ chủ phòng bắt đầu trận';
  }

  function showOnlineError(error){
    console.error(error);
    $('#lobbyHint').textContent=error?.message||'Không thể thực hiện thao tác online.';
  }

  async function onlineCreate(){
    try {
      if (!state.authenticated) throw new Error('Bạn cần đăng nhập TienHub để chơi online.');
      state.online=true;
      const id=await window.TienHubSoccerOnline.createRoom({code:state.roomCode,jerseyNumber:state.jerseyNumber});
      state.roomCode=id; enterLobby('Phòng của bạn');
    } catch(e){state.online=false;show('menu');alert(e.message||'Không thể tạo phòng.');}
  }
  async function onlineJoin(){
    try { if (!state.authenticated) throw new Error('Bạn cần đăng nhập TienHub để chơi online.'); state.online=true; await window.TienHubSoccerOnline.joinRoom(state.roomCode,state.jerseyNumber); enterLobby('Phòng '+state.roomCode); }
    catch(e){state.online=false;$('#joinError').textContent=e.message||'Không thể vào phòng.';show('join');}
  }
  $('#startLobby').onclick = () => {
    if(state.online) window.TienHubSoccerOnline.startRoom().catch(showOnlineError);
    else startSolo();
  };
  function autoAINumber(slotIndex) {
    const preferred = slotIndex + 2;
    if (preferred === state.jerseyNumber) return slotIndex + 10;
    return preferred;
  }
  function configureOnlineRoster(roster) {
    const list = Array.isArray(roster) ? roster : onlineNormalizeRoster(roster);
    players.forEach((p, i) => {
      const s = list[i];
      p.active = !!s && s.type !== 'empty';
      p.uid = s?.uid || null;
      p.human = s?.type === 'human';
      p.name = s?.displayName || (p.human ? 'Player' : 'AI');
      p.number = s?.number ?? null;
      p.team = i < 3 ? 'blue' : 'red';
      p.role = i % 3 === 2 ? 'defend' : 'attack';
      p.slot = i;
      p.home = HOME[p.id];
    });
    const me = players.find(p => p.active && p.uid === window.TienHubSoccerOnline?.getUid());
    if (me) state.controlledId = me.id;
  }

  function startOnlineGame(roster) {
    configureOnlineRoster(roster);
    state.mode = 'online';
    state.online = true;
    state.onlineHost = !!window.TienHubSoccerOnline?.isHost();
    state.blueScore = 0; state.redScore = 0; state.timeLeft = 180;
    state.running = true; state.paused = false; state.goalPause = 0;
    state.passRequestFor = null; state.passRequestAt = 0;
    state.onlineInputs = {}; state.onlineStarted = true; state.remoteTargets = {}; state.remoteBallTarget = null;
    resetStats();
    resetPlayers();
    $('#blueScore').textContent='0'; $('#redScore').textContent='0';
    $('#gameTimer').textContent=formatTime(180); $('#gameStatus').textContent='Đang online';
    show('game'); requestAnimationFrame(resizeCanvas);
    state.last = performance.now(); state.onlinePublishAt = 0;
    requestAnimationFrame(loop);
  }

  function applyOnlineSnapshot(snap) {
    if (!snap || !state.online) return;
    state.blueScore = Number(snap.blueScore || 0);
    state.redScore = Number(snap.redScore || 0);
    state.timeLeft = Number(snap.timeLeft ?? state.timeLeft);
    $('#blueScore').textContent=state.blueScore; $('#redScore').textContent=state.redScore;
    $('#gameTimer').textContent=formatTime(state.timeLeft);
    const bySlot = snap.players || {};
    Object.entries(bySlot).forEach(([slotKey,d]) => {
      const p = players[Number(slotKey)];
      if (!p || !d) return;
      p.active = true;
      const nx = Number(d.x ?? p.x), ny = Number(d.y ?? p.y);
      const mine = p.uid === window.TienHubSoccerOnline?.getUid();
      if (mine) {
        // Keep the local player's movement predicted locally. The host snapshot
        // is used only as a gentle correction so network jitter does not make
        // the mobile joystick feel like it is dragging the player backwards.
        const err = Math.hypot(nx - p.x, ny - p.y);
        if (err > 110) { p.x = nx; p.y = ny; }
        p._serverX = nx; p._serverY = ny;
      } else {
        if (!state.remoteTargets[p.slot]) { p.x = nx; p.y = ny; }
        state.remoteTargets[p.slot] = { x:nx, y:ny };
      }
      p.vx=Number(d.vx||0); p.vy=Number(d.vy||0);
      p.faceX=Number(d.faceX ?? p.faceX ?? 1); p.faceY=Number(d.faceY ?? p.faceY ?? 0);
      p.name=d.displayName||p.name; p.number=d.number??p.number;
    });
    players.forEach((p,i)=>{ if (!(String(i) in bySlot)) p.active=false; });
    if (snap.ball) {
      state.remoteBallTarget = {
        x:Number(snap.ball.x ?? ball.x), y:Number(snap.ball.y ?? ball.y),
        vx:Number(snap.ball.vx || 0), vy:Number(snap.ball.vy || 0)
      };
      ball.vx=Number(snap.ball.vx||0); ball.vy=Number(snap.ball.vy||0);
      ball.owner = snap.ball.owner == null ? null : players[Number(snap.ball.owner)] || null;
      ball.lastTouch = snap.ball.lastTouch == null ? null : players[Number(snap.ball.lastTouch)] || null;
      ball.lastPasser = snap.ball.lastPasser == null ? null : players[Number(snap.ball.lastPasser)] || null;
      ball.shotBy = snap.ball.shotBy == null ? null : players[Number(snap.ball.shotBy)] || null;
      ball.shotTeam = snap.ball.shotTeam || null; ball.isShot=!!snap.ball.isShot;
    }
  }

  function buildOnlineSnapshot() {
    const ps={};
    players.filter(p=>p.active!==false).forEach(p=>{
      ps[p.slot]= { x:p.x,y:p.y,vx:p.vx,vy:p.vy,faceX:p.faceX,faceY:p.faceY,displayName:p.name,number:p.number };
    });
    const slotOf = p => p && Number.isInteger(p.slot) ? p.slot : null;
    return {
      blueScore:state.blueScore, redScore:state.redScore, timeLeft:state.timeLeft,
      players:ps,
      ball:{x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy,
        owner:slotOf(ball.owner),lastTouch:slotOf(ball.lastTouch),lastPasser:slotOf(ball.lastPasser),
        shotBy:slotOf(ball.shotBy),shotTeam:ball.shotTeam||null,isShot:!!ball.isShot}
    };
  }

  function setupOnlineCallbacks() {
    const online = window.TienHubSoccerOnline;
    if (!online) return;
    online.setCallbacks({
      auth: ({user,displayName}) => {
        state.authenticated = !!user;
        const onlineButtons = document.querySelectorAll('[data-action="create"],[data-action="join"]');
        onlineButtons.forEach(btn => {
          btn.disabled = !user;
          btn.title = user ? '' : 'Đăng nhập TienHub để chơi online';
        });
        if (!user) $('#lobbyHint').textContent='Chưa đăng nhập: chỉ có thể chơi đơn.';
        else if (!displayName) $('#lobbyHint').textContent='Hãy đặt Display Name trong hồ sơ TienHub trước khi chơi online.';
      },
      room: ({room,roster}) => {
        state.roomCode=room.roomId || state.roomCode;
        $('#roomCode').textContent=state.roomCode;
        renderOnlineLobby(roster);
        if (room.status === 'playing' && !state.onlineStarted) startOnlineGame(roster);
        if (room.status === 'waiting' && !screens.lobby.classList.contains('hidden')) $('#startLobby').disabled=!online.isHost();
      },
      inputs: inputs => { state.onlineInputs=inputs||{}; },
      state: snap => { if (state.mode==='online' && !state.onlineHost) applyOnlineSnapshot(snap); },
      finished: snap => { if (state.mode==='online') { if (snap) applyOnlineSnapshot(snap); state.running=false; renderMatchStats(); show('stats'); } },
      roomClosed: () => { if (state.mode==='online') { state.running=false; state.onlineStarted=false; show('menu'); } }
    });
  }

  function startSolo() {
    state.online = false; state.onlineHost = false; state.onlineStarted = false; state.onlineInputs = {};
    state.mode = 'solo'; state.blueScore = 0; state.redScore = 0;
    state.timeLeft = 180; resetStats(); state.passRequestFor = null; state.passRequestAt = 0;
    state.running = true; state.paused = false; state.goalPause = 0;
    resetPlayers();
    $('#blueScore').textContent = '0'; $('#redScore').textContent = '0'; $('#gameTimer').textContent = formatTime(state.timeLeft); $('#gameStatus').textContent = 'Trận đấu';
    show('game'); requestAnimationFrame(() => { resizeCanvas(); }); state.last = performance.now(); requestAnimationFrame(loop);
  }

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function normalize(x,y){const d=Math.hypot(x,y)||1;return [x/d,y/d];}
  function controlled(){return players.find(p=>p.id===state.controlledId);}
  function nearestMate(p){return players.filter(q=>q.active !== false && q.team===p.team&&q!==p).sort((a,b)=>dist(p,a)-dist(p,b))[0];}
  function nearestPlayerToBall(team) {
    return players.filter(p => p.active !== false && p.team === team).sort((a,b) => dist(a,ball)-dist(b,ball))[0];
  }

  function readLocalInput() {
    let dx=0,dy=0;
    if(keys.has('KeyW'))dy-=1;if(keys.has('KeyS'))dy+=1;if(keys.has('KeyA'))dx-=1;if(keys.has('KeyD'))dx+=1;
    if(joy.x||joy.y){dx=joy.x;dy=joy.y;}
    if(dx||dy)[dx,dy]=normalize(dx,dy);
    return {dx,dy,faceX:dx,faceY:dy};
  }

  function applyHumanInput(p, input, dt) {
    if (!p || !input) return;
    let dx=Number(input.dx||0), dy=Number(input.dy||0);
    const mag=Math.hypot(dx,dy);
    if(mag>1)[dx,dy]=normalize(dx,dy);
    const PLAYER_SPEED=165;
    if(dx||dy){p.vx=dx*PLAYER_SPEED;p.vy=dy*PLAYER_SPEED;p.faceX=dx;p.faceY=dy;}
    else {p.vx*=.60;p.vy*=.60;}
    if(Number.isFinite(input.faceX) && Number.isFinite(input.faceY) && (Math.abs(input.faceX)+Math.abs(input.faceY)>0.01)){
      const f=normalize(Number(input.faceX),Number(input.faceY)); p.faceX=f[0];p.faceY=f[1];
    }
    movePlayer(p,dt);
  }

  function update(dt) {
    if (!state.running || state.paused) return;

    const isOnlineClient = state.online && !state.onlineHost;
    const isOnlineHost = state.online && state.onlineHost;
    if (!isOnlineClient) updateTimer(dt);
    if (!state.running) return;
    smoothRemoteState(dt);

    if (state.passRequestFor && performance.now() - state.passRequestAt > 6500) { state.passRequestFor = null; state.passRequestAt = 0; }
    if (state.goalPause > 0) { state.goalPause -= dt; if (state.goalPause <= 0 && (!state.online || state.onlineHost)) resetRound(); return; }

    const me = controlled();
    const localInput = readLocalInput();

    if (!state.online) {
      applyHumanInput(me, localInput, dt);
      players.filter(p=>p.active !== false && !p.human).forEach(p=>aiMove(p,dt));
      handleBall(dt);
      ball.cooldown=Math.max(0,ball.cooldown-dt);
      if(state.actionHeld===false && actionReleased){doAction(me);actionReleased=false;}
      return;
    }

    if (isOnlineHost) {
      // Host is the lightweight referee: every client only sends input, while
      // the host advances the shared ball/player state and publishes snapshots.
      players.filter(p=>p.active !== false && p.human).forEach(p=>{
        const input = p.uid === window.TienHubSoccerOnline?.getUid()
          ? {...localInput, faceX: localInput.faceX, faceY: localInput.faceY}
          : state.onlineInputs[p.uid] || {dx:0,dy:0,faceX:p.faceX,faceY:p.faceY,actionSeq:0};
        applyHumanInput(p,input,dt);
        const seq=Number(input.actionSeq||0);
        if(p.uid !== window.TienHubSoccerOnline?.getUid() && seq !== Number(p._lastActionSeq||0)){
          p._lastActionSeq=seq;
          doAction(p);
        }
      });
      players.filter(p=>p.active !== false && !p.human).forEach(p=>aiMove(p,dt));
      handleBall(dt);
      ball.cooldown=Math.max(0,ball.cooldown-dt);
      if(state.actionHeld===false && actionReleased){doAction(me);actionReleased=false;}

      if(performance.now()-state.onlinePublishAt>80 && !state.onlinePublishing){
        state.onlinePublishAt=performance.now(); state.onlinePublishing=true;
        window.TienHubSoccerOnline.publishState(buildOnlineSnapshot())
          .catch(console.error).finally(()=>state.onlinePublishing=false);
      }
    } else {
      // Remote clients send only their own input. The visible game state comes
      // from the host snapshot so two clients cannot independently move the ball.
      applyHumanInput(me, localInput, dt);
      const now=performance.now();
      if(now-(state.onlineLastInputAt||0)>50){
        state.onlineLastInputAt=now;
        const meInput={...localInput,faceX:localInput.faceX,faceY:localInput.faceY,actionSeq:state.onlineActionSeq};
        window.TienHubSoccerOnline.sendInput(meInput).catch(()=>{});
      }
      if(state.actionHeld===false && actionReleased){state.onlineActionSeq++;actionReleased=false;}
    }
  }

  function smoothRemoteState(dt) {
    if (!state.online || state.onlineHost) return;
    const alpha = 1 - Math.exp(-dt * 14);
    players.forEach(p => {
      if (!p.active || p.uid === window.TienHubSoccerOnline?.getUid()) return;
      const target = state.remoteTargets[p.slot];
      if (!target) return;
      p.x += (target.x - p.x) * alpha;
      p.y += (target.y - p.y) * alpha;
    });
    const bt = state.remoteBallTarget;
    if (bt) {
      const ba = 1 - Math.exp(-dt * 18);
      ball.x += (bt.x - ball.x) * ba;
      ball.y += (bt.y - ball.y) * ba;
    }
  }

  function movePlayer(p,dt){
    p.x=clamp(p.x+p.vx*dt,35,FIELD.w-35);
    p.y=clamp(p.y+p.vy*dt,35,FIELD.h-35);
  }
  function aiMove(p,dt){
    const decision = soccerAI.update(p, dt, {
      players,
      ball,
      controlled: controlled(),
      passRequestFor: state.passRequestFor
    });

    let [dx,dy] = normalize(decision.x - p.x, decision.y - p.y);
    const distanceToTarget = Math.hypot(decision.x - p.x, decision.y - p.y);
    if(distanceToTarget < 9) dx = dy = 0;
    if(dx || dy){ p.faceX = dx; p.faceY = dy; }

    // Fast enough to react before the opponent reaches the box, while still
    // leaving the human player clearly more responsive.
    const AI_SPEED = p.role === 'defend' ? 118 : 138;
    // Smooth acceleration/deceleration instead of instantly snapping to full speed.
    const targetVx = dx * AI_SPEED;
    const targetVy = dy * AI_SPEED;
    const steer = Math.min(1, dt * 5.2);
    p.vx += (targetVx - p.vx) * steer;
    p.vy += (targetVy - p.vy) * steer;
    movePlayer(p, dt);

    // Claim loose balls. Attackers may collect them from farther away; the
    // defender only joins when the ball is genuinely in the danger zone.
    const nearestForClaim = nearestPlayerToBall(p.team);
    const looseBallRange = 28;
    if(!ball.owner && nearestForClaim === p && dist(p,ball) < p.r + ball.r + looseBallRange && ball.cooldown <= 0){
      ball.owner = p;
      ball.lastTouch = p;
      ball.isShot = false;
      ball.cooldown = 0.22;
    }

    if(ball.owner === p){
      const request = state.passRequestFor === p.team;
      const now = performance.now();
      const canAct = now - (p.aiLastAction || 0) > 520;
      // Do not make an AI kick every time it owns the ball. The brain may
      // choose to dribble/carry forward; only an explicit action triggers the
      // ball release. This makes attacks look deliberate instead of like
      // constant random passing.
      if(canAct && decision.action){
        p.aiLastAction = now;
        aiAction(p, decision.action === 'pass-human' ? controlled() : null, decision.action);
      }
    }
  }

  function inPenaltyArea(p){
    const boxW = 235, boxH = 320;
    const inY = Math.abs(p.y - FIELD.h/2) < boxH/2;
    return inY && (p.team === 'blue' ? p.x < boxW + 20 : p.x > FIELD.w - boxW - 20);
  }
  function handleBall(dt){
    const contactRange = 8;

    if(ball.owner){
      const p = ball.owner;
      const [dx,dy] = normalize(p.faceX || (p.team==='blue'?1:-1), p.faceY || 0);
      ball.x = p.x + dx * 30;
      ball.y = p.y + dy * 30;

      // If an opponent actually reaches the ball, possession changes to that
      // player. Do not just bounce the ball backwards: that often sent the
      // clearance straight into another opponent.
      const challengers = players
        .filter(q => q.active !== false && q !== p && q.team !== p.team)
        .map(q => ({ p:q, d:dist(q, {x:ball.x,y:ball.y}) }))
        .filter(x => x.d <= p.r + ball.r + contactRange)
        .sort((a,b) => a.d - b.d);

      if(challengers.length && ball.cooldown <= 0){
        const tackler = challengers[0].p;
        if(tackler.role === 'defend'){
          // A defender winning the ball in its own half clears it into space,
          // away from the goal and away from the nearest opponent.
          defensiveClear(tackler);
        } else {
          ball.owner = tackler;
          ball.lastTouch = tackler;
          ball.lastPasser = null;
          ball.isShot = false;
          ball.shotBy = null;
          ball.shotTeam = null;
          ball.cooldown = 0.28;
        }
      }
      return;
    }

    // Free ball: it moves normally, then the player who actually reaches it
    // first gets possession. This means the ball is never magnetically glued
    // to a player from a distance.
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= Math.pow(.985,dt*60);
    ball.vy *= Math.pow(.985,dt*60);
    if(ball.y<18||ball.y>FIELD.h-18){ball.y=clamp(ball.y,18,FIELD.h-18);ball.vy*=-.8;}
    const goalTop=(FIELD.h/2)-95,goalBottom=(FIELD.h/2)+95;
    if(ball.x<0){if(ball.y>goalTop&&ball.y<goalBottom)goal('red');else{ball.x=10;ball.vx*=-.8;}}
    if(ball.x>FIELD.w){if(ball.y>goalTop&&ball.y<goalBottom)goal('blue');else{ball.x=FIELD.w-10;ball.vx*=-.8;}}

    if(ball.cooldown <= 0){
      const contacts = players.filter(p => p.active !== false)
        .map(p => ({p, d:dist(p,ball)}))
        .filter(x => x.d <= x.p.r + ball.r + contactRange)
        .sort((a,b) => a.d - b.d);
      if(contacts.length){
        const p = contacts[0].p;
        if (ball.isShot && ball.shotTeam && p.team !== ball.shotTeam && inPenaltyArea(p)) {
          stat(p, 'saves');
        }
        ball.owner=p;
        ball.lastTouch=p;
        ball.vx=ball.vy=0;
        ball.isShot=false;
        ball.shotBy=null;
        ball.shotTeam=null;
        ball.cooldown=0.20;
      }
    }
  }

  function defensiveClear(defender){
    const direction = defender.team === 'blue' ? 1 : -1;
    const opponents = players.filter(q => q.active !== false && q.team !== defender.team);
    const nearest = opponents.sort((a,b) => dist(a,defender)-dist(b,defender))[0];
    let dx = direction, dy = 0;

    // Pick a lane away from the nearest opponent. In the defensive third,
    // prefer a diagonal clearance toward the wing instead of through the
    // middle where an attacker is likely waiting.
    if(nearest){
      const awayX = defender.x - nearest.x;
      const awayY = defender.y - nearest.y;
      const away = normalize(awayX, awayY);
      const forwardDot = away[0] * direction;
      if(forwardDot < 0.15){
        // Opponent is directly in the forward lane: clear diagonally toward
        // the wing rather than feeding the ball straight back to them.
        const wing = defender.y < FIELD.h/2 ? -1 : 1;
        [dx,dy] = normalize(direction * 0.78, wing * 0.72);
      } else {
        dy = clamp(away[1] * 0.85 + (defender.y < FIELD.h/2 ? -0.18 : 0.18), -0.92, 0.92);
        [dx,dy] = normalize(direction, dy);
      }
    }

    ball.owner = null;
    ball.x = defender.x + dx * 35;
    ball.y = defender.y + dy * 35;
    ball.vx = dx * 330;
    ball.vy = dy * 330;
    ball.lastTouch = defender;
    ball.lastPasser = null;
    ball.shotBy = null;
    ball.shotTeam = null;
    ball.isShot = false;
    ball.cooldown = 0.30;
    stat(defender,'passes');
  }

  function aiAction(p, forcedTarget = null, brainAction = null){
    const goalX = p.team === 'blue' ? FIELD.w : 0;
    const teammates = players.filter(q => q.active !== false && q.team === p.team && q !== p);
    const opponents = players.filter(q => q.active !== false && q.team !== p.team);
    const direction = p.team === 'blue' ? 1 : -1;

    // Explicit J request: pass to the human immediately. No random choice.
    const requestedTarget = forcedTarget && forcedTarget.team === p.team && forcedTarget !== p
      ? forcedTarget : null;

    let target = requestedTarget;
    let pass = !!target;
    let shoot = brainAction === 'shoot';

    if(!target && brainAction !== 'shoot'){
      const goalDist = Math.abs(goalX - p.x);
      const inFinalThird = direction === 1 ? p.x > FIELD.w * .66 : p.x < FIELD.w * .34;
      const nearGoal = goalDist < 560 && Math.abs(p.y - FIELD.h / 2) < 255;
      const best = teammates
        .map(m => ({m, d:dist(p,m), forward:(m.x-p.x)*direction, pressure:Math.min(...opponents.map(o=>dist(m,o)),999)}))
        .filter(x => x.d > 55 && x.d < 720)
        .sort((a,b) => (b.forward*1.4+b.pressure*.8-b.d*.25) - (a.forward*1.4+a.pressure*.8-a.d*.25))[0];

      // The brain normally decides whether to pass or shoot. Keep a safety
      // rule here so a direct call can still finish near goal, but never force
      // a backward/sideways pass just to keep possession.
      if(nearGoal || (inFinalThird && goalDist < 430)) shoot = true;
      else if(best && best.forward > 95) { target = best.m; pass = true; }
      else shoot = false;
    }

    let dx,dy;
    if(pass && target){
      [dx,dy] = normalize(target.x-p.x, target.y-p.y);
      if(requestedTarget){ state.passRequestFor = null; state.passRequestAt = 0; }
    } else {
      // Aim toward the actual goal with a little vertical correction.
      [dx,dy] = normalize(goalX-p.x, FIELD.h/2-p.y);
    }

    ball.owner = null;
    ball.x = p.x + dx * 34;
    ball.y = p.y + dy * 34;

    if(pass){
      stat(p,'passes');
      ball.lastPasser = p;
      ball.shotBy = null;
      ball.shotTeam = null;
      ball.isShot = false;
      const power = requestedTarget ? 520 : 390;
      ball.vx = dx * power;
      ball.vy = dy * power;
    } else {
      stat(p,'shots');
      ball.lastPasser = null;
      ball.shotBy = p;
      ball.shotTeam = p.team;
      ball.isShot = true;
      const power = shoot ? 590 : 460;
      ball.vx = dx * power;
      ball.vy = dy * power;
    }
    ball.cooldown = .18;
  }

  function requestPassToPlayer(){
    const p = controlled();
    if(!p || state.mode !== 'solo') return;

    state.passRequestFor = p.team;
    state.passRequestAt = performance.now();

    const teammateAI = players
      .filter(q => !q.human && q.team === p.team)
      .sort((a,b) => dist(a,p)-dist(b,p));

    // If an AI already has the ball, force the pass immediately.
    const holder = ball.owner;
    if(holder && holder.team === p.team && holder !== p){
      aiAction(holder, p);
      return;
    }

    // If the ball is free and an AI is close enough, make that AI claim it and
    // pass as soon as the request is made instead of merely turning toward us.
    const receiverAI = teammateAI.find(q => dist(q,ball) < 180);
    if(receiverAI && !ball.owner && ball.cooldown <= 0){
      ball.owner = receiverAI;
      ball.lastTouch = receiverAI;
      aiAction(receiverAI, p);
    }
  }

  function doAction(p = controlled()){
    if(!p) return;

    // J only kicks the ball if the human is actually in possession.
    // No auto-pass, no assisted target selection, no AI teammate kicking.
    if(ball.owner !== p) return;

    let [dx,dy] = normalize(p.faceX || (p.team==='blue'?1:-1), p.faceY || 0);
    const held=Math.min(1,(performance.now()-state.actionStart)/900);
    const power=430 + held*230;

    // It is a directional kick. If a teammate happens to be in that lane,
    // it can receive the ball naturally; otherwise the kick simply travels
    // into space or toward an opponent.
    const teammateAhead = players
      .filter(q => q.team===p.team && q!==p)
      .some(q => {
        const vx=q.x-p.x, vy=q.y-p.y;
        const d=Math.hypot(vx,vy)||1;
        return d < 300 && ((vx*dx + vy*dy)/d) > 0.90;
      });

    if(teammateAhead) stat(p,'passes'); else stat(p,'shots');
    ball.lastPasser=teammateAhead ? p : null;
    ball.shotBy=teammateAhead ? null : p;
    ball.shotTeam=teammateAhead ? null : p.team;
    ball.isShot=!teammateAhead;
    ball.owner=null;
    ball.x=p.x+dx*34;
    ball.y=p.y+dy*34;
    ball.vx=dx*power;
    ball.vy=dy*power;
    ball.cooldown=.16;
  }

  let actionReleased=false;
  function actionDown(){if(state.goalPause>0)return;if(!state.actionHeld){state.actionHeld=true;state.actionStart=performance.now();}}
  function actionUp(){if(state.actionHeld){state.actionHeld=false;actionReleased=true;}}
  document.addEventListener('keydown',e=>{
    if(['KeyW','KeyA','KeyS','KeyD','KeyJ'].includes(e.code))e.preventDefault();
    if(e.code==='KeyJ')actionDown();else keys.add(e.code);
  });
  document.addEventListener('keyup',e=>{if(e.code==='KeyJ')actionUp();keys.delete(e.code);});

  const joy={x:0,y:0,id:null};
  const joystick=$('#joystick'),stick=$('.joy-stick');
  function joyMove(e){
    const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    let x=e.clientX-cx,y=e.clientY-cy;const max=r.width*.38,d=Math.hypot(x,y);
    if(d>max){x*=max/d;y*=max/d;}joy.x=x/max;joy.y=y/max;stick.style.transform=`translate(${x}px,${y}px)`;
  }
  joystick.addEventListener('pointerdown',e=>{joy.id=e.pointerId;joystick.setPointerCapture(e.pointerId);joyMove(e);});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)joyMove(e);});
  ['pointerup','pointercancel'].forEach(t=>joystick.addEventListener(t,e=>{if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;stick.style.transform='translate(0,0)';}}));
  $('#actionBtn').addEventListener('pointerdown',e=>{e.preventDefault();$('#actionBtn').setPointerCapture(e.pointerId);actionDown();});
  $('#actionBtn').addEventListener('pointerup',e=>{e.preventDefault();actionUp();});
  $('#actionBtn').addEventListener('pointercancel',actionUp);

  function goal(team){
    if(team==='blue')state.blueScore++;else state.redScore++;
    $('#blueScore').textContent=state.blueScore;$('#redScore').textContent=state.redScore;
    const scorer = ball.shotBy || ball.lastTouch;
    if (scorer && scorer.team === team) {
      stat(scorer, 'goals');
      if (ball.lastPasser && ball.lastPasser !== scorer && ball.lastPasser.team === team) stat(ball.lastPasser, 'assists');
    }
    $('#gameStatus').textContent=team==='blue'?'Xanh ghi bàn!':'Đỏ ghi bàn!';
    $('#goalFlash').classList.remove('show');void $('#goalFlash').offsetWidth;$('#goalFlash').classList.add('show');
    state.goalPause=1.4;
    if(state.blueScore>=5||state.redScore>=5){state.goalPause=1.6;setTimeout(()=>endMatch('Đạt 5 bàn'),1600);}
  }
  function resetRound(){resetPlayers();}

  function draw(){
    ctx.clearRect(0,0,FIELD.w,FIELD.h);
    ctx.fillStyle=COLORS.grass;ctx.fillRect(0,0,FIELD.w,FIELD.h);
    const stripeW=FIELD.w/16;
    for(let i=0;i<16;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.025)';ctx.fillRect(i*stripeW,0,stripeW,FIELD.h);}
    ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=6;ctx.strokeRect(12,12,FIELD.w-24,FIELD.h-24);
    ctx.beginPath();ctx.moveTo(FIELD.w/2,12);ctx.lineTo(FIELD.w/2,FIELD.h-12);ctx.stroke();
    ctx.beginPath();ctx.arc(FIELD.w/2,FIELD.h/2,105,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(FIELD.w/2,FIELD.h/2,6,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();
    const boxH=280, boxW=205, smallW=95, smallH=150, top=(FIELD.h-boxH)/2, smallTop=(FIELD.h-smallH)/2;
    ctx.strokeRect(12,top,boxW,boxH);ctx.strokeRect(FIELD.w-boxW-12,top,boxW,boxH);
    ctx.strokeRect(12,smallTop,smallW,smallH);ctx.strokeRect(FIELD.w-smallW-12,smallTop,smallW,smallH);
    drawGoal(0);drawGoal(FIELD.w);
    players.filter(p => p.active !== false).forEach(drawPlayer);drawBall();
  }
  function drawGoal(x){
    const top=(FIELD.h/2)-95;
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x<FIELD.w/2?0:FIELD.w-54,top,54,190);
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;
    for(let i=0;i<8;i++){ctx.beginPath();const gx=x<FIELD.w/2?i*9:FIELD.w-54+i*9;ctx.moveTo(gx,top);ctx.lineTo(gx,top+190);ctx.stroke();}
  }
  function drawPlayer(p){
    ctx.save();ctx.translate(p.x,p.y);
    ctx.shadowColor=p.team==='blue'?'rgba(42,174,255,.55)':'rgba(255,83,106,.5)';ctx.shadowBlur=p.human?20:9;
    ctx.fillStyle=p.team==='blue'?COLORS.blue:COLORS.red;ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=2;ctx.stroke();
    if(p.human){ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.r+8,-Math.PI/2,Math.PI*1.5);ctx.stroke();}
    // Small directional marker makes the player's facing direction visible.
    const fx = Number(p.faceX || (p.team === 'blue' ? 1 : -1));
    const fy = Number(p.faceY || 0);
    const fd = Math.hypot(fx, fy) || 1;
    const ax = (fx / fd) * (p.r + 8);
    const ay = (fy / fd) * (p.r + 8);
    ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ax,ay);ctx.stroke();
    ctx.fillStyle='white';ctx.font='900 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.number ?? ''),0,1);
    ctx.restore();
  }
  function drawBall(){
    ctx.save();ctx.translate(ball.x,ball.y);ctx.shadowColor='rgba(255,255,255,.6)';ctx.shadowBlur=8;ctx.fillStyle='white';
    ctx.beginPath();ctx.arc(0,0,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#1d2921';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#1d2921';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function loop(t){if(!state.running)return;const dt=Math.min(.033,(t-state.last)/1000||.016);state.last=t;update(dt);draw();requestAnimationFrame(loop);}
  function resizeCanvas(){
    const wrap = document.querySelector('.pitch-wrap');
    if (!wrap || screens.game.classList.contains('hidden')) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = FIELD.w / FIELD.h;
    let w = rect.width - 8;
    let h = w / ratio;
    const maxH = rect.height - 8;
    if (h > maxH) { h = maxH; w = h * ratio; }
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.aspectRatio = `${FIELD.w} / ${FIELD.h}`;
  }
  window.addEventListener('resize',resizeCanvas);window.addEventListener('orientationchange',()=>setTimeout(resizeCanvas,150));
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(resizeCanvas)).observe(document.querySelector('.pitch-wrap'));
  setupOnlineCallbacks();
  show('menu');
  setMobileControls(false);
  window.addEventListener('resize', () => { setMobileControls(!screens.game.classList.contains('hidden')); });
  window.addEventListener('orientationchange', () => setTimeout(() => setMobileControls(!screens.game.classList.contains('hidden')), 80));
  draw();
})();
