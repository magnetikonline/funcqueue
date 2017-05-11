# FuncQueue
A really low-fi function queue manager module for Node.js 6+ to ease the pain of building asynchronous code. Yep, there are hundreds of these already - here is another.

[![NPM](https://nodei.co/npm/funcqueue.png?downloads=true)](https://nodei.co/npm/funcqueue/)

- [Usage](#usage)
- [Methods](#methods)
	- [FuncQueue([parallelCount])](#funcqueueparallelcount)
	- [FuncQueue.addTask(callback[,arguments...])](#funcqueueaddtaskcallbackarguments)
	- [FuncQueue.complete(callback)](#funcqueuecompletecallback)

## Usage

```js
let FuncQueue = require('funcqueue'),
	myFuncQueue = new FuncQueue();

function demoTask(param,callback) {

	console.log(`Hello from task ${param}`);
	callback(null,param);
}

myFuncQueue.complete(
	(err,resultList) => {

		console.log('All done!');
		console.log(resultList);
	}
);

myFuncQueue
	.addTask(demoTask,'one')
	.addTask(demoTask,'two')
	.addTask(demoTask,'three')
	.addTask(demoTask,'four');
```

Produces the following output:

```
Hello from task one
Hello from task two
Hello from task three
Hello from task four
All done!
[ 'one', 'two', 'three', 'four' ]
```

## Methods

### FuncQueue([parallelCount])
- Creates new `FuncQueue` instance.
- Optional `parallelCount` controls how many tasks will execute at any moment, if not defined will default to `1` - thus tasks run serially.

### FuncQueue.addTask(callback[,arguments...])
- Adds a new task function `callback` to the `FuncQueue` queue.
- Optional `arguments` can be passed to the task `callback`.
- Upon execution `callback` will receive (in the following order):
	- Task `arguments`.
	- A `callback` function to be called at completion of task.
- Task `callback` in turn accepts two arguments - an error (if raised) and a task result, inline with the style of Node.js 'error first' callbacks.
- Any errors _thrown_ by task functions will be caught by `FuncQueue` and trigger the error path (e.g. same behavior as passing an error to task callback).
- Tasks are _not required_ to return a result - in this instance `undefined` is passed back and will be omitted from the finalised result list supplied to [FuncQueue.complete(callback)](#funcqueuecompletecallback).
- In the case of an error returned, currently running parallel tasks will continue to completion with their results ignored - future queue tasks will *not* be executed.

Example:

```js
myFuncQueue
	.addTask(
		(param1,param2,callback) => {

			console.log(`Task called with: ${param1} and: ${param2}`);
			// Task called with: First parameter and: Second parameter

			setTimeout(
				() => { callback(null,'My computed result'); },
				2000
			);
		},
		'First parameter',
		'Second parameter'
	);
```

In addition, task callback receive their parent `FuncQueue` instance as `this`, allowing for the chaining of further conditional tasks from within tasks themselves:

```js
myFuncQueue
	.addTask(function(callback) {

		someReallyComplexAsyncCalculation((err,result) => {

			if (result > 15) {
				// add an additional FuncQueue task
				this.addTask(resultAbove15Task);
			}

			callback(null,'Done');
		});
	});
```

### FuncQueue.complete(callback)
- Assigns a callback that will be executed at competition of all defined tasks.
- Callback is passed two arguments - Node.js 'error first' style:
	- Error value/object (if returned/thrown).
	- Array of results from each `addTask()` item in queue, unless error where result list will be `undefined`.

```js
myFuncQueue
	.complete((err,resultList) => {

		if (err) {
			// uh, oh an error
			console.log(resultList); // undefined
			return;
		}

		console.log(resultList);
	});
```
