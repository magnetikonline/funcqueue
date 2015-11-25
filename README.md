# Funcqueue
A really low-fi function queue manager module for Node.js to ease the pain of building asynchronous code. Yep, there are hundreds of these already - here is another.

[![NPM](https://nodei.co/npm/funcqueue.png?downloads=true)](https://nodei.co/npm/funcqueue/)

- [Usage](#usage)
- [Methods](#methods)
	- [funcQueue(parallelCount)](#funcqueueparallelcount)
	- [funcQueue.addTask(callback[,arguments...])](#funcqueueaddtaskcallbackarguments)
	- [funcQueue.complete(callback)](#funcqueuecompletecallback)

## Usage

```js
var funcQueue = require('funcqueue'),
	myFuncQueue = funcQueue();

function demoTask(param,callback) {

	console.log('Hello from task ' + param);
	callback(null,param);
}

myFuncQueue.complete(
	function(err,resultList) {

		console.log('All done!');
		console.dir(resultList);
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

### funcQueue(parallelCount)
- Creates a new function queue.
- The `parallelCount` argument controls how many tasks will be executing at any one moment, if not defined will default to `1` - thus tasks will run serially.

### funcQueue.addTask(callback[,arguments...])
- Adds a new task function `callback` to the queue. Optional `arguments` can be passed to the function.
- Upon execution task will receive all passed arguments, along with a callback function which *must* be called at completion of task to notify funcQueue instance.
- Task callback in turn accepts two optional arguments - an error (if any raised) and a task result - keeping in the style of Node.js 'error first' callbacks.
- Any errors _thrown_ by task functions will be caught by funcQueue and trigger the error path (e.g. same behaviour as passing an error to task callback).
- A task is not required to return a result - in this instance `undefined` is passed, it will be ommited from the result list passed to [funcQueue.complete(callback)](#funcqueuecompletecallback).
- In the case of an error returned, currently running parallel tasks will continue to completion with their resutls ignored - future queue tasks will *not* be executed.

As an example:

```js
myFuncQueue.addTask(
	function(param1,param2,callback) {

		console.log('Task called with: ' + param1 + ' and: ' + param2);

		setTimeout(
			function() { callback(null,'My computed result'); },
			2000
		);
	},
	'First parameter passed',
	'Second parameter passed'
);
```

In addition, task callbacks will be passed their parent funcQueue instance - allowing for the chaining of further conditional tasks from within tasks themselves:

```js
myFuncQueue.addTask(
	function(callback) {

		var self = this;

		someReallyComplexAsyncCalculation(function(err,result) {

			if (result > 15) {
				// add an additional funcQueue task
				self.addTask(resultAbove15Task);
			}

			callback(null,'Done');
		});
	}
);
```

### funcQueue.complete(callback)
- Assigns a callback that will be executed at the competition of all defined tasks.
- Callback is passed two arguments (Node.js 'error first' style) - an error (if any) and array of not `undefined` results from each task executed in queue.
- In the case of an error being returned from any task, result list will be `undefined`:

```js
myFuncQueue.complete(function(err,resultList) {

	if (err) {
		// uh, oh an error
		console.log(resultList); // prints undefined
		return;
	}

	console.dir(resultList);
}
```
