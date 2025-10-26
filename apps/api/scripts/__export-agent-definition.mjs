        if (typeof globalThis !== "undefined" && globalThis.EdgeRuntime || typeof navigator !== "undefined" && ((_a4 = navigator.userAgent) === null || _a4 === void 0 ? void 0 : _a4.includes("Edge"))) {
            error: "Edge runtime detected. WebSockets are not supported in edge functions.",
