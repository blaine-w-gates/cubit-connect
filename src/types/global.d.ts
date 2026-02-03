export { };

declare global {
    interface Window {
        revokeCount?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        __STORE__?: any;
    }
}
