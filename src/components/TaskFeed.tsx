import { Virtuoso } from 'react-virtuoso';
import { TaskItem } from '@/services/storage';
import TaskEditor from '@/components/TaskEditor';

interface TaskFeedProps {
    tasks: TaskItem[];
    // onCubit: taskId, prompt/context, optional stepId (if Deep Dive)
    onCubit: (taskId: string, context: string, stepId?: string) => void;
}

export default function TaskFeed({ tasks, onCubit }: TaskFeedProps) {
    // Virtualization requires fixed height or pure item rendering
    // We will render the whole page height for the feed eventually, 
    // but for now let's give it a container.

    return (
        <div className="h-full w-full bg-transparent">
            <Virtuoso
                style={{ height: 'calc(100vh - 80px)' }} // Subtract header height approx
                className="no-scrollbar" // Optional: custom scrollbar hiding if needed
                data={tasks}
                itemContent={(index, task) => (
                    <TaskEditor
                        task={task}

                        onCubit={onCubit}
                    />
                )}
            />
        </div>
    );
}
