import { signInLandingLoader } from "@agent-native/core/client/sign-in-landing";
import type { LoaderFunctionArgs } from "react-router";

import { DEFAULT_FIRE, firePath } from "@shared/fires";

// `/` opens the incident map; sign-in (when enabled) resumes there.
export function loader({ request }: LoaderFunctionArgs) {
  return signInLandingLoader(firePath(DEFAULT_FIRE), request);
}
