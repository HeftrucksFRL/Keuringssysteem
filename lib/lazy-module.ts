// Next.js and the tsx maintenance scripts can expose different module namespaces.
export function unwrapLazyModule<T extends object>(module:T|{default:T}):T{
  return ("default" in module?module.default:module) as T;
}
