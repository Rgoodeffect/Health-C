import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware` file convention to `proxy` (the
// `nodejs`-only network boundary). next-intl's locale-detection/redirect
// logic is framework-agnostic request->response middleware, so it is used
// unchanged here, just re-exported under the new `proxy` name.
const proxy = createMiddleware(routing);

export default proxy;

export const config = {
  // Skip API routes, Next internals, and static/public assets.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
