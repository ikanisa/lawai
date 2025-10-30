export function createScheduler(options = {}) {
    const tasks = new Map();
    function register(task) {
        if (tasks.has(task.id)) {
            throw new Error(`Scheduled task with id ${task.id} already registered`);
        }
        tasks.set(task.id, task);
        options.onRegister?.(task);
    }
    async function run(id, context) {
        const task = tasks.get(id);
        if (!task) {
            throw new Error(`Unknown scheduled task: ${id}`);
        }
        if (!task.handler) {
            return;
        }
        const ctx = context ?? options.defaultContext?.();
        try {
            await task.handler(ctx);
        }
        catch (error) {
            options.onError?.(task, error);
            throw error;
        }
    }
    function list() {
        return Array.from(tasks.values());
    }
    function get(id) {
        return tasks.get(id);
    }
    return { register, list, get, run };
}
