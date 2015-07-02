# Funcqueue
A really low-fi function queue manager module for Node.js to ease the pain of building asynchronous code. Yep, there are hundreds of these already - here is another.

NPM: https://www.npmjs.com/package/funcqueue

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
Create a new function queue. The `parallelCount` argument controls how many tasks will be executed at any one moment, if not given will default to `1` - thus all tasks will run serially.

### funcQueue.addTask(callback[,arguments...])
Adds a new task function `callback` to the queue. Optional `arguments` can also be passed to the task function.

Task upon execution will receive all arguments defined by `addTask()` along with a callback function which *must* be called at completion of task to notify funcQueue instance.

This callback in turn accepts two optional arguments, an error (if any) and a computed result back from the task - keeping in the style of Node.js 'error first' callbacks.

If an error is passed to this callback, currently running parallel tasks will continue then silently complete - whilst further tasks in the queue will *not* execute.

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

In addition, task callbacks will be passed their associated funcQueue instance - this allows for the chaining of further conditional tasks from within task items themselves. For example:

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
Assigns a callback that will be executed at competition of all defined tasks. This callback will be passed two arguments (Node.js 'error first' style), an error (if any) and an array of results from each task executed returned via its callback.

In the case of an error being returned from any task, the result list will be `undefined`:

```js
myFuncQueue.complete(function(err,resultList) {

	if (err) {
		// uh, oh an error
		console.log(resultList); // undefined
		return;
	}

	console.dir(resultList);
}
```
