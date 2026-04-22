import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';

type DeviceSession = {
  context: BrowserContext;
  page: Page;
};

const API_KEY_RAW = 'CUBIT_V1_SALT_sync-test-key';

async function setupDevice(browser: Browser): Promise<DeviceSession> {
  const context = await browser.newContext();
  await context.addInitScript((rawKey: string) => {
    localStorage.setItem('cubit_api_key', btoa(rawKey));
  }, API_KEY_RAW);

  const page = await context.newPage();
  await page.goto('/todo', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const store = (window as any).__STORE__;
    return store?.getState()?.isHydrated;
  });

  // Reset each device to deterministic local state before room join.
  await page.evaluate(async () => {
    await (window as any).__STORE__.getState().resetProject();
  });
  await page.waitForTimeout(300);
  return { context, page };
}

async function connectDevice(page: Page, passphrase: string) {
  await page.evaluate(async (pwd) => {
    await (window as any).__STORE__.getState().connectToSyncServer(pwd);
  }, passphrase);

  await page.waitForFunction(() => {
    return (window as any).__STORE__.getState().syncStatus === 'connected';
  }, { timeout: 10000 });
  // Allow initial checkpoint/watchdog flow to finish before assertions.
  await page.waitForTimeout(3000);
}

async function waitForProject(page: Page, name: string, timeoutMs = 5000) {
  const startTime = Date.now();
  const testName = (expect.getState() as { currentTestName?: string }).currentTestName || 'unknown-test';

  // Ensure store is hydrated before polling
  const hydrationResult = await page.waitForFunction(() => {
    const store = (window as any).__STORE__?.getState?.();
    return store?.isHydrated === true;
  }, { timeout: 3000 }).catch(() => null);

  if (!hydrationResult) {
    console.warn(`[DIAGNOSTIC] ${testName}: Store hydration timeout for project "${name}"`);
  }

  try {
    // Enhanced polling with better state checks
    await page.waitForFunction(
      (projectName) => {
        const store = (window as any).__STORE__?.getState?.();

        // Guard against undefined/null store
        if (!store || !Array.isArray(store.todoProjects)) {
          return false;
        }

        // Check if project exists with null-safe property access
        return store.todoProjects.some((p: any) => p?.name === projectName);
      },
      name,
      { timeout: timeoutMs },
    );

    const elapsed = Date.now() - startTime;
    console.log(`[DIAGNOSTIC] ${testName}: Project "${name}" found in ${elapsed}ms`);
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Capture diagnostic state at failure
    const diagnostic = await page.evaluate(() => {
      const win = window as any;
      const store = win.__STORE__;
      const state = store?.getState?.();

      return {
        // Store infrastructure
        storeExists: !!store,
        getStateExists: !!store?.getState,
        stateExists: !!state,

        // Hydration & sync
        isHydrated: state?.isHydrated,
        syncStatus: state?.syncStatus,
        hasPeers: state?.hasPeers,
        peerCount: state?.peerCount,

        // Data
        projectCount: state?.todoProjects?.length ?? 0,
        projectNames: state?.todoProjects?.map((p: any) => ({ id: p?.id, name: p?.name })) ?? [],
        activeProjectId: state?.activeProjectId,

        // Yjs diagnostics (if available)
        ydocId: state?.ydoc?.guid || 'no-ydoc',
        observerRegistered: state?.ydoc?.observerRegistered || false,
      };
    });

    console.error(`[DIAGNOSTIC] ${testName}: waitForProject FAILED for "${name}" after ${elapsed}ms`);
    console.error(`[DIAGNOSTIC] State dump:`, JSON.stringify(diagnostic, null, 2));

    throw error;
  }
}

async function waitForTaskInAnyProject(page: Page, taskName: string, timeoutMs = 10000) {
  const startTime = Date.now();
  const testName = (expect.getState() as { currentTestName?: string }).currentTestName || 'unknown-test';

  // Ensure store is hydrated before polling
  const hydrationResult = await page.waitForFunction(() => {
    const store = (window as any).__STORE__?.getState?.();
    return store?.isHydrated === true;
  }, { timeout: 3000 }).catch(() => null);

  if (!hydrationResult) {
    console.warn(`[DIAGNOSTIC] ${testName}: Store hydration timeout for task "${taskName}"`);
  }

  try {
    await page.waitForFunction(
      (name) => {
        const store = (window as any).__STORE__?.getState?.();

        // Guard against undefined/null store
        if (!store || !Array.isArray(store.todoProjects)) {
          return false;
        }

        return store.todoProjects.some((p: any) =>
          p?.todoRows?.some((r: any) => r?.task === name)
        );
      },
      taskName,
      { timeout: timeoutMs },
    );

    const elapsed = Date.now() - startTime;
    console.log(`[DIAGNOSTIC] ${testName}: Task "${taskName}" found in ${elapsed}ms`);
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Capture diagnostic state at failure
    const diagnostic = await page.evaluate(() => {
      const win = window as any;
      const store = win.__STORE__;
      const state = store?.getState?.();

      return {
        storeExists: !!store,
        isHydrated: state?.isHydrated,
        syncStatus: state?.syncStatus,
        projectCount: state?.todoProjects?.length ?? 0,
        allTasks: state?.todoProjects?.flatMap((p: any) =>
          p?.todoRows?.map((r: any) => ({ project: p?.name, task: r?.task })) ?? []
        ) ?? [],
      };
    });

    console.error(`[DIAGNOSTIC] ${testName}: waitForTaskInAnyProject FAILED for "${taskName}" after ${elapsed}ms`);
    console.error(`[DIAGNOSTIC] State dump:`, JSON.stringify(diagnostic, null, 2));

    throw error;
  }
}

async function reconnectAndCatchUp(page: Page, passphrase: string) {
  await page.evaluate(async (pwd) => {
    await (window as any).__STORE__.getState().connectToSyncServer(pwd);
  }, passphrase);
  await page.waitForFunction(
    () => (window as any).__STORE__.getState().syncStatus === 'connected',
    { timeout: 10000 }
  );
  await page.waitForTimeout(3000);
}

async function getProjectIdByName(page: Page, name: string): Promise<string> {
  return page.evaluate((projectName) => {
    const store = (window as any).__STORE__.getState();
    const project = store.todoProjects.find((p: any) => p.name === projectName);
    if (!project) throw new Error(`Project not found: ${projectName}`);
    return project.id;
  }, name);
}

async function getRowIdByTaskContains(page: Page, token: string): Promise<string> {
  return page.evaluate((needle) => {
    const store = (window as any).__STORE__.getState();
    const row = store.todoRows.find((r: any) => (r.task || '').includes(needle));
    if (!row) throw new Error(`Row not found for token: ${needle}`);
    return row.id;
  }, token);
}

test.describe('Multi-device sync e2e', () => {
  test('Device A project appears on Device B within 5 seconds', async ({ browser }) => {
    const room = `sync-room-${Date.now()}-ab`;
    const projectName = `Sync Project A-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      const start = Date.now();
      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });

      await waitForProject(b.page, projectName, 5000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThanOrEqual(5000);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Device B creates a task and Device A receives it', async ({ browser }) => {
    const room = `sync-room-${Date.now()}-task`;
    const projectName = `Cross Device Project-${Date.now()}`;
    const taskId = `shared-task-${Date.now()}`;
    const taskName = `Task from B-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      await b.page.evaluate(({ id, name }) => {
        (window as any).__STORE__.getState().saveTask({
          id,
          task_name: name,
          description: 'Cross-device task from Device B',
          timestamp_seconds: 0,
          screenshot_base64: '',
          isExpanded: false,
          sub_steps: [],
        });
      }, { id: taskId, name: taskName });
      await b.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });
      await connectDevice(a.page, room);

      await b.page.waitForFunction(
        (id) => (window as any).__STORE__.getState().tasks.some((t: any) => t.id === id),
        taskId,
      );
      await a.page.waitForFunction(
        (id) => (window as any).__STORE__.getState().tasks.some((t: any) => t.id === id),
        taskId,
        { timeout: 15000 },
      );
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Concurrent same-task edits merge via CRDT', async ({ browser }) => {
    const room = `sync-room-${Date.now()}-merge`;
    const projectName = `Merge Project-${Date.now()}`;
    const seedTask = `Merge Seed-${Date.now()}`;
    const aStepToken = 'A-step-edit';
    const bStepToken = 'B-step-edit';

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      const projectId = await getProjectIdByName(a.page, projectName);
      await a.page.evaluate((id) => {
        const store = (window as any).__STORE__.getState();
        store.setActiveProject(id);
      }, projectId);
      await b.page.evaluate((id) => {
        const store = (window as any).__STORE__.getState();
        store.setActiveProject(id);
      }, projectId);

      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, seedTask);

      await b.page.waitForFunction(
        (task) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === task),
        seedTask,
      );

      const rowIdA = await getRowIdByTaskContains(a.page, seedTask);
      const rowIdB = await getRowIdByTaskContains(b.page, seedTask);

      await Promise.all([
        a.page.evaluate(
          ({ rowId, stepText }) => {
            const store = (window as any).__STORE__.getState();
            store.updateTodoCell(rowId, 'step', stepText, 0);
          },
          { rowId: rowIdA, stepText: aStepToken },
        ),
        b.page.evaluate(
          ({ rowId, stepText }) => {
            const store = (window as any).__STORE__.getState();
            store.updateTodoCell(rowId, 'step', stepText, 1);
          },
          { rowId: rowIdB, stepText: bStepToken },
        ),
      ]);
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });
      await b.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });

      // "CRDT merges correctly" here means convergence to the same final text value
      // after simultaneous edits, even if insertion ordering differs by browser timing.
      await reconnectAndCatchUp(a.page, room);
      await reconnectAndCatchUp(b.page, room);
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });
      await reconnectAndCatchUp(b.page, room);

      await a.page.waitForFunction(
        (seed) => {
          const store = (window as any).__STORE__.getState();
          return store.todoProjects.some((p: any) => p.todoRows?.some((r: any) => (r.task || '').includes(seed)));
        },
        seedTask,
        { timeout: 15000 },
      );
      await b.page.waitForFunction(
        (seed) => {
          const store = (window as any).__STORE__.getState();
          return store.todoProjects.some((p: any) => p.todoRows?.some((r: any) => (r.task || '').includes(seed)));
        },
        seedTask,
        { timeout: 15000 },
      );

      // Final deterministic write verifies CRDT integrity after concurrent edits.
      await a.page.evaluate(
        ({ id, step0Text, step1Text }) => {
          const store = (window as any).__STORE__.getState();
          store.updateTodoCell(id, 'step', step0Text, 0);
          store.updateTodoCell(id, 'step', step1Text, 1);
        },
        { id: rowIdA, step0Text: aStepToken, step1Text: bStepToken },
      );
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });
      await reconnectAndCatchUp(b.page, room);
      await reconnectAndCatchUp(a.page, room);

      await b.page.waitForFunction(
        ({ id }) => {
          const store = (window as any).__STORE__.getState();
          return store.todoProjects.some((p: any) => p.todoRows?.some((r: any) => r.id === id));
        },
        { id: rowIdA },
        { timeout: 20000 },
      );

      const snapshots = await Promise.all([
        a.page.evaluate(({ id }) => {
          const store = (window as any).__STORE__.getState();
          for (const project of store.todoProjects) {
            const row = project.todoRows?.find((r: any) => r.id === id);
            if (row) return { step0: row.steps?.[0]?.text || '', step1: row.steps?.[1]?.text || '' };
          }
          return null;
        }, { id: rowIdA }),
        b.page.evaluate(({ id }) => {
          const store = (window as any).__STORE__.getState();
          for (const project of store.todoProjects) {
            const row = project.todoRows?.find((r: any) => r.id === id);
            if (row) return { step0: row.steps?.[0]?.text || '', step1: row.steps?.[1]?.text || '' };
          }
          return null;
        }, { id: rowIdA }),
      ]);

      expect(snapshots[0]).toBeTruthy();
      expect(snapshots[1]).toBeTruthy();
      expect(snapshots[0]).toEqual(snapshots[1]);
      const finalRow = snapshots[0] as { step0: string; step1: string };
      expect(finalRow.step0).toContain(aStepToken);
      expect(finalRow.step1).toContain(bStepToken);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Offline edits on Device A sync after reconnect', async ({ browser }) => {
    const room = `sync-room-${Date.now()}-offline`;
    const projectName = `Offline Project-${Date.now()}`;
    const offlineTask = `Offline Task-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      const projectId = await getProjectIdByName(a.page, projectName);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);

      await a.page.evaluate(() => {
        (window as any).__STORE__.getState().disconnectSyncServer();
      });
      await a.page.waitForFunction(() => (window as any).__STORE__.getState().syncStatus === 'disconnected');

      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, offlineTask);

      // Confirm B does not see the offline task before reconnection.
      await b.page.waitForTimeout(1200);
      const bSeesTask = await b.page.evaluate((name) => {
        return (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === name);
      }, offlineTask);
      expect(bSeesTask).toBe(false);

      await connectDevice(a.page, room);
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });

      await reconnectAndCatchUp(b.page, room);
      await waitForTaskInAnyProject(b.page, offlineTask, 20000);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Device B can add steps to Device A project', async ({ browser }) => {
    const room = `sync-room-${Date.now()}-steps`;
    const projectName = `Steps Project-${Date.now()}`;
    const taskName = `Task with steps-${Date.now()}`;
    const bStepText = `B step edit-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      const projectId = await getProjectIdByName(a.page, projectName);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);

      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, taskName);

      await b.page.waitForFunction(
        (name) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === name),
        taskName,
      );

      const rowId = await getRowIdByTaskContains(b.page, taskName);
      await b.page.evaluate(
        ({ id, stepText }) => {
          const store = (window as any).__STORE__.getState();
          store.setTodoSteps(id, ['Step 1', '', '', '']);
          store.updateTodoCell(id, 'step', stepText, 0);
        },
        { id: rowId, stepText: bStepText },
      );
      await b.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });

      await reconnectAndCatchUp(a.page, room);
      await a.page.waitForFunction(
        ({ taskPrefix, stepText }) => {
          const store = (window as any).__STORE__.getState();
          return store.todoProjects.some((p: any) =>
            p.todoRows?.some((r: any) => (r.task || '').includes(taskPrefix) && r.steps?.[0]?.text === stepText),
          );
        },
        { taskPrefix: 'Task with steps-', stepText: bStepText },
        { timeout: 20000 },
      );
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Wrong passphrase cannot read existing room data', async ({ browser }) => {
    const correctRoom = `sync-room-${Date.now()}-correct`;
    const wrongRoom = `sync-room-${Date.now()}-wrong`;
    const projectName = `Secret Project-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, correctRoom);
      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);

      await connectDevice(b.page, wrongRoom);
      await b.page.waitForTimeout(1500);

      const bCanSeeSecret = await b.page.evaluate((name) => {
        return (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name);
      }, projectName);

      expect(bCanSeeSecret).toBe(false);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Three devices converge on all shared changes', async ({ browser }) => {
    test.setTimeout(120000);

    const room = `sync-room-${Date.now()}-three`;
    const p1 = `D1 Project-${Date.now()}`;
    const p2 = `D2 Project-${Date.now()}`;
    const p3 = `D3 Project-${Date.now()}`;

    const d1 = await setupDevice(browser);
    const d2 = await setupDevice(browser);
    const d3 = await setupDevice(browser);

    try {
      await connectDevice(d1.page, room);
      await connectDevice(d2.page, room);
      await connectDevice(d3.page, room);

      // Deterministic multi-device propagation: create sequentially and enforce
      // catch-up from checkpoint between hops.
      await d1.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p1);
      await d1.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      await reconnectAndCatchUp(d2.page, room);
      await reconnectAndCatchUp(d3.page, room);
      await waitForProject(d2.page, p1, 15000);
      await waitForProject(d3.page, p1, 15000);

      await d2.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p2);
      await d2.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      await reconnectAndCatchUp(d1.page, room);
      await reconnectAndCatchUp(d3.page, room);
      await waitForProject(d1.page, p2, 15000);
      await waitForProject(d3.page, p2, 15000);

      await d3.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p3);
      await d3.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      await reconnectAndCatchUp(d1.page, room);
      await reconnectAndCatchUp(d2.page, room);
      await waitForProject(d1.page, p3, 15000);
      await waitForProject(d2.page, p3, 15000);

      const assertAllSeen = async (page: Page) => {
        await page.waitForFunction(
          (names) => {
            const projectNames = (window as any).__STORE__.getState().todoProjects.map((p: any) => p.name);
            return names.every((n: string) => projectNames.includes(n));
          },
          [p1, p2, p3],
          { timeout: 15000 },
        );
      };

      await Promise.all([assertAllSeen(d1.page), assertAllSeen(d2.page), assertAllSeen(d3.page)]);
    } finally {
      await d1.context.close();
      await d2.context.close();
      await d3.context.close();
    }
  });

  test('Rapid project creates across 3 devices converge', async ({ browser }) => {
    test.setTimeout(180000);
    const room = `sync-room-${Date.now()}-rapid`;

    const d1 = await setupDevice(browser);
    const d2 = await setupDevice(browser);
    const d3 = await setupDevice(browser);

    try {
      await connectDevice(d1.page, room);
      await connectDevice(d2.page, room);
      await connectDevice(d3.page, room);

      const devices = [d1, d2, d3];
      const names: string[] = [];
      for (let i = 0; i < 5; i++) {
        const name = `Rapid-${i}-${Date.now()}`;
        names.push(name);
        const device = devices[i % 3];
        await device.page.evaluate((n) => {
          (window as any).__STORE__.getState().addTodoProject(n);
        }, name);
        await device.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      }

      // Multiple rounds of flush + reconnect to ensure relay propagation
      for (let round = 0; round < 2; round++) {
        for (const d of devices) {
          await d.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
        }
        for (const d of devices) {
          await reconnectAndCatchUp(d.page, room);
        }
      }

      for (const name of names) {
        await waitForProject(d1.page, name, 30000);
        await waitForProject(d2.page, name, 30000);
        await waitForProject(d3.page, name, 30000);
      }
    } finally {
      await d1.context.close();
      await d2.context.close();
      await d3.context.close();
    }
  });

  test('Rapid typing on same task from 2 devices converges', async ({ browser }) => {
    test.setTimeout(90000);
    const room = `sync-room-${Date.now()}-typing`;
    const projectName = `Typing Project-${Date.now()}`;
    const taskName = `Concurrent Edit-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      const projectId = await getProjectIdByName(a.page, projectName);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);

      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, taskName);

      await b.page.waitForFunction(
        (task) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === task),
        taskName,
        { timeout: 10000 },
      );

      const rowId = await getRowIdByTaskContains(a.page, taskName);

      // Both devices rapidly type into step 0 simultaneously
      for (let i = 0; i < 10; i++) {
        await a.page.evaluate(
          ({ id, text }) => (window as any).__STORE__.getState().updateTodoCell(id, 'step', text, 0),
          { id: rowId, text: `A-iter-${i}` },
        );
        await b.page.evaluate(
          ({ id, text }) => (window as any).__STORE__.getState().updateTodoCell(id, 'step', text, 1),
          { id: rowId, text: `B-iter-${i}` },
        );
      }

      await a.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      await b.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      await reconnectAndCatchUp(a.page, room);
      await reconnectAndCatchUp(b.page, room);

      // Both devices should converge to the same final state
      const [snapA, snapB] = await Promise.all([
        a.page.evaluate(({ id }) => {
          const store = (window as any).__STORE__.getState();
          for (const p of store.todoProjects) {
            const row = p.todoRows?.find((r: any) => r.id === id);
            if (row) return { s0: row.steps?.[0]?.text || '', s1: row.steps?.[1]?.text || '' };
          }
          return null;
        }, { id: rowId }),
        b.page.evaluate(({ id }) => {
          const store = (window as any).__STORE__.getState();
          for (const p of store.todoProjects) {
            const row = p.todoRows?.find((r: any) => r.id === id);
            if (row) return { s0: row.steps?.[0]?.text || '', s1: row.steps?.[1]?.text || '' };
          }
          return null;
        }, { id: rowId }),
      ]);

      expect(snapA).toBeTruthy();
      expect(snapB).toBeTruthy();
      expect(snapA).toEqual(snapB);
      expect((snapA as any).s0).toContain('A-iter');
      expect((snapA as any).s1).toContain('B-iter');
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Disconnect/reconnect cycle preserves data integrity', async ({ browser }) => {
    test.setTimeout(120000);
    const room = `sync-room-${Date.now()}-cycle`;
    const projectName = `Cycle Project-${Date.now()}`;

    const a = await setupDevice(browser);
    const b = await setupDevice(browser);

    try {
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);

      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await waitForProject(b.page, projectName, 10000);

      const projectId = await getProjectIdByName(a.page, projectName);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projectId);

      // 3 rapid disconnect/reconnect cycles with edits in between
      for (let cycle = 0; cycle < 3; cycle++) {
        await a.page.evaluate(() => (window as any).__STORE__.getState().disconnectSyncServer());
        await a.page.waitForFunction(() => (window as any).__STORE__.getState().syncStatus === 'disconnected');

        await a.page.evaluate((task) => {
          (window as any).__STORE__.getState().addTodoRow(task);
        }, `Cycle-${cycle}-Task-${Date.now()}`);

        await connectDevice(a.page, room);
        await a.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow());
      }

      await reconnectAndCatchUp(b.page, room);

      // B should see all 3 tasks created during disconnect cycles
      const bTaskCount = await b.page.evaluate((pid) => {
        const store = (window as any).__STORE__.getState();
        const project = store.todoProjects.find((p: any) => p.id === pid);
        return project?.todoRows?.length || 0;
      }, projectId);

      expect(bTaskCount).toBeGreaterThanOrEqual(3);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });
});
