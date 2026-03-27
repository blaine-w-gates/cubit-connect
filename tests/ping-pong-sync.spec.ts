/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';

/**
 * Specification Engineering: Ping-Pong Bidirectional Sync Test
 * Goal: Verify strict alternating A→B→A→B convergence across all Cubit Connect operations.
 * 
 * This test validates that:
 * 1. Changes made on Device A propagate to Device B
 * 2. Changes made on Device B propagate to Device A
 * 3. Both devices converge to identical state after each operation
 * 4. Complex operations (deep dive, dial focus, rabbit positioning) sync correctly
 * 5. No directional bias exists in the sync protocol
 */

type DeviceSession = {
  context: BrowserContext;
  page: Page;
  name: string;
};

// const API_KEY_RAW = 'CUBIT_V1_SALT_pingpong-test-key';

async function setupDevice(browser: Browser, name: string): Promise<DeviceSession> {
  const context = await browser.newContext();

  const page = await context.newPage();
  
  // Navigate first, then set localStorage, then reload (like sync-reconciliation.spec.ts)
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_pingpong-test-key'));
    localStorage.setItem('sync_server_url', 'ws://localhost:8080');
    localStorage.setItem('theme', 'dark');
  });
  await page.reload();
  
  await page.waitForFunction(() => {
    const store = (window as any).__STORE__;
    return store?.getState()?.isHydrated;
  });

  // Reset to deterministic state before room join
  await page.evaluate(async () => {
    await (window as any).__STORE__.getState().resetProject();
  });
  await page.waitForTimeout(300);

  return { context, page, name };
}

async function connectDevice(page: Page, passphrase: string) {
  // Use UI-based connection like sync-reconciliation.spec.ts
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await page.getByPlaceholder('Enter a shared secret...').fill(passphrase);
  await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
  await expect(page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
  
  // Wait for peer discovery BEFORE closing modal
  await page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 20000 });
  
  // Close the modal
  await page.getByRole('button', { name: 'Close', exact: false }).or(page.locator('button:has(svg.lucide-x)')).click();
}

async function reconnectAndCatchUp(page: Page) {
  // Just flush - the WebSocket is already connected
  await page.evaluate(async () => {
    await (window as any).__STORE__.getState().flushSyncNow();
  });
  await page.waitForTimeout(2000);
}

async function flushSync(page: Page) {
  await page.evaluate(async () => {
    await (window as any).__STORE__.getState().flushSyncNow();
  });
  await page.waitForTimeout(500);
}

async function waitForProject(page: Page, name: string, timeoutMs = 10000) {
  await page.waitForFunction(
    (projectName) => {
      const store = (window as any).__STORE__.getState();
      return store.todoProjects.some((p: any) => p.name === projectName);
    },
    name,
    { timeout: timeoutMs }
  );
}

async function waitForProjectGone(page: Page, name: string, timeoutMs = 10000) {
  await page.waitForFunction(
    (projectName) => {
      const store = (window as any).__STORE__.getState();
      return !store.todoProjects.some((p: any) => p.name === projectName);
    },
    name,
    { timeout: timeoutMs }
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

async function waitForTask(page: Page, taskName: string, timeoutMs = 10000) {
  await page.waitForFunction(
    (name) => {
      const store = (window as any).__STORE__.getState();
      return store.todoRows.some((r: any) => r.task === name);
    },
    taskName,
    { timeout: timeoutMs }
  );
}

async function waitForTaskGone(page: Page, taskName: string, timeoutMs = 10000) {
  await page.waitForFunction(
    (name) => {
      const store = (window as any).__STORE__.getState();
      return !store.todoRows.some((r: any) => r.task === name);
    },
    taskName,
    { timeout: timeoutMs }
  );
}

async function getRowIdByTask(page: Page, taskName: string): Promise<string> {
  return page.evaluate((name) => {
    const store = (window as any).__STORE__.getState();
    const row = store.todoRows.find((r: any) => r.task === name);
    if (!row) throw new Error(`Row not found for task: ${name}`);
    return row.id;
  }, taskName);
}

async function getStoreSnapshot(page: Page) {
  return page.evaluate(() => {
    const store = (window as any).__STORE__.getState();
    const activeProject = store.todoProjects.find((p: any) => p.id === store.activeProjectId);
    return {
      projectCount: store.todoProjects.length,
      projectNames: store.todoProjects.map((p: any) => p.name).sort(),
      activeProjectId: store.activeProjectId,
      taskCount: store.todoRows.length,
      taskNames: store.todoRows.map((r: any) => r.task).sort(),
      dialLeft: activeProject?.priorityDials?.left || '',
      dialRight: activeProject?.priorityDials?.right || '',
      dialFocusedSide: activeProject?.priorityDials?.focusedSide || 'none',
      rows: store.todoRows.map((r: any) => ({
        id: r.id,
        task: r.task,
        steps: r.steps?.map((s: any) => s.text) || [],
        stepsCompleted: r.steps?.map((s: any) => s.isCompleted) || [],
        isCompleted: r.isCompleted,
      })),
    };
  });
}

async function verifyStoresMatch(pageA: Page, pageB: Page, description: string) {
  const [snapA, snapB] = await Promise.all([
    getStoreSnapshot(pageA),
    getStoreSnapshot(pageB),
  ]);

  expect(snapA.projectCount).toBe(snapB.projectCount);
  expect(snapA.taskCount).toBe(snapB.taskCount);
  expect(snapA.dialLeft).toBe(snapB.dialLeft);
  expect(snapA.dialRight).toBe(snapB.dialRight);
  expect(snapA.dialFocusedSide).toBe(snapB.dialFocusedSide);
  
  // Deep compare rows
  expect(snapA.rows.length).toBe(snapB.rows.length);
  for (let i = 0; i < snapA.rows.length; i++) {
    const rowA = snapA.rows[i];
    const rowB = snapB.rows.find((r: any) => r.id === rowA.id);
    expect(rowB).toBeTruthy();
    expect(rowA.task).toBe(rowB!.task);
    expect(rowA.steps).toEqual(rowB!.steps);
    expect(rowA.isCompleted).toBe(rowB!.isCompleted);
  }

  console.log(`✅ ${description}: Stores match (${snapA.projectCount} projects, ${snapA.taskCount} tasks)`);
  return { snapA, snapB };
}

test.describe('Ping-Pong Bidirectional Sync', () => {
  test.setTimeout(300000);

  test('DEBUG: Basic connection test', async ({ browser }) => {
    const room = `debug-${Date.now()}`;
    
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      console.log('DEBUG: Connecting device A...');
      await a.page.getByRole('button', { name: 'Sync', exact: true }).click();
      
      // Take screenshot of modal
      await a.page.waitForTimeout(500);
      
      await a.page.getByPlaceholder('Enter a shared secret...').fill(room);
      await a.page.getByRole('button', { name: 'Establish Secure Connection' }).click();
      
      // Wait longer and check status
      await a.page.waitForTimeout(5000);
      const statusA = await a.page.evaluate(() => (window as any).__STORE__.getState().syncStatus);
      console.log('Device A status:', statusA);
      
      await expect(a.page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
      console.log('DEBUG: A connected successfully');

      console.log('DEBUG: Connecting device B...');
      await b.page.getByRole('button', { name: 'Sync', exact: true }).click();
      await b.page.getByPlaceholder('Enter a shared secret...').fill(room);
      await b.page.getByRole('button', { name: 'Establish Secure Connection' }).click();
      
      await b.page.waitForTimeout(5000);
      const statusB = await b.page.evaluate(() => (window as any).__STORE__.getState().syncStatus);
      console.log('Device B status:', statusB);
      
      await expect(b.page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
      console.log('DEBUG: B connected successfully');
      
      // Wait for peer discovery
      await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 20000 });
      await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 20000 });
      
      const hasPeersA = await a.page.evaluate(() => (window as any).__STORE__.getState().hasPeers);
      const hasPeersB = await b.page.evaluate(() => (window as any).__STORE__.getState().hasPeers);
      console.log('Peer discovery - A:', hasPeersA, 'B:', hasPeersB);
      
      expect(hasPeersA).toBe(true);
      expect(hasPeersB).toBe(true);
      
      console.log('✅ DEBUG TEST PASSED');
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('AC1-AC11: Complete ping-pong sequence with all operation types', async ({ browser }) => {
    const room = `pingpong-${Date.now()}`;
    const timestamps = Date.now();
    
    // Project names
    const projectA = `PingPong-Project-A-${timestamps}`;
    // const projectB = `PingPong-Project-B-${timestamps}`;
    
    // Task names
    const taskA = `Task-From-A-${timestamps}`;
    // const taskB = `Task-From-B-${timestamps}`;
    const deepDiveTask = `DeepDive-Task-${timestamps}`;
    
    // Setup devices
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      console.log('🚀 Starting Ping-Pong Sync Test...');

      // ============================================================
      // STEP 1: Connect both devices to same room
      // ============================================================
      console.log('\n📡 STEP 1: Connecting devices...');
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);
      
      // Wait for peer discovery
      await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
      await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
      console.log('✅ Both devices connected and discovered each other');

      // ============================================================
      // STEP 2: A creates project → B receives it (AC1)
      // ============================================================
      console.log('\n🔄 STEP 2: A creates project, B receives it (AC1)');
      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectA);
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      
      await waitForProject(b.page, projectA, 10000);
      await verifyStoresMatch(a.page, b.page, 'AC1: Project A→B');

      // ============================================================
      // STEP 3: B activates project A → Both on same project
      // ============================================================
      console.log('\n🔄 STEP 3: B activates project A');
      const projectAId = await getProjectIdByName(b.page, projectA);
      await b.page.evaluate((id) => {
        (window as any).__STORE__.getState().setActiveProject(id);
      }, projectAId);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      await verifyStoresMatch(a.page, b.page, 'Project activation sync');

      // ============================================================
      // STEP 4: A adds task → B receives it (AC3)
      // ============================================================
      console.log('\n🔄 STEP 4: A adds task, B receives it (AC3)');
      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, taskA);
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      
      await waitForTask(b.page, taskA, 10000);
      await verifyStoresMatch(a.page, b.page, 'AC3: Task A→B');

      // ============================================================
      // STEP 5: B adds steps via Cubit → A receives them (AC5)
      // ============================================================
      console.log('\n🔄 STEP 5: B adds steps via Cubit, A receives them (AC5)');
      const rowIdForCubit = await getRowIdByTask(b.page, taskA);
      
      // Simulate Cubit by directly setting steps (mocking AI response)
      await b.page.evaluate(({ rowId, steps }) => {
        (window as any).__STORE__.getState().setTodoSteps(rowId, steps);
      }, { 
        rowId: rowIdForCubit, 
        steps: ['Step 1: Research', 'Step 2: Design', 'Step 3: Implement', 'Step 4: Test']
      });
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      const snapAfterCubit = await verifyStoresMatch(a.page, b.page, 'AC5: Cubit steps B→A');
      expect(snapAfterCubit.snapA.rows[0].steps).toContain('Step 1: Research');

      // ============================================================
      // STEP 6: B deep dives step 0 → A receives new task with 4 steps (AC6)
      // ============================================================
      console.log('\n🔄 STEP 6: B deep dives step 0 → A receives new task (AC6)');
      const rowIdForDeepDive = await getRowIdByTask(b.page, taskA);
      
      // Deep dive: create new task from step 0
      await b.page.evaluate(({ afterRowId, taskText, steps }) => {
        const newRowId = (window as any).__STORE__.getState().insertTodoRowAfter(afterRowId, taskText);
        // Wait for row to be created then set steps
        setTimeout(() => {
          (window as any).__STORE__.getState().setTodoSteps(newRowId, steps);
        }, 100);
      }, { 
        afterRowId: rowIdForDeepDive, 
        taskText: deepDiveTask,
        steps: ['Deep Step 1', 'Deep Step 2', 'Deep Step 3', 'Deep Step 4']
      });
      
      await b.page.waitForTimeout(200);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      await waitForTask(a.page, deepDiveTask, 10000);
      const snapAfterDeepDive = await verifyStoresMatch(a.page, b.page, 'AC6: Deep dive B→A');
      const deepDiveRow = snapAfterDeepDive.snapA.rows.find((r: any) => r.task === deepDiveTask);
      expect(deepDiveRow).toBeTruthy();
      expect(deepDiveRow!.steps.length).toBe(4);

      // ============================================================
      // STEP 7: B deletes original task → A removes it (AC4)
      // ============================================================
      console.log('\n🔄 STEP 7: B deletes original task, A removes it (AC4)');
      const rowIdToDelete = await getRowIdByTask(b.page, taskA);
      await b.page.evaluate((rowId) => {
        (window as any).__STORE__.getState().deleteTodoRow(rowId);
      }, rowIdToDelete);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      await waitForTaskGone(a.page, taskA, 10000);
      await verifyStoresMatch(a.page, b.page, 'AC4: Task deletion B→A');

      // ============================================================
      // STEP 8: A sets dial left text → B sees it (AC7)
      // ============================================================
      console.log('\n🔄 STEP 8: A sets dial left, B sees it (AC7)');
      await a.page.evaluate((text) => {
        (window as any).__STORE__.getState().setDialPriority('left', text);
      }, 'High Priority from A');
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      
      const snapAfterDialLeft = await verifyStoresMatch(a.page, b.page, 'AC7: Dial left A→B');
      expect(snapAfterDialLeft.snapA.dialLeft).toBe('High Priority from A');

      // ============================================================
      // STEP 9: B focuses right dial → A sees focus change (AC8)
      // ============================================================
      console.log('\n🔄 STEP 9: B focuses right dial, A sees it (AC8)');
      await b.page.evaluate(() => {
        (window as any).__STORE__.getState().setDialFocus('right');
      });
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      const snapAfterFocus = await verifyStoresMatch(a.page, b.page, 'AC8: Dial focus B→A');
      expect(snapAfterFocus.snapA.dialFocusedSide).toBe('right');

      // ============================================================
      // STEP 10: A moves rabbit (completes steps) → B mirrors (AC9)
      // ============================================================
      console.log('\n🔄 STEP 10: A moves rabbit, B mirrors (AC9)');
      const deepDiveRowIdA = await getRowIdByTask(a.page, deepDiveTask);
      
      // Complete first 2 steps via rabbit
      await a.page.evaluate((rowId) => {
        (window as any).__STORE__.getState().completeStepsUpTo(rowId, 1); // Index 1 = step 2
      }, deepDiveRowIdA);
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      
      const snapAfterRabbitA = await verifyStoresMatch(a.page, b.page, 'AC9: Rabbit A→B');
      const rabbitRowA = snapAfterRabbitA.snapA.rows.find((r: any) => r.task === deepDiveTask);
      expect(rabbitRowA!.stepsCompleted[0]).toBe(true);
      expect(rabbitRowA!.stepsCompleted[1]).toBe(true);
      expect(rabbitRowA!.stepsCompleted[2]).toBe(false);

      // ============================================================
      // STEP 11: B moves rabbit (completes more steps) → A mirrors (AC10)
      // ============================================================
      console.log('\n🔄 STEP 11: B moves rabbit, A mirrors (AC10)');
      const deepDiveRowIdB = await getRowIdByTask(b.page, deepDiveTask);
      
      // Complete all steps (index 3 = step 4)
      await b.page.evaluate((rowId) => {
        (window as any).__STORE__.getState().completeStepsUpTo(rowId, 3); // Index 3 = step 4
      }, deepDiveRowIdB);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      const snapAfterRabbitB = await verifyStoresMatch(a.page, b.page, 'AC10: Rabbit B→A');
      const rabbitRowB = snapAfterRabbitB.snapA.rows.find((r: any) => r.task === deepDiveTask);
      expect(rabbitRowB!.stepsCompleted[2]).toBe(true);
      expect(rabbitRowB!.stepsCompleted[3]).toBe(true);
      expect(rabbitRowB!.isCompleted).toBe(true);

      // ============================================================
      // STEP 12: B deletes deep dive project, A removes it (AC2)
      // ============================================================
      console.log('\n🔄 STEP 12: B creates then deletes project, A mirrors (AC2)');
      
      // First B creates a new project
      const projectToDelete = `Temp-Project-B-${timestamps}`;
      await b.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectToDelete);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      await waitForProject(a.page, projectToDelete, 10000);
      
      // Then B deletes it
      const projectBId = await getProjectIdByName(b.page, projectToDelete);
      await b.page.evaluate((pid) => {
        (window as any).__STORE__.getState().deleteTodoProject(pid);
      }, projectBId);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      
      await waitForProjectGone(a.page, projectToDelete, 10000);
      await verifyStoresMatch(a.page, b.page, 'AC2: Project deletion B→A');

      // ============================================================
      // STEP 13: Final convergence verification (AC11)
      // ============================================================
      console.log('\n🔄 STEP 13: Final convergence verification (AC11)');
      
      // Force final sync on both
      await flushSync(a.page);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      await reconnectAndCatchUp(b.page);
      
      const finalSnap = await verifyStoresMatch(a.page, b.page, 'AC11: Final convergence');
      
      // Verify specific expected state
      expect(finalSnap.snapA.projectNames).toContain(projectA);
      expect(finalSnap.snapA.projectNames).not.toContain(`Temp-Project-B-${timestamps}`);
      expect(finalSnap.snapA.taskNames).toContain(deepDiveTask);
      expect(finalSnap.snapA.taskNames).not.toContain(taskA);
      expect(finalSnap.snapA.dialLeft).toBe('High Priority from A');
      expect(finalSnap.snapA.dialFocusedSide).toBe('right');
      
      const finalDeepDiveRow = finalSnap.snapA.rows.find((r: any) => r.task === deepDiveTask);
      expect(finalDeepDiveRow!.steps.length).toBe(4);
      expect(finalDeepDiveRow!.isCompleted).toBe(true);

      console.log('\n✅✅✅ ALL PING-PONG TESTS PASSED ✅✅✅');
      console.log(`Final state: ${finalSnap.snapA.projectCount} projects, ${finalSnap.snapA.taskCount} tasks`);

    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Rapid ping-pong: Alternating edits on same task', async ({ browser }) => {
    test.setTimeout(120000);
    const room = `rapid-pingpong-${Date.now()}`;
    const timestamps = Date.now();
    
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      console.log('🚀 Starting Rapid Ping-Pong Test...');

      // Connect both
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);
      await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
      await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });

      // Create shared project on A
      const projectName = `Rapid-Project-${timestamps}`;
      await a.page.evaluate((name) => {
        (window as any).__STORE__.getState().addTodoProject(name);
      }, projectName);
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      await waitForProject(b.page, projectName, 10000);

      // Activate on B
      const projectId = await getProjectIdByName(b.page, projectName);
      await b.page.evaluate((id) => {
        (window as any).__STORE__.getState().setActiveProject(id);
      }, projectId);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);

      // Create task on A
      const taskName = `Rapid-Task-${timestamps}`;
      await a.page.evaluate((task) => {
        (window as any).__STORE__.getState().addTodoRow(task);
      }, taskName);
      await flushSync(a.page);
      await reconnectAndCatchUp(b.page);
      await waitForTask(b.page, taskName, 10000);

      // Rapid alternating edits: A edits step 0, B edits step 1, A edits step 2, etc.
      const rowIdA = await getRowIdByTask(a.page, taskName);
      const rowIdB = await getRowIdByTask(b.page, taskName);

      for (let i = 0; i < 5; i++) {
        // A edits step 0
        await a.page.evaluate(({ rowId, text }) => {
          (window as any).__STORE__.getState().updateTodoCell(rowId, 'step', text, 0);
        }, { rowId: rowIdA, text: `A-edit-${i}` });
        
        // B edits step 1
        await b.page.evaluate(({ rowId, text }) => {
          (window as any).__STORE__.getState().updateTodoCell(rowId, 'step', text, 1);
        }, { rowId: rowIdB, text: `B-edit-${i}` });
      }

      // Force convergence
      await flushSync(a.page);
      await flushSync(b.page);
      await reconnectAndCatchUp(a.page);
      await reconnectAndCatchUp(b.page);

      const finalSnap = await verifyStoresMatch(a.page, b.page, 'Rapid ping-pong convergence');
      const taskRow = finalSnap.snapA.rows.find((r: any) => r.task === taskName);
      expect(taskRow!.steps[0]).toContain('A-edit-');
      expect(taskRow!.steps[1]).toContain('B-edit-');

      console.log('✅ Rapid ping-pong test passed');

    } finally {
      await a.context.close();
      await b.context.close();
      console.log('Contexts closed');
    }
  });
});
