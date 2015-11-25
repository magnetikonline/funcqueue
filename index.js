'use strict';

var slice = Array.prototype.slice;


module.exports = function(parallelCount) {

	return new FuncQueue(parallelCount);
};

function FuncQueue(parallelCount) {

	this.parallelCount = parallelCount || 1;
	this.taskQueue = [];
	this.taskActiveCount = 0;
	this.resultIndex = 0;
	this.resultCollection = {};
	this.haveResult = false;
	this.completeCallback = null;
}

FuncQueue.prototype.addTask = function(callback) {

	if (this.taskQueue === false) {
		// queue finished - no further tasks allowed
		return;
	}

	if (callback) {
		// add task callback and arguments to new queue slot
		this.taskQueue.push([callback,slice.call(arguments,1)]);
	}

	// tasks on queue and less currently running than desired maximum?
	while ((this.taskQueue.length > 0) && (this.taskActiveCount < this.parallelCount)) {
		// fetch task from queue and call on next tick
		var nextTask = this.taskQueue.shift();

		// call task on next tick and increment active task count
		process.nextTick(execTask.bind(
			this,
			nextTask[0],nextTask[1],
			this.resultIndex++
		));

		this.taskActiveCount++;
	}

	// return self, allowing chaining
	return this;
};

FuncQueue.prototype.complete = function(callback) {

	if (!this.completeCallback) {
		this.completeCallback = callback;
	}

	// return self, allowing chaining
	return this;
};

function execTask(task,argumentList,resultIndex) {

	var self = this,
		callbackHandled;

	// execute task - adding 'complete' callback function to argument list
	try {
		task.apply(this,argumentList.concat(
			function(err,result) {

				// ensures callback is called only once from task
				if (callbackHandled) {
					return;
				}

				// finish up task upon next tick
				callbackHandled = true;
				process.nextTick(function() {

					execTaskComplete(
						self,err,result,
						resultIndex
					);
				});
			}
		));

	} catch (ex) {
		// caught thrown exception from task
		process.nextTick(function() {

			execTaskComplete(self,ex);
		});
	}
}

function execTaskComplete(self,err,result,resultIndex) {

	if (self.taskQueue === false) {
		// if we enter this path a prior task has finished in error
		// so throw away this and any future returned task results
		return;
	}

	if (err) {
		// task callback returned error - finish queue right now in error & ignore result list
		return finishQueue(self,err);
	}

	// save result from task into collection index slot (if returned) & decrement active task count
	if (result !== undefined) {
		self.resultCollection[resultIndex] = result;
		self.haveResult = true;
	}

	self.taskActiveCount--;

	// further tasks in queue?
	if (self.taskQueue.length > 0) {
		// call add task method to execute any further available tasks
		self.addTask();

	} else if (self.taskActiveCount < 1) {
		// queue depleted and no active tasks - no more tasks accepted
		finishQueue(self,null,self.resultCollection);
	}
}

function finishQueue(self,err,resultCollection) {

	// compile final result list from collection
	var resultList;

	if (!err && self.haveResult) {
		// if not a single result returned from all tasks - no need to work resultCollection
		resultList = [];

		for (var resultIndex = 0,resultIndexCount = self.resultIndex;resultIndex < resultIndexCount;resultIndex++) {
			var resultValue = resultCollection[resultIndex];
			if (resultValue !== undefined) {
				resultList.push(resultValue);
			}
		}
	}

	// ensure no further tasks can be added to queue
	self.taskQueue = false;
	self.taskActiveCount = 0;
	self.resultCollection = null;

	if (self.completeCallback) {
		// call complete callback
		self.completeCallback(err,resultList);
	}
}
