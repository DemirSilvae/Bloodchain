"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Navbar from "../../components/Navbar";
import DonationDetailModal from "../../components/DonationDetailModal";

const BLOODCHAIN_ADDRESS = process.env.NEXT_PUBLIC_BLOODCHAIN_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const BLOODCHAIN_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "ipfsCid", "type": "string" },
      { "indexed": false, "internalType": "uint64", "name": "date", "type": "uint64" },
      { "indexed": false, "internalType": "bytes32", "name": "locationHash", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "hospitalHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint8", "name": "donationType", "type": "uint8" },
      { "indexed": false, "internalType": "uint32", "name": "volume", "type": "uint32" },
      { "indexed": false, "internalType": "bytes32", "name": "encVolume", "type": "bytes32" }
    ],
    "name": "DonationRecorded",
    "type": "event"
  }
];

type DonationRecord = {
  ipfsCid: string;
  date: number;
  donationType: number;
  txHash: string;
  encVolume: string;
};

export default function ArchivePage() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [records, setRecords] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DonationRecord | null>(null);

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
        await fetchRecords(p, addr);
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
    await fetchRecords(provider, addr);
  };

  const fetchRecords = async (p: ethers.BrowserProvider, addr: string) => {
    setLoading(true);
    try {
      const contract = new ethers.Contract(BLOODCHAIN_ADDRESS, BLOODCHAIN_ABI, p);
      const filter = contract.filters.DonationRecorded(addr);
      const events = await contract.queryFilter(filter);
      
      const parsed: DonationRecord[] = events.map((e: any) => ({
        ipfsCid: e.args.ipfsCid,
        date: Number(e.args.date),
        donationType: Number(e.args.donationType),
        txHash: e.transactionHash,
        encVolume: e.args.encVolume as string,
      })).reverse();

      setRecords(parsed);
    } catch (e) {
      console.error("Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
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
            📜 我的献血档案
          </h1>
          <p style={{ color: '#7F8C8D' }}>
            查看您所有的献血记录，所有数据均存储在区块链上
          </p>
        </div>

        {!account ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>请先连接钱包</p>
            <button className="btn-primary" onClick={connect}>连接钱包</button>
          </div>
        ) : loading ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <p>正在加载献血记录...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>暂无献血记录</h3>
            <p style={{ color: '#7F8C8D', marginBottom: '2rem' }}>
              开始您的第一次献血记录吧
            </p>
            <a href="/record">
              <button className="btn-primary">添加记录</button>
            </a>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* 时间轴线 */}
            <div style={{
              position: 'absolute',
              left: '2rem',
              top: '2rem',
              bottom: '2rem',
              width: '2px',
              background: 'linear-gradient(180deg, #E74C3C 0%, #FFD3B6 100%)',
              borderRadius: '2px'
            }} />

            {records.map((record, idx) => (
              <div key={idx} style={{ position: 'relative', marginBottom: '2rem', paddingLeft: '5rem' }}>
                {/* 时间轴节点 */}
                <div style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '2rem',
                  width: '1.5rem',
                  height: '1.5rem',
                  background: '#E74C3C',
                  borderRadius: '50%',
                  border: '4px solid white',
                  boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)'
                }} />

                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        {record.donationType === 0 ? '🩸 全血捐献' : '🔬 血小板捐献'}
                      </div>
                      <div style={{ color: '#7F8C8D', fontSize: '0.875rem' }}>
                        {formatDate(record.date)}
                      </div>
                    </div>
                    {/* 体积不展示明文，保持隐私 */}
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#7F8C8D' }}>📋 IPFS CID:</span>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${record.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#E74C3C', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.875rem' }}
                      >
                        {record.ipfsCid.slice(0, 12)}...
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#7F8C8D' }}>⛓️ 交易哈希:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#E74C3C', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.875rem' }}
                      >
                        {record.txHash.slice(0, 12)}...
                      </a>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => setSelectedRecord(record)}
                    style={{ width: '100%' }}
                  >
                    📖 查看详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedRecord && provider && chainId && (
          <DonationDetailModal
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            chainId={chainId}
            provider={provider}
            contractAddress={BLOODCHAIN_ADDRESS}
          />
        )}
      </div>
    </>
  );
}

