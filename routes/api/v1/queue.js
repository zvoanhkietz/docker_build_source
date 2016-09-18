var sem = require('semaphore')(1);

/**
 * @return {[type]}
 */
module.exports = function() {

	/**
	 * [_queue description]
	 * @type {Array}
	 */
	var _queue = [];

	/**
	 * @return {[type]}
	 */
	this.getData = (()=>{
		return _queue;
	});

	/**
	 * @param  {[type]}
	 * @return {[type]}
	 */
	this.push = (data)=>{
		_queue.push(data);
		return this;
	};

	/**
	 * @return {[type]}
	 */
	this.pop = (callback)=>{
		sem.take(()=>{
			var data = _queue[0];
			_queue.splice(0, 1);
			sem.leave();
			callback(data);
		});
	};

	/**
	 * @return {[type]}
	 */
	this.isEmpty = ()=>{
		return (_queue.length == 0);
	};

	/**
	 * @return {[type]}
	 */
	this.empty = ()=>{
		_queue = [];
		return this;
	};
};