import { PUBLIC_DESK_URL } from "@/lib/public-desk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown when this process is Vercel (or HOST_URL is set) but the Mac mini is not reachable. */
export function ControlSurfaceNotice() {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Control surface only — host not pointed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p>
          This Vercel site is the desk website. WorkerEnvironment, sticky compute,
          Grant selected, and tear-down run on the Mac mini, not here and not in
          the browser.
        </p>
        <p>
          Set <span className="font-mono text-foreground">WORKERLAYER_HOST_URL</span>{" "}
          on Vercel to the mini&apos;s <span className="font-mono text-foreground">pnpm start</span>{" "}
          URL. Until that lasting URL is live, open the temporary Alpha desk:{" "}
          <a href={PUBLIC_DESK_URL} className="text-foreground underline underline-offset-4">
            {PUBLIC_DESK_URL}
          </a>
          .
        </p>
        <p>No SSO. The API key stays identity only. Echo is not the product.</p>
      </CardContent>
    </Card>
  );
}
