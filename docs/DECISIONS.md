# Implementation decisions

- Keep the requested local application architecture. This is a LAN exercise tool with SQLite, not a hosted site; no deployment is part of this build.
- Use Node's built-in SQLite adapter to avoid a native driver installation dependency. Require Node 22.13 or later and validate on Node 24.
- Use one TypeScript repository with a pure domain folder instead of separate workspace packages.
- Use system fonts and locally bundled icons/assets so runtime does not depend on a CDN.
- Start with deterministic rule and scenario engines. There is no runtime AI API dependency.
