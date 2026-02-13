import { Virtuoso } from 'react-virtuoso';
import { TaskItem } from '@/services/storage';
import TaskEditor from '@/components/TaskEditor';

interface TaskFeedProps {
  tasks: TaskItem[];
  // onCubit: taskId, prompt/context, optional stepId (if Deep Dive)
  onCubit: (taskId: string, context: string, stepId?: string) => void;
}

export default function TaskFeed({ tasks, onCubit }: TaskFeedProps) {
  // Virtualization now uses Window Scrolling for better UX (single scrollbar)

  return (
    <div className="w-full bg-transparent">
      <Virtuoso
        useWindowScroll
        overscan={400} // Render 400px extra to prevent white flashes
        data={tasks}
        itemContent={(index, task) => <TaskEditor task={task} onCubit={onCubit} />}
      />
    </div>
  );
}
