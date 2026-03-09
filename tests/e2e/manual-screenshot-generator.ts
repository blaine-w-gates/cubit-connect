import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Starting Manual QA Simulation via Playwright Script...");

    await page.goto('http://localhost:3000/todo');
    await page.evaluate(() => {
        localStorage.clear();
        const store = (window as any).__STORE__.getState();
        store.fullLogout();
        if (store.todoProjects.length === 0) store.addTodoProject('Test Project');
    });

    // Test 1: Typing Speed
    await page.evaluate(() => (window as any).__STORE__.getState().addTodoRow('Performance Row'));
    await page.waitForTimeout(1000);

    // Enter edit mode by double-clicking the span
    await page.locator('span:has-text("Performance Row")').dblclick();

    const target1 = page.locator('textarea').first();
    await target1.waitFor({ state: 'visible', timeout: 10000 });

    const p = "This is a massive paragraph meant to trigger the O(N) observer loop rapidly across multiple keystrokes to ensure our structural sharing cache handles the load.";
    const t0 = Date.now();
    await target1.pressSequentially(p, { delay: 5 });
    const t1 = Date.now();
    console.log(`[TEST 1] Typed ${p.length} chars in ${t1 - t0}ms`);
    await page.screenshot({ path: '/tmp/test1-cpu.png' });

    // Test 2: Cursor Jump
    await page.evaluate(() => (window as any).__STORE__.getState().addTodoRow('The quick brown fox jumps.'));
    await page.waitForTimeout(1000);

    // Enter edit mode by double-clicking the span
    await page.locator('span:has-text("The quick brown fox jumps.")').dblclick();

    const target2 = page.locator('textarea').first();
    await target2.waitFor({ state: 'visible', timeout: 10000 });
    await target2.focus();
    for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X');
    await page.keyboard.type('Y');
    const val = await target2.inputValue();
    console.log(`[TEST 2] Cursor result string: "${val}"`);
    await page.screenshot({ path: '/tmp/test2-cursor.png' });

    // Test 3: Tombstone Orphan
    await page.evaluate(() => {
        const st = (window as any).__STORE__.getState();
        st.addTodoProject("Project A");
    });
    await page.waitForTimeout(500);

    const projId = await page.evaluate(() => {
        const st = (window as any).__STORE__.getState();
        const proj = st.todoProjects.find((x: any) => x.name === 'Project A');
        st.setActiveProject(proj.id);
        st.addTodoRow('Task 1');
        st.addTodoRow('Task 2');
        st.addTodoRow('Task 3');
        return proj.id;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/test3-before-delete.png' });

    await page.evaluate((id) => {
        (window as any).__STORE__.getState().deleteTodoProject(id);
    }, projId);
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/test3-after-delete.png' });
    console.log(`[TEST 3] Captured screenshots of Project A deletion.`);

    // Test 4: Genesis
    const uni = "Verify Genesis Boot " + Date.now();
    await page.evaluate((u) => (window as any).__STORE__.getState().addTodoRow(u), uni);
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/test4-genesis.png' });

    const found = await page.evaluate((u) => {
        const st = (window as any).__STORE__.getState();
        return st.todoRows.some((r: any) => r.task.includes(u));
    }, uni);
    console.log(`[TEST 4] Did Genesis Boot survive reload? ${found}`);

    await browser.close();
    console.log("Simulation complete!");
})();
