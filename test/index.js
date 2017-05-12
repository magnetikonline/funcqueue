'use strict';

let assert = require('assert'),
	util = require('util'),

	FuncQueue = require('../index.js'),

	SET_TIMEOUT_TEST_DELAY = 20;


function getSequenceList(limit) {

	let sequenceList = [];
	for (let seq = 1;seq <= limit;seq++) {
		sequenceList.push(seq);
	}

	return sequenceList;
}


{
	let TEST_RUN_PARALLEL_COUNT = 4,

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT),
		dummyFunction = () => {};

	assert(
		testFuncQueue.parallelCount == TEST_RUN_PARALLEL_COUNT,
		`Run parallel task count should equal $(TEST_RUN_PARALLEL_COUNT}`
	);

	assert(
		testFuncQueue.resultCollection === undefined,
		'Result collection should be undefined'
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
	testFuncQueue.complete(() => {});

	assert(
		testFuncQueue.completeCallback === dummyFunction,
		'Function for complete callback can only be set once'
	);
}


{
	let testFuncQueue = new FuncQueue(),
		activeTaskCount = 0;

	assert(
		testFuncQueue.parallelCount == 1,
		'Parallel task count should equal 1'
	);

	// dummy task with artificial callback delay (to simulate 'work')
	function testTask(returnValue,callback) {

		activeTaskCount++;

		setTimeout(
			() => {

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
	for (let number of getSequenceList(6)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6'],
			'Expected result list different to actual'
		);
	});
}


{
	let TEST_RUN_PARALLEL_COUNT = 4,
		TEST_RUN_WAVES = 3, // running 12 tasks total (4 * 3)

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT),
		workCallbackSimulatorList = [],
		activeTaskCount = 0;

	// dummy task with artificial callback delay (to simulate 'work')
	function testTask(expectedTaskCount,returnValue,callback) {

		activeTaskCount++;

		// push work item onto list
		workCallbackSimulatorList.push(() => {

			assert(
				activeTaskCount == expectedTaskCount,
				`Active running task count should be ${expectedTaskCount}`
			);

			activeTaskCount--;
			callback(null,returnValue);
		});
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
	{
		let expectedTaskCount = (TEST_RUN_PARALLEL_COUNT * TEST_RUN_WAVES);

		for (let number of getSequenceList(expectedTaskCount)) {
			testFuncQueue.addTask(
				testTask,
				// should never be more than TEST_RUN_PARALLEL_COUNT active tasks
				(expectedTaskCount > TEST_RUN_PARALLEL_COUNT)
					? TEST_RUN_PARALLEL_COUNT
					: expectedTaskCount,
				`Task ${number}`
			);

			expectedTaskCount--;
		}
	}

	testFuncQueue.complete((err,resultList) => {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6','Task 7','Task 8','Task 9','Task 10','Task 11','Task 12'],
			'Expected result list different to actual'
		);
	});

	// start work simulation
	setTimeout(runWorkCallbackLoop,SET_TIMEOUT_TEST_DELAY);
}


{
	let TEST_RUN_PARALLEL_COUNT = 8,

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT);

	// dummy task will callback at random timeouts, testing result list is in source task order
	function testTask(returnValue,callback) {

		setTimeout(
			() => {

				callback(null,returnValue);
			},
			Math.floor(Math.random() * SET_TIMEOUT_TEST_DELAY) + 1
		);
	}

	// queue up dummy tasks
	for (let number of getSequenceList(TEST_RUN_PARALLEL_COUNT * 25)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

		let expectedList = [];
		for (var number = 1,limit = (TEST_RUN_PARALLEL_COUNT * 25);number <= limit;number++) {
			expectedList.push(`Task ${number}`);
		}

		assert.deepEqual(
			resultList,expectedList,
			'Expected called task list different to actual'
		);
	});
}


{
	let testFuncQueue = new FuncQueue();

	// run a single task that returns no result
	testFuncQueue.addTask((callback) => {

		callback(null);
	});

	testFuncQueue.complete((err,resultList) => {

		assert(
			err === null,
			'Expected complete callback to receive null error object'
		);

		assert(
			Array.isArray(resultList) && (resultList.length == 0),
			'Complete callback should receive an empty result list array'
		);
	});
}


{
	let testFuncQueue = new FuncQueue();

	// run a single task that returns no result and passes nothing to callback()
	// still expect complete callback to receive error object of null
	testFuncQueue.addTask((callback) => {

		callback();
	});

	testFuncQueue.complete((err,resultList) => {

		assert(
			err === null,
			'Expected complete callback to receive null error object'
		);
	});
}


{
	let testFuncQueue = new FuncQueue();

	// dummy task which returns a result via callback - except for tasks 2 and 5
	function testTask(returnValue,callback) {

		if (['Task 2','Task 5'].includes(returnValue)) {
			// finish task without result returned
			// note: falling through to second callback() on purpose to confirm callback() can only be called once per task
			callback(null);
		}

		callback(null,returnValue);
	}

	// queue up dummy tasks
	for (let number of getSequenceList(12)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

		assert.deepEqual(
			resultList,
			['Task 1','Task 3','Task 4','Task 6','Task 7','Task 8','Task 9','Task 10','Task 11','Task 12'],
			'Expected result list different to actual'
		);
	});
}


{
	let TEST_RUN_PARALLEL_COUNT = 4,

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT),
		taskError = new Error('Task error');

	testFuncQueue.addTask((callback) => {

		callback(null,'Task success');
	});

	testFuncQueue.addTask((callback) => {

		callback(taskError);
	});

	testFuncQueue.complete((err,resultList) => {

		assert(
			err === taskError,
			'Expected complete callback to receive thrown error'
		);

		assert(
			resultList === undefined,
			'Complete callback should receive no results upon error raised'
		);
	});
}


{
	let TEST_RUN_PARALLEL_COUNT = 4,

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT),
		taskCalledList = [],
		taskSuccessList = [];

	// dummy task will simulate failure on the 3rd task called
	function testTask(returnValue,callback) {

		taskCalledList.push(returnValue);

		if (returnValue == 'Task 3') {
			return callback(new Error('Task error'));
		}

		callback(null,returnValue);
		taskSuccessList.push(returnValue);
	}

	// queue up dummy tasks
	for (let number of getSequenceList(16)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

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
}


{
	let testFuncQueue = new FuncQueue(),
		taskError = new Error('Task error'),
		taskCalledList = [],
		taskSuccessList = [];

	// dummy task will throw an error on 6th task called
	function testTask(returnValue,callback) {

		taskCalledList.push(returnValue);

		if (returnValue == 'Task 6') {
			throw taskError;
		}

		callback(null,returnValue);
		taskSuccessList.push(returnValue);
	}

	// queue up dummy tasks
	for (let number of getSequenceList(16)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

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
			err === taskError,
			'Expected complete callback to receive thrown error'
		);

		assert(
			resultList === undefined,
			'Complete callback should receive no results upon error raised'
		);
	});
}


{
	let testFuncQueue = new FuncQueue();

	// dummy task which returns a result via callback - then calls callback again with error
	// this second callback should be ignored by FuncQueue instance
	function testTask(returnValue,callback) {

		callback(null,returnValue);
		callback(new Error('Task error'));
	}

	// queue up dummy tasks
	for (let number of getSequenceList(6)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

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
}


{
	let TEST_RUN_PARALLEL_COUNT = 4,

		testFuncQueue = new FuncQueue(TEST_RUN_PARALLEL_COUNT);

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
	for (let number of getSequenceList(6)) {
		testFuncQueue.addTask(testTask,`Task ${number}`);
	}

	testFuncQueue.complete((err,resultList) => {

		assert.deepEqual(
			resultList,
			['Task 1','Task 2','Task 3','Task 4','Task 5','Task 6','Additional task 1','Additional task 2'],
			'Expected result list different to actual'
		);
	});
}
