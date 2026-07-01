declare module "lodash.bindall" {
  function bindAll<T extends object>(
    object: T,
    ...methodNames: Array<keyof T | string>
  ): T;
  export default bindAll;
}
