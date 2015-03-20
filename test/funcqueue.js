'use strict';

var SET_TIMEOUT_TEST_DELAY = 20,

	assert = require('assert'),
	util = require('util'),

	funcQueue = require('../funcqueue.js');


function getArraySequence(limit) {

	var sequence = [];
	for (var seq = 1;seq <= limit;seq++) {
		sequence.push(seq);
	}

	return sequence;
}

(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT),
		dummyFunction = function() {};

	assert(
		testFuncQueue.parallelCount == TEST_RUN_PARALLEL_COUNT,
		'Run parallel task count should equal ' + TEST_RUN_PARALLEL_COUNT
	);

	assert(
		testFuncQueue.resultList.length == 0,
		'Result list should be empty'
	);

	assert(
		testFuncQueue.addTask() === testFuncQueue,
		'Function addTask() should return itself'
	);

	assert(
		testFuncQueue.complete(dummyFunction) === testFuncQueue,
		'Function complete() should return itself'
	);

	testFuncQueue.complete(function() {});

	assert(
		testFuncQueue.completeCallback === dummyFunction,
		'Function for complete callback can only be set once'
	);
})();


(function() {

	var testFuncQueue = funcQueue(),
		activeTaskCount = 0;

	assert(
		testFuncQueue.parallelCount == 1,
		'Parallel task count should equal 1'
	);

	// dummy task with artificial callback delay (to simulate 'work')
	function testTask(returnValue,callback) {

		activeTaskCount++;

		setTimeout(
			function() {

				assert(
					activeTaskCount == 1,
					'Active running task count should not exceed 1'
				);

				activeTaskCount--;
				callback(null,returnValue);
			},
			SET_TIMEOUT_TEST_DELAY
		);
	}

	// queue up dummy tasks
	getArraySequence(6).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6'],
			'Expected result list different to actual'
		);
	});
})();


(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT),
		activeTaskCount = 0;

	// dummy task with artificial callback delay (to simulate 'work')
	function testTask(expectedTaskCount,returnValue,callback) {

		activeTaskCount++;

		setTimeout(
			function() {

				assert(
					activeTaskCount == expectedTaskCount,
					'Active running task count should be ' + expectedTaskCount
				);

				activeTaskCount--;
				callback(null,returnValue);
			},
			SET_TIMEOUT_TEST_DELAY
		);
	}

	// queue up dummy tasks
	var expectedTaskCount = TEST_RUN_PARALLEL_COUNT;
	getArraySequence(8).forEach(function(number) {

		testFuncQueue.addTask(testTask,expectedTaskCount--,'Task ' + number);
		if (expectedTaskCount < 1) expectedTaskCount = TEST_RUN_PARALLEL_COUNT;
	});

	testFuncQueue.complete(function(err,resultList) {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6','Task 7','Task 8'],
			'Expected result list different to actual'
		);
	});
})();


(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT),
		taskErrorObj = new Error('Task error');

	testFuncQueue.addTask(
		function(callback) {

			callback(null,'Task success');
		}
	);

	testFuncQueue.addTask(
		function(callback) {

			callback(taskErrorObj,'Task fail');
		}
	);

	testFuncQueue.complete(function(err,resultList) {

		assert(
			err === taskErrorObj,
			'Expected complete callback to receive thrown error'
		);

		assert(
			resultList === undefined,
			'Complete callback should receive no results upon error raised'
		);
	});
})();


(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT),
		taskCalledList = [],
		taskSuccessList = [];


	// dummy task will simulate failure on the 3rd task called
	function testTask(returnValue,callback) {

		taskCalledList.push(returnValue);

		if (returnValue == 'Task 3') {
			callback(new Error('Task error'));

		} else {
			callback(null,returnValue);
			taskSuccessList.push(returnValue);
		}
	}

	// queue up dummy tasks
	getArraySequence(16).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		// note: tasks are queued to TEST_RUN_PARALLEL_COUNT chunks
		// thus number of called tasks will be beyond that of task returning error
		assert.deepEqual(
			taskCalledList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6'],
			'Expected called task list different to actual'
		);

		assert.deepEqual(
			taskSuccessList,
			['Task 1','Task 2','Task 4','Task 5','Task 6'],
			'Expected success task list different to actual'
		);
	});
})();


(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT);


	// dummy task will simulate failure on the 3rd task called
	function testTask(returnValue,callback) {

		console.log(returnValue);

		if (returnValue == 'Task 4') {
			this.addTask(testTask,'Additional task 1');
		}

		if (returnValue == 'Task 5') {
			this.addTask(testTask,'Additional task 2');
		}

		callback(null,returnValue);
	}

	// queue up dummy tasks
	getArraySequence(6).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6','Additional task 1','Additional task 2'],
			'Expected result list different to actual'
		);
	});
})();
