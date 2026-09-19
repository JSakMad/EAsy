"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin requests keep session cookies on the web app, including in production.
export const authClient = createAuthClient();
