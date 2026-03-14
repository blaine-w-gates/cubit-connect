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
  });
  // Allow initial checkpoint/watchdog flow to finish before assertions.
  await page.waitForTimeout(3000);
}

async function waitForProject(page: Page, name: string, timeoutMs = 5000) {
  await page.waitForFunction(
    (projectName) => {
      const store = (window as any).__STORE__.getState();
      return store.todoProjects.some((p: any) => p.name === projectName);
    },
    name,
    { timeout: timeoutMs },
  );
}

async function waitForTaskInAnyProject(page: Page, taskName: string, timeoutMs = 10000) {
  await page.waitForFunction(
    (name) => {
      const store = (window as any).__STORE__.getState();
      return store.todoProjects.some((p: any) => p.todoRows?.some((r: any) => r.task === name));
    },
    taskName,
    { timeout: timeoutMs },
  );
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
    const aToken = 'A-edit';
    const bToken = 'B-edit';

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
          ({ rowId, text }) => (window as any).__STORE__.getState().updateTodoCell(rowId, 'task', text),
          { rowId: rowIdA, text: `${seedTask} ${aToken}` },
        ),
        b.page.evaluate(
          ({ rowId, text }) => (window as any).__STORE__.getState().updateTodoCell(rowId, 'task', text),
          { rowId: rowIdB, text: `${seedTask} ${bToken}` },
        ),
      ]);
      await a.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });
      await b.page.evaluate(async () => {
        await (window as any).__STORE__.getState().flushSyncNow();
      });

      await a.page.waitForFunction(
        (seed) => {
          const row = (window as any).__STORE__.getState().todoRows.find((r: any) => r.task.includes(seed));
          return !!row && row.task.includes('A-edit') && row.task.includes('B-edit');
        },
        seedTask,
        { timeout: 15000 },
      );

      await b.page.waitForFunction(
        (seed) => {
          const row = (window as any).__STORE__.getState().todoRows.find((r: any) => r.task.includes(seed));
          return !!row && row.task.includes('A-edit') && row.task.includes('B-edit');
        },
        seedTask,
        { timeout: 15000 },
      );
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

      await b.page.waitForFunction(
        (name) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === name),
        offlineTask,
        { timeout: 15000 },
      );
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

      await a.page.waitForFunction(
        (stepText) => {
          const row = (window as any).__STORE__.getState().todoRows.find((r: any) => r.task.includes('Task with steps-'));
          return !!row && row.steps?.[0]?.text === stepText;
        },
        bStepText,
        { timeout: 15000 },
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

      await d1.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p1);
      await d2.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p2);
      await d3.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), p3);
      await Promise.all([
        d1.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow()),
        d2.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow()),
        d3.page.evaluate(async () => (window as any).__STORE__.getState().flushSyncNow()),
      ]);

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
});
