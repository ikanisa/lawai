import { Button } from '@avocat-ai/ui';

interface WorkspaceErrorStateProps {
  onRetry?: () => void;
}

export function WorkspaceErrorState({ onRetry }: WorkspaceErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive-foreground">
      <p>We were unable to refresh the workspace overview. Please try again.</p>
      <Button variant="destructive" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
