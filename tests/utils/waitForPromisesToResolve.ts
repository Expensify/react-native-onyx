export default (): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
