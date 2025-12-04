// This file is used to provide type definitions for the environment.
// We define the JSX namespace to resolve "Property 'div' does not exist on type 'JSX.IntrinsicElements'" errors.
// We also declare process.env to support the API_KEY usage.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};
