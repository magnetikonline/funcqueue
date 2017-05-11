'use strict';

class FuncQueue {

	constructor(parallelCount) {

		this.parallelCount = parallelCount || 1;
		this.taskQueue = [];
		this.taskActiveCount = 0;
		this.resultIndex = 0;
		this.resultCollection = undefined;
		this.completeCallback = null;
	}

	addTask(callback,...argumentList) {

		if (this.taskQueue === false) {
			// queue finished - no further tasks allowed
			return;
		}

		if (callback) {
			// add task callback and arguments to new queue slot
			this.taskQueue.push({callback,argumentList});
		}

		// if possible, queue next task
		queueTask(this);
		return this;
	}

	complete(callback) {

		if (this.completeCallback === null) {
			this.completeCallback = callback;
		}

		return this;
	}
}

function queueTask(funcQueue) {

	// tasks on queue and less currently running than desired maximum?
	while (
		(funcQueue.taskQueue.length > 0) &&
		(funcQueue.taskActiveCount < funcQueue.parallelCount)
	) {
		// fetch task from queue and call on next tick
		let {callback,argumentList} = funcQueue.taskQueue.shift();

		// call task on next tick and increment active task count
		process.nextTick(execTask.bind(
			null,
			funcQueue,
			callback,argumentList,
			funcQueue.resultIndex++
		));

		funcQueue.taskActiveCount++;
	}
}

function execTask(funcQueue,callback,argumentList,resultIndex) {

	let callbackHandled;

	// execute task, passing argument list and finish callback
	try {
		callback.call(
			funcQueue,...argumentList,
			(err,result) => {

				// ensures callback is called only once from task
				if (callbackHandled) {
					return;
				}

				// finish up task upon next tick
				callbackHandled = true;
				process.nextTick(execTaskComplete.bind(
					null,
					funcQueue,
					err,result,
					resultIndex
				));
			}
		);

	} catch (ex) {
		// caught thrown exception from task
		process.nextTick(execTaskComplete.bind(null,funcQueue,ex));
	}
}

function execTaskComplete(funcQueue,err,result,resultIndex) {

	if (funcQueue.taskQueue === false) {
		// if we enter this path a prior task has finished in error
		// so throw away this and any future returned task results
		return;
	}

	if (err) {
		// task callback returned error - finish queue right now in error & ignore result list
		return finishQueue(funcQueue,err);
	}

	// save result from task into collection index slot (if returned)
	if (result !== undefined) {
		if (funcQueue.resultCollection === undefined) {
			funcQueue.resultCollection = {};
		}

		funcQueue.resultCollection[resultIndex] = result;
	}

	// decrement active task count, queue further tasks
	funcQueue.taskActiveCount--;
	queueTask(funcQueue);

	if (funcQueue.taskActiveCount < 1) {
		// queue depleted - finish
		finishQueue(funcQueue,null);
	}
}

function finishQueue(funcQueue,err) {

	let hasCallback = (funcQueue.completeCallback !== null),
		resultCollection = funcQueue.resultCollection,
		resultList;

	if (!err && hasCallback) {
		// compile final result list from collection
		resultList = [];

		if (resultCollection !== undefined) {
			// if not a single result returned from all tasks - no need to work resultCollection
			let resultIndexCount = funcQueue.resultIndex;
			for (let resultIndex = 0;resultIndex < resultIndexCount;resultIndex++) {
				let resultValue = resultCollection[resultIndex];
				if (resultValue !== undefined) {
					resultList.push(resultValue);
				}
			}
		}
	}

	// setting (funcQueue.taskQueue === false) ensures no further tasks are allowed
	funcQueue.taskQueue = false;
	funcQueue.taskActiveCount = 0;
	funcQueue.resultCollection = undefined;

	if (hasCallback) {
		// call complete callback
		funcQueue.completeCallback(err,resultList);
	}
}

module.exports = FuncQueue;
