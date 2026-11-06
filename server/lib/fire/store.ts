import { fail } from "@agent-native/core/action";

import { BUNDLED_FIRES } from "./bundled/index.js";
import { FireStore } from "./data.js";

const stores = new Map<string, Promise<FireStore>>();

/** The fire's bundled files as a FireStore, loaded once per server instance. */
export function getFireStore(fire: string): Promise<FireStore> {
  const load = BUNDLED_FIRES[fire];
  if (!load) {
    fail(`Unknown fire "${fire}". Known fires: ${Object.keys(BUNDLED_FIRES).join(", ")}.`, {
      errorCode: "unknown_fire",
      statusCode: 404,
    });
  }
  let store = stores.get(fire);
  if (!store) {
    store = load().then((bundle) => {
      const bytes = new Map<string, Uint8Array>();
      return new FireStore(fire, {
        json: (file) => bundle.json[file],
        bytes: (file) => {
          const b64 = bundle.bytes[file];
          if (b64 === undefined) return undefined;
          let decoded = bytes.get(file);
          if (!decoded) {
            decoded = Uint8Array.from(Buffer.from(b64, "base64"));
            bytes.set(file, decoded);
          }
          return decoded;
        },
      });
    });
    stores.set(fire, store);
    store.catch(() => stores.delete(fire));
  }
  return store;
}
