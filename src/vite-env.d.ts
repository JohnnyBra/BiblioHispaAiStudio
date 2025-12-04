// Shim for JSX Intrinsic Elements to fix missing React types in this environment
declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: any;
    }
}
