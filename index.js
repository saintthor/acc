import { RemoteConnector, P2PNode, NetworkEvents } from './p2p.js';
import { AccountManager } from './account.js';
import { BlockchainUtils, BanknoteChain } from './blockchain.js';

const connector = new RemoteConnector();
const localNodes = []; 
let activeItem = null;
let currentStep = 0;

// 全球同步存储实例
const accountManager = new AccountManager(connector.root);
let banknoteChains = []; 

// --- 全局数据同步逻辑 ---

connector.root.get('chains').map().on((data, genesisHash) => {
    if (!data) return;
    const blocks = JSON.parse(data.blocks);
    const existing = banknoteChains.find(c => c.genesisHash === genesisHash);
    
    if (existing) {
        if (blocks.length > existing.blocks.length) {
            existing.blocks = blocks;
            if (activeItem && activeItem.type === 'CHAIN' && activeItem.data.genesisHash === genesisHash) {
                renderPanel();
            }
            renderBlockchainTab();
        }
    } else {
        const chain = new BanknoteChain(data.serial, blocks[0]);
        chain.blocks = blocks;
        chain.genesisHash = genesisHash;
        chain.denomination = data.denomination;
        banknoteChains.push(chain);
        renderBlockchainTab();
    }
});

accountManager.onSync = () => {
    renderUsersTab();
    if (activeItem && activeItem.type === 'USER') renderPanel();
};

// --- UI 引导逻辑 ---

function switchTab(tabId) {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    contents.forEach(c => c.classList.toggle('active', c.id === tabId));
}

function updateStepUI(nextStepNum) {
    const instruction = document.getElementById('instruction-text');
    const activeContainer = document.getElementById('active-step-container');
    const readyContainer = document.getElementById('ready-status-container');
    const futureSteps = document.getElementById('future-steps');

    const configs = {
        1: {
            ready: "P2P 节点群已就绪",
            nextInstruction: "<strong>第二步：同步 30 个加密身份</strong><br>30 个虚拟节点已通过 UUID 互联。现在我们为这 30 个节点分别生成非对称加密密钥。在 AOB 体系中，公钥（Public Key）即是唯一的数字身份。",
            nextBtnId: "step-2",
            tab: "tab-nodes"
        },
        2: {
            ready: "加密身份已同步",
            nextInstruction: "<strong>第三步：发行 500 条资产区块链</strong><br>身份层已就绪。点击下方按钮将创建 500 条基于哈希标识的原子资产链。每条链都是独立的微型账本，并随机分发给上述公钥持有者。",
            nextBtnId: "step-3",
            tab: "tab-users"
        },
        3: {
            ready: "500 条资产链已发行",
            nextInstruction: "<strong>实验：原子所有权跨页面流动</strong><br>所有资产链现已跨页面同步。选择任意资产发起支付，你将观察到所有权如何在不经过全网共识的情况下实现原子级瞬时转移。",
            tab: "tab-blockchain"
        }
    };

    const config = configs[nextStepNum - 1];
    if (config) {
        const badge = document.createElement('div');
        badge.className = 'status-ready';
        badge.innerHTML = `✓ ${config.ready}`;
        readyContainer.appendChild(badge);
        instruction.innerHTML = config.nextInstruction;
        
        if (config.nextBtnId) {
            const nextBtn = futureSteps.querySelector(`#${config.nextBtnId}`);
            if (nextBtn) {
                nextBtn.classList.remove('inactive');
                activeContainer.innerHTML = '';
                activeContainer.appendChild(nextBtn);
            }
        } else { activeContainer.innerHTML = ''; }
        switchTab(config.tab);
    }
}

// --- 日志监控 ---

NetworkEvents.addEventListener('node-log', (e) => {
    const { nodeId, t, msg, type } = e.detail;
    const stream = document.getElementById('global-log-stream');
    if (stream && (type === 'in' || type === 'out')) {
        const line = document.createElement('div');
        line.style.marginBottom = '2px';
        line.innerHTML = `<span style="opacity:0.4">[${t}]</span> <b style="color:#818cf8">${nodeId.substring(0,8)}...</b>: <span style="color:${type==='in'?'#10b981':'#60a5fa'}">${msg}</span>`;
        stream.prepend(line);
        if (stream.children.length > 80) stream.lastChild.remove();
    }
    if (activeItem && activeItem.type === 'NODE' && activeItem.data.id === nodeId) renderPanel();
});

// --- 详情渲染 ---

function openPanel(type, data) {
    activeItem = { type, data };
    document.getElementById('side-panel').classList.add('open');
    renderPanel();
}

function renderPanel() {
    if (!activeItem) return;
    const { type, data } = activeItem;
    const body = document.getElementById('p-body');
    const title = document.getElementById('p-title');
    const subtitle = document.getElementById('p-subtitle');

    if (type === 'NODE') {
        const sid = data.id.substring(0, 12);
        title.textContent = `Node ${sid}...`;
        subtitle.textContent = "UUID 分布式链路";
        body.innerHTML = `
            <p class="form-label">物理 UUID:</p>
            <p style="font-family:monospace; font-size:10px; color:var(--text-dim); margin-bottom:12px; word-break:break-all;">${data.id}</p>
            <p class="form-label">P2P 连接状态:</p>
            <p style="font-size:14px; font-weight:700; color:var(--success); margin-bottom:16px;">${data.peers.size} 活跃 Peer</p>
            <p class="form-label">已知节点分布 (Hash Discoveries):</p>
            <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:16px;">
                ${Array.from(data.knownNodes).map(id => `<span style="font-size:9px; background:#f1f5f9; padding:2px 4px; border-radius:4px;">${id.substring(0,8)}</span>`).join('')}
            </div>
            <p class="form-label">实时同步日志:</p>
            <div style="background:#0f172a; color:#10b981; padding:12px; border-radius:8px; font-family:monospace; font-size:11px; height:200px; overflow-y:auto;">
                ${data.logs.map(l => `<div>[${l.t}] ${l.msg}</div>`).join('')}
            </div>
        `;
    } 
    else if (type === 'USER') {
        const user = data;
        title.textContent = `${user.pubKey.substring(0, 12)}...`;
        subtitle.textContent = "公钥持有资产 (Atomic Tokens)";
        
        const sorted = [...banknoteChains].sort((a, b) => {
            const aOwned = a.currentOwner === user.pubKey;
            const bOwned = b.currentOwner === user.pubKey;
            return aOwned === bOwned ? 0 : aOwned ? -1 : 1;
        });

        body.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:16px;">
                <p class="form-label">公钥 (唯一加密地址):</p>
                <p style="font-family:monospace; font-size:10px; word-break:break-all; color:var(--accent);">${user.pubKey}</p>
            </div>
            <p class="form-label">资产列表 (绿色为合法持有):</p>
            <div class="chain-grid" style="max-height: 400px; overflow-y: auto;">
                ${sorted.map(c => {
                    const isOwned = c.currentOwner === user.pubKey;
                    const gid = c.genesisHash.substring(0, 8);
                    return `<div class="chain-mini-card ${isOwned?'owned':''}" onclick="window.showChainDetail('${c.genesisHash}')">
                        <div style="font-size:11px;">$${c.denomination}</div>
                        <div style="font-size:7px; color:var(--text-dim); opacity:0.7;">${gid}</div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }
    else if (type === 'CHAIN') {
        const chain = data;
        const gidShort = chain.genesisHash.substring(0, 12);
        title.textContent = `Asset ${gidShort}...`;
        subtitle.textContent = `$${chain.denomination} 原子所有权链`;
        
        body.innerHTML = `
            <div class="payment-form">
                <p class="form-label">签署所有权转移</p>
                <label class="form-label">接收人 (Target PubKey)</label>
                <div style="display:flex; gap:4px;">
                    <input type="text" id="pay-target" class="form-input" style="flex:1" placeholder="PK...">
                    <button class="btn-step" style="padding:4px 8px; font-size:10px;" onclick="window.fillRandom()">随机</button>
                </div>
                <label class="form-label">签署身份</label>
                <select id="pay-signer" class="form-input">
                    ${accountManager.accounts.map(u => `<option value="${u.pubKey}">${u.pubKey.substring(0,10)}... ${u.pubKey === chain.currentOwner?'(当前持有)':''}</option>`).join('')}
                </select>
                <button class="btn-action" onclick="window.confirmPay('${chain.genesisHash}')">签署并全球同步</button>
            </div>
            <p class="form-label">账本区块同步状态 (新->旧):</p>
            ${chain.blocks.map((b, i) => `
                <div class="block-card">
                    <h4 style="font-size:9px; color:var(--accent); margin-bottom:4px;">Block #${i}</h4>
                    <div style="font-family:monospace; font-size:9px; overflow:hidden; color:var(--text-dim);">Hash: ${b.hash}</div>
                    <div style="font-family:monospace; font-size:10px; margin-top:4px; background:white; padding:6px; border-radius:4px; border:1px solid #eee;">${b.data}</div>
                </div>
            `).reverse().join('')}
        `;
    }
}

// --- 阶段执行 ---

document.getElementById('step-1').onclick = () => {
    if (currentStep >= 1) return;
    currentStep = 1;
    updateStepUI(2);
    
    // 正确启动 30 个本地节点
    for (let i = 0; i < 30; i++) {
        const uuid = crypto.randomUUID();
        const node = new P2PNode(uuid, connector, (n) => {
            const card = document.getElementById(`card-${n.id}`);
            if (card) {
                card.querySelectorAll('.slot').forEach((s, idx) => s.classList.toggle('active', idx < n.peers.size));
            }
        });
        localNodes.push(node);
        const card = document.createElement('div');
        card.id = `card-${uuid}`; card.className = 'node-card';
        card.innerHTML = `<div style="font-size:8px; font-weight:700; color:var(--text-dim);">${uuid.substring(0,13)}...</div><div class="slots">${'<div class="slot"></div>'.repeat(5)}</div>`;
        card.onclick = () => openPanel('NODE', node);
        document.getElementById('grid').appendChild(card);
    }
    setInterval(() => localNodes.forEach(n => n.tick()), 5000);
};

connector.onDiscovery((uuid) => {
    if (localNodes.find(n => n.id === uuid)) return;
    if (document.getElementById(`card-${uuid}`)) return;
    const card = document.createElement('div');
    card.id = `card-${uuid}`; card.className = 'node-card';
    card.style.borderColor = '#10b981';
    card.innerHTML = `<div style="font-size:8px; font-weight:700; color:#10b981;">REMOTE</div><div style="font-size:7px; color:var(--text-dim);">${uuid.substring(0,13)}...</div>`;
    document.getElementById('grid').appendChild(card);
});

document.getElementById('step-2').onclick = async () => {
    if (currentStep < 1 || currentStep >= 2) return;
    currentStep = 2;
    updateStepUI(3);
    // 正确启动 30 个加密身份
    for(let i=0; i<30; i++) await accountManager.createIdentity();
    renderUsersTab();
};

document.getElementById('step-3').onclick = async () => {
    if (currentStep < 2 || currentStep >= 3) return;
    currentStep = 3;
    updateStepUI(4);
    
    const issuerPk = "Issuer-Global-Root";
    // 正确启动 500 条原子资产链
    for (let s = 1; s <= 500; s++) {
        const genData = `GENESIS\nIssuer: AOB-Lab\n${issuerPk}`;
        const hash = await BlockchainUtils.sha256(genData + Math.random() + s);
        const genesis = { type: 'GENESIS', data: genData, hash: hash, parentIndex: -1 };
        
        const chain = new BanknoteChain(s, genesis);
        const randUser = accountManager.accounts[Math.floor(Math.random() * accountManager.accounts.length)];
        await chain.addTransferBlock("ISSUER-ROOT-KEY", randUser.pubKey);
        
        connector.root.get('chains').get(hash).put({
            serial: s,
            denomination: chain.denomination,
            blocks: JSON.stringify(chain.blocks)
        });
    }
};

// --- 全局渲染逻辑 ---

function renderUsersTab() {
    const container = document.getElementById('user-list-container');
    if (!container) return;
    container.innerHTML = accountManager.accounts.map(u => `
        <div class="user-profile-card" onclick="window.showUserDetailByPubKey('${u.pubKey}')">
            <div style="font-size:9px; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:6px;">PK Identity</div>
            <div style="font-size:12px; font-weight:800; color:var(--accent); font-family:monospace; word-break:break-all;">${u.pubKey.substring(0, 20)}...</div>
        </div>
    `).join('');
}

function renderBlockchainTab() {
    const container = document.getElementById('blockchain-list-container');
    if (!container) return;
    container.innerHTML = `<div class="chain-grid">${banknoteChains.map(c => `
        <div class="chain-mini-card" onclick="window.showChainDetail('${c.genesisHash}')">
            <div style="font-size:12px; font-weight:700; color:var(--accent);">$${c.denomination}</div>
            <div style="font-size:7px; color:var(--text-dim); font-family:monospace;">${c.genesisHash.substring(0, 8)}</div>
        </div>
    `).join('')}</div>`;
}

// --- Window 全局绑定 ---

window.showChainDetail = (hash) => openPanel('CHAIN', banknoteChains.find(c => c.genesisHash === hash));
window.showUserDetailByPubKey = (pk) => openPanel('USER', accountManager.accounts.find(u => u.pubKey === pk));
window.fillRandom = () => {
    const acc = accountManager.accounts[Math.floor(Math.random() * accountManager.accounts.length)];
    if (acc) document.getElementById('pay-target').value = acc.pubKey;
};
window.confirmPay = async (hash) => {
    const chain = banknoteChains.find(c => c.genesisHash === hash);
    const target = document.getElementById('pay-target').value;
    const signerPk = document.getElementById('pay-signer').value;
    const signer = accountManager.accounts.find(u => u.pubKey === signerPk);

    if (!target) return alert("请选择接收人公钥");
    await chain.addTransferBlock(signer.privKey, target);
    
    connector.root.get('chains').get(hash).get('blocks').put(JSON.stringify(chain.blocks));
    
    const sid = hash.substring(0, 8);
    if (localNodes.length > 0) {
        localNodes[0].broadcast(`Asset ${sid} flowed to ${target.substring(0,8)}... signed by ${signerPk.substring(0,8)}...`);
    }
    renderPanel();
};

document.getElementById('p-close').onclick = () => { activeItem = null; document.getElementById('side-panel').classList.remove('open'); };
window.onload = () => { document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab')))); };
