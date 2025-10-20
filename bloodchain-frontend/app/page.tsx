"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Link from "next/link";

declare global {
  interface Window {
    ethereum?: any;
    relayerSDK?: any;
  }
}

const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

async function loadRelayerSDK() {
  if (typeof window === "undefined") return;
  if (window.relayerSDK) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_CDN_URL;
    s.type = "text/javascript";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Relayer SDK load failed"));
    document.head.appendChild(s);
  });
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [fhevmStatus, setFhevmStatus] = useState<string>("未初始化");
  const [totalDonations, setTotalDonations] = useState<number>(0);
  const [lastDonationVolume, setLastDonationVolume] = useState<string>("-");
  const [countHandle, setCountHandle] = useState<string | null>(null);
  const [clearCount, setClearCount] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<string>("");

  // 合约地址 - 可改为配置
  const BLOODCHAIN_ADDRESS = process.env.NEXT_PUBLIC_BLOODCHAIN_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const MEDALNFT_ADDRESS = process.env.NEXT_PUBLIC_MEDALNFT_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  useEffect(() => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    setProvider(p);
    p.send("eth_chainId", []).then((hex: string) => {
      const id = parseInt(hex, 16);
      setChainId(id);
      initFhevm(id);
    });

    // 尝试自动恢复授权过的钱包
    p.send("eth_accounts", []).then(async (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const s = await p.getSigner();
        setSigner(s);
        setAccount(await s.getAddress());
        const net = await s.provider.getNetwork();
        setChainId(Number(net.chainId));
        initFhevm(Number(net.chainId));
      }
    }).catch(() => {});

    // 账户/网络变更监听
    const onAccountsChanged = async (accs: string[]) => {
      if (!accs || accs.length === 0) {
        setSigner(null); setAccount("");
        return;
      }
      const s = await p.getSigner();
      setSigner(s); setAccount(await s.getAddress());
    };
    const onChainChanged = async () => {
      const net = await p.getNetwork();
      setChainId(Number(net.chainId));
      initFhevm(Number(net.chainId));
    };
    window.ethereum?.on?.('accountsChanged', onAccountsChanged);
    window.ethereum?.on?.('chainChanged', onChainChanged);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  const initFhevm = async (chain: number) => {
    try {
      setFhevmStatus("初始化中...");
      if (chain === 31337) {
        setFhevmStatus("✅ 本地 Mock 模式");
      } else if (chain === 11155111) {
        await loadRelayerSDK();
        setFhevmStatus("✅ Sepolia Relayer SDK");
      } else {
        setFhevmStatus("⚠️ 不支持的链");
      }
    } catch (e) {
      setFhevmStatus("❌ 初始化失败");
    }
  };

  const readEncryptedCountHandle = async () => {
    if (!provider || !account) return;
    try {
      setDemoMsg("读取密文句柄中...");
      const abi = [{
        "inputs": [],
        "name": "getMyDonationCount",
        "outputs": [{ "internalType": "euint32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
      }];
      const s = await provider.getSigner();
      const c = new ethers.Contract(BLOODCHAIN_ADDRESS, abi, s);
      const handle: string = await c.getMyDonationCount();
      setCountHandle(handle);
      setDemoMsg("已获取到密文句柄");
    } catch (e: any) {
      setDemoMsg(`读取失败: ${e?.message || e}`);
    }
  };

  const decryptMyCount = async () => {
    if (!countHandle || !provider || !chainId) return;
    try {
      setDemoMsg("正在解密...");
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
        await loadRelayerSDK();
        await window.relayerSDK.initSDK();
        instance = await window.relayerSDK.createInstance({ ...window.relayerSDK.SepoliaConfig, network: window.ethereum });
      }
      const s = await provider.getSigner();
      const { publicKey, privateKey } = instance.generateKeypair();
      const start = Math.floor(Date.now() / 1000);
      const days = 365;
      const eip712 = instance.createEIP712(publicKey, [BLOODCHAIN_ADDRESS], start, days);
      const signature = await (s as any).signTypedData(eip712.domain, { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification }, eip712.message);
      const userAddr = await s.getAddress();
      const res = await instance.userDecrypt(
        [{ handle: countHandle, contractAddress: BLOODCHAIN_ADDRESS }],
        privateKey, publicKey, signature,
        [BLOODCHAIN_ADDRESS], userAddr, start, days
      );
      setClearCount(res[countHandle].toString());
      // 同步到统计卡片
      setTotalDonations(Number(res[countHandle]));
      setDemoMsg("解密完成");
      // 同步解密最近一次体积
      await readAndDecryptLastVolume();
    } catch (e: any) {
      setDemoMsg(`解密失败: ${e?.message || e}`);
    }
  };

  // 解密最近一次献血体积
  const readAndDecryptLastVolume = async () => {
    if (!provider || !chainId) return;
    try {
      const abi = [{
        "inputs": [],
        "name": "getMyLastVolume",
        "outputs": [{ "internalType": "euint32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
      }];
      const s = await provider.getSigner();
      const c = new ethers.Contract(BLOODCHAIN_ADDRESS, abi, s);
      const handle: string = await c.getMyLastVolume();

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
        await loadRelayerSDK();
        await window.relayerSDK.initSDK();
        instance = await window.relayerSDK.createInstance({ ...window.relayerSDK.SepoliaConfig, network: window.ethereum });
      }
      const { publicKey, privateKey } = instance.generateKeypair();
      const start = Math.floor(Date.now() / 1000);
      const days = 365;
      const eip712 = instance.createEIP712(publicKey, [BLOODCHAIN_ADDRESS], start, days);
      const signature = await (await provider.getSigner() as any).signTypedData(
        eip712.domain, { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification }, eip712.message
      );
      const userAddr = await (await provider.getSigner()).getAddress();
      const res = await instance.userDecrypt(
        [{ handle, contractAddress: BLOODCHAIN_ADDRESS }],
        privateKey, publicKey, signature,
        [BLOODCHAIN_ADDRESS], userAddr, start, days
      );
      setLastDonationVolume(`${res[handle].toString()} ml`);
    } catch (e) {
      // ignore
    }
  };

  const connect = async () => {
    if (!provider) return;
    await provider.send("eth_requestAccounts", []);
    const s = await provider.getSigner();
    setSigner(s);
    const addr = await s.getAddress();
    setAccount(addr);
    const id = await s.provider.getNetwork();
    const cid = Number(id.chainId);
    setChainId(cid);
    initFhevm(cid);
    // 记住连接
    try { localStorage.setItem('bloodchain_connected', '1'); } catch {}
    // 自动读取/解密统计
    try {
      await readEncryptedCountHandle();
      await decryptMyCount();
      await readAndDecryptLastVolume();
    } catch {}
  };

  return (
    <>
      <Navbar account={account} chainId={chainId || undefined} onConnect={connect} />
      
      <div className="container" style={{ paddingTop: '3rem' }}>
        {/* Hero Section */}
        <div className="glass-card" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 700,
            background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem'
          }}>
            献血记录存证平台
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#7F8C8D', marginBottom: '2rem' }}>
            基于区块链的去中心化献血记录存证，让每一份爱心都有迹可循
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/record">
              <button className="btn-primary">
                🩸 添加献血记录
              </button>
            </Link>
            <Link href="/archive">
              <button className="btn-secondary">
                📜 查看我的档案
              </button>
            </Link>
          </div>
        </div>

        {/* FHEVM 状态展示 */}
        <div className="glass-card" style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            🔐 FHEVM 隐私计算状态
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">链 ID</div>
              <div className="stat-value">{chainId || '-'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">网络</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                {chainId === 11155111 ? 'Sepolia' : chainId === 31337 ? 'Local' : '-'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">FHEVM 状态</div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                {fhevmStatus}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">合约地址</div>
              <div className="stat-value" style={{ fontSize: '0.875rem', wordBreak: 'break-all' }}>
                {BLOODCHAIN_ADDRESS.slice(0, 10)}...
              </div>
            </div>
          </div>
        </div>

      {/* FHEVM 密文 → 解密演示 */}
      {account && (
        <div className="glass-card" style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>🧪 FHEVM 密文解密演示</h2>
          <p style={{ color: '#7F8C8D', marginBottom: '1rem' }}>点击“读取密文句柄”从合约获取你的加密累计次数句柄，再点击“解密为明文”在本地完成解密。</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn-secondary" onClick={readEncryptedCountHandle}>读取密文句柄</button>
            <button className="btn-primary" onClick={decryptMyCount} disabled={!countHandle}>解密为明文</button>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <span className="stat-label">密文句柄</span>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{countHandle ?? '-'}</div>
            </div>
            <div>
              <span className="stat-label">解密后的明文</span>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>{clearCount ?? '-'}</div>
            </div>
            {demoMsg && (
              <div style={{ color: '#7F8C8D' }}>{demoMsg}</div>
            )}
          </div>
        </div>
      )}

        {/* 个人统计 */}
        {account && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="glass-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                📊 我的献血统计
              </h3>
              <div className="stat-card" style={{ marginBottom: '1rem' }}>
                <div className="stat-label">总献血次数</div>
                <div className="stat-value">{totalDonations}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">最近一次（解密体积）</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>{lastDonationVolume}</div>
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                🎖 可领取勋章
              </h3>
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏅</div>
                <p style={{ color: '#7F8C8D' }}>
                  当前暂无可领取勋章
                </p>
                <Link href="/medals">
                  <button className="btn-secondary" style={{ marginTop: '1rem' }}>
                    查看勋章中心
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {!account && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🔗</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>连接钱包以查看您的献血记录</h3>
            <p style={{ color: '#7F8C8D', marginBottom: '2rem' }}>
              使用 MetaMask 连接到 Sepolia 测试网
            </p>
            <button className="btn-primary" onClick={connect}>
              连接 MetaMask
            </button>
          </div>
        )}
      </div>
    </>
  );
}
