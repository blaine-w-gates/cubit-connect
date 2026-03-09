import * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';
import diff from 'fast-diff';
import { TodoRow, TodoStep, TodoProject, TaskItem, CubitStep } from '@/schemas/storage';

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
 */
export function generateOrderKey(prevKey?: string, nextKey?: string): string {
    try {
        return generateKeyBetween(prevKey ?? null, nextKey ?? null);
    } catch (err) {
        console.error('Fractional Indexing Error, falling back to lexicographical default', err);
        // Extremely rudimentary fallback just in case
        return prevKey ? prevKey + 'a' : 'a0';
    }
}

/**
 * Returns an array securely sorted by their `orderKey`, using `id` as a fallback tie-breaker
 * to prevent the 'Genesis Double Boot' interleaved collision trap.
 */
export function sortYMapList<T extends { id: string, orderKey?: string }>(items: T[]): T[] {
    return items.sort((a, b) => {
        const keyA = a.orderKey || '';
        const keyB = b.orderKey || '';
        if (keyA === keyB) {
            return a.id.localeCompare(b.id); // Tie-breaker!
        }
        return keyA.localeCompare(keyB);
    });
}

// --- Todo Steps Binding ---
export function bindTodoStepToYMap(step: TodoStep): Y.Map<any> {
    const yStep = new Y.Map();
    const yText = new Y.Text(step.text);
    yStep.set('text', yText);
    yStep.set('isCompleted', step.isCompleted);
    return yStep;
}

export function extractTodoStepFromYMap(yStep: Y.Map<any>): TodoStep {
    return {
        text: (yStep.get('text') as Y.Text)?.toString() || '',
        isCompleted: !!yStep.get('isCompleted'),
    };
}

// --- Todo Row Binding ---
export function bindTodoRowToYMap(row: TodoRow, initialOrderKey?: string): Y.Map<any> {
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

export function extractTodoRowFromYMap(yRow: Y.Map<any>): TodoRow {
    const ySteps = yRow.get('steps') as Y.Array<Y.Map<any>>;
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
export function bindPriorityDialsToYMap(dials: import('@/schemas/storage').PriorityDials): Y.Map<any> {
    const yDials = new Y.Map();

    const leftText = new Y.Text(dials.left || '');
    const rightText = new Y.Text(dials.right || '');

    yDials.set('left', leftText);
    yDials.set('right', rightText);
    yDials.set('focusedSide', dials.focusedSide || 'none');

    return yDials;
}

export function extractPriorityDialsFromYMap(yDials: Y.Map<any>): import('@/schemas/storage').PriorityDials {
    if (!yDials) return { left: '', right: '', focusedSide: 'none' };
    return {
        left: (yDials.get('left') as Y.Text)?.toString() || '',
        right: (yDials.get('right') as Y.Text)?.toString() || '',
        focusedSide: yDials.get('focusedSide') || 'none',
    };
}

// --- Todo Project Binding ---
export function bindTodoProjectToYMap(project: TodoProject, initialOrderKey?: string): Y.Map<any> {
    const yProject = new Y.Map();
    yProject.set('id', project.id);

    const yName = new Y.Text(project.name);
    yProject.set('name', yName);

    yProject.set('color', project.color);
    yProject.set('createdAt', project.createdAt);
    yProject.set('orderKey', initialOrderKey || project.orderKey || generateOrderKey());

    // Mandate 2: Entity Lists MUST be Y.Maps keyed by ID
    const rowsMap = new Y.Map();
    project.todoRows.forEach((row, i) => {
        // Generate order key for legacy arrays if missing
        const prevKey = i === 0 ? undefined : project.todoRows[i - 1].orderKey;
        const orderKey = row.orderKey || generateOrderKey(prevKey || undefined);
        rowsMap.set(row.id, bindTodoRowToYMap(row, orderKey));
    });
    yProject.set('todoRows', rowsMap);

    yProject.set('priorityDials', bindPriorityDialsToYMap(project.priorityDials));

    return yProject;
}

export function extractTodoProjectFromYMap(yProject: Y.Map<any>): TodoProject {
    const rowsMap = yProject.get('todoRows') as Y.Map<Y.Map<any>>;
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
    };
}


// --- Cubit/Deep Dive Tasks Binding ---
// Recursive steps!
export function bindCubitStepToYMap(step: CubitStep): Y.Map<any> {
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

export function extractCubitStepFromYMap(yStep: Y.Map<any>): CubitStep {
    const ySub = yStep.get('sub_steps') as Y.Array<Y.Map<any>>;
    const sub_steps = ySub ? ySub.toArray().map(extractCubitStepFromYMap) : [];

    return {
        id: yStep.get('id'),
        text: (yStep.get('text') as Y.Text)?.toString() || '',
        isCompleted: !!yStep.get('isCompleted'),
        sub_steps,
    };
}

export function bindTaskItemToYMap(task: TaskItem): Y.Map<any> {
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

export function extractTaskItemFromYMap(yTask: Y.Map<any>): TaskItem {
    const ySub = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;
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
