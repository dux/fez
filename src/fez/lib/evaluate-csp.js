// evaluate.js for the CSP build: no code from strings, see evaluate.js.

export default function evaluate(what) {
  throw new Error(
    `fez CSP build: ${what} needs code evaluation ('unsafe-eval'); precompile components with the bundler plugin and pass functions, not strings`,
  );
}
