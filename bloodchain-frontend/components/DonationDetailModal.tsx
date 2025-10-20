"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

interface DonationDetailModalProps {
  record: {
    ipfsCid: string;
    date: number;
    donationType: number;
    txHash: string;
    encVolume: string;
  };
  onClose: () => void;
  chainId: number;
  provider: ethers.BrowserProvider;
  contractAddress: string;
}

export default function DonationDetailModal({ record, onClose, chainId, provider, contractAddress }: DonationDetailModalProps) {
  const [decryptedVolume, setDecryptedVolume] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [metaAttrs, setMetaAttrs] = useState<Record<string, string> | null>(null);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const decryptVolume = async () => {
    try {
      setDecrypting(true);
      setMessage("正在解密体积...");
      
      let instance: any;
      if (chainId === 31337) {
        const { MockFhevmInstance } = await import("@fhevm/mock-utils");
        const p = new ethers.JsonRpcProvider("http://localhost:8545");
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
        // Sepolia: 需先 loadSDK
        if (!window.relayerSDK) {
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
        await window.relayerSDK.initSDK();
        instance = await window.relayerSDK.createInstance({
          ...window.relayerSDK.SepoliaConfig,
          network: window.ethereum,
        });
      }

      const s = await provider.getSigner();
      const { publicKey, privateKey } = instance.generateKeypair();
      const start = Math.floor(Date.now() / 1000);
      const days = 365;
      const eip712 = instance.createEIP712(publicKey, [contractAddress], start, days);
      const signature = await (s as any).signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      const addr = await s.getAddress();
      const res = await instance.userDecrypt(
        [{ handle: record.encVolume, contractAddress }],
        privateKey,
        publicKey,
        signature,
        [contractAddress],
        addr,
        start,
        days
      );
      setDecryptedVolume(res[record.encVolume].toString());
      setMessage("✅ 解密成功");
    } catch (e: any) {
      setMessage(`❌ 解密失败: ${e?.message || e}`);
    } finally {
      setDecrypting(false);
    }
  };

  // 加载 IPFS 元数据并解析 image、attributes
  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const metaGateways = [
          `https://gateway.pinata.cloud/ipfs/${record.ipfsCid}`,
          `https://ipfs.io/ipfs/${record.ipfsCid}`,
          `https://dweb.link/ipfs/${record.ipfsCid}`,
        ];

        let json: any = null;
        for (const url of metaGateways) {
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) { json = await res.json(); break; }
          } catch {}
        }
        if (!json) return;

        // 提取 image 字段
        const img = typeof json.image === "string" ? json.image : undefined;
        if (img) {
          const cid = img.startsWith("ipfs://") ? img.replace("ipfs://", "") : img;
          const imgGateways = [
            `https://gateway.pinata.cloud/ipfs/${cid}`,
            `https://ipfs.io/ipfs/${cid}`,
            `https://dweb.link/ipfs/${cid}`,
          ];
          if (!cancelled) setImageUrl(imgGateways[0]);
        }

        // 展示 attributes（仅常用字段）
        const attrs: Record<string, string> = {};
        if (Array.isArray(json.attributes)) {
          for (const a of json.attributes) {
            if (a?.trait_type && a?.value !== undefined) {
              attrs[a.trait_type] = String(a.value);
            }
          }
        }
        if (!cancelled) setMetaAttrs(attrs);
      } catch { /* ignore */ }
    };
    loadMeta();
    return () => { cancelled = true; };
  }, [record.ipfsCid]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '2rem',
            cursor: 'pointer',
            color: '#7F8C8D',
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', color: '#E74C3C' }}>
          {record.donationType === 0 ? '🩸 全血捐献详情' : '🔬 血小板捐献详情'}
        </h2>

        {/* 凭证图片 */}
        <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden' }}>
          <img
            src={imageUrl ?? ''}
            alt="献血凭证"
            style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', background: '#f5f5f5' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f5f5f5" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3E无法加载图片%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>

        {/* 记录信息 */}
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-label">献血日期</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#2C3E50' }}>
              {formatDate(record.date)}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">献血类型</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#2C3E50' }}>
              {record.donationType === 0 ? '全血' : '血小板'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">献血量（加密）</div>
            {decryptedVolume ? (
              <div className="stat-value" style={{ fontSize: '2rem' }}>
                {decryptedVolume} ml
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#7F8C8D', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
                  🔐 密文句柄: {record.encVolume.slice(0, 20)}...
                </div>
                <button
                  className="btn-primary"
                  onClick={decryptVolume}
                  disabled={decrypting}
                  style={{ width: '100%' }}
                >
                  {decrypting ? '解密中...' : '🔓 解密查看明文'}
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '12px' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>📋 IPFS CID:</strong>
              <a
                href={`https://gateway.pinata.cloud/ipfs/${record.ipfsCid}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#E74C3C', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.875rem', marginLeft: '0.5rem' }}
              >
                {record.ipfsCid}
              </a>
            </div>
            {metaAttrs && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {metaAttrs["LocationHash"] && (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#7F8C8D' }}>
                    📍 LocationHash: {metaAttrs["LocationHash"]}
                  </div>
                )}
                {metaAttrs["HospitalHash"] && (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#7F8C8D' }}>
                    🏥 HospitalHash: {metaAttrs["HospitalHash"]}
                  </div>
                )}
                {metaAttrs["Date"] && (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#7F8C8D' }}>
                    📅 Date(meta): {metaAttrs["Date"]}
                  </div>
                )}
              </div>
            )}
            <div>
              <strong>⛓️ 交易哈希:</strong>
              <a
                href={chainId === 31337 ? `#` : `https://sepolia.etherscan.io/tx/${record.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#E74C3C', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.875rem', marginLeft: '0.5rem' }}
              >
                {record.txHash.slice(0, 12)}...
              </a>
            </div>
          </div>

          {message && (
            <div style={{
              padding: '1rem',
              background: message.includes('❌') ? '#F8D7DA' : '#D4EDDA',
              borderRadius: '12px',
              color: '#2C3E50',
              textAlign: 'center',
            }}>
              {message}
            </div>
          )}
        </div>

        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          关闭
        </button>
      </div>
    </div>
  );
}

