import * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';
import diff from 'fast-diff';
import { TodoRow, TodoStep, TodoProject, TaskItem, CubitStep } from '@/schemas/storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
 type YMap = Y.Map<any>;

/**
 * Calculates deterministic diff operations to safely mutate Y.Text character-by-character
 * instead of destroying the entire string and recreating it (Wipe-and-Replace Bug).
 */
export function applyUpdateToYText(yText: Y.Text, newString: string) {
    const currentString = yText.toString();
    if (currentString === newString) return;

    const changes = diff(currentString, newString);
    let cursor = 0;

    // Must be called inside a ydoc.transact() to avoid snapshot tearing
    changes.forEach(([operation, text]) => {
        if (operation === diff.EQUAL) {
            cursor += text.length; // Retain
        } else if (operation === diff.DELETE) {
            yText.delete(cursor, text.length);
        } else if (operation === diff.INSERT) {
            yText.insert(cursor, text);
            cursor += text.length;
        }
    });
}

/**
 * Generates a clean Fractional Index string logic based on surrounding items.
 * Keys are normalized to lowercase for consistent lexicographic ordering.
 */
export function generateOrderKey(prevKey?: string, nextKey?: string): string {
    try {
        // Normalize to lowercase for consistent comparison
        const normalizedPrev = prevKey?.toLowerCase() ?? null;
        const normalizedNext = nextKey?.toLowerCase() ?? null;
        return generateKeyBetween(normalizedPrev, normalizedNext);
    } catch (err) {
        console.error('Fractional Indexing Error, falling back to lexicographical default', err);
        // Fallback with lowercase key
        const fallbackBase = prevKey?.toLowerCase() ?? 'a0';
        return fallbackBase + 'n';
    }
}

/**
 * Returns an array securely sorted by their `orderKey`, using `id` as a fallback tie-breaker
 * to prevent the 'Genesis Double Boot' interleaved collision trap.
 */
export function sortYMapList<T extends { id: string, orderKey?: string }>(items: T[]): T[] {
    return items.sort((a, b) => {
        // Normalize to lowercase for consistent comparison
        const keyA = (a.orderKey || '').toLowerCase();
        const keyB = (b.orderKey || '').toLowerCase();
        if (keyA === keyB) {
            return a.id.localeCompare(b.id); // Tie-breaker!
        }
        return keyA.localeCompare(keyB);
    });
}

// --- Todo Steps Binding ---
export function bindTodoStepToYMap(step: TodoStep): YMap {
    const yStep = new Y.Map();
    const yText = new Y.Text(step.text);
    yStep.set('text', yText);
    yStep.set('isCompleted', step.isCompleted);
    return yStep;
}

export function extractTodoStepFromYMap(yStep: YMap): TodoStep {
    return {
        text: (yStep.get('text') as Y.Text)?.toString() || '',
        isCompleted: !!yStep.get('isCompleted'),
    };
}

// --- Todo Row Binding ---
export function bindTodoRowToYMap(row: TodoRow, initialOrderKey?: string): YMap {
    const yRow = new Y.Map();
    yRow.set('id', row.id);

    const yTaskText = new Y.Text(row.task);
    yRow.set('task', yTaskText);

    const yStepsArray = new Y.Array();
    // We keep steps as an array since it's a fixed 4-step grid and order matters rigidly
    yStepsArray.push(row.steps.map(bindTodoStepToYMap));
    yRow.set('steps', yStepsArray);

    yRow.set('isCompleted', !!row.isCompleted);
    if (row.sourceStepId) yRow.set('sourceStepId', row.sourceStepId);
    yRow.set('orderKey', initialOrderKey || row.orderKey || generateOrderKey());

    return yRow;
}

export function extractTodoRowFromYMap(yRow: YMap): TodoRow {
    const ySteps = yRow.get('steps') as Y.Array<YMap>;
    const rawSteps = ySteps ? ySteps.toArray().map(extractTodoStepFromYMap) : [];

    return {
        id: yRow.get('id'),
        task: (yRow.get('task') as Y.Text)?.toString() || '',
        // Enforce 4-tuple typing
        steps: [
            rawSteps[0] || { text: '', isCompleted: false },
            rawSteps[1] || { text: '', isCompleted: false },
            rawSteps[2] || { text: '', isCompleted: false },
            rawSteps[3] || { text: '', isCompleted: false }
        ],
        isCompleted: !!yRow.get('isCompleted'),
        sourceStepId: yRow.get('sourceStepId'),
        orderKey: yRow.get('orderKey'),
    };
}

// --- Priority Dials Binding ---
export function bindPriorityDialsToYMap(dials: import('@/schemas/storage').PriorityDials): YMap {
    const yDials = new Y.Map();

    const leftText = new Y.Text(dials.left || '');
    const rightText = new Y.Text(dials.right || '');

    yDials.set('left', leftText);
    yDials.set('right', rightText);
    yDials.set('focusedSide', dials.focusedSide || 'none');

    return yDials;
}

export function extractPriorityDialsFromYMap(yDials: YMap): import('@/schemas/storage').PriorityDials {
    if (!yDials) return { left: '', right: '', focusedSide: 'none' };
    return {
        left: (yDials.get('left') as Y.Text)?.toString() || '',
        right: (yDials.get('right') as Y.Text)?.toString() || '',
        focusedSide: yDials.get('focusedSide') || 'none',
    };
}

// --- Todo Project Binding ---
export function bindTodoProjectToYMap(project: TodoProject, initialOrderKey?: string): YMap {
    const yProject = new Y.Map();
    yProject.set('id', project.id);

    const yName = new Y.Text(project.name);
    yProject.set('name', yName);

    yProject.set('color', project.color);
    yProject.set('createdAt', project.createdAt);
    yProject.set('orderKey', initialOrderKey || project.orderKey || generateOrderKey());

    // Workspace metadata (ADR-001)
    yProject.set('workspaceType', project.workspaceType || 'personalUno');
    yProject.set('workspaceId', project.workspaceId || '');
    yProject.set('ownerId', project.ownerId || '');
    if (project.teamId) yProject.set('teamId', project.teamId);
    if (project.objectiveId) yProject.set('objectiveId', project.objectiveId);

    // Mandate 2: Entity Lists MUST be Y.Maps keyed by ID
    const rowsMap = new Y.Map();
    project.todoRows.forEach((row, i) => {
        const prevKey = i === 0 ? undefined : project.todoRows[i - 1].orderKey;
        const orderKey = row.orderKey || generateOrderKey(prevKey || undefined);
        rowsMap.set(row.id, bindTodoRowToYMap(row, orderKey));
    });
    yProject.set('todoRows', rowsMap);

    yProject.set('priorityDials', bindPriorityDialsToYMap(project.priorityDials));

    return yProject;
}

export function extractTodoProjectFromYMap(yProject: YMap): TodoProject {
    const rowsMap = yProject.get('todoRows') as Y.Map<YMap>;
    const rowsList = rowsMap ? Array.from(rowsMap.values())
        .filter(yRow => !yRow.get('isDeleted'))
        .map(extractTodoRowFromYMap) : [];

    return {
        id: yProject.get('id'),
        name: (yProject.get('name') as Y.Text)?.toString() || '',
        color: yProject.get('color'),
        createdAt: yProject.get('createdAt'),
        orderKey: yProject.get('orderKey'),
        todoRows: sortYMapList(rowsList),
        priorityDials: extractPriorityDialsFromYMap(yProject.get('priorityDials')),
        workspaceType: yProject.get('workspaceType') || 'personalUno',
        workspaceId: yProject.get('workspaceId') || '',
        ownerId: yProject.get('ownerId') || '',
        teamId: yProject.get('teamId'),
        objectiveId: yProject.get('objectiveId'),
    };
}


// --- Cubit/Deep Dive Tasks Binding ---
// Recursive steps!
export function bindCubitStepToYMap(step: CubitStep): YMap {
    const yStep = new Y.Map();
    yStep.set('id', step.id);

    const yText = new Y.Text(step.text);
    yStep.set('text', yText);
    yStep.set('isCompleted', !!step.isCompleted);

    const ySubSteps = new Y.Array();
    // Mixed string/object fallback logic
    const sub = step.sub_steps || [];
    sub.forEach(s => {
        if (typeof s === 'string') {
            const fallback: CubitStep = { id: crypto.randomUUID(), text: s };
            ySubSteps.push([bindCubitStepToYMap(fallback)]);
        } else {
            ySubSteps.push([bindCubitStepToYMap(s as CubitStep)]);
        }
    });

    yStep.set('sub_steps', ySubSteps);
    return yStep;
}

export function extractCubitStepFromYMap(yStep: YMap): CubitStep {
    const ySub = yStep.get('sub_steps') as Y.Array<YMap>;
    const sub_steps = ySub ? ySub.toArray().map(extractCubitStepFromYMap) : [];

    return {
        id: yStep.get('id'),
        text: (yStep.get('text') as Y.Text)?.toString() || '',
        isCompleted: !!yStep.get('isCompleted'),
        sub_steps,
    };
}

export function bindTaskItemToYMap(task: TaskItem): YMap {
    const yTask = new Y.Map();
    yTask.set('id', task.id);

    const yName = new Y.Text(task.task_name);
    yTask.set('task_name', yName);

    const yDesc = new Y.Text(task.description);
    yTask.set('description', yDesc);

    yTask.set('timestamp_seconds', task.timestamp_seconds);
    yTask.set('screenshot_base64', task.screenshot_base64 || '');
    yTask.set('isExpanded', !!task.isExpanded);

    const ySub = new Y.Array();
    (task.sub_steps || []).forEach(s => {
        ySub.push([bindCubitStepToYMap(s)]);
    });
    yTask.set('sub_steps', ySub);

    return yTask;
}

export function extractTaskItemFromYMap(yTask: YMap): TaskItem {
    const ySub = yTask.get('sub_steps') as Y.Array<YMap>;
    const sub_steps = ySub ? ySub.toArray().map(extractCubitStepFromYMap) : [];

    return {
        id: yTask.get('id'),
        task_name: (yTask.get('task_name') as Y.Text)?.toString() || '',
        description: (yTask.get('description') as Y.Text)?.toString() || '',
        timestamp_seconds: yTask.get('timestamp_seconds'),
        screenshot_base64: yTask.get('screenshot_base64'),
        isExpanded: !!yTask.get('isExpanded'),
        sub_steps,
    };
}
