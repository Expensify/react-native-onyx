<!-- If necessary, assign reviewers that know the area or changes well. Feel free to tag any additional reviewers you see fit. -->

### Details
<!-- Explanation of the change or anything fishy that is going on -->

### Related Issues
<!-- Please replace GH_LINK with the link to the GitHub issue this Pull Request is related to -->
GH_LINK

### Automated Tests
<!---
Most changes to Onyx should have accompanying tests. Describe the tests you added or if no tests were added an explanation about why one was not needed.
--->

### Manual Tests
<!---
Each set of changes should be tested against the Expensify/App repo on all platforms to verify it does not break our staging App.
--->

### Author Checklist

- [ ] I linked the correct issue in the `### Related Issues` section above
- [ ] I wrote clear testing steps that cover the changes made in this PR
    - [ ] I added steps for local testing in the `Tests` section
    - [ ] I tested this PR with a [High Traffic account](https://github.com/Expensify/App/blob/main/contributingGuides/CONTRIBUTING.md#high-traffic-accounts) against the staging or production API to ensure there are no regressions (e.g. long loading states that impact usability).
- [ ] I included screenshots or videos for tests on [all platforms](https://github.com/Expensify/App/blob/main/contributingGuides/CONTRIBUTING.md#make-sure-you-can-test-on-all-platforms)
- [ ] I ran the tests on **all platforms** & verified they passed on:
    - [ ] Android / native
    - [ ] Android / Chrome
    - [ ] iOS / native
    - [ ] iOS / Safari
    - [ ] MacOS / Chrome / Safari
    - [ ] MacOS / Desktop
- [ ] I verified there are no console errors (if there's a console error not related to the PR, report it or open an issue for it to be fixed)
- [ ] I followed proper code patterns (see [Reviewing the code](https://github.com/Expensify/App/blob/main/contributingGuides/PR_REVIEW_GUIDELINES.md#reviewing-the-code))
    - [ ] I verified that any callback methods that were added or modified are named for what the method does and never what callback they handle (i.e. `toggleReport` and not `onIconClick`)
    - [ ] I verified that the left part of a conditional rendering a React component is a boolean and NOT a string, e.g. `myBool && <MyComponent />`.
    - [ ] I verified that comments were added to code that is not self explanatory
    - [ ] I verified that any new or modified comments were clear, correct English, and explained "why" the code was doing something instead of only explaining "what" the code was doing.
    - [ ] I verified proper file naming conventions were followed for any new files or renamed files. All non-platform specific files are named after what they export and are not named "index.js". All platform-specific files are named for the platform the code supports as outlined in the README.
    - [ ] I verified the JSDocs style guidelines (in [`STYLE.md`](https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md#jsdocs)) were followed
- [ ] If a new code pattern is added I verified it was agreed to be used by multiple Expensify engineers
- [ ] I followed the guidelines as stated in the [Review Guidelines](https://github.com/Expensify/App/blob/main/contributingGuides/PR_REVIEW_GUIDELINES.md)
- [ ] I tested other components that can be impacted by my changes (i.e. if the PR modifies a shared library or component like `Avatar`, I verified the components using `Avatar` are working as expected)
- [ ] I verified all code is DRY (the PR doesn't include any logic written more than once, with the exception of tests)
- [ ] I verified any variables that can be defined as constants (ie. in CONST.js or at the top of the file that uses the constant) are defined as such
- [ ] I verified that if a function's arguments changed that all usages have also been updated correctly
- [ ] If a new component is created I verified that:
    - [ ] A similar component doesn't exist in the codebase
    - [ ] All props are defined accurately and each prop has a `/** comment above it */`
    - [ ] The file is named correctly
    - [ ] The component has a clear name that is non-ambiguous and the purpose of the component can be inferred from the name alone
    - [ ] The only data being stored in the state is data necessary for rendering and nothing else
    - [ ] If we are not using the full Onyx data that we loaded, I've added the proper selector in order to ensure the component only re-renders when the data it is using changes
    - [ ] For Class Components, any internal methods passed to components event handlers are bound to `this` properly so there are no scoping issues (i.e. for `onClick={this.submit}` the method `this.submit` should be bound to `this` in the constructor)
    - [ ] Any internal methods bound to `this` are necessary to be bound (i.e. avoid `this.submit = this.submit.bind(this);` if `this.submit` is never passed to a component event handler like `onClick`)
    - [ ] All JSX used for rendering exists in the render method
    - [ ] The component has the minimum amount of code necessary for its purpose, and it is broken down into smaller components in order to separate concerns and functions
- [ ] If any new file was added I verified that:
    - [ ] The file has a description of what it does and/or why is needed at the top of the file if the code is not self explanatory
- [ ] If the PR modifies a generic component, I tested and verified that those changes do not break usages of that component in the rest of the App (i.e. if a shared library or component like `Avatar` is modified, I verified that `Avatar` is working as expected in all cases)
- [ ] If the `main` branch was merged into this PR after a review, I tested again and verified the outcome was still expected according to the `Test` steps.
- [ ] I have checked off every checkbox in the PR author checklist, including those that don't apply to this PR.

### Screenshots/Videos
<details>
<summary>Android: Native</summary>

<!-- add screenshots or videos here -->

</details>

<details>
<summary>Android: mWeb Chrome</summary>

<!-- add screenshots or videos here -->

</details>

<details>
<summary>iOS: Native</summary>

<!-- add screenshots or videos here -->

</details>

<details>
<summary>iOS: mWeb Safari</summary>

<!-- add screenshots or videos here -->

</details>

<details>
<summary>MacOS: Chrome / Safari</summary>

<!-- add screenshots or videos here -->

</details>

<details>
<summary>MacOS: Desktop</summary>

<!-- add screenshots or videos here -->

</details>
