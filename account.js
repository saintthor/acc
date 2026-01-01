/**
 * AccountManager - 全局同步的加密身份管理
 */
export class AccountManager {
    constructor(gunRoot) {
        this.store = gunRoot.get('accounts');
        this.accounts = [];
        this.localAccounts = []; // 本页创建的账号
        
        // 监听全网账号
        this.store.map().on((data, pubKey) => {
            if (data && !this.accounts.find(a => a.pubKey === pubKey)) {
                this.accounts.push({
                    pubKey: pubKey,
                    privKey: data.privKey, // 仅用于实验室演示目的共享，实际环境中私钥不可共享
                    nodeIds: JSON.parse(data.nodeIds || '[]')
                });
                if (this.onSync) this.onSync();
            }
        });
    }

    _toBase64(buffer) {
        return window.btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
    }

    async createIdentity() {
        const pub = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
        const priv = this._toBase64(crypto.getRandomValues(new Uint8Array(32)));
        
        // 随机分配 3 个发现的节点
        const acc = {
            pubKey: pub,
            privKey: priv,
            nodeIds: JSON.stringify([]) // 稍后在 index.js 中绑定
        };

        this.store.get(pub).put(acc);
        return acc;
    }

    getUsersForNode(nodeId) {
        return this.accounts.filter(acc => acc.nodeIds.includes(nodeId));
    }
}