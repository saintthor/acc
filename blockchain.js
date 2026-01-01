/**
 * AOB (Atomic Ownership Blockchain) 核心逻辑
 */
export class BlockchainUtils {
    static async sha256(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return btoa(String.fromCharCode.apply(null, hashArray));
    }

    static getDenomination(serial) {
        if (serial <= 100) return 1;
        if (serial <= 200) return 5;
        if (serial <= 300) return 10;
        if (serial <= 400) return 20;
        if (serial <= 500) return 50;
        return 0;
    }

    static async sign(content, privKey) {
        // 在真实系统中，这是非对称签名。这里模拟一个基于内容和私钥的哈希签名。
        return await this.sha256(content + privKey);
    }
}

export class BanknoteChain {
    constructor(serial, genesisBlock) {
        this.serial = serial;
        this.blocks = [genesisBlock]; // 块结构: { type, data, sig, hash, parentIndex }
        this.denomination = BlockchainUtils.getDenomination(serial);
    }

    // 获取“名义上”的当前持有人（最长链末端）
    get currentOwner() {
        const lastBlock = this.blocks[this.blocks.length - 1];
        if (lastBlock.type === 'GENESIS') {
            return lastBlock.data.split('\n')[2];
        }
        return lastBlock.data.split('\n')[0];
    }

    /**
     * 添加支付区块
     * @param {string} senderPrivKey 发送者私钥
     * @param {string} recipientPubKey 接收者公钥
     * @param {number} parentIndex 父区块索引（允许分叉攻击测试）
     */
    async addTransferBlock(senderPrivKey, recipientPubKey, parentIndex = null) {
        const pIdx = parentIndex !== null ? parentIndex : this.blocks.length - 1;
        const parent = this.blocks[pIdx];
        const prevHash = parent.hash;
        const ts = new Date().toISOString();
        
        // 核心数据结构升级
        const coreData = `${recipientPubKey}\n${prevHash}\n${ts}\nType: TRANSFER`;
        const sig = await BlockchainUtils.sign(coreData, senderPrivKey);
        const finalData = `${coreData}\nSig: ${sig}`;
        const hash = await BlockchainUtils.sha256(finalData);
        
        const newBlock = { 
            type: 'TRANSFER', 
            data: finalData, 
            sig, 
            hash, 
            parentIndex: pIdx,
            signerPubKey: await this._simulateExtractPubKey(senderPrivKey) // 模拟从签名提取的公钥
        };
        
        this.blocks.push(newBlock);
        return newBlock;
    }

    async _simulateExtractPubKey(privKey) {
        // 这是一个模拟辅助函数：假设我们可以从签名/私钥关联中找到对应的公钥
        // 在本模拟器的 AccountManager 中，我们保持这种对应关系
        return "EXTRACTED_FROM_SIG"; 
    }

    getOwnerAt(idx) {
        const b = this.blocks[idx];
        if (b.type === 'GENESIS') return b.data.split('\n')[2];
        return b.data.split('\n')[0];
    }
}
