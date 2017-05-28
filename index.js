'use strict';

class FuncQueue {

	constructor(parallelCount) {

		// validate parallelCount
		parallelCount = parallelCount || 1;
		if (typeof parallelCount != 'number') {
			throw new TypeError('Expected a numeric value for parallel count');
		}

		parallelCount = Math.floor(parallelCount);
		if (parallelCount <= 0) {
			throw new RangeError('Parallel count must be a value greater than zero');
		}

		this.parallelCount = parallelCount;
		this.taskQueue = [];
		this.taskActiveCount = 0;

		this.resultIndex = 0;
		this.resultList = [];
		this.resultIndexList = [];

		this.completeCallback = null;
	}

	addTask(callback,...argumentList) {

		// callback given a function?
		if (!isFunction(callback)) {
			throw new TypeError('Callback must be a function');
		}

		if (this.taskQueue === false) {
			// queue finished - no further tasks allowed
			return;
		}

		// add task callback and arguments to queue slot - if possible, queue next task
		this.taskQueue.push({callback,argumentList});
		queueTask(this);

		return this;
	}

	complete(callback) {

		// callback given a function?
		if (!isFunction(callback)) {
			throw new TypeError('Callback must be a function');
		}

		if (this.completeCallback === null) {
			this.completeCallback = callback;
		}

		return this;
	}
}

function isFunction(value) {

	return (typeof value == 'function');
}

function queueTask(funcQueue) {

	// tasks on queue and less currently running than desired maximum?
	while (
		(funcQueue.taskQueue.length > 0) &&
		(funcQueue.taskActiveCount < funcQueue.parallelCount)
	) {
		// fetch task from queue and call on next tick
		let {callback,argumentList} = funcQueue.taskQueue.shift();

		// start task on next tick
		funcQueue.taskActiveCount++;
		process.nextTick(
			execTask,
			funcQueue,
			callback,argumentList,
			funcQueue.resultIndex++
		);
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
				process.nextTick(
					execTaskComplete,
					funcQueue,
					err,result,
					resultIndex
				);
			}
		);

	} catch (ex) {
		// caught thrown exception from task
		process.nextTick(
			execTaskComplete,
			funcQueue,ex
		);
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

	if (result !== undefined) {
		// save task result
		let {resultList,resultIndexList} = funcQueue,
			indexLength = resultIndexList.length;

		// if resultIndex greater than current list, push onto end (less work)
		if (
			(indexLength < 1) ||
			(resultIndexList[indexLength - 1] < resultIndex)
		) {
			resultList.push(result);
			resultIndexList.push(resultIndex);

		} else {
			// find index to insert result value at
			let insertAt = resultIndexListInsertAt(resultIndex,resultIndexList,0,indexLength);
			resultList.splice(insertAt,0,result);
			resultIndexList.splice(insertAt,0,resultIndex);
		}
	}

	// decrement active task count, queue further tasks
	funcQueue.taskActiveCount--;
	queueTask(funcQueue);

	if (funcQueue.taskActiveCount < 1) {
		// queue depleted - finish
		finishQueue(funcQueue,null);
	}
}

function resultIndexListInsertAt(resultIndex,resultIndexList,low,high) {

	if (low == high) {
		// hit end of list - done
		return low;
	}

	// get midpoint of list and result index value
	let mid = low + Math.floor((high - low) / 2),
		itemCompare = resultIndexList[mid];

	if (resultIndex > itemCompare) {
		// work higher end of list
		return resultIndexListInsertAt(resultIndex,resultIndexList,mid + 1,high);
	}

	if (resultIndex < itemCompare) {
		// work lower end of list
		return resultIndexListInsertAt(resultIndex,resultIndexList,low,mid);
	}

	// found equal value - done
	return mid;
}

function finishQueue(funcQueue,err) {

	// setting (funcQueue.taskQueue === false) ensures no further tasks are allowed
	funcQueue.taskQueue = false;
	funcQueue.taskActiveCount = 0;
	funcQueue.resultIndexList = null;

	if (funcQueue.completeCallback !== null) {
		// call complete callback
		funcQueue.completeCallback(
			err,
			(err) ? undefined : funcQueue.resultList
		);
	}

	funcQueue.resultList = null;
}

module.exports = FuncQueue;
