'use client';

import { AuthCoreContextProvider } from '@particle-network/auth-core-modal';
import { AuthType } from '@particle-network/auth-core';
import { Solana } from '@particle-network/chains';

export default function ParticleAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthCoreContextProvider
      options={{
        projectId:  process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID  ?? '',
        clientKey:  process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY  ?? '',
        appId:      process.env.NEXT_PUBLIC_PARTICLE_APP_ID      ?? '',
        authTypes:  [AuthType.email, AuthType.google, AuthType.apple],
        themeType:  'dark',
        wallet:     { visible: false },
        customStyle: {
          projectName: 'D.FAITH Wallet',
          modalWidth:   400,
          modalHeight:  480,
          zIndex:       9999,
        },
        // Solana als primäre Chain → useSolana().address als stabiler Identifier
        chains: [Solana],
      } as never}
    >
      {children}
    </AuthCoreContextProvider>
  );
}
