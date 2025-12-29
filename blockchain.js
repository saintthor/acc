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

    // 签名模拟 (教育用途：使用内容+私钥的哈希表示签名)
    static async sign(content, privKey) {
        return await this.sha256(content + privKey);
    }

    static async verify(content, sig, pubKey, privKeyForSim) {
        // 在真实系统中，这里会使用非对称加密验证
        // 在此模拟器中，我们通过重新计算来验证
        const expected = await this.sha256(content + privKeyForSim);
        return sig === expected;
    }
}

export class BanknoteChain {
    constructor(serial, genesisBlock) {
        this.serial = serial;
        this.blocks = [genesisBlock]; // 块结构: { type, data, sig, hash }
        this.denomination = BlockchainUtils.getDenomination(serial);
    }

    get currentOwner() {
        const lastBlock = this.blocks[this.blocks.length - 1];
        if (lastBlock.type === 'GENESIS') {
            return lastBlock.data.split('\n')[2]; // K
        }
        // 对于新的数据结构，持有人公钥在第一行
        return lastBlock.data.split('\n')[0];
    }

    get lastHash() {
        return this.blocks[this.blocks.length - 1].hash;
    }

    async addTransferBlock(senderPrivKey, recipientPubKey) {
        const prevHash = this.lastHash;
        const ts = new Date().toISOString();
        // 核心数据：接收者、前一区块哈希、时间戳
        const coreData = `${recipientPubKey}\n${prevHash}\n${ts}`;
        // 对核心数据进行签名
        const sig = await BlockchainUtils.sign(coreData, senderPrivKey);
        // 最终存入区块的数据包含签名
        const finalData = `${coreData}\nSig: ${sig}`;
        const hash = await BlockchainUtils.sha256(finalData);
        
        const newBlock = { type: 'TRANSFER', data: finalData, sig, hash, sender: this.currentOwner };
        this.blocks.push(newBlock);
        return newBlock;
    }
}
