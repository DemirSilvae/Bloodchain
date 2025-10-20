"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Navbar from "../../components/Navbar";

declare global {
  interface Window {
    ethereum?: any;
    relayerSDK?: any;
  }
}

const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxNTdkZjg5OS0wZjNhLTQxYTUtOTEyMi02YTAxNGM1ZDVjNmQiLCJlbWFpbCI6InN1bmpmNjI2QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI0M2U5N2ZmMDI1YmUzY2Q3NzJiMiIsInNjb3BlZEtleVNlY3JldCI6IjlhMTViY2I2ZmZkZjE4YWVlZDUwM2I5Zjk1ZTMzZDIyOTBjYTI2YmM2MzU3NWI2ODM1ODkyMGRjNzZiMjZmYTciLCJleHAiOjE3OTE1OTQwNzB9.bLafx4ZoPiKe8Yew08DlqFHhNW7Aaz74dLCoOxc_264";

const BLOODCHAIN_ADDRESS = process.env.NEXT_PUBLIC_BLOODCHAIN_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const BLOODCHAIN_ABI = [
  {
    "inputs": [
      { "internalType": "externalEuint32", "name": "inputVolume", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" },
      { "internalType": "string", "name": "ipfsCid", "type": "string" },
      { "internalType": "uint64", "name": "date", "type": "uint64" },
      { "internalType": "bytes32", "name": "locationHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "hospitalHash", "type": "bytes32" },
      { "internalType": "uint8", "name": "donationType", "type": "uint8" },
      { "internalType": "uint32", "name": "publicVolume", "type": "uint32" }
    ],
    "name": "recordDonation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

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

export default function RecordPage() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // 表单字段
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [hospital, setHospital] = useState<string>("");
  const [donationType, setDonationType] = useState<number>(0);
  const [volume, setVolume] = useState<number>(400);

  useEffect(() => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    setProvider(p);
    p.send("eth_chainId", []).then((hex: string) => setChainId(parseInt(hex, 16)));
    // 恢复授权账户
    p.send("eth_accounts", []).then(async (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const s = await p.getSigner();
        setSigner(s);
        setAccount(await s.getAddress());
      }
    }).catch(() => {});
  }, []);

  const connect = async () => {
    if (!provider) return;
    await provider.send("eth_requestAccounts", []);
    const s = await provider.getSigner();
    setSigner(s);
    setAccount(await s.getAddress());
    const id = await s.provider.getNetwork();
    setChainId(Number(id.chainId));
    try { localStorage.setItem('bloodchain_connected', '1'); } catch {}
  };

  const uploadToPinata = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: formData,
    });
    const data = await res.json();
    return data.IpfsHash;
  };

  const uploadJsonToPinata = async (json: any): Promise<string> => {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(json),
    });
    const data = await res.json();
    return data.IpfsHash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !signer || !file) return;

    try {
      setLoading(true);
      setMessage("📤 正在上传凭证到 IPFS...");

      // 1. 上传图片
      const imageCid = await uploadToPinata(file);
      setMessage(`✅ 图片已上传: ${imageCid}`);

      // 2. 生成哈希
      const locationHash = ethers.keccak256(ethers.toUtf8Bytes(location + account));
      const hospitalHash = ethers.keccak256(ethers.toUtf8Bytes(hospital + account));

      // 3. 生成 JSON metadata
      const metadata = {
        name: "Blood Donation Record",
        description: `献血记录 - ${date}`,
        image: `ipfs://${imageCid}`,
        attributes: [
          { trait_type: "Date", value: date },
          { trait_type: "LocationHash", value: locationHash },
          { trait_type: "HospitalHash", value: hospitalHash },
          // 不暴露具体体积，保持隐私
          { trait_type: "EncryptedVolume", value: true },
          { trait_type: "Type", value: donationType === 0 ? "全血" : "血小板" },
        ],
      };

      setMessage("📤 正在上传元数据到 IPFS...");
      const metadataCid = await uploadJsonToPinata(metadata);
      setMessage(`✅ 元数据已上传: ${metadataCid}`);

      // 4. 初始化 FHEVM
      setMessage("🔐 正在初始化 FHEVM...");
      let instance: any;
      if (chainId === 31337) {
        const { MockFhevmInstance } = await import("@fhevm/mock-utils");
        const rpcUrl = "http://localhost:8545";
        const p = new ethers.JsonRpcProvider(rpcUrl);
        let md: any = null;
        try { md = await p.send("fhevm_relayer_metadata", []); } catch {}
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
        instance = await window.relayerSDK.createInstance({
          ...window.relayerSDK.SepoliaConfig,
          network: window.ethereum,
        });
      }

      // 5. 加密体积
      setMessage("🔐 正在加密数据...");
      const buffer = instance.createEncryptedInput(BLOODCHAIN_ADDRESS, account);
      buffer.add32(BigInt(volume));
      const enc = await buffer.encrypt();

      // 6. 调用合约
      setMessage("⛓️ 正在上链存证...");
      const contract = new ethers.Contract(BLOODCHAIN_ADDRESS, BLOODCHAIN_ABI, signer);
      const tx = await contract.recordDonation(
        enc.handles[0],
        enc.inputProof,
        metadataCid,
        Math.floor(new Date(date).getTime() / 1000),
        locationHash,
        hospitalHash,
        donationType,
        0 // 公共体积置 0，体积仅通过 FHE 加密存储
      );

      setMessage("⏳ 等待交易确认...");
      await tx.wait();
      setMessage(`🎉 献血记录已成功上链！交易哈希: ${tx.hash}`);

      // 重置表单
      setFile(null);
      setDate("");
      setLocation("");
      setHospital("");
      setVolume(400);
    } catch (e: any) {
      setMessage(`❌ 失败: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar account={account} chainId={chainId || undefined} onConnect={connect} />
      
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 700, 
            marginBottom: '0.5rem',
            color: '#E74C3C'
          }}>
            🩸 添加献血记录
          </h1>
          <p style={{ color: '#7F8C8D', marginBottom: '2rem' }}>
            填写以下信息并上传凭证，您的献血记录将被永久保存在区块链上
          </p>

          {!account ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ marginBottom: '1.5rem' }}>请先连接钱包</p>
              <button className="btn-primary" onClick={connect}>连接钱包</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    献血凭证 *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      border: '2px dashed #E74C3C',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  />
                  <small style={{ color: '#7F8C8D' }}>支持 JPG、PNG 格式</small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    献血日期 *
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    献血地点 *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="例如：北京市海淀区中关村献血屋"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    医院/采血机构 *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="例如：北京血液中心"
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    献血类型 *
                  </label>
                  <select
                    className="input-field"
                    value={donationType}
                    onChange={(e) => setDonationType(Number(e.target.value))}
                  >
                    <option value={0}>全血</option>
                    <option value={1}>血小板</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    献血量 (ml) *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    min="200"
                    max="800"
                    step="100"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '1rem' }}
                >
                  {loading ? '处理中...' : '🔗 上链存证'}
                </button>
              </div>
            </form>
          )}

          {message && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: loading ? '#FFF3CD' : message.includes('❌') ? '#F8D7DA' : '#D4EDDA',
              borderRadius: '12px',
              color: '#2C3E50',
              wordBreak: 'break-all'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

