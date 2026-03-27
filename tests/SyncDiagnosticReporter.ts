/**
 * SyncDiagnosticReporter
 * 
 * Generates comprehensive diagnostic reports when sync tests fail.
 * Captures all relevant state for debugging SYNC-001 issues.
 */

import type { Page } from '@playwright/test';

export interface SyncDiagnosticData {
  timestamp: string;
  browserLogs: string[];
  networkStats: {
    messagesSent: number;
    messagesReceived: number;
    lastHeartbeatReceived: number;
  };
  peerState: {
    hasPeers: boolean;
    peerCount: number;
    roomId: string | null;
    roomFingerprint: string | null;
  };
  connectionHealth: {
    isHealthy: boolean;
    missedHeartbeats: number;
    consecutiveFailures: number;
    reconnectAttempts: number;
  };
  yjsState: {
    docGuid: string;
    todoCount: number;
  };
}

export class SyncDiagnosticReporter {
  static async collectFromPage(page: Page, name: string): Promise<SyncDiagnosticData> {
    const logs: string[] = [];
    
    // Capture any console logs that Playwright collected
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    return page.evaluate((peerName) => {
      // Access store and connection manager from window
      const store = (window as unknown as { 
        __STORE__?: { 
          getState: () => Record<string, unknown> 
        } 
      }).__STORE__;
      
      const connMgr = (window as unknown as { 
        __CONNECTION_MANAGER__?: { 
          getHealth: () => Record<string, unknown> 
        } 
      }).__CONNECTION_MANAGER__;

      const state = store?.getState() || {};
      const health = connMgr?.getHealth() || {};

      // Get Yjs doc info
      const ydoc = (window as unknown as { __YDOC__?: { guid: string } }).__YDOC__;
      
      return {
        timestamp: new Date().toISOString(),
        peerName,
        browserLogs: [], // Will be populated by Playwright
        networkStats: {
          messagesSent: (health.messagesSent as number) || 0,
          messagesReceived: (health.messagesReceived as number) || 0,
          lastHeartbeatReceived: (health.lastHeartbeatReceived as number) || 0,
        },
        peerState: {
          hasPeers: !!state.hasPeers,
          peerCount: (state.peerCount as number) || 0,
          roomId: (state.activeWorkspaceId as string) || null,
          roomFingerprint: (state.roomFingerprint as string) || null,
        },
        connectionHealth: {
          isHealthy: !!health.isHealthy,
          missedHeartbeats: (health.missedHeartbeats as number) || 0,
          consecutiveFailures: (health.consecutiveFailures as number) || 0,
          reconnectAttempts: (health.reconnectAttempts as number) || 0,
        },
        yjsState: {
          docGuid: ydoc?.guid || 'unknown',
          todoCount: ((state.todoRows as unknown[]) || []).length,
        },
      };
    }, name);
  }

  static generateReport(peerA: SyncDiagnosticData, peerB: SyncDiagnosticData): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('SYNC-001 DIAGNOSTIC REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    
    // Summary
    const roomMatch = peerA.peerState.roomId === peerB.peerState.roomId;
    const aHasPeers = peerA.peerState.hasPeers;
    const bHasPeers = peerB.peerState.hasPeers;
    
    lines.push('ISSUE SUMMARY:');
    lines.push(`  - Room ID Match: ${roomMatch ? '✅ YES' : '❌ NO'}`);
    if (!roomMatch) {
      lines.push(`    Peer A Room: ${peerA.peerState.roomId?.slice(0, 16)}...`);
      lines.push(`    Peer B Room: ${peerB.peerState.roomId?.slice(0, 16)}...`);
    }
    lines.push(`  - Peer A hasPeers: ${aHasPeers ? '✅ YES' : '❌ NO'}`);
    lines.push(`  - Peer B hasPeers: ${bHasPeers ? '✅ YES' : '❌ NO'}`);
    lines.push(`  - Messages: A sent ${peerA.networkStats.messagesSent}, B sent ${peerB.networkStats.messagesSent}`);
    lines.push(`  - Messages: A received ${peerA.networkStats.messagesReceived}, B received ${peerB.networkStats.messagesReceived}`);
    lines.push('');
    
    // Detailed Peer A
    lines.push('-'.repeat(80));
    lines.push('PEER A DETAILS:');
    lines.push('-'.repeat(80));
    lines.push(...this.formatPeerDetails(peerA));
    lines.push('');
    
    // Detailed Peer B
    lines.push('-'.repeat(80));
    lines.push('PEER B DETAILS:');
    lines.push('-'.repeat(80));
    lines.push(...this.formatPeerDetails(peerB));
    lines.push('');
    
    // Analysis
    lines.push('-'.repeat(80));
    lines.push('ANALYSIS:');
    lines.push('-'.repeat(80));
    
    if (!roomMatch) {
      lines.push('❌ CRITICAL: Peers are in different rooms.');
      lines.push('   → Check room passphrase hashing in cryptoSync.ts');
      lines.push('   → Verify deriveRoomId() returns deterministic results');
    } else if (peerA.networkStats.messagesReceived === 0 && peerB.networkStats.messagesReceived === 0) {
      lines.push('❌ CRITICAL: Peers not receiving any messages from server.');
      lines.push('   → Check server broadcast logic in sync-server/server.js');
      lines.push('   → Verify MSG_UPDATE is being broadcast to all clients in room');
    } else if (!aHasPeers && !bHasPeers) {
      lines.push('❌ Peers receiving messages but not detecting each other.');
      lines.push('   → Check presence heartbeat detection in networkSync.ts');
      lines.push('   → Verify onPeerPresence callback is being called');
      lines.push('   → Check for decryption failures (key mismatch)');
    }
    
    lines.push('');
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }

  private static formatPeerDetails(data: SyncDiagnosticData): string[] {
    const lines: string[] = [];
    
    lines.push(`  Room ID:      ${data.peerState.roomId || 'N/A'}`);
    lines.push(`  Fingerprint:  ${data.peerState.roomFingerprint || 'N/A'}`);
    lines.push(`  Yjs Doc GUID: ${data.yjsState.docGuid}`);
    lines.push(`  Todo Count:   ${data.yjsState.todoCount}`);
    lines.push('');
    lines.push('  Peer State:');
    lines.push(`    - hasPeers: ${data.peerState.hasPeers}`);
    lines.push(`    - peerCount: ${data.peerState.peerCount}`);
    lines.push('');
    lines.push('  Connection Health:');
    lines.push(`    - isHealthy: ${data.connectionHealth.isHealthy}`);
    lines.push(`    - missedHeartbeats: ${data.connectionHealth.missedHeartbeats}`);
    lines.push(`    - reconnectAttempts: ${data.connectionHealth.reconnectAttempts}`);
    lines.push('');
    lines.push('  Network Stats:');
    lines.push(`    - messagesSent: ${data.networkStats.messagesSent}`);
    lines.push(`    - messagesReceived: ${data.networkStats.messagesReceived}`);
    lines.push(`    - lastHeartbeat: ${data.networkStats.lastHeartbeatReceived ? new Date(data.networkStats.lastHeartbeatReceived).toISOString() : 'never'}`);
    
    return lines;
  }
}
