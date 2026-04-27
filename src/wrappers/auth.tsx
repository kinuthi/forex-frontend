import React, { useEffect, useState } from 'react';
import { history, useLocation } from 'umi';
import { getToken } from '@/services/authStorage';

export default function AuthWrapper(props: { children: React.ReactNode }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      history.replace(`/login?next=${next}`);
      setAllowed(false);
      return;
    }

    setAllowed(true);
  }, [location.pathname, location.search]);

  if (allowed !== true) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0a0a',
          color: '#666',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          letterSpacing: 2,
          fontSize: 12,
        }}
      >
        REDIRECTING…
      </div>
    );
  }

  return <>{props.children}</>;
}
