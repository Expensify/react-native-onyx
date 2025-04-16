# Performance testing

We use Reassure for monitoring performance regression. It helps us check if our app is getting faster and quickly spot any issues we need to fix.

## How does Reassure work?

- Reassure builds on the existing React Testing Library setup and adds a performance measurement functionality. It's intended to be used on local machine and on a remote server as part of your continuous integration setup.
- To make sure the results are reliable and consistent, Reassure runs tests twice – once for the current branch and once for the base branch.

## Performance Testing Strategy (`measureFunction`)

-   Identifying functions with heavy calculations.
-   Targeting functions that are frequently used throughout the app.

## Running tests locally

-   Checkout your base environment, eg. `git checkout main`.
-   Collect baseline metrics with `npm run perf-test -- --baseline`.
-   Apply any desired changes (for testing purposes you can eg. try to slow down a list).
-   Collect current metrics with `npm run perf-test`.
-   Open up the resulting `output.md` / `output.json` (see console output) to compare the results.
-   With all that information, Reassure can present the render duration times as statistically significant or meaningless.

## Example Test

```javascript
describe('[Utils.js]', () => {
    test('fastMerge', async () => {
        const target = getMockedPersonalDetails(1000);
        const source = getMockedPersonalDetails(500);

        await measureFunction(() => utils.fastMerge(target, source, true));
    });
});
```
