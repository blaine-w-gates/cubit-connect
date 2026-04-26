/**
 * Yjs Sync Diagnostics & Monitoring System
 * 
 * Purpose: Trace every ydoc instance lifecycle, observer registration,
 * and update propagation to diagnose SYNC-001.
 */

import * as Y from 'yjs';

// ============================================================================
// CAUSAL EVENT LOG
// ============================================================================

export type CausalEvent = {
  timestamp: number;
  sequence: number;
  phase: 'init' | 'reset' | 'loadProject' | 'connect' | 'network' | 'observer' | 'update' | 'error';
  instanceId: string;
  action: string;
  details: Record<string, unknown>;
  stackTrace?: string;
};

let globalSequence = 0;
const MAX_EVENTS = 1000;
const eventLog: CausalEvent[] = [];

export function logCausalEvent(
  phase: CausalEvent['phase'],
  instanceId: string,
  action: string,
  details: Record<string, unknown> = {}
): CausalEvent {
  const event: CausalEvent = {
    timestamp: Date.now(),
    sequence: ++globalSequence,
    phase,
    instanceId,
    action,
    details,
    stackTrace: new Error().stack?.split('\n').slice(2, 5).join(' | '),
  };
  
  eventLog.push(event);
  if (eventLog.length > MAX_EVENTS) {
    eventLog.shift();
  }
  
  // Always log to console in development
  if (typeof window !== 'undefined' && (window as unknown as { __SYNC_DIAGNOSTICS?: boolean }).__SYNC_DIAGNOSTICS) {
    // Causal event logged via audit system
  }
  
  return event;
}

export function getCausalLog(): CausalEvent[] {
  return [...eventLog];
}

export function clearCausalLog(): void {
  eventLog.length = 0;
  globalSequence = 0;
}

export function exportCausalLog(): string {
  return JSON.stringify(eventLog, null, 2);
}

// ============================================================================
// YDOC INSTANCE TRACKER
// ============================================================================

export type YDocInstance = {
  id: string;
  createdAt: number;
  destroyedAt?: number;
  createdBy: string;
  destroyedBy?: string;
  observerRegistered: boolean;
  observerRegisteredAt?: number;
  observerRegisteredBy?: string;
  networkSyncAttached: boolean;
  networkSyncAttachedAt?: number;
  networkSyncId?: string;
  updatesReceived: number;
  updatesApplied: number;
  observerCallbacksFired: number;
  zustandUpdatesTriggered: number;
};

const instanceRegistry = new Map<string, YDocInstance>();
const ydocToInstanceId = new WeakMap<Y.Doc, string>();
let instanceCounter = 0;

export function generateYDocId(): string {
  return `ydoc-${Date.now()}-${++instanceCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function registerYDocInstance(
  ydoc: Y.Doc,
  createdBy: string
): string {
  const id = generateYDocId();
  
  const instance: YDocInstance = {
    id,
    createdAt: Date.now(),
    createdBy,
    observerRegistered: false,
    networkSyncAttached: false,
    updatesReceived: 0,
    updatesApplied: 0,
    observerCallbacksFired: 0,
    zustandUpdatesTriggered: 0,
  };
  
  instanceRegistry.set(id, instance);
  ydocToInstanceId.set(ydoc, id);
  
  // Attach tracking to ydoc
  (ydoc as unknown as Record<string, unknown>).__instanceId = id;
  (ydoc as unknown as Record<string, unknown>).__tracker = instance;
  
  logCausalEvent('init', id, 'ydoc_created', {
    createdBy,
    guid: (ydoc as unknown as { guid: string }).guid,
  });
  
  // Monitor updates on this instance
  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    const inst = instanceRegistry.get(id);
    if (inst) {
      inst.updatesReceived++;
      inst.observerCallbacksFired++;
      
      logCausalEvent('update', id, 'ydoc_update_fired', {
        origin,
        updateLength: update.length,
        totalCallbacks: inst.observerCallbacksFired,
      });
    }
  });
  
  return id;
}

export function getInstanceId(ydoc: Y.Doc): string | undefined {
  return ydocToInstanceId.get(ydoc);
}

export function getInstance(id: string): YDocInstance | undefined {
  return instanceRegistry.get(id);
}

export function markInstanceDestroyed(
  ydoc: Y.Doc,
  destroyedBy: string
): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.destroyedAt = Date.now();
      instance.destroyedBy = destroyedBy;
      
      logCausalEvent('reset', id, 'ydoc_destroyed', {
        destroyedBy,
        lifetime: instance.destroyedAt - instance.createdAt,
        totalUpdates: instance.updatesReceived,
        totalCallbacks: instance.observerCallbacksFired,
      });
    }
  }
}

export function markObserverRegistered(
  ydoc: Y.Doc,
  registeredBy: string
): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.observerRegistered = true;
      instance.observerRegisteredAt = Date.now();
      instance.observerRegisteredBy = registeredBy;
      
      logCausalEvent('observer', id, 'observer_registered', {
        registeredBy,
        timeSinceCreation: instance.observerRegisteredAt - instance.createdAt,
      });
    }
  }
}

export function markNetworkSyncAttached(
  ydoc: Y.Doc,
  networkSyncId: string
): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.networkSyncAttached = true;
      instance.networkSyncAttachedAt = Date.now();
      instance.networkSyncId = networkSyncId;
      
      logCausalEvent('connect', id, 'network_sync_attached', {
        networkSyncId,
        timeSinceCreation: instance.networkSyncAttachedAt - instance.createdAt,
        observerAlreadyRegistered: instance.observerRegistered,
      });
    }
  }
}

export function recordZustandUpdate(ydoc: Y.Doc): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.zustandUpdatesTriggered++;
    }
  }
}

export function recordUpdateReceived(ydoc: Y.Doc): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.updatesReceived++;
    }
  }
}

export function markUpdateApplied(ydoc: Y.Doc): void {
  const id = ydocToInstanceId.get(ydoc);
  if (id) {
    const instance = instanceRegistry.get(id);
    if (instance) {
      instance.updatesApplied++;
    }
  }
}

export function getAllInstances(): YDocInstance[] {
  return Array.from(instanceRegistry.values());
}

export function getActiveInstance(): YDocInstance | undefined {
  return Array.from(instanceRegistry.values())
    .filter(i => !i.destroyedAt)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function getInstanceReport(): string {
  const instances = getAllInstances();
  const active = instances.filter(i => !i.destroyedAt);
  const destroyed = instances.filter(i => i.destroyedAt);
  
  return `
=== YDOC INSTANCE REPORT ===
Total instances created: ${instances.length}
Active instances: ${active.length}
Destroyed instances: ${destroyed.length}

ACTIVE INSTANCES:
${active.map(i => `
  ID: ${i.id}
  Created: ${new Date(i.createdAt).toISOString()} by ${i.createdBy}
  Observer registered: ${i.observerRegistered} ${i.observerRegisteredAt ? `at ${new Date(i.observerRegisteredAt).toISOString()}` : ''}
  NetworkSync attached: ${i.networkSyncAttached} ${i.networkSyncId ? `(${i.networkSyncId})` : ''}
  Updates received: ${i.updatesReceived}
  Observer callbacks: ${i.observerCallbacksFired}
  Zustand updates: ${i.zustandUpdatesTriggered}
`).join('')}

DESTROYED INSTANCES:
${destroyed.map(i => `
  ID: ${i.id}
  Lifetime: ${i.destroyedAt! - i.createdAt}ms
  Created by: ${i.createdBy}, Destroyed by: ${i.destroyedBy}
  Total updates: ${i.updatesReceived}
  Total callbacks: ${i.observerCallbacksFired}
`).join('')}
`;
}

// ============================================================================
// INVARIANT ASSERTIONS
// ============================================================================

export type InvariantViolation = {
  invariant: string;
  expected: unknown;
  actual: unknown;
  context: Record<string, unknown>;
  timestamp: number;
};

const invariantViolations: InvariantViolation[] = [];

export function assertInvariant(
  name: string,
  expected: unknown,
  actual: unknown,
  context: Record<string, unknown> = {}
): boolean {
  if (expected !== actual) {
    const violation: InvariantViolation = {
      invariant: name,
      expected,
      actual,
      context,
      timestamp: Date.now(),
    };
    invariantViolations.push(violation);
    
    console.error(`
🔴 INVARIANT VIOLATION: ${name}
Expected: ${expected}
Actual: ${actual}
Context: ${JSON.stringify(context, null, 2)}
Stack: ${new Error().stack?.split('\n').slice(2, 6).join('\n')}
    `);
    
    return false;
  }
  return true;
}

export function getInvariantViolations(): InvariantViolation[] {
  return [...invariantViolations];
}

export function clearInvariantViolations(): void {
  invariantViolations.length = 0;
}

// Critical invariants for SYNC-001
export function checkCriticalInvariants(
  currentYdoc: Y.Doc,
  networkSyncYdoc?: Y.Doc,
  observerRegisteredOn?: Y.Doc
): boolean {
  let allPassed = true;
  
  // Invariant 1: NetworkSync must use current ydoc
  if (networkSyncYdoc) {
    allPassed = assertInvariant(
      'NetworkSync uses current ydoc',
      getInstanceId(currentYdoc),
      getInstanceId(networkSyncYdoc),
      {
        currentYdocId: getInstanceId(currentYdoc),
        networkSyncYdocId: getInstanceId(networkSyncYdoc),
      }
    ) && allPassed;
  }
  
  // Invariant 2: Observer must be registered on current ydoc
  if (observerRegisteredOn) {
    allPassed = assertInvariant(
      'Observer registered on current ydoc',
      getInstanceId(currentYdoc),
      getInstanceId(observerRegisteredOn),
      {
        currentYdocId: getInstanceId(currentYdoc),
        observerYdocId: getInstanceId(observerRegisteredOn),
      }
    ) && allPassed;
  }
  
  // Invariant 3: Current ydoc must not be destroyed
  const currentId = getInstanceId(currentYdoc);
  if (currentId) {
    const instance = getInstance(currentId);
    allPassed = assertInvariant(
      'Current ydoc not destroyed',
      undefined,
      instance?.destroyedAt,
      {
        currentYdocId: currentId,
        destroyedAt: instance?.destroyedAt,
        destroyedBy: instance?.destroyedBy,
      }
    ) && allPassed;
  }
  
  return allPassed;
}

// ============================================================================
// SYNC STATE MACHINE
// ============================================================================

export type SyncPhase = 
  | 'disconnected'
  | 'initializing'
  | 'ydoc_reset'
  | 'loadProject_start'
  | 'loadProject_complete'
  | 'networkSync_creating'
  | 'networkSync_connecting'
  | 'catchup_pending'
  | 'catchup_complete'
  | 'live'
  | 'error';

export type SyncStateMachine = {
  currentPhase: SyncPhase;
  phaseHistory: Array<{ phase: SyncPhase; enteredAt: number; ydocId?: string }>;
  currentYdocId?: string;
  networkSyncId?: string;
  observerRegistered: boolean;
  error?: string;
};

const stateMachine: SyncStateMachine = {
  currentPhase: 'disconnected',
  phaseHistory: [{ phase: 'disconnected', enteredAt: Date.now() }],
  observerRegistered: false,
};

export function transitionToPhase(
  newPhase: SyncPhase,
  context: { ydocId?: string; networkSyncId?: string; error?: string } = {}
): void {
  const previousPhase = stateMachine.currentPhase;
  stateMachine.currentPhase = newPhase;
  stateMachine.phaseHistory.push({
    phase: newPhase,
    enteredAt: Date.now(),
    ydocId: context.ydocId,
  });
  
  if (context.ydocId) {
    stateMachine.currentYdocId = context.ydocId;
  }
  if (context.networkSyncId) {
    stateMachine.networkSyncId = context.networkSyncId;
  }
  if (context.error) {
    stateMachine.error = context.error;
  }
  
  logCausalEvent('connect', context.ydocId || 'unknown', 'phase_transition', {
    from: previousPhase,
    to: newPhase,
    duration: stateMachine.phaseHistory[stateMachine.phaseHistory.length - 1].enteredAt - 
             stateMachine.phaseHistory[stateMachine.phaseHistory.length - 2].enteredAt,
  });
  
}

export function markObserverRegisteredInStateMachine(): void {
  stateMachine.observerRegistered = true;
}

export function getSyncStateMachine(): SyncStateMachine {
  return { ...stateMachine };
}

export function validateStateMachine(): string[] {
  const errors: string[] = [];
  const history = stateMachine.phaseHistory;
  
  // Validate phase sequences
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    
    // Rule: ydoc_reset must happen before loadProject_start
    if (curr.phase === 'loadProject_start' && prev.phase !== 'ydoc_reset') {
      errors.push(`Invalid sequence: ${prev.phase} → ${curr.phase} (expected ydoc_reset before loadProject_start)`);
    }
    
    // Rule: observer must be registered before networkSync_creating
    if (curr.phase === 'networkSync_creating' && !stateMachine.observerRegistered) {
      errors.push('Observer not registered before NetworkSync creation');
    }
    
    // Rule: ydocId should not change mid-sequence without reset
    if (curr.ydocId && prev.ydocId && curr.ydocId !== prev.ydocId) {
      errors.push(`YDoc changed without reset: ${prev.ydocId} → ${curr.ydocId}`);
    }
  }
  
  return errors;
}

// ============================================================================
// DIAGNOSTIC REPORT
// ============================================================================

export function generateDiagnosticReport(): string {
  const stateMachineErrors = validateStateMachine();
  const invariants = getInvariantViolations();
  const instances = getAllInstances();
  const causalLog = getCausalLog().slice(-50); // Last 50 events
  
  return `
╔════════════════════════════════════════════════════════════════╗
║           SYNC-001 DIAGNOSTIC REPORT                           ║
╚════════════════════════════════════════════════════════════════╝

STATE MACHINE:
  Current Phase: ${stateMachine.currentPhase}
  Observer Registered: ${stateMachine.observerRegistered}
  Current YDoc ID: ${stateMachine.currentYdocId || 'UNKNOWN'}
  NetworkSync ID: ${stateMachine.networkSyncId || 'UNKNOWN'}
  Phase History (${stateMachine.phaseHistory.length} transitions):
${stateMachine.phaseHistory.map(h => `    ${new Date(h.enteredAt).toISOString()}: ${h.phase}${h.ydocId ? ` (${h.ydocId.slice(0, 8)}...)` : ''}`).join('\n')}

STATE MACHINE ERRORS: ${stateMachineErrors.length > 0 ? '\n' + stateMachineErrors.map(e => '  ❌ ' + e).join('\n') : 'None ✓'}

INVARIANT VIOLATIONS: ${invariants.length > 0 ? '\n' + invariants.map(v => `  ❌ ${v.invariant}: expected ${v.expected}, got ${v.actual}`).join('\n') : 'None ✓'}

ACTIVE YDOC INSTANCES: ${instances.filter(i => !i.destroyedAt).length}
${instances.filter(i => !i.destroyedAt).map(i => `
  📄 ${i.id}
     Created: ${new Date(i.createdAt).toISOString()} by ${i.createdBy}
     Observer: ${i.observerRegistered ? '✓' : '✗'} ${i.observerRegisteredAt ? `(${new Date(i.observerRegisteredAt).toISOString()})` : ''}
     NetworkSync: ${i.networkSyncAttached ? '✓' : '✗'} ${i.networkSyncId ? `(${i.networkSyncId.slice(0, 8)})` : ''}
     Updates: ${i.updatesReceived} received, ${i.observerCallbacksFired} callbacks, ${i.zustandUpdatesTriggered} Zustand updates
`).join('')}

RECENT CAUSAL EVENTS (last 50):
${causalLog.map(e => `  #${e.sequence} [${e.phase}] ${e.instanceId.slice(0, 8)}: ${e.action}`).join('\n')}

════════════════════════════════════════════════════════════════
`;
}

// ============================================================================
// STATE SNAPSHOTS (for before/after comparison)
// ============================================================================

export type StateSnapshot = {
  id: string;
  timestamp: number;
  label: string;
  causalLogSequence: number;
  stateMachinePhase: SyncPhase;
  activeYdocId?: string;
  instanceCount: number;
  observerRegistered: boolean;
  customData?: Record<string, unknown>;
};

const stateSnapshots: StateSnapshot[] = [];
const MAX_SNAPSHOTS = 10;

export function takeSnapshot(label: string, customData?: Record<string, unknown>): StateSnapshot {
  const stateMachine = getSyncStateMachine();
  const instances = getAllInstances();
  const activeInstance = instances.find(i => !i.destroyedAt);
  
  const snapshot: StateSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    label,
    causalLogSequence: globalSequence,
    stateMachinePhase: stateMachine.currentPhase,
    activeYdocId: stateMachine.currentYdocId,
    instanceCount: instances.length,
    observerRegistered: activeInstance?.observerRegistered ?? false,
    customData,
  };
  
  stateSnapshots.push(snapshot);
  if (stateSnapshots.length > MAX_SNAPSHOTS) {
    stateSnapshots.shift();
  }
  
  logCausalEvent('init', stateMachine.currentYdocId || 'unknown', 'snapshot_taken', {
    label,
    snapshotId: snapshot.id,
    phase: stateMachine.currentPhase,
  });
  
  return snapshot;
}

export function getSnapshots(): StateSnapshot[] {
  return [...stateSnapshots];
}

export function clearSnapshots(): void {
  stateSnapshots.length = 0;
}

export function compareSnapshots(snap1: StateSnapshot, snap2: StateSnapshot): string {
  const issues: string[] = [];
  
  if (snap1.stateMachinePhase !== snap2.stateMachinePhase) {
    issues.push(`Phase changed: ${snap1.stateMachinePhase} → ${snap2.stateMachinePhase}`);
  }
  
  if (snap1.activeYdocId !== snap2.activeYdocId) {
    issues.push(`YDoc changed: ${snap1.activeYdocId?.slice(0, 8)} → ${snap2.activeYdocId?.slice(0, 8)}`);
  }
  
  if (snap1.observerRegistered && !snap2.observerRegistered) {
    issues.push('Observer was LOST');
  }
  
  if (!snap1.observerRegistered && snap2.observerRegistered) {
    issues.push('Observer was GAINED');
  }
  
  const eventsBetween = globalSequence - snap1.causalLogSequence;
  
  return issues.length > 0 
    ? issues.join('\n') 
    : `No issues detected (${eventsBetween} events between snapshots)`;
}

// ============================================================================
// TEST HOOKS
// ============================================================================

export function enableDiagnostics(): void {
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__SYNC_DIAGNOSTICS = true;
    (window as unknown as Record<string, unknown>).__SYNC_MONITOR = {
      getCausalLog,
      getAllInstances,
      getInstanceReport,
      getSyncStateMachine,
      getInvariantViolations,
      generateDiagnosticReport,
      takeSnapshot,
      getSnapshots,
      clearSnapshots,
      compareSnapshots,
      clearAll: () => {
        clearCausalLog();
        clearInvariantViolations();
        clearSnapshots();
      },
    };
  }
}

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  enableDiagnostics();
}
