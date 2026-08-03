import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const answerSubagent = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;
    const answer = parsed.answer || parsed.response;

    if (!id) {
        return 'ERROR: Missing "id" argument for Answer.';
    }

    if (!answer) {
        return 'ERROR: Missing "answer" argument for Answer.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    if (!task.questions || task.questions.length === 0) {
        return `INFO: Subagent task [${id}] has no pending questions.`;
    }

    const pending = task.questions.filter(q => !q.answered);
    if (pending.length === 0) {
        return `INFO: Subagent task [${id}] has no unanswered questions.`;
    }

    pending.forEach(q => {
        q.answered = true;
        q.answer = answer;
        q.answeredAt = Date.now();
        if (q._resolve) {
            q._resolve(answer);
        }
    });

    task.status = 'running';

    if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
    }

    return `SUCCESS: Answer provided to subagent task [${id}]. Subagent execution resumed.`;
};
