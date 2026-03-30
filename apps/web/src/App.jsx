import { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function App() {
  const [apiStatus, setApiStatus] = useState('checking...');

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status === 'ok' ? '✅ Connected' : '❌ Error'))
      .catch(() => setApiStatus('❌ API not running'));
  }, []);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0D4F4F 0%, #14897A 50%, #1a8a6e 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
        }}
      >
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>
          प्रजाशक्ति
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            margin: 0,
            fontWeight: 600,
          }}
        >
          Power of the Citizens
        </p>
      </div>

      {/* Day 1 Status Dashboard */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--color-border)',
          padding: 24,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          🚀 Day 1 — Project Initialisation
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Monorepo Structure', '✅ Complete', 'npm workspaces with apps/api, apps/web, apps/mobile'],
            ['API Server (Fastify)', apiStatus, 'Run: npm run dev:api'],
            ['Web Client (React + Vite)', '✅ Running', 'Run: npm run dev:web'],
            ['ESLint + Prettier', '✅ Configured', 'Run: npm run lint / npm run format'],
            ['Husky Pre-commit Hooks', '✅ Configured', 'Auto-runs lint-staged on git commit'],
            ['Mobile Shell (Expo)', '📱 Ready', 'Run: npm run dev:mobile'],
          ].map(([task, status, detail], i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: i % 2 === 0 ? '#F7FAFA' : '#fff',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{task}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{detail}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--color-border)',
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0D4F4F', marginBottom: 12 }}>
          📋 Day 2 Preview — Cloud Infrastructure
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Set up AWS account with IAM roles. Provision EKS cluster in ap-south-1. Set up RDS
          (PostgreSQL), ElastiCache (Redis), S3 bucket for media. Configure VPC, security groups,
          and bastion host.
        </p>
      </div>

      {/* Footer */}
      <p
        style={{
          textAlign: 'center',
          padding: '24px 0',
          fontSize: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        PrajaShakti v1.0.0 — Phase 1, Sprint 1
      </p>
    </div>
  );
}
