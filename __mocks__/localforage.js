const localforageMock = {
    config: jest.fn(),
    getItem: jest.fn(),
    setItem: jest.fn(() => Promise.resolve()),
};

export default localforageMock;
