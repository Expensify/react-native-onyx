export default (): Promise<unknown> =>
    new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
