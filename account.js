/**
 * AccountManager - 管理加密身份和超级用户
 */
export class AccountManager {
    constructor(sessionPrefix) {
        this.sessionPrefix = sessionPrefix;
        this.storageKey = `atomic_accounts_v3_${sessionPrefix}`;
        this.superKey = `atomic_superuser_v3_${sessionPrefix}`;
        this.accounts = this.load();
        this.superUser = this.loadSuper();
    }

    _toBase64(buffer) {
        return window.btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
    }

    loadSuper() {
        const data = localStorage.getItem(this.superKey);
        if (data) return JSON.parse(data);
        
        // 创建超级用户
        const pub = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
        const priv = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
        const user = { id: 'SUPER-USER', pubKey: pub, privKey: priv };
        localStorage.setItem(this.superKey, JSON.stringify(user));
        return user;
    }

    async ensureAccountsCreated() {
        if (this.accounts.length > 0) return this.accounts;
        const newAccounts = [];
        for (let i = 1; i <= 30; i++) {
            const id = `USER-${String(i).padStart(2, '0')}`;
            const pub = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
            const priv = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
            const nodeIds = [];
            while(nodeIds.length < 3) {
                const nIdx = Math.floor(Math.random() * 30) + 1;
                const nId = `${this.sessionPrefix}-${String(nIdx).padStart(2, '0')}`;
                if (!nodeIds.includes(nId)) nodeIds.push(nId);
            }
            newAccounts.push({ id, pubKey: pub, privKey: priv, nodeIds });
        }
        this.accounts = newAccounts;
        this.save();
        return this.accounts;
    }

    save() { localStorage.setItem(this.storageKey, JSON.stringify(this.accounts)); }
    load() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    getUsersForNode(nodeId) {
        return this.accounts.filter(acc => acc.nodeIds.includes(nodeId));
    }
}
