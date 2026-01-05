/**
 * Type-safe wrapper for window.openai runtime in ChatGPT widgets
 */

declare global {
    interface Window {
        openai?: OpenAIWidgetRuntime;
    }
}

export interface OpenAIWidgetRuntime {
    toolOutput?: ToolOutput;
    toolResponseMetadata?: Record<string, unknown>;
    callTool?: (name: string, args: Record<string, unknown>) => Promise<ToolOutput>;
    sendMessage?: (message: string) => void;
    updateWidgetState?: (state: Record<string, unknown>) => void;
}

export interface ToolOutput {
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
}

/**
 * Get the current tool output from the widget runtime
 */
export function getToolOutput<T = Record<string, unknown>>(): T | null {
    const output = window.openai?.toolOutput?.structuredContent;
    return (output as T) ?? null;
}

/**
 * Get the tool response metadata (widget-exclusive data via _meta)
 */
export function getToolMeta<T = Record<string, unknown>>(): T | null {
    const meta = window.openai?.toolResponseMetadata;
    return (meta as T) ?? null;
}

/**
 * Get the text content from tool output
 */
export function getToolText(): string | null {
    const content = window.openai?.toolOutput?.content;
    if (!content || content.length === 0) return null;

    const textItems = content.filter((item) => item.type === 'text' && item.text);
    return textItems.map((item) => item.text).join('\n') || null;
}

/**
 * Call an MCP tool from the widget
 * Note: This may not be available in all contexts
 */
export async function callTool<T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>
): Promise<T | null> {
    if (!window.openai?.callTool) {
        console.warn('callTool not available in this context');
        return null;
    }

    const result = await window.openai.callTool(name, args);
    return (result.structuredContent as T) ?? null;
}

/**
 * Send a message to the chat
 */
export function sendMessage(message: string): void {
    if (!window.openai?.sendMessage) {
        console.warn('sendMessage not available in this context');
        return;
    }

    window.openai.sendMessage(message);
}

/**
 * Update widget state (persists across re-renders)
 */
export function updateWidgetState(state: Record<string, unknown>): void {
    if (!window.openai?.updateWidgetState) {
        console.warn('updateWidgetState not available in this context');
        return;
    }

    window.openai.updateWidgetState(state);
}

/**
 * Check if running inside ChatGPT widget context
 */
export function isWidgetContext(): boolean {
    return typeof window !== 'undefined' && window.openai !== undefined;
}

/**
 * Get color scheme preference
 */
export function getColorScheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
