'use strict';

var SET_TIMEOUT_TEST_DELAY = 20,

	assert = require('assert'),
	util = require('util'),

	funcQueue = require('../index.js');


function getArraySequenceList(limit) {

	var sequenceList = [];
	for (var seq = 1;seq <= limit;seq++) {
		sequenceList.push(seq);
	}

	return sequenceList;
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
		Object.keys(testFuncQueue.resultCollection).length == 0,
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

	// try to assign a different complete callback function
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
					'Active running task count should never exceed 1'
				);

				activeTaskCount--;
				callback(null,returnValue);
			},
			SET_TIMEOUT_TEST_DELAY
		);
	}

	// queue up dummy tasks
	getArraySequenceList(6).forEach(function(number) {

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
		TEST_RUN_WAVES = 3, // running 12 tasks total (4 * 3)
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT),
		workCallbackSimulatorList = [],
		activeTaskCount = 0;

	// dummy task with artificial callback delay (to simulate 'work')
	function testTask(expectedTaskCount,returnValue,callback) {

		activeTaskCount++;

		workCallbackSimulatorList.push(
			function() {

				assert(
					activeTaskCount == expectedTaskCount,
					'Active running task count should be ' + expectedTaskCount
				);

				activeTaskCount--;
				callback(null,returnValue);
			}
		);
	}

	function runWorkCallbackLoop() {

		// call back next work task
		workCallbackSimulatorList.shift()();

		// queue up next loop if more work items in list
		if (workCallbackSimulatorList.length > 0) {
			setTimeout(runWorkCallbackLoop,SET_TIMEOUT_TEST_DELAY);
		}
	}

	// queue up dummy tasks
	var expectedTaskCount = (TEST_RUN_PARALLEL_COUNT * TEST_RUN_WAVES);
	getArraySequenceList(TEST_RUN_PARALLEL_COUNT * TEST_RUN_WAVES).forEach(function(number) {

		testFuncQueue.addTask(
			testTask,
			(expectedTaskCount > TEST_RUN_PARALLEL_COUNT)
				? TEST_RUN_PARALLEL_COUNT
				: expectedTaskCount,
			'Task ' + number
		);

		expectedTaskCount--;
	});

	testFuncQueue.complete(function(err,resultList) {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6','Task 7','Task 8','Task 9','Task 10','Task 11','Task 12'],
			'Expected result list different to actual'
		);
	});

	// kick off the work simulation
	setTimeout(runWorkCallbackLoop,SET_TIMEOUT_TEST_DELAY);
})();


(function() {

	var testFuncQueue = funcQueue();

	// dummy task which returns a result via callback - except for tasks 2 and 5
	function testTask(returnValue,callback) {

		if (
			(returnValue != 'Task 2') &&
			(returnValue != 'Task 5')
		) {
			return callback(null,returnValue);
		}

		// finish task without result returned
		callback(null);
	}

	// queue up dummy tasks
	getArraySequenceList(12).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		assert.deepEqual(
			resultList,
			['Task 1','Task 3','Task 4','Task 6','Task 7','Task 8','Task 9','Task 10','Task 11','Task 12'],
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

			callback(taskErrorObj);
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
	getArraySequenceList(16).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		// note: tasks are queued to TEST_RUN_PARALLEL_COUNT chunks
		// thus number of called tasks will be beyond that of task returning error
		assert.deepEqual(
			taskCalledList,
			['Task 1','Task 2','Task 3','Task 4'],
			'Expected called task list different to actual'
		);

		assert.deepEqual(
			taskSuccessList,
			['Task 1','Task 2','Task 4'],
			'Expected success task list different to actual'
		);
	});
})();


(function() {

	var testFuncQueue = funcQueue(),
		taskErrorObj = new Error('Task error'),
		taskCalledList = [],
		taskSuccessList = [];


	// dummy task will throw an error on 6th task called
	function testTask(returnValue,callback) {

		taskCalledList.push(returnValue);

		if (returnValue == 'Task 6') {
			throw taskErrorObj;

		} else {
			callback(null,returnValue);
			taskSuccessList.push(returnValue);
		}
	}

	// queue up dummy tasks
	getArraySequenceList(16).forEach(function(number) {

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
			['Task 1','Task 2','Task 3','Task 4','Task 5'],
			'Expected success task list different to actual'
		);

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

	var testFuncQueue = funcQueue();

	// dummy task which returns a result via callback - then calls callback again with error
	// this second callback should be ignored - which is what we are testing
	function testTask(returnValue,callback) {

		callback(null,returnValue);
		callback(new Error('Task error'));
	}

	// queue up dummy tasks
	getArraySequenceList(6).forEach(function(number) {

		testFuncQueue.addTask(testTask,'Task ' + number);
	});

	testFuncQueue.complete(function(err,resultList) {

		assert(
			err === null,
			'Error returned expected to be null (no error)'
		);

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6'],
			'Expected result list different to actual'
		);
	});
})();


(function() {

	var TEST_RUN_PARALLEL_COUNT = 4,
		testFuncQueue = funcQueue(TEST_RUN_PARALLEL_COUNT);


	// dummy task will add additional tasks on the fourth and fifth calls
	function testTask(returnValue,callback) {

		if (returnValue == 'Task 4') {
			this.addTask(testTask,'Additional task 1');
		}

		if (returnValue == 'Task 5') {
			this.addTask(testTask,'Additional task 2');
		}

		callback(null,returnValue);
	}

	// queue up dummy tasks
	getArraySequenceList(6).forEach(function(number) {

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
