'use strict';

var slice = Array.prototype.slice;


module.exports = function(parallelCount) {

	return new FuncQueue(parallelCount);
};

function FuncQueue(parallelCount) {

	this.parallelCount = parallelCount || 1;
	this.taskQueue = [];
	this.taskActiveCount = 0;
	this.resultList = [];
	this.completeCallback = null;
}

FuncQueue.prototype.addTask = function(callback) {

	if (this.taskQueue === false) {
		// queue finished - no more tasks allowed
		return;
	}

	if (callback) {
		// add task callback and arguments to new queue slot
		this.taskQueue.push([callback,slice.call(arguments,1)]);
	}

	// tasks on queue and less currently running than allowed maximum?
	while ((this.taskQueue.length > 0) && (this.taskActiveCount < this.parallelCount)) {
		// fetch next task from queue and create slot for result
		var nextTask = this.taskQueue.shift();
		this.resultList.push(undefined);

		// call task function on next tick and increment active task count
		process.nextTick(execTask.bind(
			this,
			nextTask[0],nextTask[1],
			this.resultList.length - 1 // the this.resultList store index for task
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

function execTask(taskFunc,argumentList,resultListIndex) {

	var self = this;

	// add complete callback to argument list
	argumentList.push(function(err,result) {

		// callback will finish up task on next tick
		process.nextTick(function() {

			execTaskComplete(
				self,resultListIndex,
				err,result
			);
		});
	});

	// call task
	taskFunc.apply(this,argumentList);
}

function execTaskComplete(self,resultListIndex,err,result) {

	if (self.taskQueue === false) {
		// if we enter this path - a prior task has called back in error
		// so throw away this, and any further returning callback task data
		return;
	}

	if (err) {
		// task callback returned error - complete queue right now, in error
		self.taskQueue = false;
		self.taskActiveCount = 0;
		callCompleteCallback(self,err);

		return;
	}

	// save result returned from task and decrement active task count
	self.resultList[resultListIndex] = result;
	self.taskActiveCount--;

	// further tasks in queue?
	if (self.taskQueue.length > 0) {
		// call add task method to execute more tasks if able
		self.addTask();

	} else if (self.taskActiveCount < 1) {
		// queue depleted and no active tasks - no more tasks accepted
		self.taskQueue = false;
		callCompleteCallback(self,null,self.resultList);
	}
}

function callCompleteCallback(self,err,resultList) {

	if (self.completeCallback) {
		// call complete callback after next tick
		process.nextTick(function() {

			self.completeCallback(err,resultList);
		});
	}
}
