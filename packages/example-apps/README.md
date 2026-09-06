# @benos/example-apps

The default app suite shipped in the playground and the docs demo: Notes,
Calculator, Clock, Calendar, Reminders, Sketch, and Terminal. Each is a real
`App` object built on `@benos/core` and `@benos/desktop`, kept in
one place so both surfaces show the same apps.

```tsx
import { exampleApps } from "@benos/example-apps";

<Desktop apps={[helloApp, ...exampleApps]} theme={theme} />;
```

The `Hello` intro is intentionally not part of this package: each surface keeps
its own welcome window.
