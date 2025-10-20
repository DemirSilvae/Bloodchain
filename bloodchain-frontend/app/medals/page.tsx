"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Navbar from "../../components/Navbar";

// 默认本地地址（启动本地部署时将自动使用本地链）
const BLOODCHAIN_ADDRESS = process.env.NEXT_PUBLIC_BLOODCHAIN_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const MEDALNFT_ADDRESS = process.env.NEXT_PUBLIC_MEDALNFT_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const BLOODCHAIN_COUNT_HANDLE_ABI = [
  {
    inputs: [],
    name: "getMyDonationCount",
    outputs: [{ internalType: "euint32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
];

const MEDALNFT_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "levelIndex", "type": "uint256" }],
    "name": "mintMedal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getThresholds",
    "outputs": [{ "internalType": "uint32[]", "name": "", "type": "uint32[]" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const MEDAL_LEVELS = [
  { name: "铜滴勋章", emoji: "🥉", color: "#CD7F32", threshold: 1 },
  { name: "银滴勋章", emoji: "🥈", color: "#C0C0C0", threshold: 10 },
  { name: "金滴勋章", emoji: "🥇", color: "#FFD700", threshold: 20 },
];

export default function MedalsPage() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [donationCount, setDonationCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [mintingIndex, setMintingIndex] = useState<number | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [countHandle, setCountHandle] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    setProvider(p);
    p.send("eth_chainId", []).then((hex: string) => setChainId(parseInt(hex, 16)));
    p.send("eth_accounts", []).then(async (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const s = await p.getSigner();
        setSigner(s);
        const addr = await s.getAddress();
        setAccount(addr);
        // 连接后等待用户主动解密
      }
    }).catch(() => {});
  }, []);

  const connect = async () => {
    if (!provider) return;
    await provider.send("eth_requestAccounts", []);
    const s = await provider.getSigner();
    setSigner(s);
    const addr = await s.getAddress();
    setAccount(addr);
    try { localStorage.setItem('bloodchain_connected', '1'); } catch {}
  };

  // 读取密文句柄并解密累计次数
  const decryptDonationCount = async () => {
    if (!provider || !signer || !chainId) return;
    try {
      setMessage("🔐 正在读取密文句柄...");
      const c = new ethers.Contract(BLOODCHAIN_ADDRESS, BLOODCHAIN_COUNT_HANDLE_ABI, signer);
      const handle: string = await c.getMyDonationCount();
      setCountHandle(handle);

      setMessage("🔓 正在解密...");
      let instance: any;
      if (chainId === 31337) {
        const { MockFhevmInstance } = await import("@fhevm/mock-utils");
        const p = new ethers.JsonRpcProvider("http://localhost:8545");
        let md: any = null; try { md = await p.send("fhevm_relayer_metadata", []);} catch {}
        instance = await (MockFhevmInstance as any).create(p, p, {
          aclContractAddress: md?.ACLAddress ?? "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
          inputVerifierContractAddress: md?.InputVerifierAddress ?? "0x901F8942346f7AB3a01F6D7613119Bca447Bb030",
          kmsContractAddress: md?.KMSVerifierAddress ?? "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
          chainId: 31337,
          gatewayChainId: 55815,
          verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
          verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
        });
      } else {
        const win = window as any;
        if (!win.relayerSDK) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
            s.type = "text/javascript";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("SDK load failed"));
            document.head.appendChild(s);
          });
        }
        await (window as any).relayerSDK.initSDK();
        instance = await (window as any).relayerSDK.createInstance({
          ...(window as any).relayerSDK.SepoliaConfig,
          network: (window as any).ethereum,
        });
      }

      const { publicKey, privateKey } = instance.generateKeypair();
      const start = Math.floor(Date.now() / 1000);
      const days = 365;
      const eip712 = instance.createEIP712(publicKey, [BLOODCHAIN_ADDRESS], start, days);
      const signature = await (signer as any).signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      const userAddr = await signer.getAddress();
      const res = await instance.userDecrypt(
        [{ handle, contractAddress: BLOODCHAIN_ADDRESS }],
        privateKey,
        publicKey,
        signature,
        [BLOODCHAIN_ADDRESS],
        userAddr,
        start,
        days
      );
      const clear = Number(res[handle]);
      setDonationCount(clear);
      setIsDecrypted(true);
      setMessage("✅ 解密完成");
      // 解密完成后预检测是否已领取
      await preCheckClaimed(clear);
    } catch (e: any) {
      setMessage(`❌ 解密失败: ${e?.message || e}`);
    }
  };

  const preCheckClaimed = async (clearCount: number) => {
    if (!signer) return;
    const contract = new ethers.Contract(MEDALNFT_ADDRESS, MEDALNFT_ABI, signer);
    const tmp: Record<number, boolean> = {};
    for (let i = 0; i < MEDAL_LEVELS.length; i++) {
      try {
        // 如果静态调用成功，说明可以领取（未领取且满足合约条件）
        await contract.callStatic.mintMedal(i);
        tmp[i] = false;
      } catch (e: any) {
        const reason = e?.reason || e?.error?.message || "";
        if (String(reason).includes("already claimed")) tmp[i] = true; else tmp[i] = false;
      }
    }
    setClaimed(tmp);
  };

  const mintMedal = async (levelIndex: number) => {
    if (!signer) return;
    try {
      setMessage("🎖 正在铸造勋章...");
      const contract = new ethers.Contract(MEDALNFT_ADDRESS, MEDALNFT_ABI, signer);
      const tx = await contract.mintMedal(levelIndex);
      await tx.wait();
      setMessage(`🎉 恭喜！${MEDAL_LEVELS[levelIndex].name} 铸造成功！`);
    } catch (e: any) {
      setMessage(`❌ 铸造失败: ${e?.message || e}`);
    } finally {
    }
  };

  return (
    <>
      <Navbar account={account} chainId={chainId || undefined} onConnect={connect} />
      
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 700, 
            marginBottom: '0.5rem',
            color: '#E74C3C'
          }}>
            🎖 勋章中心
          </h1>
          <p style={{ color: '#7F8C8D' }}>
            每累计献血达到一定次数，即可领取对应等级的荣誉勋章 NFT
          </p>
        </div>

        {!account ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>请先连接钱包</p>
            <button className="btn-primary" onClick={connect}>连接钱包</button>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-label">我的献血次数</div>
                <div className="stat-value">{donationCount ?? '-'}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn-primary" onClick={decryptDonationCount} disabled={isDecrypted || !account}>
                  {isDecrypted ? '已解密' : '读取并解密次数'}
                </button>
                {countHandle && (
                  <div style={{ alignSelf: 'center', fontFamily: 'monospace', color: '#7F8C8D' }}>
                    句柄: {countHandle.slice(0, 12)}...
                  </div>
                )}
              </div>
              {message && (
                <div style={{ marginTop: '0.5rem', color: '#7F8C8D' }}>{message}</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {MEDAL_LEVELS.map((medal, idx) => {
                const unlocked = !!isDecrypted && (donationCount ?? 0) >= medal.threshold;
                const isClaimed = !!claimed[idx];
                return (
                  <div
                    key={idx}
                    className="glass-card"
                    style={{
                      textAlign: 'center',
                      opacity: unlocked ? 1 : 0.6,
                      position: 'relative'
                    }}
                  >
                    {(unlocked || isClaimed) && (
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: '#2ECC71',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {isClaimed ? '✓ 已领取' : '✓ 已解锁'}
                      </div>
                    )}
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>
                      {medal.emoji}
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: medal.color }}>
                      {medal.name}
                    </h3>
                    <p style={{ color: '#7F8C8D', marginBottom: '1.5rem' }}>
                      献血满 {medal.threshold} 次解锁
                    </p>
                    <button
                      className="btn-primary"
                      onClick={async () => { setMintingIndex(idx); await mintMedal(idx); setMintingIndex(null); setClaimed(prev => ({ ...prev, [idx]: true })); }}
                      disabled={!unlocked || isClaimed || mintingIndex !== null}
                      style={{ width: '100%', opacity: unlocked && !isClaimed ? 1 : 0.6 }}
                    >
                      {isClaimed ? '已领取' : (mintingIndex === idx ? '铸造中...' : (unlocked ? '领取勋章' : `还需 ${Math.max(0, medal.threshold - (donationCount ?? 0))} 次`))}
                    </button>
                  </div>
                );
              })}
            </div>

            {message && (
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: message.includes('❌') ? '#F8D7DA' : '#D4EDDA',
                borderRadius: '12px',
                color: '#2C3E50',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

