import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Separator } from '@avocat-ai/ui';

export function WorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="h-6 w-48 animate-pulse rounded-full bg-muted/60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded-full bg-muted/60" />
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Separator />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="h-5 w-40 animate-pulse rounded-full bg-muted/60" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((__, inner) => (
                <div key={inner} className="h-12 animate-pulse rounded-2xl bg-muted/40" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
