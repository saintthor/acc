import { RemoteConnector, P2PNode, NetworkEvents } from './p2p.js';
import { AccountManager } from './account.js';
import { BlockchainUtils, BanknoteChain } from './blockchain.js';

const connector = new RemoteConnector();
const nodes = [];
let activeItem = null; // { type: 'NODE'|'USER'|'CHAIN', data: any }
let currentStep = localStorage.getItem('atomic_step_v3') ? parseInt(localStorage.getItem('atomic_step_v3')) : 0;

const sessionPrefix = localStorage.getItem('atomic_session_v3') || Math.random().toString(36).substring(7).toUpperCase();
localStorage.setItem('atomic_session_v3', sessionPrefix);

const accountManager = new AccountManager(sessionPrefix);
let banknoteChains = [];

// DOM Elements
const grid = document.getElementById('grid');
const panel = document.getElementById('side-panel');
const step1Btn = document.getElementById('step-1');
const step2Btn = document.getElementById('step-2');
const step3Btn = document.getElementById('step-3');
const guideText = document.getElementById('guide-text');
const userGrid = document.getElementById('user-list-container');
const chainGrid = document.getElementById('tab-blockchain');
const globalLogStream = document.getElementById('global-log-stream');

// --- 全网日志监听 ---
NetworkEvents.addEventListener('node-log', (e) => {
    const { nodeId, t, msg, type } = e.detail;
    if (globalLogStream && (type === 'in' || type === 'out')) {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.innerHTML = `<span style="opacity: 0.5;">[${t}]</span> <b style="color:var(--text)">${nodeId}</b>: ${msg}`;
        globalLogStream.prepend(line);
        if (globalLogStream.children.length > 100) globalLogStream.lastChild.remove();
    }
    if (activeItem && activeItem.type === 'NODE' && activeItem.data.id === nodeId) {
        renderPanel();
    }
});

// --- Tab Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(target).classList.add('active');
    };
});

function openPanel(type, data) {
    activeItem = { type, data };
    panel.classList.add('open');
    renderPanel();
}

function renderPanel() {
    if (!activeItem) return;
    const { type, data } = activeItem;
    const body = document.getElementById('p-body');
    const title = document.getElementById('p-title');
    const subtitle = document.getElementById('p-subtitle');
    const footer = document.getElementById('p-footer');

    footer.style.display = 'none';

    if (type === 'NODE') {
        const node = data;
        title.textContent = node.id;
        subtitle.textContent = "核心节点详情";
        footer.style.display = 'flex';

        const peersArr = Array.from(node.peers);
        const users = accountManager.getUsersForNode(node.id);

        body.innerHTML = `
            <p class="panel-section-title">直接连接的节点 (${peersArr.length}/5)</p>
            <div class="peer-list">
                ${peersArr.length > 0 ? peersArr.map(p => `<div class="peer-tag">${p.split('-').pop()}</div>`).join('') : '<span style="color:var(--text-dim); font-size:10px;">孤立节点</span>'}
            </div>
            <p class="panel-section-title">本节点用户身份 (${users.length})</p>
            <div id="p-users-grid">
                ${users.map(u => `<div class="user-item-mini"><b style="color:var(--accent)">${u.id.split('-').pop()}</b><br/>${u.pubKey.substring(0,4)}..</div>`).join('')}
            </div>
            <p class="panel-section-title">节点事件日志</p>
            <div class="log-container">
                ${node.logs.map(l => `<div class="log-line ${l.type}"><span style="opacity:0.4">[${l.t}]</span> ${l.msg}</div>`).join('')}
            </div>
        `;

        const select = document.getElementById('p-user-select');
        select.innerHTML = '<option value="">身份...</option>' + users.map(u => `<option value="${u.id}">${u.id}</option>`).join('');
    } 
    else if (type === 'USER') {
        const user = data;
        title.textContent = "USER ACCOUNT";
        subtitle.textContent = user.pubKey.substring(0, 16) + "...";
        
        const ownedChains = banknoteChains.filter(c => c.currentOwner === user.pubKey);

        body.innerHTML = `
            <p class="panel-section-title">完整公钥 (Public Key)</p>
            <div class="user-pubkey-label" style="font-size:10px;">${user.pubKey}</div>
            
            <p class="panel-section-title">所属节点 (Affiliated Nodes)</p>
            <div class="peer-list">
                ${user.nodeIds.map(nid => `<div class="peer-tag" style="background:#fef3c7; border-color:#fde68a; color:#b45309;">${nid.split('-').pop()}</div>`).join('')}
            </div>

            <p class="panel-section-title">拥有的原子区块链 (${ownedChains.length})</p>
            <div class="chain-grid" style="grid-template-columns: repeat(2, 1fr);">
                ${ownedChains.map(c => `
                    <div class="chain-mini-card" style="height: auto; min-height: 60px; padding: 10px;" onclick="window.showChainDetail(${c.serial})">
                        <div class="val">$${c.denomination}</div>
                        <div style="font-size: 8px; color: var(--text-dim); margin-top: 4px; font-family: monospace; overflow: hidden; text-overflow: ellipsis;">ID: ${c.blocks[0].hash.substring(0, 8)}...</div>
                    </div>
                `).join('') || '<div style="font-size:11px; color:var(--text-dim);">暂无资产</div>'}
            </div>
        `;
    }
    else if (type === 'CHAIN') {
        const chain = data;
        title.textContent = `BLOCKCHAIN #SN-${chain.serial}`;
        subtitle.textContent = `原子钞票: 面额 $${chain.denomination}`;

        body.innerHTML = `
            <p class="panel-section-title">当前持有人 (Current Owner)</p>
            <div class="user-pubkey-label" style="cursor:pointer;" onclick="window.showUserDetailByPubKey('${chain.currentOwner}')">${chain.currentOwner.substring(0, 12)}... (点击查看)</div>

            <p class="panel-section-title">账本所有区块 (${chain.blocks.length})</p>
            <div class="blocks-list">
                ${chain.blocks.map((b, i) => `
                    <div class="block-card">
                        <h4>${b.type} Block ${i === 0 ? '(Genesis)' : '#'+i}</h4>
                        <div class="hash">Hash: ${b.hash}</div>
                        <div class="data">Data:\n${b.data}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// 暴露给全局调用
window.showChainDetail = (serial) => {
    const chain = banknoteChains.find(c => c.serial === serial);
    if (chain) openPanel('CHAIN', chain);
};

window.showUserDetailByPubKey = (pubKey) => {
    const user = accountManager.accounts.find(u => u.pubKey === pubKey);
    if (user) openPanel('USER', user);
};

function updateUI(node, pulse = false) {
    const card = document.getElementById(`card-${node.id}`);
    if (!card) return;
    const slots = card.querySelectorAll('.slot');
    slots.forEach((s, i) => { s.classList.toggle('active', i < node.peers.size); });
    let badge = card.querySelector('.msg-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'msg-badge'; card.appendChild(badge); }
    badge.textContent = node.msgCount > 0 ? `RX: ${node.msgCount}` : '';
    if (pulse) { card.classList.add('pulse'); setTimeout(() => card.classList.remove('pulse'), 600); }
    const uc = card.querySelector('.user-count');
    if (uc && currentStep >= 2) { uc.textContent = `${accountManager.getUsersForNode(node.id).length} Users`; uc.style.display = 'block'; }
}

function renderUsersTab() {
    if (currentStep < 2 || !userGrid) return;
    const accounts = accountManager.accounts;
    userGrid.innerHTML = accounts.map(acc => `
        <div class="user-profile-card" onclick="window.showUserDetailByPubKey('${acc.pubKey}')">
            <div style="font-size: 10px; color: var(--text-dim); margin-bottom: 6px;">Crypto Identity (Public Key):</div>
            <div class="user-pubkey-label" title="${acc.pubKey}">
                ${acc.pubKey.substring(0, 12)}...
            </div>
            <div style="margin-top: 10px; font-size: 9px; color: var(--text-dim);">
                所属节点: ${acc.nodeIds.map(nid => nid.split('-').pop()).join(', ')}
            </div>
        </div>
    `).join('');
}

function renderBlockchainTab() {
    if (currentStep < 3 || !chainGrid) return;
    const stats = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0 };
    banknoteChains.forEach(c => stats[c.denomination]++);

    chainGrid.innerHTML = `
        <div style="background:white; padding:16px; border-radius:12px; margin-bottom:16px; border:1px solid var(--border);">
            <h3 style="font-size:12px; margin-bottom:12px; color:var(--text-dim);">全网 500 条链概况</h3>
            <div style="display:flex; gap:10px;">
                ${Object.entries(stats).map(([val, count]) => `
                    <div style="flex:1; background:#f8fafc; padding:8px; border-radius:6px; text-align:center; border:1px solid #f1f5f9;">
                        <div style="font-size:9px; color:var(--text-dim);">$${val}</div>
                        <div style="font-size:14px; font-weight:bold; color:var(--accent);">${count}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="chain-grid">
            ${banknoteChains.map(c => `
                <div class="chain-mini-card" title="SN: ${c.serial} | Owner: ${c.currentOwner}" onclick="window.showChainDetail(${c.serial})">
                    <div class="val">$${c.denomination}</div>
                    <div class="owner">${c.currentOwner.substring(0, 6)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

async function startStep1() {
    if (currentStep >= 1) return;
    currentStep = 1; localStorage.setItem('atomic_step_v3', 1);
    step1Btn.classList.add('completed'); step2Btn.classList.add('active'); grid.classList.add('active');
    for (let i = 1; i <= 30; i++) {
        const id = `${sessionPrefix}-${String(i).padStart(2, '0')}`;
        const node = new P2PNode(id, connector, updateUI);
        nodes.push(node);
        const card = document.createElement('div');
        card.id = `card-${id}`; card.className = 'node-card';
        card.innerHTML = `<span class="user-count" style="display:none">0 Users</span><span class="id">${id}</span><div class="slots">${'<div class="slot"></div>'.repeat(5)}</div>`;
        card.onclick = () => openPanel('NODE', node);
        grid.appendChild(card);
    }
    setInterval(() => nodes.forEach(n => n.tick()), 3000);
}

async function startStep2() {
    if (currentStep < 1 || currentStep >= 2) return;
    currentStep = 2; localStorage.setItem('atomic_step_v3', 2);
    step2Btn.classList.add('completed'); step3Btn.classList.add('active'); step3Btn.style.opacity = "1";
    await accountManager.ensureAccountsCreated();
    renderUsersTab();
    nodes.forEach(n => updateUI(n));
}

async function startStep3() {
    if (currentStep < 2 || currentStep >= 3) return;
    guideText.textContent = "正在生成 500 条创世链并分发...";
    
    const definition = `Definition: Each SN (1-500) corresponds to a unique chain. Denominations: 1-100: $1, 101-200: $5, 201-300: $10, 301-400: $20, 401-500: $50. Issuer: ${accountManager.superUser.pubKey}.`;
    const H = await BlockchainUtils.sha256(definition);
    const superUser = accountManager.superUser;
    const normalUsers = accountManager.accounts;

    const chains = [];
    for (let s = 1; s <= 500; s++) {
        const genesisData = `${H}\n${s}\n${superUser.pubKey}`;
        const genesisHash = await BlockchainUtils.sha256(genesisData);
        const chain = new BanknoteChain(s, { type: 'GENESIS', data: genesisData, hash: genesisHash });
        const recipient = normalUsers[Math.floor(Math.random() * normalUsers.length)];
        // 使用更新后的 addTransferBlock
        await chain.addTransferBlock(superUser.privKey, recipient.pubKey);
        chains.push(chain);
    }
    banknoteChains = chains;
    nodes[0].broadcast(`[AOB] 500 chains deployed.`);
    currentStep = 3; localStorage.setItem('atomic_step_v3', 3);
    localStorage.setItem(`atomic_chains_${sessionPrefix}`, JSON.stringify(chains));
    step3Btn.classList.add('completed');
    guideText.textContent = "原子所有权区块已部署。点击链方块查看详情。";
    renderBlockchainTab();
    renderUsersTab();
}

step1Btn.onclick = startStep1;
step2Btn.onclick = startStep2;
step3Btn.onclick = startStep3;

document.getElementById('p-close').onclick = () => { activeItem = null; panel.classList.remove('open'); };

document.getElementById('p-broadcast').onclick = () => {
    const txt = document.getElementById('p-msg').value.trim();
    const userName = document.getElementById('p-user-select').value;
    if (activeItem && activeItem.type === 'NODE' && txt && userName) {
        const user = accountManager.accounts.find(a => a.id === userName);
        activeItem.data.broadcast(`[From ${user.pubKey.substring(0, 6)}...] ${txt}`);
        document.getElementById('p-msg').value = '';
    }
};

window.onload = async () => {
    if (currentStep >= 1) {
        const savedStep = currentStep; currentStep = 0; await startStep1();
        if (savedStep >= 2) { currentStep = 1; await startStep2(); }
        if (savedStep >= 3) {
            const saved = localStorage.getItem(`atomic_chains_${sessionPrefix}`);
            if (saved) {
                const raw = JSON.parse(saved);
                banknoteChains = raw.map(r => {
                    const bc = new BanknoteChain(r.serial, r.blocks[0]);
                    bc.blocks = r.blocks; return bc;
                });
                currentStep = 3; step3Btn.classList.add('completed'); renderBlockchainTab();
            }
        }
    }
};
