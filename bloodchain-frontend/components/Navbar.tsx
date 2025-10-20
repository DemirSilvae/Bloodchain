"use client";

import React from 'react';
import Link from 'next/link';

interface NavbarProps {
  account?: string;
  chainId?: number;
  onConnect: () => void;
}

export default function Navbar({ account, chainId, onConnect }: NavbarProps) {
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav style={{
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(231, 76, 60, 0.18)',
      padding: '1rem 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              ❤️ BloodChain
            </h1>
          </Link>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            <Link href="/" style={{
              textDecoration: 'none',
              color: '#2C3E50',
              fontWeight: 500,
              transition: 'color 0.3s'
            }}>
              首页
            </Link>
            <Link href="/record" style={{
              textDecoration: 'none',
              color: '#2C3E50',
              fontWeight: 500,
              transition: 'color 0.3s'
            }}>
              献血记录
            </Link>
            <Link href="/medals" style={{
              textDecoration: 'none',
              color: '#2C3E50',
              fontWeight: 500,
              transition: 'color 0.3s'
            }}>
              勋章中心
            </Link>
            <Link href="/archive" style={{
              textDecoration: 'none',
              color: '#2C3E50',
              fontWeight: 500,
              transition: 'color 0.3s'
            }}>
              献血档案
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {chainId && (
            <span className="badge badge-success">
              {chainId === 11155111 ? 'Sepolia' : chainId === 31337 ? 'Localhost' : `Chain ${chainId}`}
            </span>
          )}
          
          {account ? (
            <div className="badge badge-warning">
              {truncateAddress(account)}
            </div>
          ) : (
            <button className="btn-primary" onClick={onConnect}>
              连接钱包
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}




