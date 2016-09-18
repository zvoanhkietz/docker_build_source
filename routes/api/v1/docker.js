var Queue = require('./queue');
var exec =  require('child_process').exec;
var async = require("async");
var request = require("request");
var fs = require("fs");

/**
 * [queue description]
 * @type {[type]}
 */
module.exports = (()=>{


	/**
	 * Max number of jobs per docker
	 * @type {Number}
	 */
	const MAX_TASKS = 2;

	/**
	 * [NUM_DOCKER description]
	 * @type {Number}
	 */
	const NUM_DOCKER = 3;


	/**
	 * [RESULT_FAIL description]
	 * @type {Number}
	 */
	const RESULT_FAIL = 0;

	/**
	 * [RESULT_PASS description]
	 * @type {Number}
	 */
	const RESULT_PASS = 1;

	/**
	 * [RESULT_COMPILE_ERROR description]
	 * @type {Number}
	 */
	const RESULT_COMPILE_ERROR = 2;

	/**
	 * [PATH_RESOURCE description]
	 * @type {String}
	 */
	const PATH_RESOURCE = '/home/source_code/';

	/**
	 * [DOCKER_PATH_RESOURCE description]
	 * @type {String}
	 */
	const DOCKER_PATH_RESOURCE = '/src/';

	/**
	 * [_queue description]
	 * @type {[type]}
	 */
	var _queue = new Queue();

	/**
	 * Store list callbacks
	 * 
	 * @type {Object}
	 */
	var _callbacks = {};

	/**
	 * List job of docker
	 * 
	 * @type {Array}
	 */
	var _docker = Array(NUM_DOCKER).fill(0);


	/**
	 * Dispatch
	 * 
	 * @param  {[type]}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function dispatch(event, data){
		var chains = _callbacks[event] || [];
		// run callback function
		chains.forEach((callback)=>{
			callback(data);
		});
	}

	/**
	 * Get docker min job
	 * 
	 * @return {[type]}
	 */
	function dockerMinTasks(){
		var min = 0;
		for(var i = 1; i < NUM_DOCKER; i++){
			if(_docker[i] < _docker[min]){
				min = i;
			}
		}
		return min;
	}

	/**
	 * 
	 * @return {[type]}
	 */
	function upTask(index, step){
		step = step || 1;
		_docker[index] += step;
		dispatch('upTask', _docker);
	}

	/**
	 * 
	 * @return {[type]}
	 */
	function downTask(index, step){
		step = step || 1;
		_docker[index] -= step;
		dispatch('downTask', _docker);
	}


	/**
	 * 
	 * @return {Boolean}
	 */
	function dockerIsBusy(){
		var min = dockerMinTasks();
		return (_docker[min] >= MAX_TASKS);
	}


	/**
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function getExt(lang){
		switch(lang){
			case 'php': return 'php';
		}
	}

	/**
	 * Create command for execute
	 * 
	 * @param  {[type]}
	 * @param  {[type]}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function createCommandLine(docker, lang, sourceFile, inputFile){
		switch(lang){
			// TODO: apply docker command line
			case 'php': return 'php ' + sourceFile + '<' + inputFile;
		}
	}


	/**
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function getContainerName(dockerX){
		return "docker" + (dockerX + 1);
	}

	/**
	 * Check result after execute
	 * 
	 * @param  {[type]}
	 * @param  {[type]}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function parseResult(error, stdout, stderr, expected){
		var message = 'Pass';
		var status = RESULT_PASS;
		if( error ){
			// compile error
			message = stderr;
			status = RESULT_COMPILE_ERROR;
		}else if(stdout != expected){
			// compare not same with expected
			message = 'Output don\'t match with expected';
			status = RESULT_FAIL;
		}else if(stdout == expected){
			// Passs
			message = 'Pass';
			status = RESULT_PASS;
		}else{
			// other
		}
		return {result: status, message: message};
	}

	/**
	 * Run all testcases
	 * 
	 * @param  {[type]}
	 * @param  {[type]}
	 * @param  {Function}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function runTest(dockerX, data, callback , index, messages){
		index = index || 0;
		messages = messages || [];
		if(index >= data.cases.length){
			return callback(RESULT_PASS, messages);
		}

		// create commandline execute
		var testCase = data.cases[index];
		var commandLine = createCommandLine(
			dockerX, 
			data.lang, 
			data.pathToSourceCode, 
			testCase.pathToInputFile
		);
		exec(commandLine, (error, stdout, stderr)=>{
			var v = parseResult(error, stdout, stderr, testCase.output);
			messages.push(v.message);
			if(v.result === RESULT_PASS){
				runTest(dockerX, data, callback, index + 1, messages);
			}else{
				callback(v.result, messages);
			}
		});
		
	}

	/**
	 * Start tasks management
	 * @return {[type]}
	 */
	function startTasksManagement(){
		// check docker is empty
		if(_queue.isEmpty()){
			return dispatch('free', null);
		}

		// check docker is busy
		if(dockerIsBusy()){
			return dispatch('busy', {
				docker: _docker, 
				queue: _queue
			});
		}

		// run test
		var rdata = null;
		var dockerX = null;
		var pathToResource = null;
		var sourceCode = null;
		async.series([
			// get data from first of queue
			(callback) => {
				_queue.pop(function(d){
					rdata = d;
					callback();
				});
			},

			// create folder contain resource
			(callback) => {
				pathToResource = PATH_RESOURCE + '/' 
					+ rdata.user + '/' 
					+ rdata.question_id + '/';
				var cmdCreateFolder = 'mkdir -p ' + pathToResource;
				exec(commandLine, (error, stdout, stderr)=>{
					if(error)return callback(error);
					callback();
				});
			},

			// request source file
			(callback) => {
				request(rdata.source_file, function (error, response, body) {
					if(error) return callback(error);
					sourceCode = response.body;
					callback();
				})
			},

			// create resource from source and cases
			(callback) => {
				// create source file
				var pathToSourceCode = pathToResource + "Main" + getExt(rdata.language);
				fs.writeFile(pathToSourceCode, sourceCode, (err) => {
				    if(err) return callback(err);
				    rdata.pathToSourceCode = pathToSourceCode;
				    callback();
				});

				// create input file
				rdata.cases.forEach((v, k) => {
					var pathToInputFile = pathToResource + "input_" + k;
					fs.writeFile(pathToInputFile, v.input, (err) => {
					    if(err) return callback(err);
					    rdata.cases[k].pathToInputFile = pathToInputFile;
					    callback();
					});
				});
			},

			// copy to docker
			(callback) => {
				// before run test
				dockerX = dockerMinTasks();
				upTask(dockerX);

				// copy resource to docker
				var pathToDocker = pathToResource.replace(
					PATH_RESOURCE, 
					DOCKER_PATH_RESOURCE
				);
				var containerId = getContainerName(dockerX);
				var cmdCopyFolder = 'docker cp ' 
					+ containerId + ':' 
					+ pathToDocker + ' ' 
					+ pathToResource;
				exec(cmdCopyFolder, (error, stdout, stderr)=>{
					if(error)return callback(error);
					callback();
				});

			},

			// rename path to source --> path to docer
			(callback) => {
				rdata.pathToSourceCode = rdata.pathToSourceCode.replace(
					PATH_RESOURCE, 
					DOCKER_PATH_RESOURCE
				);
				rdata.cases.forEach((v, k) => {
					rdata.cases[k].pathToInputFile = v.pathToInputFile.replace(
						PATH_RESOURCE, 
						DOCKER_PATH_RESOURCE
					);
				});
			},

			// run test
			(callback) => {
				runTest(dockerX, rdata, (result, messages) => {
					// sent to confirm done
					dispatch('execDone', { 
						onDocker: dockerX, 
						data: rdata, 
						result: result, 
						messages: messages 
					});
					downTask(dockerX);
					callback();
				});
			}
		], 
		(err) => {
			// stop incase error system
			if(err) return new Error(err);

			// run to the next task
			startTasksManagement();
		});

	}

	/**
	 * Public methods and properties
	 */
	return {
		on: (event, callback)=>{
			_callbacks[event] = _callbacks[event] || [];
			_callbacks[event].push(callback);
			return this;
		},
		build: (data)=>{
			_queue.push(data);
			startTasksManagement();
			return this;
		}
	};
})();