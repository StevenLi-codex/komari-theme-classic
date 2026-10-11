# Third-party information

The runtime theme uses the browser platform without external UI libraries, web fonts or remote icon services. Flags, interface illustrations, CSS and SVG charts are provided in this repository under its MIT license. System fonts and emoji come from the visitor's device. No Microsoft proprietary artwork is included.

Build and test tools (not shipped in `theme.tar.gz`):

| Tool | License | Purpose |
| --- | --- | --- |
| TypeScript | Apache-2.0 | Static type checking |
| esbuild | MIT | Module bundling |
| tsx | MIT | TypeScript unit tests |
| Playwright | Apache-2.0 | Browser regression checks and preview capture |
| Prettier | MIT | Source formatting |

Exact tool versions and transitive dependency integrity are recorded in `package-lock.json`. Tool license files are available in `node_modules` after `npm ci`.
