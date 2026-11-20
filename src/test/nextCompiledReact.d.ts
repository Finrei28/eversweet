/**
 * Next's own build of React 19, which the App Router runs; the `react` and `react-dom` in
 * node_modules are 18. Next ships it without types. A test that hydrates mocks the React
 * packages with it (see `src/app/components/language.test.ts`), and these let it name them.
 */
declare module "next/dist/compiled/react" {
  export * from "react";
}
declare module "next/dist/compiled/react/jsx-runtime" {
  export * from "react/jsx-runtime";
}
declare module "next/dist/compiled/react/jsx-dev-runtime" {
  export * from "react/jsx-dev-runtime";
}
declare module "next/dist/compiled/react-dom/client" {
  export * from "react-dom/client";
}
declare module "next/dist/compiled/react-dom/server.node" {
  export * from "react-dom/server";
}
