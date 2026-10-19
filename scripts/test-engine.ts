import { runAllEngineTests } from '../tests/engine.test';
const result=runAllEngineTests();
console.log(result.results.join('\n'));
console.log(`Passed ${result.passed} engine scenarios`);
if(result.passed<11)throw Error('Missing engine scenarios');
